import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import {
  clearAssignments,
  getFleetBoard,
  runAutoAssignment,
  type FleetBoard,
} from "@/lib/fleet.functions";
import type { AssignmentResult } from "@/lib/assignment-engine";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Fleet Navigator — Automatic Resource Assignment" },
      {
        name: "description",
        content:
          "Deterministic bus and crew assignment engine: filters unavailable resources, prevents overlapping trips and scores every feasible combination.",
      },
      { property: "og:title", content: "Fleet Navigator — Automatic Resource Assignment" },
      {
        property: "og:description",
        content:
          "Rule-based dispatcher that assigns buses and crew to scheduled trips without double-booking.",
      },
    ],
  }),
  component: Dispatcher,
});

function statusTone(status: string) {
  if (status === "active") return "bg-success/15 text-success border-success/30";
  if (status === "maintenance" || status === "off_duty")
    return "bg-warning/15 text-warning border-warning/30";
  return "bg-destructive/15 text-destructive border-destructive/30";
}

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

function Dispatcher() {
  const queryClient = useQueryClient();
  const fetchBoard = useServerFn(getFleetBoard);
  const assignFn = useServerFn(runAutoAssignment);
  const clearFn = useServerFn(clearAssignments);
  const [results, setResults] = useState<AssignmentResult[] | null>(null);

  const { data } = useQuery<FleetBoard>({
    queryKey: ["fleet-board"],
    queryFn: () => fetchBoard(),
  });

  const run = useMutation({
    mutationFn: () => assignFn(),
    onSuccess: (res) => {
      setResults(res.results);
      queryClient.setQueryData(["fleet-board"], res.board);
    },
  });

  const clear = useMutation({
    mutationFn: () => clearFn(),
    onSuccess: (board) => {
      setResults(null);
      queryClient.setQueryData(["fleet-board"], board);
    },
  });

  const board = data;
  const depotName = (id: string) => board?.depots.find((d) => d.id === id)?.name ?? "—";
  const busByTrip = (tripId: string) => {
    const a = board?.assignments.find((x) => x.trip_id === tripId);
    if (!a) return null;
    return {
      bus: board?.buses.find((b) => b.id === a.bus_id),
      crew: board?.crew.find((c) => c.id === a.crew_id),
      score: a.score,
      reasons: a.reasons,
    };
  };

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mono-label">Fleet Navigator</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Automatic Resource Assignment
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Deterministic, rule-based dispatching. Every scheduled trip is filtered against bus
            status, depot capacity, crew duty windows and existing bookings, then the best feasible
            bus + crew combination is selected by score. No overlapping assignments, ever.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => run.mutate()} disabled={run.isPending}>
            {run.isPending ? "Assigning…" : "Run auto-assignment"}
          </Button>
          <Button variant="secondary" onClick={() => clear.mutate()} disabled={clear.isPending}>
            Clear plan
          </Button>
        </div>
      </header>

      {!board ? (
        <p className="text-sm text-muted-foreground">Loading fleet…</p>
      ) : (
        <div className="space-y-8">
          <section className="panel overflow-hidden">
            <div className="border-b border-border px-5 py-3">
              <h2 className="text-sm font-semibold">Scheduled trips</h2>
            </div>
            <div className="divide-y divide-border">
              {board.trips.map((trip) => {
                const a = busByTrip(trip.id);
                const detail = results?.find((r) => r.tripId === trip.id);
                return (
                  <div key={trip.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <span className="mono-label">{trip.code}</span>
                        <p className="font-medium">
                          {depotName(trip.origin_depot_id)} → {trip.destination}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {fmt(trip.start_time)}–{fmt(trip.end_time)} UTC · {trip.required_capacity}{" "}
                          pax
                        </p>
                      </div>
                      {a ? (
                        <div className="text-right">
                          <p className="text-sm font-medium">
                            {a.bus?.code} · {a.crew?.name}
                          </p>
                          <p className="mono-label">score {a.score}</p>
                        </div>
                      ) : (
                        <Badge variant="outline" className={statusTone("inactive")}>
                          Unassigned
                        </Badge>
                      )}
                    </div>
                    {(a?.reasons?.length || detail) && (
                      <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                        {(a?.reasons ?? []).map((r) => (
                          <li key={r}>• {r}</li>
                        ))}
                        {detail?.rejections.slice(0, 4).map((r) => (
                          <li key={r} className="text-destructive/80">
                            ✕ {r}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <div className="grid gap-6 md:grid-cols-2">
            <section className="panel overflow-hidden">
              <div className="border-b border-border px-5 py-3">
                <h2 className="text-sm font-semibold">Buses</h2>
              </div>
              <ul className="divide-y divide-border">
                {board.buses.map((bus) => (
                  <li key={bus.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium">{bus.code}</p>
                      <p className="text-xs text-muted-foreground">
                        {depotName(bus.depot_id)} · {bus.capacity} seats
                      </p>
                    </div>
                    <Badge variant="outline" className={statusTone(bus.status)}>
                      {bus.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            </section>

            <section className="panel overflow-hidden">
              <div className="border-b border-border px-5 py-3">
                <h2 className="text-sm font-semibold">Crew</h2>
              </div>
              <ul className="divide-y divide-border">
                {board.crew.map((member) => (
                  <li key={member.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium">{member.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {depotName(member.depot_id)} · {member.shift_start.slice(0, 5)}–
                        {member.shift_end.slice(0, 5)}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={statusTone(member.is_available ? member.status : "inactive")}
                    >
                      {member.status === "active" && !member.is_available
                        ? "unavailable"
                        : member.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      )}
    </main>
  );
}
