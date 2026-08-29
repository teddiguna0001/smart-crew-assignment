import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  BusFront,
  Fuel,
  Gauge,
  MapPin,
  Route as RouteIcon,
  TimerReset,
  Users,
} from "lucide-react";
import {
  BarSeries,
  DataTable,
  Metric,
  Meter,
  Panel,
  Pill,
  Td,
  Th,
} from "@/components/transit/primitives";
import { busTone } from "@/lib/transit-ui";
import {
  DTC_DEPOTS,
  DTC_ROUTES,
  LIVE_BUSES,
  INITIAL_TRIPS,
  BASELINE_OPTIMIZATION_METRICS,
} from "@/data/transitData";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Operations Control — DTC TransitOps" },
      {
        name: "description",
        content:
          "Live DTC fleet status, depot readiness and corridor load for the automated bus scheduling control centre.",
      },
      { property: "og:title", content: "Operations Control — DTC TransitOps" },
      {
        property: "og:description",
        content: "Live DTC fleet status, depot readiness and corridor load in one flat control board.",
      },
    ],
  }),
  component: Operations,
});

const HEADWAY = [
  { label: "04", value: 18 },
  { label: "06", value: 62 },
  { label: "08", value: 96 },
  { label: "10", value: 54 },
  { label: "12", value: 41 },
  { label: "14", value: 45 },
  { label: "16", value: 68 },
  { label: "18", value: 92 },
  { label: "20", value: 57 },
  { label: "22", value: 29 },
];

