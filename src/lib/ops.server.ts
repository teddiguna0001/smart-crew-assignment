import { createClient } from "@supabase/supabase-js";
import { DAY_PLAN, minutesToClock } from "@/lib/day-plan";
import {
  autoAssign,
  planToTrips,
  runScenario,
  simulateDisruption,
  type Assignment,
  type AssignmentPlan,
  type BusRecord,
  type CrewRecord,
  type DisruptionInput,
  type DisruptionImpact,
  type ScenarioInput,
} from "@/lib/ops-engine";

/* ------------------------------------------------------------------ *
 * Server-only operations layer.
 *
 * Loads the real fleet/crew records from the database, runs the pure
 * ops engine against the operating-day trip plan and persists the
 * resulting assignments, resource states and incident records.
 * ------------------------------------------------------------------ */

export function serverDb() {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`)
          h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

type Db = ReturnType<typeof serverDb>;

export interface DisruptionRow {
  id: string;
  reference: string;
  route_number: string;
  disruption_type: string;
  severity: string;
  start_min: number;
  duration_min: number;
  location: string | null;
  description: string | null;
  status: string;
  affected_trips: number;
  affected_bus_ids: string[];
  affected_crew_ids: string[];
  recovered_trips: number;
  unrecovered_trips: number;
  recovery_rate_pct: number;
  added_delay_min: number;
  passengers_impacted: number;
  impact: DisruptionImpact;
  resolved_at: string | null;
  created_at: string;
}

export interface AssignmentRow {
  id: string;
  trip_id: string;
  trip_code: string;
  route_number: string;
  origin: string | null;
  destination: string | null;
  depot: string;
  start_min: number;
  end_min: number;
  bus_id: string | null;
  bus_label: string | null;
  driver_id: string | null;
  driver_name: string | null;
  conductor_id: string | null;
  conductor_name: string | null;
  delay_min: number;
  same_depot: boolean;
  source: string;
  disruption_id: string | null;
  created_at: string;
}

export interface ScenarioRow {
  id: string;
  label: string;
  input: ScenarioInput;
  result: ReturnType<typeof runScenario>;
  applied: boolean;
  applied_at: string | null;
  created_at: string;
}

/* --------------------------- resource load ------------------------- */

export async function loadResources(db: Db) {
  const [busRes, crewRes] = await Promise.all([
    db.from("buses").select("*").order("bus_code"),
    db.from("crew").select("*").order("crew_code"),
  ]);
  if (busRes.error) throw new Error(busRes.error.message);
  if (crewRes.error) throw new Error(crewRes.error.message);

  const buses = (busRes.data ?? []) as unknown as (BusRecord & { capacity: number })[];
  const crew = (crewRes.data ?? []) as unknown as CrewRecord[];
  return { buses, crew };
}

export async function activeDisruptions(db: Db): Promise<DisruptionRow[]> {
  const { data, error } = await db
    .from("disruptions")
    .select("*")
    .eq("status", "ACTIVE")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as DisruptionRow[];
}

const TRIPS = planToTrips(DAY_PLAN);
const tripById = new Map(DAY_PLAN.map((t) => [t.id, t]));

export function dayTrips() {
  return TRIPS;
}

/** Assignment plan that already respects every currently active incident. */
export function planWithDisruptions(
  buses: BusRecord[],
  crew: CrewRecord[],
  disruptions: DisruptionRow[],
): AssignmentPlan {
  return autoAssign(TRIPS, buses, crew, {
    excludeBusIds: disruptions.flatMap((d) => d.affected_bus_ids ?? []),
    excludeCrewIds: disruptions.flatMap((d) => d.affected_crew_ids ?? []),
    closures: disruptions.map((d) => ({
      routeNumber: d.route_number,
      startMin: d.start_min,
      endMin: d.start_min + d.duration_min,
    })),
  });
}

/* ---------------------------- persistence -------------------------- */

export async function persistPlan(
  db: Db,
  plan: AssignmentPlan,
  source: string,
  disruptionId: string | null,
  buses: BusRecord[],
  crew: CrewRecord[],
) {
  const rows = plan.assignments.map((a) => toRow(a, source, disruptionId));

  const del = await db.from("trip_assignments").delete().neq("trip_id", "__none__");
  if (del.error) throw new Error(del.error.message);

  for (let i = 0; i < rows.length; i += 100) {
    const { error } = await db.from("trip_assignments").insert(rows.slice(i, i + 100));
    if (error) throw new Error(error.message);
  }

  await syncResourceStates(db, plan, buses, crew);
  return rows.length;
}

function toRow(a: Assignment, source: string, disruptionId: string | null) {
  const trip = tripById.get(a.tripId);
  return {
    trip_id: a.tripId,
    trip_code: a.tripCode,
    route_number: a.routeNumber,
    origin: trip?.origin ?? null,
    destination: trip?.destination ?? null,
    depot: a.depot,
    start_min: a.startMin,
    end_min: a.endMin,
    bus_id: a.busId,
    bus_label: `${a.busCode} · ${a.busNumber}`,
    driver_id: a.driverId,
    driver_name: a.driverName,
    conductor_id: a.conductorId,
    conductor_name: a.conductorName,
    delay_min: a.delayMin,
    same_depot: a.sameDepot,
    source,
    disruption_id: disruptionId,
  };
}

/**
 * Reflects the plan back onto the resource records: every rostered bus
 * and crew member is marked ASSIGNED with its first duty, every other
 * operable resource is released back into the available pool.
 */
async function syncResourceStates(
  db: Db,
  plan: AssignmentPlan,
  buses: BusRecord[],
  crew: CrewRecord[],
) {
  const busDuty = new Map<string, string>();
  const crewDuty = new Map<string, string>();

  [...plan.assignments]
    .sort((a, b) => a.startMin - b.startMin)
    .forEach((a) => {
      const label = `Route ${a.routeNumber} · ${a.tripCode} (${minutesToClock(a.startMin)})`;
      if (!busDuty.has(a.busId)) busDuty.set(a.busId, label);
      if (!crewDuty.has(a.driverId)) crewDuty.set(a.driverId, label);
      if (a.conductorId && !crewDuty.has(a.conductorId)) crewDuty.set(a.conductorId, label);
    });

  const busUpdates = buses
    .filter((b) => b.status === "AVAILABLE" || b.status === "ASSIGNED")
    .map((b) => {
      const duty = busDuty.get(b.id);
      return db
        .from("buses")
        .update({
          status: duty ? "ASSIGNED" : "AVAILABLE",
          current_assignment: duty ?? null,
        })
        .eq("id", b.id);
    });

  const crewUpdates = crew
    .filter((c) => c.status === "AVAILABLE" || c.status === "ASSIGNED")
    .map((c) => {
      const duty = crewDuty.get(c.id);
      return db
        .from("crew")
        .update({
          status: duty ? "ASSIGNED" : "AVAILABLE",
          current_assignment: duty ?? null,
        })
        .eq("id", c.id);
    });

  await Promise.all([...busUpdates, ...crewUpdates]);
}

export async function logBusEvents(
  db: Db,
  busIds: string[],
  eventType: string,
  detail: string,
  toStatus?: string,
) {
  if (!busIds.length) return;
  await db.from("bus_events").insert(
    busIds.map((id) => ({
      bus_id: id,
      event_type: eventType,
      to_status: toStatus ?? null,
      detail,
    })),
  );
}

export async function logCrewEvents(
  db: Db,
  crewIds: string[],
  eventType: string,
  detail: string,
  toStatus?: string,
) {
  if (!crewIds.length) return;
  await db.from("crew_events").insert(
    crewIds.map((id) => ({
      crew_id: id,
      event_type: eventType,
      to_status: toStatus ?? null,
      detail,
    })),
  );
}

/* ------------------------------ actions ---------------------------- */

export async function doAutoAssign(persist: boolean) {
  const db = serverDb();
  const [{ buses, crew }, disruptions] = await Promise.all([
    loadResources(db),
    activeDisruptions(db),
  ]);
  const plan = planWithDisruptions(buses, crew, disruptions);
  if (persist) await persistPlan(db, plan, "AUTO_ASSIGN", null, buses, crew);
  return { plan, persisted: persist, activeDisruptions: disruptions.length };
}

export async function doCreateDisruption(input: DisruptionInput & { location?: string }) {
  const db = serverDb();
  const { buses, crew } = await loadResources(db);
  const impact = simulateDisruption(input, TRIPS, buses, crew);

  const affectedBusIds = [...new Set(impact.affectedBuses.map((b) => b.id))];
  const affectedCrewIds = [...new Set(impact.affectedCrew.map((c) => c.id))];

  const reference = `DSR-${Date.now().toString().slice(-6)}`;
  const { data, error } = await db
    .from("disruptions")
    .insert({
      reference,
      route_number: input.routeNumber,
      disruption_type: input.type,
      severity: input.severity,
      start_min: input.startMin,
      duration_min: input.durationMin,
      location: input.location ?? null,
      description: input.description,
      status: "ACTIVE",
      affected_trips: impact.affectedTrips.length,
      affected_bus_ids: affectedBusIds,
      affected_crew_ids: affectedCrewIds,
      recovered_trips: impact.recovered.length,
      unrecovered_trips: impact.unrecovered.length,
      recovery_rate_pct: impact.recoveryRatePct,
      added_delay_min: impact.addedDelayMin,
      passengers_impacted: impact.passengersImpacted,
      impact: impact as unknown as never,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  const row = data as unknown as DisruptionRow;

  // Mark the trapped resources according to the nature of the incident.
  if (input.type === "Bus Breakdown" && affectedBusIds.length) {
    await db
      .from("buses")
      .update({ status: "MAINTENANCE", current_assignment: `${reference} · ${input.type}` })
      .in("id", affectedBusIds);
    await logBusEvents(db, affectedBusIds, "DISRUPTION", `${reference}: ${input.description}`, "MAINTENANCE");
  } else {
    await logBusEvents(db, affectedBusIds, "DISRUPTION", `${reference}: ${input.description}`);
  }

  if (input.type === "Crew Absenteeism" && affectedCrewIds.length) {
    await db
      .from("crew")
      .update({ status: "UNAVAILABLE", current_assignment: `${reference} · ${input.type}` })
      .in("id", affectedCrewIds);
    await logCrewEvents(db, affectedCrewIds, "DISRUPTION", `${reference}: ${input.description}`, "UNAVAILABLE");
  } else {
    await logCrewEvents(db, affectedCrewIds, "DISRUPTION", `${reference}: ${input.description}`);
  }

  // Re-run the roster with the incident in force and publish the recovery.
  const fresh = await loadResources(db);
  const disruptions = await activeDisruptions(db);
  const recoveryPlan = planWithDisruptions(fresh.buses, fresh.crew, disruptions);
  await persistPlan(db, recoveryPlan, "DISRUPTION_RECOVERY", row.id, fresh.buses, fresh.crew);

  return { disruption: row, impact, plan: recoveryPlan };
}

export async function doResolveDisruption(id: string) {
  const db = serverDb();
  const { data, error } = await db
    .from("disruptions")
    .update({ status: "RESOLVED", resolved_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  const row = data as unknown as DisruptionRow;

  if (row.affected_bus_ids?.length) {
    await db
      .from("buses")
      .update({ status: "AVAILABLE", current_assignment: null })
      .in("id", row.affected_bus_ids)
      .eq("status", "MAINTENANCE");
    await logBusEvents(db, row.affected_bus_ids, "RECOVERED", `${row.reference} resolved`, "AVAILABLE");
  }
  if (row.affected_crew_ids?.length) {
    await db
      .from("crew")
      .update({ status: "AVAILABLE", current_assignment: null })
      .in("id", row.affected_crew_ids)
      .eq("status", "UNAVAILABLE");
    await logCrewEvents(db, row.affected_crew_ids, "RECOVERED", `${row.reference} resolved`, "AVAILABLE");
  }

  const { buses, crew } = await loadResources(db);
  const disruptions = await activeDisruptions(db);
  const plan = planWithDisruptions(buses, crew, disruptions);
  await persistPlan(db, plan, "AUTO_ASSIGN", null, buses, crew);
  return { disruption: row, plan };
}

export async function doPreviewScenario(input: ScenarioInput) {
  const db = serverDb();
  const { buses, crew } = await loadResources(db);
  const result = runScenario(input, TRIPS, buses, crew);

  const { data, error } = await db
    .from("scenarios")
    .insert({
      label: input.label,
      input: input as unknown as Record<string, unknown>,
      result: result as unknown as Record<string, unknown>,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return { scenario: data as unknown as ScenarioRow, result };
}

export async function doApplyScenario(scenarioId: string) {
  const db = serverDb();
  const { data, error } = await db.from("scenarios").select("*").eq("id", scenarioId).single();
  if (error) throw new Error(error.message);
  const row = data as unknown as ScenarioRow;

  const { buses, crew } = await loadResources(db);
  // Recompute from the stored inputs so the applied plan matches today's
  // real resource state rather than a stale snapshot.
  const result = runScenario(row.input, TRIPS, buses, crew);
  const plan: AssignmentPlan = {
    assignments: result.assignments,
    uncovered: result.uncovered,
    metrics: result.scenario,
  };
  await persistPlan(db, plan, "SCENARIO_APPLIED", null, buses, crew);

  const withdrawnBuses = result.withdrawnBuses.map((b) => b.id);
  const withdrawnCrew = result.withdrawnCrew.map((c) => c.id);
  if (withdrawnBuses.length) {
    await db
      .from("buses")
      .update({ status: "INACTIVE", current_assignment: `Withdrawn · ${row.label}` })
      .in("id", withdrawnBuses);
    await logBusEvents(db, withdrawnBuses, "SCENARIO", `Withdrawn by scenario ${row.label}`, "INACTIVE");
  }
  if (withdrawnCrew.length) {
    await db
      .from("crew")
      .update({ status: "UNAVAILABLE", current_assignment: `Withdrawn · ${row.label}` })
      .in("id", withdrawnCrew);
    await logCrewEvents(db, withdrawnCrew, "SCENARIO", `Withdrawn by scenario ${row.label}`, "UNAVAILABLE");
  }

  const { error: updErr } = await db
    .from("scenarios")
    .update({
      applied: true,
      applied_at: new Date().toISOString(),
      result: result as unknown as Record<string, unknown>,
    })
    .eq("id", scenarioId);
  if (updErr) throw new Error(updErr.message);

  return { scenarioId, result, applied: plan.assignments.length };
}

export async function doListState() {
  const db = serverDb();
  const [{ buses, crew }, assignmentsRes, disruptionsRes, scenariosRes] = await Promise.all([
    loadResources(db),
    db.from("trip_assignments").select("*").order("start_min"),
    db.from("disruptions").select("*").order("created_at", { ascending: false }).limit(25),
    db.from("scenarios").select("*").order("created_at", { ascending: false }).limit(25),
  ]);
  if (assignmentsRes.error) throw new Error(assignmentsRes.error.message);
  if (disruptionsRes.error) throw new Error(disruptionsRes.error.message);
  if (scenariosRes.error) throw new Error(scenariosRes.error.message);

  return {
    buses: buses.map((b) => ({ id: b.id, label: `${b.bus_code} · ${b.bus_number}`, status: b.status, depot: b.depot })),
    crew: crew.map((c) => ({ id: c.id, label: `${c.crew_code} · ${c.name}`, role: c.role, status: c.status, depot: c.depot })),
    assignments: (assignmentsRes.data ?? []) as unknown as AssignmentRow[],
    disruptions: (disruptionsRes.data ?? []) as unknown as DisruptionRow[],
    scenarios: (scenariosRes.data ?? []) as unknown as ScenarioRow[],
    totalTrips: TRIPS.length,
  };
}
