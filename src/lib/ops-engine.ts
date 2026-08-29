import { DAY_PLAN, SERVICE_END_MIN, minutesToClock, type PlannedTrip } from "@/lib/day-plan";

/* ------------------------------------------------------------------ *
 * Operations engine.
 *
 * Pure business logic shared by the server functions (automatic
 * assignment, disruption simulation, what-if scenarios) and the UI.
 * Nothing here is random or hardcoded: every number returned is
 * computed from the trip plan and the resource records passed in.
 * ------------------------------------------------------------------ */

export interface BusRecord {
  id: string;
  bus_code: string;
  bus_number: string;
  depot: string;
  status: string;
  capacity?: number;
}

export interface CrewRecord {
  id: string;
  crew_code: string;
  name: string;
  role: string;
  depot: string;
  status: string;
  daily_spreadover_hours: number;
  license_valid_till: string | null;
}

export interface EngineTrip {
  id: string;
  tripCode: string;
  routeNumber: string;
  origin: string;
  destination: string;
  startMin: number;
  endMin: number;
  depot: string;
}

export const TURNAROUND_MIN = 8;
export const MAX_DUTY_MIN = 12 * 60;

const ASSIGNABLE_BUS_STATUS = new Set(["AVAILABLE", "ASSIGNED"]);
const ASSIGNABLE_CREW_STATUS = new Set(["AVAILABLE", "ASSIGNED"]);

export function planToTrips(plan: PlannedTrip[] = DAY_PLAN): EngineTrip[] {
  return plan.map((t) => ({
    id: t.id,
    tripCode: t.tripCode,
    routeNumber: t.routeNumber,
    origin: t.origin,
    destination: t.destination,
    startMin: t.startMin,
    endMin: t.endMin,
    depot: t.depot,
  }));
}

/* ------------------------------ booking ---------------------------- */

interface Booking {
  startMin: number;
  endMin: number;
}

class Ledger {
  private map = new Map<string, Booking[]>();

  free(id: string, startMin: number, endMin: number, buffer: number) {
    const rows = this.map.get(id);
    if (!rows) return true;
    return rows.every((b) => endMin + buffer <= b.startMin || startMin >= b.endMin + buffer);
  }

  minutes(id: string) {
    return (this.map.get(id) ?? []).reduce((s, b) => s + (b.endMin - b.startMin), 0);
  }

  span(id: string) {
    const rows = this.map.get(id);
    if (!rows?.length) return 0;
    const start = Math.min(...rows.map((r) => r.startMin));
    const end = Math.max(...rows.map((r) => r.endMin));
    return end - start;
  }

  count(id: string) {
    return (this.map.get(id) ?? []).length;
  }

  book(id: string, startMin: number, endMin: number) {
    const rows = this.map.get(id) ?? [];
    rows.push({ startMin, endMin });
    this.map.set(id, rows);
  }

  used() {
    return [...this.map.keys()];
  }
}

/* ----------------------------- eligibility ------------------------- */

export function busBlockReason(bus: BusRecord, excluded: Set<string>): string | null {
  if (excluded.has(bus.id)) return "Withdrawn in this scenario";
  if (bus.status === "RETIRED") return "Retired vehicle";
  if (bus.status === "INACTIVE") return "Inactive vehicle";
  if (bus.status === "MAINTENANCE") return "In maintenance";
  if (!ASSIGNABLE_BUS_STATUS.has(bus.status)) return `Status ${bus.status}`;
  return null;
}

export function crewBlockReason(crew: CrewRecord, excluded: Set<string>): string | null {
  if (excluded.has(crew.id)) return "Withdrawn in this scenario";
  if (crew.status === "INACTIVE") return "Inactive crew";
  if (crew.status === "UNAVAILABLE") return "Marked unavailable";
  if (crew.status === "OFF_DUTY") return "Off duty";
  if (!ASSIGNABLE_CREW_STATUS.has(crew.status)) return `Status ${crew.status}`;
  if (crew.daily_spreadover_hours >= 12) return "Spreadover limit reached";
  if (crew.license_valid_till && new Date(crew.license_valid_till) < new Date())
    return "Licence expired";
  return null;
}