function Operations() {
  const [filter, setFilter] = useState<"all" | "on-time" | "delayed" | "critical-delay">("all");

  const buses = useMemo(
    () => (filter === "all" ? LIVE_BUSES : LIVE_BUSES.filter((b) => b.status === filter)),
    [filter],
  );

  const fleet = DTC_DEPOTS.reduce(
    (acc, d) => {
      acc.total += d.totalFleet;
      acc.active += d.activeFleet;
      acc.standby += d.standbyFleet;
      acc.maintenance += d.maintenanceFleet;
      return acc;
    },
    { total: 0, active: 0, standby: 0, maintenance: 0 },
  );

  const onTime = LIVE_BUSES.filter((b) => b.status === "on-time").length;
  const punctuality = Math.round((onTime / LIVE_BUSES.length) * 100);
  const conflicts = INITIAL_TRIPS.filter((t) => t.status === "Conflict").length;

  return (
    <div className="space-y-8">
      {/* Poster-style hero block: solid ink, flat grid paper, zero depth. */}
      <section className="relative overflow-hidden rounded-lg bg-ink px-6 py-10 sm:px-10 sm:py-14">
        <div className="grid-paper pointer-events-none absolute inset-0" />
        <div className="pointer-events-none absolute -top-24 -right-16 h-72 w-72 rounded-full bg-primary/25" />
        <div className="pointer-events-none absolute right-40 -bottom-24 h-56 w-56 rotate-12 rounded-lg bg-secondary/20" />
        <div className="relative grid gap-10 lg:grid-cols-[1.5fr_1fr]">
          <div>
            <Pill tone="accent" solid>
              Weekday roster · 29 Aug
            </Pill>
            <h1 className="mt-5 text-4xl font-extrabold text-ink-foreground sm:text-6xl">
              Every bus, every duty,
              <br />
              scheduled by the solver.
            </h1>
            <p className="mt-5 max-w-xl text-base text-ink-foreground/70">
              TransitOps ingests GTFS, builds turnaround blocks, rosters crew inside CMVR limits and
              re-optimises the network the moment a vehicle drops out.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/optimizer"
                className="inline-flex h-14 items-center gap-2 rounded-md bg-primary px-7 text-sm font-semibold text-primary-foreground transition-all duration-200 hover:scale-105"
              >
                Run network optimiser
                <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
              </Link>
              <Link
                to="/disruptions"
                className="inline-flex h-14 items-center rounded-md border-4 border-ink-foreground/40 px-7 text-sm font-semibold text-ink-foreground transition-all duration-200 hover:scale-105 hover:border-accent hover:bg-accent hover:text-accent-foreground"
              >
                Disruption desk
              </Link>
            </div>
          </div>
          <dl className="relative grid grid-cols-2 gap-px overflow-hidden rounded-md bg-ink-foreground/15">
            {[
              { k: "Fleet on road", v: fleet.active, tone: "text-primary" },
              { k: "Standby", v: fleet.standby, tone: "text-secondary" },
              { k: "Routes live", v: DTC_ROUTES.length, tone: "text-accent" },
              { k: "Depots", v: DTC_DEPOTS.length, tone: "text-ink-foreground" },
            ].map((s) => (
              <div key={s.k} className="bg-ink p-6">
                <dt className="label-xs text-ink-foreground/50">{s.k}</dt>
                <dd className={`num mt-3 text-4xl font-extrabold ${s.tone}`}>{s.v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Punctuality index"
          value={punctuality}
          unit="%"
          tone="secondary"
          delta={`${onTime} of ${LIVE_BUSES.length} tracked buses within 5 min`}
          icon={<TimerReset className="h-5 w-5" strokeWidth={2.4} />}
        />
        <Metric
          label="Fleet utilisation"
          value={BASELINE_OPTIMIZATION_METRICS.fleetUtilization}
          unit="%"
          tone="primary"
          delta={`${fleet.total} vehicles across ${DTC_DEPOTS.length} depots`}
          icon={<Gauge className="h-5 w-5" strokeWidth={2.4} />}
        />
        <Metric
          label="Deadhead today"
          value={BASELINE_OPTIMIZATION_METRICS.deadheadKm}
          unit="km"
          tone="accent"
          delta="Depot-to-terminal empty running"
          icon={<RouteIcon className="h-5 w-5" strokeWidth={2.4} />}
        />
        <Metric
          label="Schedule conflicts"
          value={conflicts}
          tone={conflicts ? "destructive" : "secondary"}
          delta="Blocks awaiting dispatcher action"
          icon={<BusFront className="h-5 w-5" strokeWidth={2.4} />}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <Panel
          className="min-w-0"

          title="Live vehicle tracking"
          hint="Telemetry from on-board units, refreshed every 20 seconds."
          action={
            <div className="flex flex-wrap gap-2">
              {(["all", "on-time", "delayed", "critical-delay"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`label-xs rounded-sm px-3 py-2 transition-all duration-200 hover:scale-105 ${
                    filter === f
                      ? "bg-ink text-ink-foreground"
                      : "bg-muted text-muted-foreground hover:bg-border"
                  }`}
                >
                  {f.replace("-", " ")}
                </button>
              ))}
            </div>
          }
        >
          <DataTable
            head={
              <>
                <Th>Vehicle</Th>
                <Th>Route</Th>
                <Th>Crew</Th>
                <Th>Next stop</Th>
                <Th className="text-right">Load</Th>
                <Th className="text-right">Energy</Th>
                <Th>Status</Th>
              </>
            }
          >
            {buses.slice(0, 9).map((bus) => (
              <tr key={bus.busId} className="transition-colors duration-200 hover:bg-muted">
                <Td>
                  <p className="num font-semibold">{bus.regNumber}</p>
                  <p className="text-xs text-muted-foreground">{bus.depot}</p>
                </Td>
                <Td>
                  <span className="num rounded-sm bg-primary-tint px-2 py-1 text-xs font-bold text-primary">
                    {bus.routeNumber}
                  </span>
                </Td>
                <Td className="text-muted-foreground">{bus.driverName}</Td>
                <Td>
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={2.4} />
                    {bus.nextStop}
                  </span>
                </Td>
                <Td className="num text-right font-semibold">{bus.passengers}</Td>
                <Td className="text-right">
                  <span className="num inline-flex items-center gap-1.5 font-semibold">
                    <Fuel className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={2.4} />
                    {bus.batteryOrFuelPct}%
                  </span>
                  <p className="label-xs text-muted-foreground">{bus.fuelType}</p>
                </Td>
                <Td>
                  <Pill tone={busTone(bus.status)}>
                    {bus.status === "on-time" ? "On time" : `${bus.delayMins} min late`}
                  </Pill>
                </Td>
              </tr>
            ))}
          </DataTable>
        </Panel>

        <div className="space-y-4">
          <Panel title="Departures by hour" hint="Scheduled trip starts, network-wide.">
            <BarSeries data={HEADWAY} tone="primary" peakTone="accent" />
          </Panel>
          <Panel title="Depot readiness">
            <ul className="space-y-5">
              {DTC_DEPOTS.slice(0, 5).map((depot) => {
                const pct = Math.round((depot.activeFleet / depot.totalFleet) * 100);
                return (
                  <li key={depot.id}>
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-sm font-semibold">{depot.name}</p>
                      <p className="num text-sm font-bold text-primary">{pct}%</p>
                    </div>
                    <Meter
                      value={pct}
                      tone={pct > 85 ? "destructive" : pct > 70 ? "primary" : "secondary"}
                      className="mt-2"
                    />
                    <p className="num mt-2 text-xs text-muted-foreground">
                      {depot.activeFleet} active · {depot.standbyFleet} standby ·{" "}
                      {depot.maintenanceFleet} workshop
                    </p>
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>
      </div>

      <Panel title="Corridor pressure" hint="Highest-demand routes ranked by active buses.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[...DTC_ROUTES]
            .sort((a, b) => b.activeBuses - a.activeBuses)
            .slice(0, 6)
            .map((route) => (
              <article
                key={route.id}
                className="group rounded-lg bg-muted p-6 transition-all duration-200 hover:scale-[1.02] hover:bg-primary-tint"
              >
                <div className="flex items-center justify-between">
                  <span className="num rounded-sm bg-ink px-2.5 py-1 text-xs font-bold text-ink-foreground">
                    {route.routeNumber}
                  </span>
                  <Pill tone="violet">{route.corridorType}</Pill>
                </div>
                <h3 className="mt-4 text-lg font-bold">{route.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {route.origin} → {route.destination}
                </p>
                <dl className="num mt-5 grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <dt className="label-xs text-muted-foreground">Buses</dt>
                    <dd className="mt-1 font-bold text-primary">{route.activeBuses}</dd>
                  </div>
                  <div>
                    <dt className="label-xs text-muted-foreground">Headway</dt>
                    <dd className="mt-1 font-bold">{route.frequencyMins}m</dd>
                  </div>
                  <div>
                    <dt className="label-xs text-muted-foreground">Length</dt>
                    <dd className="mt-1 font-bold">{route.distanceKm} km</dd>
                  </div>
                </dl>
              </article>
            ))}
        </div>
      </Panel>

      <section className="flex flex-wrap items-center justify-between gap-6 rounded-lg bg-accent px-8 py-10">
        <div className="max-w-xl">
          <p className="label-xs text-accent-foreground/70">Next action</p>
          <h2 className="mt-2 text-3xl font-extrabold text-accent-foreground">
            Rebuild tomorrow's duty roster with CMVR guardrails applied.
          </h2>
        </div>
        <Link
          to="/schedule"
          className="inline-flex h-14 items-center gap-2 rounded-md bg-ink px-7 text-sm font-semibold text-ink-foreground transition-transform duration-200 hover:scale-105"
        >
          Open scheduling board
          <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
        </Link>
      </section>
    </div>
  );
}
