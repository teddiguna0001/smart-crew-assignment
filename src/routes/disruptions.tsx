import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CircleAlert, Radio, Siren, TimerReset } from "lucide-react";
import {
  DataTable,
  Metric,
  PageHead,
  Panel,
  Pill,
  Td,
  Th,
} from "@/components/transit/primitives";
import { severityTone } from "@/lib/transit-ui";
import { DTC_ROUTES } from "@/data/transitData";
import { clockToMinutes, minutesToClock } from "@/lib/day-plan";
import { DISRUPTION_TYPES, SEVERITIES, type DisruptionImpact } from "@/lib/ops-engine";
import {
  createDisruption,
  fetchOpsState,
  opsStateQueryKey,
  resolveDisruption,
} from "@/lib/ops-api";

export const Route = createFileRoute("/disruptions")({
  head: () => ({
    meta: [
      { title: "Disruption Simulation — DTC TransitOps" },
      {
        name: "description",
        content:
          "Raise a real disruption on any DTC corridor and watch the engine identify affected trips, buses and crew, then publish an automated recovery roster.",
      },
      { property: "og:title", content: "Disruption Simulation — DTC TransitOps" },
      {
        property: "og:description",
        content: "Simulate breakdowns, blockages and absenteeism with automated recovery assignment.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Disruptions,
});

const DURATIONS = [15, 30, 45, 60, 90, 120];

function Disruptions() {
  const qc = useQueryClient();
  const state = useQuery({ queryKey: opsStateQueryKey, queryFn: fetchOpsState });

  const [routeNumber, setRouteNumber] = useState(DTC_ROUTES[0]?.routeNumber ?? "");
  const [type, setType] = useState<string>(DISRUPTION_TYPES[0]);
  const [severity, setSeverity] = useState<string>("High");
  const [clock, setClock] = useState("10:45");
  const [durationMin, setDurationMin] = useState(45);
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [impact, setImpact] = useState<DisruptionImpact | null>(null);

  const raise = useMutation({
    mutationFn: () =>
      createDisruption({
        data: {
          routeNumber,
          type,
          severity,
          startMin: clockToMinutes(clock),
          durationMin,
          location: location || `Route ${routeNumber} corridor`,
          description: description || `${severity} ${type.toLowerCase()} on route ${routeNumber}`,
        },
      }),
    onSuccess: (res) => {
      setImpact(res.impact as DisruptionImpact);
      qc.invalidateQueries({ queryKey: opsStateQueryKey });
      qc.invalidateQueries({ queryKey: ["buses"] });
      qc.invalidateQueries({ queryKey: ["crew"] });
    },
  });

  const resolve = useMutation({
    mutationFn: (id: string) => resolveDisruption({ data: { id } }),
    onSuccess: () => {
      setImpact(null);
      qc.invalidateQueries({ queryKey: opsStateQueryKey });
      qc.invalidateQueries({ queryKey: ["buses"] });
      qc.invalidateQueries({ queryKey: ["crew"] });
    },
  });

  const disruptions = state.data?.disruptions ?? [];
  const active = disruptions.filter((d) => d.status === "ACTIVE");
  const shown = impact ?? (active[0]?.impact as DisruptionImpact | undefined) ?? null;
  const activeRecord = active[0];

  const busPool = useMemo(() => state.data?.buses ?? [], [state.data]);

  return (
    <div className="space-y-8">
      <PageHead
        eyebrow="Feature 6 — Disruption simulation"
        title="Disruption desk"
        description="Raise a real incident against the operating-day plan. The engine locates every affected trip, vehicle and crew member, quarantines them and re-rosters the corridor from the live resource pool."
        aside={
          <div className="flex items-center gap-2 rounded-md bg-destructive-tint px-5 py-4">
            <Radio className="h-5 w-5 text-destructive" strokeWidth={2.4} />
            <span className="label-xs text-destructive">
              {active.length} active incident{active.length === 1 ? "" : "s"}
            </span>
          </div>
        }
      />

      <Panel
        title="Simulate a disruption"
        hint="Choose the corridor, the nature and severity of the event, when it starts and how long it lasts."
      >
        <form
          className="grid gap-4 md:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            raise.mutate();
          }}
        >
          <Field label="Route">
            <select className={inputCls} value={routeNumber} onChange={(e) => setRouteNumber(e.target.value)}>
              {DTC_ROUTES.map((r) => (
                <option key={r.routeNumber} value={r.routeNumber}>
                  {r.routeNumber} · {r.origin} → {r.destination}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Disruption type">
            <select className={inputCls} value={type} onChange={(e) => setType(e.target.value)}>
              {DISRUPTION_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Severity">
            <select className={inputCls} value={severity} onChange={(e) => setSeverity(e.target.value)}>
              {SEVERITIES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Start time">
            <input type="time" className={inputCls} value={clock} onChange={(e) => setClock(e.target.value)} />
          </Field>
          <Field label="Duration">
            <select
              className={inputCls}
              value={durationMin}
              onChange={(e) => setDurationMin(Number(e.target.value))}
            >
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {d} minutes
                </option>
              ))}
            </select>
          </Field>
          <Field label="Location">
            <input
              className={inputCls}
              placeholder="e.g. Ring Road · Ashram Chowk"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </Field>
          <Field label="Description" className="md:col-span-2">
            <input
              className={inputCls}
              placeholder="What happened on the corridor?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={raise.isPending}
              className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-md bg-destructive px-6 text-sm font-semibold text-destructive-foreground transition-transform duration-200 hover:scale-105 disabled:opacity-60"
            >
              <Siren className="h-4 w-4" strokeWidth={2.5} />
              {raise.isPending ? "Simulating…" : "Raise disruption"}
            </button>
          </div>
        </form>
        {raise.isError ? (
          <p className="mt-4 text-sm text-destructive">{(raise.error as Error).message}</p>
        ) : null}
      </Panel>

      {shown ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Affected trips"
              value={shown.affectedTrips.length}
              tone="destructive"
              icon={<Siren className="h-5 w-5" strokeWidth={2.4} />}
            />
            <Metric
              label="Passengers impacted"
              value={shown.passengersImpacted.toLocaleString("en-IN")}
              tone="accent"
            />
            <Metric
              label="Recovery rate"
              value={shown.recoveryRatePct}
              unit="%"
              tone="secondary"
              icon={<TimerReset className="h-5 w-5" strokeWidth={2.4} />}
              delta={`${shown.recovered.length} of ${shown.affectedTrips.length} trips re-covered`}
            />
            <Metric
              label="Added delay"
              value={shown.addedDelayMin}
              unit="min"
              tone="primary"
              delta={`${shown.unrecovered.length} trips still uncovered`}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <Panel title="Affected trips" hint="Running inside the incident window on the blocked corridor.">
              <ul className="max-h-64 space-y-2 overflow-y-auto">
                {shown.affectedTrips.map((t) => (
                  <li key={t.tripId} className="rounded-md bg-muted px-4 py-3">
                    <p className="num text-sm font-semibold">{t.tripCode}</p>
                    <p className="num text-xs text-muted-foreground">{t.window}</p>
                  </li>
                ))}
                {!shown.affectedTrips.length && (
                  <li className="text-sm text-muted-foreground">
                    No trips were running on this corridor in that window.
                  </li>
                )}
              </ul>
            </Panel>
            <Panel title="Affected vehicles" hint="Marked in the fleet register for the duration of the event.">
              <ul className="max-h-64 space-y-2 overflow-y-auto">
                {dedupe(shown.affectedBuses).map((b) => (
                  <li key={b.id} className="num rounded-md bg-muted px-4 py-3 text-sm">
                    {b.label}
                  </li>
                ))}
                {!shown.affectedBuses.length && (
                  <li className="text-sm text-muted-foreground">No vehicles trapped.</li>
                )}
              </ul>
            </Panel>
            <Panel title="Affected crew" hint="Released from the duty and re-rostered where possible.">
              <ul className="max-h-64 space-y-2 overflow-y-auto">
                {dedupe(shown.affectedCrew).map((c) => (
                  <li key={c.id} className="rounded-md bg-muted px-4 py-3 text-sm">
                    {c.label}
                  </li>
                ))}
                {!shown.affectedCrew.length && (
                  <li className="text-sm text-muted-foreground">No crew affected.</li>
                )}
              </ul>
            </Panel>
          </div>

          <Panel
            title="Recovery roster"
            hint="Replacement vehicles and relief crew published to the live schedule."
            action={
              activeRecord ? (
                <button
                  onClick={() => resolve.mutate(activeRecord.id)}
                  disabled={resolve.isPending}
                  className="inline-flex h-11 items-center gap-2 rounded-md bg-secondary px-5 text-sm font-semibold text-secondary-foreground transition-transform duration-200 hover:scale-105 disabled:opacity-60"
                >
                  <CheckCircle2 className="h-4 w-4" strokeWidth={2.5} />
                  {resolve.isPending ? "Clearing…" : "Mark resolved"}
                </button>
              ) : null
            }
          >
            <DataTable
              head={
                <>
                  <Th>Trip</Th>
                  <Th>Window</Th>
                  <Th>Route</Th>
                  <Th>Replacement bus</Th>
                  <Th>Relief crew</Th>
                  <Th className="text-right">Delay</Th>
                </>
              }
            >
              {shown.recovered.map((a) => (
                <tr key={a.tripId} className="transition-colors duration-200 hover:bg-muted">
                  <Td className="num font-semibold">{a.tripCode}</Td>
                  <Td className="num">{a.window}</Td>
                  <Td>
                    <Pill tone="primary">{a.routeNumber}</Pill>
                  </Td>
                  <Td className="num">
                    {a.busCode} · {a.busNumber}
                  </Td>
                  <Td>
                    {a.driverName}
                    {a.conductorName ? ` · ${a.conductorName}` : ""}
                  </Td>
                  <Td className="num text-right font-semibold">+{a.delayMin} min</Td>
                </tr>
              ))}
            </DataTable>
            {shown.unrecovered.length ? (
              <div className="mt-6 rounded-md bg-destructive-tint p-5">
                <p className="label-xs text-destructive">
                  {shown.unrecovered.length} trip(s) could not be recovered
                </p>
                <ul className="mt-3 space-y-2">
                  {shown.unrecovered.map((u) => (
                    <li key={u.tripId} className="text-sm">
                      <span className="num font-semibold">{u.tripCode}</span> · {u.detail}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="mt-6 grid gap-px overflow-hidden rounded-md bg-border sm:grid-cols-4">
              {[
                { k: "Coverage before", v: `${shown.baseline.coveragePct}%` },
                { k: "Coverage after", v: `${shown.disrupted.coveragePct}%` },
                { k: "Replacement buses", v: shown.replacementBusesRequired },
                { k: "Relief crew", v: shown.reliefCrewRequired },
              ].map((s) => (
                <div key={s.k} className="bg-card p-5">
                  <p className="label-xs text-muted-foreground">{s.k}</p>
                  <p className="num mt-2 text-2xl font-extrabold">{s.v}</p>
                </div>
              ))}
            </div>
          </Panel>
        </>
      ) : (
        <Panel title="No incident selected" hint="Raise a disruption above to run the recovery engine.">
          <p className="text-sm text-muted-foreground">
            The engine will assess {busPool.length} vehicles and the full crew roster against the
            operating-day plan.
          </p>
        </Panel>
      )}

      <Panel title="Incident register" hint="Every disruption raised against this network, newest first.">
        <ul className="grid gap-4 md:grid-cols-3">
          {disruptions.map((d) => (
            <li key={d.id} className="rounded-lg bg-muted p-6">
              <div className="flex items-center justify-between">
                <Pill tone={severityTone(d.severity)}>{d.severity}</Pill>
                <span className="num label-xs text-muted-foreground">{d.reference}</span>
              </div>
              <h3 className="mt-4 flex items-center gap-2 text-lg font-bold">
                <CircleAlert className="h-4 w-4 text-muted-foreground" strokeWidth={2.4} />
                {d.disruption_type}
              </h3>
              <p className="num mt-1 text-sm text-muted-foreground">
                Route {d.route_number} · {minutesToClock(d.start_min)} for {d.duration_min} min
              </p>
              <p className="mt-4 text-sm leading-relaxed">
                {d.affected_trips} trips affected · {d.recovered_trips} recovered ·{" "}
                {d.recovery_rate_pct}% recovery
              </p>
              <div className="mt-5 flex items-center justify-between">
                <span className="label-xs text-secondary">{d.status}</span>
                {d.status === "ACTIVE" ? (
                  <button
                    onClick={() => resolve.mutate(d.id)}
                    className="label-xs rounded-sm bg-background px-3 py-2 transition-colors hover:bg-border"
                  >
                    Resolve
                  </button>
                ) : null}
              </div>
            </li>
          ))}
          {!disruptions.length && (
            <li className="text-sm text-muted-foreground">No disruptions recorded yet.</li>
          )}
        </ul>
      </Panel>
    </div>
  );
}

const inputCls =
  "h-12 w-full rounded-md bg-muted px-3 text-sm font-medium focus:bg-background focus:outline-none";

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="label-xs text-muted-foreground">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function dedupe(items: { id: string; label: string }[]) {
  const map = new Map(items.map((i) => [i.id, i]));
  return [...map.values()];
}