/* ---------------------------- assignment --------------------------- */

export interface Assignment {
  tripId: string;
  tripCode: string;
  routeNumber: string;
  window: string;
  startMin: number;
  endMin: number;
  depot: string;
  busId: string;
  busCode: string;
  busNumber: string;
  driverId: string;
  driverName: string;
  conductorId: string | null;
  conductorName: string | null;
  sameDepot: boolean;
  delayMin: number;
}

export interface UncoveredTrip {
  tripId: string;
  tripCode: string;
  routeNumber: string;
  window: string;
  reason: "NO_BUS" | "NO_DRIVER" | "BLOCKED";
  detail: string;
}

export interface PlanMetrics {
  totalTrips: number;
  coveredTrips: number;
  uncoveredTrips: number;
  busesUsed: number;
  eligibleBuses: number;
  crewUsed: number;
  eligibleCrew: number;
  busUtilizationPct: number;
  crewUtilizationPct: number;
  scheduleConflicts: number;
  replacementBusesRequired: number;
  crewShortage: number;
  serviceHours: number;
  coveragePct: number;
  totalDelayMin: number;
}

export interface AssignmentPlan {
  assignments: Assignment[];
  uncovered: UncoveredTrip[];
  metrics: PlanMetrics;
}

export interface AssignmentOptions {
  excludeBusIds?: string[];
  excludeCrewIds?: string[];
  /** Route closures — trips overlapping a closure are re-timed after it. */
  closures?: { routeNumber: string; startMin: number; endMin: number }[];
  turnaroundMin?: number;
}

/**
 * Automatic resource assignment.
 *
 * Trips are processed in departure order. For every trip we build the
 * candidate bus/crew pools, strip out ineligible and already-committed
 * resources, then pick the best feasible pairing (same depot first, then
 * the least-loaded resource so the duty load spreads across the roster).
 */
