import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertTriangle, Clock, Filter, Repeat } from "lucide-react";
import {
  DataTable,
  PageHead,
  Panel,
  Pill,
  Td,
  Th,
  Metric,
} from "@/components/transit/primitives";
import { tripTone } from "@/lib/transit-ui";
import { INITIAL_TRIPS, DTC_DEPOTS } from "@/data/transitData";

export const Route = createFileRoute("/schedule")({
  head: () => ({
    meta: [
      { title: "Scheduling Board — DTC TransitOps" },
      {
        name: "description",
        content:
          "Trip blocks, duty types and conflict detection for automated DTC bus scheduling and crew linking.",
      },
      { property: "og:title", content: "Scheduling Board — DTC TransitOps" },
      {
        property: "og:description",
        content: "Trip blocks, duty types and conflict detection for DTC bus scheduling.",
      },
    ],
  }),
  component: Scheduling,
});

const STATUSES = ["All", "Scheduled", "In-Transit", "Delayed", "Conflict", "Completed"] as const;

function Scheduling() {
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("All");
  const [depot, setDepot] = useState("All depots");

  const trips = useMemo(
    () =>
      INITIAL_TRIPS.filter(
        (t) =>
          (status === "All" || t.status === status) &&
          (depot === "All depots" || t.depot === depot),
      ),
    [status, depot],
  );

  const conflicts = INITIAL_TRIPS.filter((t) => t.status === "Conflict");
  const deadhead = INITIAL_TRIPS.reduce((sum, t) => sum + t.deadheadKm, 0);
  const linked = INITIAL_TRIPS.filter((t) => t.dutyType === "Linked Shift").length;

  return (
    <div className="space-y-8">
      <PageHead
        eyebrow="Phase 4 · 5 — Blocking & rostering"
        title="Scheduling board"
        description="Turnaround blocks generated from GTFS headways, then linked to crew duties inside spreadover and rest-break limits."
        aside={
          <div className="flex gap-3">
            <button className="inline-flex h-14 items-center gap-2 rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground transition-transform duration-200 hover:scale-105">
              <Repeat className="h-4 w-4" strokeWidth={2.5} />
              Rebuild blocks
            </button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Trips planned" value={INITIAL_TRIPS.length} tone="primary" />
        <Metric
          label="Conflicts"
          value={conflicts.length}
          tone={conflicts.length ? "destructive" : "secondary"}
          delta="Crew or vehicle double-booking"
        />
        <Metric label="Linked shifts" value={linked} tone="secondary" delta="Same crew, same bus" />
        <Metric
          label="Deadhead"
          value={deadhead.toFixed(1)}
          unit="km"
          tone="accent"
          delta="Empty running across all blocks"
        />
      </div>

      {conflicts.length ? (
        <section className="rounded-lg bg-destructive-tint p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-md bg-destructive">
              <AlertTriangle className="h-6 w-6 text-destructive-foreground" strokeWidth={2.4} />
            </span>
            <div>
              <h2 className="text-lg font-bold text-destructive">
                {conflicts.length} block{conflicts.length > 1 ? "s" : ""} need dispatcher action
              </h2>
              <p className="text-sm text-muted-foreground">
                Resolve before the roster is published to depot terminals.
              </p>
            </div>
          </div>
          <ul className="mt-5 grid gap-3 md:grid-cols-2">
            {conflicts.map((t) => (
              <li key={t.id} className="rounded-md bg-background p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="num font-bold">{t.tripCode}</p>
                  <Pill tone="destructive" solid>
                    Route {t.routeNumber}
                  </Pill>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{t.conflictReason}</p>
                <p className="num mt-3 text-xs text-muted-foreground">
                  {t.startTime}–{t.endTime} · {t.assignedBus} · {t.assignedDriver}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Panel
        title="Trip blocks"
        hint={`${trips.length} of ${INITIAL_TRIPS.length} trips shown`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" strokeWidth={2.4} />
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`label-xs rounded-sm px-3 py-2 transition-all duration-200 hover:scale-105 ${
                  status === s
                    ? "bg-ink text-ink-foreground"
                    : "bg-muted text-muted-foreground hover:bg-border"
                }`}
              >
                {s}
              </button>
            ))}
            <select
              value={depot}
              onChange={(e) => setDepot(e.target.value)}
              className="h-9 rounded-md bg-muted px-3 text-sm font-medium focus:bg-background focus:outline-none"
            >
              <option>All depots</option>
              {DTC_DEPOTS.map((d) => (
                <option key={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        }
      >
        <DataTable
          head={
            <>
              <Th>Trip</Th>
              <Th>Window</Th>
              <Th>Corridor</Th>
              <Th>Vehicle & crew</Th>
              <Th>Duty type</Th>
              <Th className="text-right">Deadhead</Th>
              <Th>Status</Th>
            </>
          }
        >
          {trips.map((t) => (
            <tr key={t.id} className="transition-colors duration-200 hover:bg-muted">
              <Td>
                <p className="num font-semibold">{t.tripCode}</p>
                <p className="text-xs text-muted-foreground">{t.depot}</p>
              </Td>
              <Td>
                <span className="num inline-flex items-center gap-1.5 font-semibold">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={2.4} />
                  {t.startTime}–{t.endTime}
                </span>
              </Td>
              <Td>
                <span className="num rounded-sm bg-primary-tint px-2 py-1 text-xs font-bold text-primary">
                  {t.routeNumber}
                </span>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t.origin} → {t.destination}
                </p>
              </Td>
              <Td>
                <p className="num font-medium">{t.assignedBus}</p>
                <p className="text-xs text-muted-foreground">
                  {t.assignedDriver} · {t.assignedConductor}
                </p>
              </Td>
              <Td className="text-muted-foreground">{t.dutyType}</Td>
              <Td className="num text-right font-semibold">{t.deadheadKm} km</Td>
              <Td>
                <Pill tone={tripTone(t.status)}>{t.status}</Pill>
              </Td>
            </tr>
          ))}
        </DataTable>
      </Panel>
    </div>
  );
}
