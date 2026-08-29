import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircuitBoard, Play, Rocket, Sparkles } from "lucide-react";
import { Meter, PageHead, Panel, Pill } from "@/components/transit/primitives";
import { DTC_ROUTES } from "@/data/transitData";
import { clockToMinutes } from "@/lib/day-plan";
import type { PlanMetrics, ScenarioResult } from "@/lib/ops-engine";
import {
  applyScenario,
  fetchOpsState,
  opsStateQueryKey,
  previewScenario,
} from "@/lib/ops-api";

export const Route = createFileRoute("/optimizer")({
  head: () => ({
    meta: [
      { title: "What-If Simulation — DTC TransitOps" },
      {
        name: "description",
        content:
          "Model bus withdrawals, crew shortages, corridor closures and demand surges against the live DTC plan, then apply the winning scenario.",
      },
      { property: "og:title", content: "What-If Simulation — DTC TransitOps" },
      {
        property: "og:description",
        content: "Compare baseline versus scenario coverage, conflicts and resource availability.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Optimizer,
});

type Row = {
  key: keyof PlanMetrics;
  label: string;
  unit?: string;
  lowerIsBetter: boolean;
};

const ROWS: Row[] = [
  { key: "coveragePct", label: "Trip coverage", unit: "%", lowerIsBetter: false },
  { key: "coveredTrips", label: "Trips covered", lowerIsBetter: false },
  { key: "uncoveredTrips", label: "Trips uncovered", lowerIsBetter: true },
  { key: "busesUsed", label: "Buses required", lowerIsBetter: true },
  { key: "eligibleBuses", label: "Buses available", lowerIsBetter: false },
  { key: "crewUsed", label: "Crew rostered", lowerIsBetter: true },
  { key: "eligibleCrew", label: "Crew available", lowerIsBetter: false },
  { key: "busUtilizationPct", label: "Bus utilisation", unit: "%", lowerIsBetter: false },
  { key: "crewUtilizationPct", label: "Crew utilisation", unit: "%", lowerIsBetter: false },
  { key: "scheduleConflicts", label: "Schedule conflicts", lowerIsBetter: true },
  { key: "replacementBusesRequired", label: "Replacement buses needed", lowerIsBetter: true },
  { key: "crewShortage", label: "Crew shortfalls", lowerIsBetter: true },
  { key: "totalDelayMin", label: "Injected delay", unit: " min", lowerIsBetter: true },
  { key: "serviceHours", label: "Service hours", unit: " h", lowerIsBetter: false },
];

function Optimizer() {
  const qc = useQueryClient();
  const state = useQuery({ queryKey: opsStateQueryKey, queryFn: fetchOpsState });

  const [label, setLabel] = useState("Peak-hour resource stress test");
  const [busesUnavailable, setBusesUnavailable] = useState(2);
  const [crewUnavailable, setCrewUnavailable] = useState(2);
  const [blockedRoute, setBlockedRoute] = useState("");
  const [blockClock, setBlockClock] = useState("17:30");
  const [blockDurationMin, setBlockDurationMin] = useState(60);
  const [extraPeakTripsPct, setExtraPeakTripsPct] = useState(20);

  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  const run = useMutation({
    mutationFn: () =>
      previewScenario({
        data: {
          label,
          busesUnavailable,
          crewUnavailable,
          blockedRoute: blockedRoute || null,
          blockStartMin: clockToMinutes(blockClock),
          blockDurationMin,
          extraPeakTripsPct,
        },
      }),
    onSuccess: (res) => {
      setResult(res.result as ScenarioResult);
      setScenarioId(res.scenario.id);
      setApplied(false);
      qc.invalidateQueries({ queryKey: opsStateQueryKey });
    },
  });

  const apply = useMutation({
    mutationFn: (id: string) => applyScenario({ data: { id } }),
    onSuccess: (res) => {
      setResult(res.result as ScenarioResult);
      setApplied(true);
      qc.invalidateQueries({ queryKey: opsStateQueryKey });
      qc.invalidateQueries({ queryKey: ["buses"] });
      qc.invalidateQueries({ queryKey: ["crew"] });
    },
  });

  const scenarios = state.data?.scenarios ?? [];

  return (
    <div className="space-y-8">
      <PageHead
        eyebrow="Feature 7 — What-if simulation"
        title="Scenario studio"
        description="Model a hypothetical operating day against a copy of the plan. Nothing touches the live schedule until you apply the scenario."
        aside={
          <button
            onClick={() => run.mutate()}
            disabled={run.isPending}
            className="inline-flex h-16 items-center gap-2 rounded-md bg-primary px-8 text-sm font-semibold text-primary-foreground transition-all duration-200 hover:scale-105 disabled:opacity-70"
          >
            {run.isPending ? (
              <>
                <CircuitBoard className="h-5 w-5 animate-spin" strokeWidth={2.5} />
                Simulating…
              </>
            ) : (
              <>
                <Play className="h-5 w-5" strokeWidth={2.5} />
                {result ? "Re-run scenario" : "Run scenario"}
              </>
            )}
          </button>
        }
      />

      <Panel title="Scenario inputs" hint="Withdraw resources, close a corridor or inject extra peak demand.">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Scenario name">
            <input className={inputCls} value={label} onChange={(e) => setLabel(e.target.value)} />
          </Field>
          <Field label={`Buses withdrawn (${busesUnavailable})`}>
            <input
              type="range"
              min={0}
              max={Math.max(1, (state.data?.buses.length ?? 8) - 1)}
              value={busesUnavailable}
              onChange={(e) => setBusesUnavailable(Number(e.target.value))}
              className="w-full accent-[var(--primary)]"
            />
          </Field>
          <Field label={`Drivers withdrawn (${crewUnavailable})`}>
            <input
              type="range"
              min={0}
              max={Math.max(1, (state.data?.crew.length ?? 8) - 1)}
              value={crewUnavailable}
              onChange={(e) => setCrewUnavailable(Number(e.target.value))}
              className="w-full accent-[var(--primary)]"
            />
          </Field>
          <Field label="Corridor closed">
            <select className={inputCls} value={blockedRoute} onChange={(e) => setBlockedRoute(e.target.value)}>
              <option value="">No closure</option>
              {DTC_ROUTES.map((r) => (
                <option key={r.routeNumber} value={r.routeNumber}>
                  {r.routeNumber} · {r.origin} → {r.destination}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Closure starts">
            <input
              type="time"
              className={inputCls}
              value={blockClock}
              onChange={(e) => setBlockClock(e.target.value)}
            />
          </Field>
          <Field label={`Closure duration (${blockDurationMin} min)`}>
            <input
              type="range"
              min={15}
              max={180}
              step={15}
              value={blockDurationMin}
              onChange={(e) => setBlockDurationMin(Number(e.target.value))}
              className="w-full accent-[var(--primary)]"
            />
          </Field>
          <Field label={`Extra peak trips (+${extraPeakTripsPct}%)`}>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={extraPeakTripsPct}
              onChange={(e) => setExtraPeakTripsPct(Number(e.target.value))}
              className="w-full accent-[var(--primary)]"
            />
          </Field>
        </div>
        {run.isError ? (
          <p className="mt-4 text-sm text-destructive">{(run.error as Error).message}</p>
        ) : null}
      </Panel>

      {result ? (
        <>
          <section className="grid gap-px overflow-hidden rounded-lg bg-border sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                k: "Coverage delta",
                v: `${round(result.scenario.coveragePct - result.baseline.coveragePct)}%`,
                tone: result.scenario.coveragePct >= result.baseline.coveragePct ? "text-secondary" : "text-destructive",
              },
              { k: "Buses withdrawn", v: result.withdrawnBuses.length, tone: "text-violet" },
              { k: "Crew withdrawn", v: result.withdrawnCrew.length, tone: "text-accent" },
              { k: "Extra trips injected", v: result.addedTrips, tone: "text-primary" },
            ].map((s) => (
              <div key={s.k} className="bg-card p-6">
                <p className="label-xs text-muted-foreground">{s.k}</p>
                <p className={`num mt-3 text-3xl font-extrabold ${s.tone}`}>{s.v}</p>
              </div>
            ))}
          </section>

          <Panel
            title="Baseline versus scenario"
            hint="Baseline is the live plan as it stands today; the scenario runs on an isolated copy."
            action={
              <div className="flex items-center gap-3">
                <Pill tone={applied ? "secondary" : "primary"} solid>
                  <Sparkles className="h-3.5 w-3.5" strokeWidth={2.5} />
                  {applied ? "Applied to live schedule" : "Scenario only — schedule untouched"}
                </Pill>
                <button
                  onClick={() => scenarioId && apply.mutate(scenarioId)}
                  disabled={!scenarioId || apply.isPending || applied}
                  className="inline-flex h-12 items-center gap-2 rounded-md bg-ink px-5 text-sm font-semibold text-ink-foreground transition-transform duration-200 hover:scale-105 disabled:opacity-60"
                >
                  <Rocket className="h-4 w-4" strokeWidth={2.5} />
                  {apply.isPending ? "Applying…" : applied ? "Applied" : "Apply scenario"}
                </button>
              </div>
            }
          >
            <ul className="space-y-6">
              {ROWS.map((r) => {
                const base = Number(result.baseline[r.key]);
                const opt = Number(result.scenario[r.key]);
                const improved = r.lowerIsBetter ? opt <= base : opt >= base;
                const delta = base === 0 ? (opt === 0 ? 0 : 100) : Math.round(((opt - base) / base) * 100);
                const max = Math.max(base, opt, 1);
                const fmt = (n: number) => `${n}${r.unit ?? ""}`;
                return (
                  <li key={r.key} className="grid gap-3 sm:grid-cols-[220px_1fr_120px] sm:items-center">
                    <p className="text-sm font-semibold">{r.label}</p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="label-xs w-16 text-muted-foreground">Base</span>
                        <Meter value={(base / max) * 100} tone="neutral" />
                        <span className="num w-28 text-right text-sm text-muted-foreground">{fmt(base)}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="label-xs w-16 text-primary">Scenario</span>
                        <Meter value={(opt / max) * 100} tone={improved ? "secondary" : "destructive"} />
                        <span className="num w-28 text-right text-sm font-bold">{fmt(opt)}</span>
                      </div>
                    </div>
                    <div className="sm:text-right">
                      <Pill tone={improved ? "secondary" : "destructive"}>
                        {delta > 0 ? "+" : ""}
                        {delta}%
                      </Pill>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Panel>

          <div className="grid gap-4 xl:grid-cols-3">
            <Panel title="Withdrawn vehicles" hint="Removed from the assignable pool in this scenario.">
              <ul className="space-y-2">
                {result.withdrawnBuses.map((b) => (
                  <li key={b.id} className="num rounded-md bg-muted px-4 py-3 text-sm">
                    {b.label}
                  </li>
                ))}
                {!result.withdrawnBuses.length && (
                  <li className="text-sm text-muted-foreground">None withdrawn.</li>
                )}
              </ul>
            </Panel>
            <Panel title="Withdrawn crew" hint="Drivers taken off the roster in this scenario.">
              <ul className="space-y-2">
                {result.withdrawnCrew.map((c) => (
                  <li key={c.id} className="rounded-md bg-muted px-4 py-3 text-sm">
                    {c.label}
                  </li>
                ))}
                {!result.withdrawnCrew.length && (
                  <li className="text-sm text-muted-foreground">None withdrawn.</li>
                )}
              </ul>
            </Panel>
            <Panel title="Conflicts & gaps" hint="Trips the scenario could not cover, with the blocking reason.">
              <ul className="max-h-72 space-y-2 overflow-y-auto">
                {result.uncovered.map((u) => (
                  <li key={u.tripId} className="rounded-md bg-destructive-tint px-4 py-3">
                    <p className="num text-sm font-semibold text-destructive">{u.tripCode}</p>
                    <p className="text-xs text-muted-foreground">
                      {u.window} · {u.detail}
                    </p>
                  </li>
                ))}
                {!result.uncovered.length && (
                  <li className="text-sm text-muted-foreground">Every trip stayed covered.</li>
                )}
              </ul>
            </Panel>
          </div>
        </>
      ) : null}

      <Panel title="Saved scenarios" hint="Every scenario run is stored so you can compare or apply it later.">
        <ul className="grid gap-4 md:grid-cols-3">
          {scenarios.map((s) => (
            <li key={s.id} className="rounded-lg bg-muted p-6">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-bold">{s.label}</h3>
                <Pill tone={s.applied ? "secondary" : "neutral"}>{s.applied ? "Applied" : "Draft"}</Pill>
              </div>
              <p className="num mt-3 text-sm text-muted-foreground">
                Coverage {s.result?.scenario?.coveragePct ?? 0}% · conflicts{" "}
                {s.result?.scenario?.scheduleConflicts ?? 0}
              </p>
              {!s.applied ? (
                <button
                  onClick={() => {
                    setScenarioId(s.id);
                    apply.mutate(s.id);
                  }}
                  className="label-xs mt-4 rounded-sm bg-background px-3 py-2 transition-colors hover:bg-border"
                >
                  Apply scenario
                </button>
              ) : null}
            </li>
          ))}
          {!scenarios.length && <li className="text-sm text-muted-foreground">No scenarios yet.</li>}
        </ul>
      </Panel>
    </div>
  );
}

const inputCls =
  "h-12 w-full rounded-md bg-muted px-3 text-sm font-medium focus:bg-background focus:outline-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label-xs text-muted-foreground">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function round(n: number) {
  return Math.round(n * 10) / 10;
}