export function autoAssign(
  trips: EngineTrip[],
  buses: BusRecord[],
  crew: CrewRecord[],
  options: AssignmentOptions = {},
): AssignmentPlan {
  const excludedBuses = new Set(options.excludeBusIds ?? []);
  const excludedCrew = new Set(options.excludeCrewIds ?? []);
  const closures = options.closures ?? [];
  const buffer = options.turnaroundMin ?? TURNAROUND_MIN;

  // (1-3) candidate buses, minus unavailable / maintenance / retired / inactive
  const busPool = buses.filter((b) => busBlockReason(b, excludedBuses) === null);
  // (5-6) candidate crew, minus unavailable / off-duty / inactive
  const crewPool = crew.filter((c) => crewBlockReason(c, excludedCrew) === null);
  const driverPool = crewPool.filter((c) => c.role !== "Conductor");
  const conductorPool = crewPool.filter((c) => c.role === "Conductor");

  const busLedger = new Ledger();
  const crewLedger = new Ledger();

  const assignments: Assignment[] = [];
  const uncovered: UncoveredTrip[] = [];
  let conflicts = 0;
  let totalDelay = 0;

  const ordered = [...trips].sort((a, b) => a.startMin - b.startMin);

  for (const trip of ordered) {
    // (4) route closure constraint — the trip is pushed behind the blockage
    const closure = closures.find(
      (c) => c.routeNumber === trip.routeNumber && trip.startMin < c.endMin && trip.endMin > c.startMin,
    );
    const shift = closure ? Math.max(0, closure.endMin - trip.startMin) : 0;
    const startMin = trip.startMin + shift;
    const endMin = trip.endMin + shift;
    const window = `${minutesToClock(startMin)}–${minutesToClock(endMin)}`;

    if (startMin >= SERVICE_END_MIN) {
      uncovered.push({
        tripId: trip.id,
        tripCode: trip.tripCode,
        routeNumber: trip.routeNumber,
        window,
        reason: "BLOCKED",
        detail: "Re-timed past the end of the operating day",
      });
      continue;
    }

    // (7-8) timing conflicts and overlapping commitments
    const freeBuses = busPool.filter((b) => busLedger.free(b.id, startMin, endMin, buffer));
    if (!freeBuses.length) {
      conflicts += 1;
      uncovered.push({
        tripId: trip.id,
        tripCode: trip.tripCode,
        routeNumber: trip.routeNumber,
        window,
        reason: "NO_BUS",
        detail: busPool.length
          ? "Every eligible bus is already committed to an overlapping trip"
          : "No eligible bus in the fleet",
      });
      continue;
    }

    const freeDrivers = driverPool.filter(
      (c) =>
        crewLedger.free(c.id, startMin, endMin, buffer) &&
        crewLedger.span(c.id) + (endMin - startMin) <= MAX_DUTY_MIN,
    );
    if (!freeDrivers.length) {
      conflicts += 1;
      uncovered.push({
        tripId: trip.id,
        tripCode: trip.tripCode,
        routeNumber: trip.routeNumber,
        window,
        reason: "NO_DRIVER",
        detail: driverPool.length
          ? "No rested driver free in this window"
          : "No eligible driver on the roster",
      });
      continue;
    }

    // (9-10) score the feasible combinations and take the best one
    const bus = pickBest(freeBuses, trip.depot, (b) => busLedger.minutes(b.id), (b) => b.depot);
    const driver = pickBest(freeDrivers, trip.depot, (c) => crewLedger.span(c.id), (c) => c.depot);
    const conductor =
      pickBest(
        conductorPool.filter(
          (c) =>
            c.id !== driver.id &&
            crewLedger.free(c.id, startMin, endMin, buffer) &&
            crewLedger.span(c.id) + (endMin - startMin) <= MAX_DUTY_MIN,
        ),
        trip.depot,
        (c) => crewLedger.span(c.id),
        (c) => c.depot,
      ) ?? null;

    busLedger.book(bus.id, startMin, endMin);
    crewLedger.book(driver.id, startMin, endMin);
    if (conductor) crewLedger.book(conductor.id, startMin, endMin);
    totalDelay += shift;

    assignments.push({
      tripId: trip.id,
      tripCode: trip.tripCode,
      routeNumber: trip.routeNumber,
      window,
      startMin,
      endMin,
      depot: trip.depot,
      busId: bus.id,
      busCode: bus.bus_code,
      busNumber: bus.bus_number,
      driverId: driver.id,
      driverName: driver.name,
      conductorId: conductor?.id ?? null,
      conductorName: conductor?.name ?? null,
      sameDepot: bus.depot === trip.depot,
      delayMin: shift,
    });
  }

  const serviceMin = assignments.reduce((s, a) => s + (a.endMin - a.startMin), 0);
  const busesUsed = busLedger.used().length;
  const crewUsed = crewLedger.used().length;

  return {
    assignments,
    uncovered,
    metrics: {
      totalTrips: trips.length,
      coveredTrips: assignments.length,
      uncoveredTrips: uncovered.length,
      busesUsed,
      eligibleBuses: busPool.length,
      crewUsed,
      eligibleCrew: crewPool.length,
      busUtilizationPct: busPool.length ? round1((busesUsed / busPool.length) * 100) : 0,
      crewUtilizationPct: crewPool.length ? round1((crewUsed / crewPool.length) * 100) : 0,
      scheduleConflicts: conflicts,
      replacementBusesRequired: uncovered.filter((u) => u.reason === "NO_BUS").length,
      crewShortage: uncovered.filter((u) => u.reason === "NO_DRIVER").length,
      serviceHours: round1(serviceMin / 60),
      coveragePct: trips.length ? round1((assignments.length / trips.length) * 100) : 0,
      totalDelayMin: totalDelay,
    },
  };
}

