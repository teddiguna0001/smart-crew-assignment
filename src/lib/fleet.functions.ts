import { createServerFn } from "@tanstack/react-start";

import { planAssignments } from "./assignment-engine";
import type { Bus, Crew, Depot, Trip } from "./assignment-engine";

export interface FleetBoard {
  depots: Depot[];
  buses: Bus[];
  crew: Crew[];
  trips: Trip[];
  assignments: {
    id: string;
    trip_id: string;
    bus_id: string;
    crew_id: string;
    score: number;
    reasons: string[];
  }[];
}

async function loadBoard(): Promise<FleetBoard> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [depots, buses, crew, trips, assignments] = await Promise.all([
    supabaseAdmin.from("depots").select("id,name,lat,lng").order("name"),
    supabaseAdmin
      .from("buses")
      .select("id,code,depot_id,status,capacity,utilization_minutes")
      .order("code"),
    supabaseAdmin
      .from("crew")
      .select("id,name,depot_id,status,is_available,shift_start,shift_end,utilization_minutes")
      .order("name"),
    supabaseAdmin
      .from("trips")
      .select("id,code,origin_depot_id,destination,start_time,end_time,required_capacity")
      .order("start_time"),
    supabaseAdmin.from("assignments").select("id,trip_id,bus_id,crew_id,score,reasons"),
  ]);

  return {
    depots: (depots.data ?? []) as Depot[],
    buses: (buses.data ?? []) as Bus[],
    crew: (crew.data ?? []) as Crew[],
    trips: (trips.data ?? []) as Trip[],
    assignments: ((assignments.data ?? []) as unknown[]).map((row) => {
      const a = row as {
        id: string;
        trip_id: string;
        bus_id: string;
        crew_id: string;
        score: number;
        reasons: unknown;
      };
      return { ...a, reasons: Array.isArray(a.reasons) ? (a.reasons as string[]) : [] };
    }),
  };
}

export const getFleetBoard = createServerFn({ method: "GET" }).handler(async () => loadBoard());

export const runAutoAssignment = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const board = await loadBoard();

  const results = planAssignments({
    trips: board.trips,
    buses: board.buses,
    crew: board.crew,
    depots: board.depots,
  });

  // Replace the current plan atomically enough for a demo fleet: clear, then insert.
  await supabaseAdmin.from("assignments").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  const rows = results
    .filter((r) => r.busId && r.crewId)
    .map((r) => ({
      trip_id: r.tripId,
      bus_id: r.busId!,
      crew_id: r.crewId!,
      score: r.score,
      reasons: r.reasons,
    }));

  const failures: string[] = [];
  if (rows.length > 0) {
    // Insert one at a time so the DB-level overlap trigger reports the exact conflict.
    for (const row of rows) {
      const { error } = await supabaseAdmin.from("assignments").insert(row);
      if (error) failures.push(error.message);
    }
  }

  return { results, failures, board: await loadBoard() };
});

export const clearAssignments = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("assignments").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  return loadBoard();
});
