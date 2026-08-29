import { createFileRoute } from "@tanstack/react-router";
import { TrendingDown, TrendingUp } from "lucide-react";
import { BarSeries, Metric, Meter, PageHead, Panel, Pill } from "@/components/transit/primitives";
import { inr } from "@/lib/transit-ui";
import {
  BASELINE_OPTIMIZATION_METRICS,
  OPTIMIZED_RESULTS_METRICS,
  DTC_DEPOTS,
  DTC_ROUTES,
} from "@/data/transitData";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — DTC TransitOps" },
      {
        name: "description",
        content:
          "Punctuality, fuel, deadhead and cost analytics proving the impact of automated DTC bus scheduling.",
      },
      { property: "og:title", content: "Analytics — DTC TransitOps" },
      {
        property: "og:description",
        content: "Punctuality, deadhead and cost analytics for the DTC scheduling programme.",
      },
    ],
  }),
  component: Analytics,
});

const PUNCTUALITY = [
  { label: "Mon", value: 82 },
  { label: "Tue", value: 84 },
  { label: "Wed", value: 87 },
  { label: "Thu", value: 86 },
  { label: "Fri", value: 91 },
  { label: "Sat", value: 94 },
  { label: "Sun", value: 89 },
];

const DEADHEAD = [
  { label: "W1", value: 1420 },
  { label: "W2", value: 1305 },
  { label: "W3", value: 1188 },
  { label: "W4", value: 1042 },
  { label: "W5", value: 964 },
  { label: "W6", value: 902 },
];

function Analytics() {
  const saving =
    BASELINE_OPTIMIZATION_METRICS.operatingCostPerDay -
    OPTIMIZED_RESULTS_METRICS.operatingCostPerDay;
  const busesSaved =
    BASELINE_OPTIMIZATION_METRICS.totalBusesRequired - OPTIMIZED_RESULTS_METRICS.totalBusesRequired;
  const networkKm = DTC_ROUTES.reduce((s, r) => s + r.distanceKm, 0);

  return (
    <div className="space-y-8">
      <PageHead
        eyebrow="Phase 8 — KPI proofs"
        title="Programme analytics"
        description="Six weeks of scheduling output measured against the manual baseline: punctuality up, deadhead down, fewer buses for the same service."
        aside={
          <Pill tone="secondary" solid>
            <TrendingUp className="h-3.5 w-3.5" strokeWidth={2.5} />
            Trending positive
          </Pill>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Annualised saving"
          value={`₹${inr(saving * 365)}`}
          tone="secondary"
          delta={`₹${inr(saving)} per operating day`}
        />
        <Metric
          label="Buses released"
          value={busesSaved}
          tone="primary"
          delta="Same service level, smaller fleet"
        />
        <Metric
          label="Deadhead reduction"
          value={Math.round(
            ((BASELINE_OPTIMIZATION_METRICS.deadheadKm - OPTIMIZED_RESULTS_METRICS.deadheadKm) /
              BASELINE_OPTIMIZATION_METRICS.deadheadKm) *
              100,
          )}
          unit="%"
          tone="accent"
          icon={<TrendingDown className="h-5 w-5" strokeWidth={2.4} />}
        />
        <Metric
          label="Network length"
          value={Math.round(networkKm)}
          unit="km"
          tone="violet"
          delta={`${DTC_ROUTES.length} corridors mapped`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Punctuality index" hint="Share of trips arriving within a 5-minute window.">
          <BarSeries data={PUNCTUALITY} tone="primary" peakTone="secondary" height={200} />
        </Panel>
        <Panel title="Weekly deadhead kilometres" hint="Empty running since the solver went live.">
          <BarSeries data={DEADHEAD} tone="accent" peakTone="destructive" height={200} />
        </Panel>
      </div>

      <Panel title="Depot scorecard" hint="Utilisation and workshop load by depot.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {DTC_DEPOTS.map((d) => {
            const util = Math.round((d.activeFleet / d.totalFleet) * 100);
            const shop = Math.round((d.maintenanceFleet / d.totalFleet) * 100);
            return (
              <article
                key={d.id}
                className="group rounded-lg bg-muted p-6 transition-all duration-200 hover:scale-[1.02] hover:bg-background"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold">{d.name}</h3>
                  <span className="num label-xs rounded-sm bg-ink px-2 py-1 text-ink-foreground">
                    {d.code}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{d.manager}</p>
                <div className="mt-5 space-y-4">
                  <div>
                    <div className="flex justify-between text-sm font-semibold">
                      <span className="label-xs text-muted-foreground">Utilisation</span>
                      <span className="num text-primary">{util}%</span>
                    </div>
                    <Meter value={util} tone="primary" className="mt-2" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm font-semibold">
                      <span className="label-xs text-muted-foreground">Workshop load</span>
                      <span className="num text-accent">{shop}%</span>
                    </div>
                    <Meter value={shop} tone="accent" className="mt-2" />
                  </div>
                </div>
                <p className="num mt-5 text-xs text-muted-foreground">
                  Fleet {d.totalFleet} · standby {d.standbyFleet}
                </p>
              </article>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