function pickBest<T>(
  pool: T[],
  depot: string,
  load: (item: T) => number,
  depotOf: (item: T) => string,
): T {
  return [...pool].sort((a, b) => {
    const depotDelta = Number(depotOf(b) === depot) - Number(depotOf(a) === depot);
    if (depotDelta !== 0) return depotDelta;
    return load(a) - load(b);
  })[0] as T;
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

/* --------------------------- disruption ---------------------------- */

export const DISRUPTION_TYPES = [
  "Road Blockage",
  "Bus Breakdown",
  "Crew Absenteeism",
  "Traffic Congestion",
  "Demand Surge",
  "Weather Event",
] as const;
export type DisruptionType = (typeof DISRUPTION_TYPES)[number];

export const SEVERITIES = ["Low", "Moderate", "High", "Critical"] as const;
export type Severity = (typeof SEVERITIES)[number];

export interface DisruptionInput {
  routeNumber: string;
  type: DisruptionType | string;
  severity: Severity | string;
  startMin: number;
  durationMin: number;
  description: string;
}

export interface DisruptionImpact {
  affectedTrips: { tripId: string; tripCode: string; window: string }[];
  affectedBuses: { id: string; label: string }[];
  affectedCrew: { id: string; label: string }[];
  recovered: Assignment[];
  unrecovered: UncoveredTrip[];
  replacementBusesRequired: number;
  reliefCrewRequired: number;
  addedDelayMin: number;
  recoveryRatePct: number;
  passengersImpacted: number;
  baseline: PlanMetrics;
  disrupted: PlanMetrics;
}

/**
 * Runs the full disruption workflow against the real plan and resource
 * pool: locate affected trips/buses/crew, quarantine them for the
 * duration of the event, then re-run the assignment engine to recover.
 */
export function simulateDisruption(
  input: DisruptionInput,
  trips: EngineTrip[],
  buses: BusRecord[],
  crew: CrewRecord[],
): DisruptionImpact {
  const endMin = input.startMin + input.durationMin;
  const baselinePlan = autoAssign(trips, buses, crew);

  const affected = baselinePlan.assignments.filter(
    (a) => a.routeNumber === input.routeNumber && a.startMin < endMin && a.endMin > input.startMin,
  );

  const affectedBusIds = [...new Set(affected.map((a) => a.busId))];
  const affectedCrewIds = [
    ...new Set(affected.flatMap((a) => [a.driverId, ...(a.conductorId ? [a.conductorId] : [])])),
  ];

  // The blocked corridor closes for the duration; the trapped vehicles and
  // crew are unavailable for the rest of the recovery window.
  const disruptedPlan = autoAssign(trips, buses, crew, {
    excludeBusIds: affectedBusIds,
    excludeCrewIds: affectedCrewIds,
    closures: [{ routeNumber: input.routeNumber, startMin: input.startMin, endMin }],
  });

  const affectedIds = new Set(affected.map((a) => a.tripId));
  const recovered = disruptedPlan.assignments.filter((a) => affectedIds.has(a.tripId));
  const unrecovered = disruptedPlan.uncovered.filter((u) => affectedIds.has(u.tripId));

  const severityWeight =
    input.severity === "Critical" ? 90 : input.severity === "High" ? 65 : input.severity === "Moderate" ? 40 : 20;

  return {
    affectedTrips: affected.map((a) => ({ tripId: a.tripId, tripCode: a.tripCode, window: a.window })),
    affectedBuses: affected.map((a) => ({ id: a.busId, label: `${a.busCode} · ${a.busNumber}` })),
    affectedCrew: affected.map((a) => ({ id: a.driverId, label: a.driverName })),
    recovered,
    unrecovered,
    replacementBusesRequired: new Set(recovered.map((r) => r.busId)).size,
    reliefCrewRequired: new Set(recovered.map((r) => r.driverId)).size,
    addedDelayMin: recovered.reduce((s, r) => s + r.delayMin, 0),
    recoveryRatePct: affected.length
      ? Math.round((recovered.length / affected.length) * 100)
      : 100,
    passengersImpacted: Math.round(
      affected.length * (severityWeight / 100) * averageLoad(buses),
    ),
    baseline: baselinePlan.metrics,
    disrupted: disruptedPlan.metrics,
  };
}

function averageLoad(buses: BusRecord[]) {
  if (!buses.length) return 40;
  const total = buses.reduce((s, b) => s + (b.capacity ?? 40), 0);
  return Math.round(total / buses.length);
}

/* ---------------------------- what-if ------------------------------ */

export interface ScenarioInput {
  label: string;
  busesUnavailable: number;
  crewUnavailable: number;
  blockedRoute: string | null;
  blockStartMin: number;
  blockDurationMin: number;
  /** Extra peak-hour trips injected on the busiest corridors. */
  extraPeakTripsPct: number;
}

export interface ScenarioResult {
  label: string;
  baseline: PlanMetrics;
  scenario: PlanMetrics;
  withdrawnBuses: { id: string; label: string }[];
  withdrawnCrew: { id: string; label: string }[];
  addedTrips: number;
  uncovered: UncoveredTrip[];
  assignments: Assignment[];
}

const PEAK_START = 17 * 60;
const PEAK_END = 20 * 60;

/**
 * Builds a scenario COPY of the operating state, applies the hypothetical
 * change, re-runs the assignment engine and reports the measured delta.
 * The real schedule and database are untouched until the plan is applied.
 */
export function runScenario(
  input: ScenarioInput,
  trips: EngineTrip[],
  buses: BusRecord[],
  crew: CrewRecord[],
): ScenarioResult {
  const baseline = autoAssign(trips, buses, crew);

  const eligibleBuses = buses.filter((b) => busBlockReason(b, new Set()) === null);
  const eligibleCrew = crew.filter((c) => crewBlockReason(c, new Set()) === null);

  const withdrawnBuses = eligibleBuses.slice(0, Math.max(0, input.busesUnavailable));
  const withdrawnCrew = eligibleCrew
    .filter((c) => c.role !== "Conductor")
    .slice(0, Math.max(0, input.crewUnavailable));

  // Scenario copy of the trip list (never the live plan).
  const scenarioTrips: EngineTrip[] = trips.map((t) => ({ ...t }));
  let added = 0;
  if (input.extraPeakTripsPct > 0) {
    const peak = trips.filter((t) => t.startMin >= PEAK_START && t.endMin <= PEAK_END);
    const count = Math.round((peak.length * input.extraPeakTripsPct) / 100);
    peak.slice(0, count).forEach((t, i) => {
      const offset = 10 + (i % 3) * 5;
      if (t.endMin + offset > SERVICE_END_MIN) return;
      scenarioTrips.push({
        ...t,
        id: `${t.id}-extra`,
        tripCode: `${t.tripCode}-X`,
        startMin: t.startMin + offset,
        endMin: t.endMin + offset,
      });
      added += 1;
    });
  }

  const scenario = autoAssign(scenarioTrips, buses, crew, {
    excludeBusIds: withdrawnBuses.map((b) => b.id),
    excludeCrewIds: withdrawnCrew.map((c) => c.id),
    closures: input.blockedRoute
      ? [
          {
            routeNumber: input.blockedRoute,
            startMin: input.blockStartMin,
            endMin: input.blockStartMin + input.blockDurationMin,
          },
        ]
      : [],
  });

  return {
    label: input.label,
    baseline: baseline.metrics,
    scenario: scenario.metrics,
    withdrawnBuses: withdrawnBuses.map((b) => ({ id: b.id, label: `${b.bus_code} · ${b.bus_number}` })),
    withdrawnCrew: withdrawnCrew.map((c) => ({ id: c.id, label: `${c.crew_code} · ${c.name}` })),
    addedTrips: added,
    uncovered: scenario.uncovered,
    assignments: scenario.assignments,
  };
}
