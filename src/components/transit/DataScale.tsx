import { useQuery } from "@tanstack/react-query";
import { Panel, Pill } from "@/components/transit/primitives";
import { DEMO_FLEET, DEMO_SHARE_PCT, OFFICIAL_NETWORK } from "@/data/network-scale";
import { busesQueryKey, fetchBuses } from "@/lib/fleet-api";
import { crewQueryKey, fetchCrew } from "@/lib/crew-api";

/**
 * Feature 16 — data scale.
 * Keeps the official network baseline and the controlled demo operational
 * fleet visually and textually separated so no figure is ever mistaken for
 * the other.
 */
export function DataScale() {
  const { data: buses = [] } = useQuery({ queryKey: busesQueryKey, queryFn: fetchBuses });
  const { data: crew = [] } = useQuery({ queryKey: crewQueryKey, queryFn: fetchCrew });

  const reference = [
    ["Stops", OFFICIAL_NETWORK.stops.toLocaleString("en-IN")],
    ["Routes", OFFICIAL_NETWORK.routes.toLocaleString("en-IN")],
    ["Agencies", `${OFFICIAL_NETWORK.agencies}`],
    ["Fleet baseline", OFFICIAL_NETWORK.fleetBaseline.toLocaleString("en-IN")],
    ["Terminals", `${OFFICIAL_NETWORK.terminals}`],
    ["Depots", `${OFFICIAL_NETWORK.depots}`],
  ];

  const operational = [
    ["Demo depots", `${DEMO_FLEET.depots}`],
    ["Buses per depot", `${DEMO_FLEET.busesPerDepot}`],
    ["Demo fleet size", `${DEMO_FLEET.totalBuses}`],
    ["Buses in database", `${buses.length}`],
    ["Crew in database", `${crew.length}`],
    ["Share of baseline", `${DEMO_SHARE_PCT}%`],
  ];

  return (
    <Panel
      title="Data scale"
      hint="Reference network figures and the operational demo fleet are kept strictly separate — the simulation and solver only ever run on the demo fleet."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-lg bg-muted p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-bold">Official network baseline</h3>
            <Pill tone="violet">Reference only · not simulated</Pill>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{OFFICIAL_NETWORK.source}</p>
          <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {reference.map(([k, v]) => (
              <div key={k}>
                <dt className="label-xs text-muted-foreground">{k}</dt>
                <dd className="num text-xl font-extrabold text-violet">{v}</dd>
              </div>
            ))}
          </dl>
        </article>

        <article className="rounded-lg bg-muted p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-bold">Demo operational fleet</h3>
            <Pill tone="primary">Used by simulation &amp; solver</Pill>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {DEMO_FLEET.depots} depots × {DEMO_FLEET.busesPerDepot} buses ={" "}
            {DEMO_FLEET.totalBuses} vehicles. The {OFFICIAL_NETWORK.fleetBaseline.toLocaleString("en-IN")}-bus
            baseline is never loaded into the assignment engine.
          </p>
          <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {operational.map(([k, v]) => (
              <div key={k}>
                <dt className="label-xs text-muted-foreground">{k}</dt>
                <dd className="num text-xl font-extrabold text-primary">{v}</dd>
              </div>
            ))}
          </dl>
        </article>
      </div>
    </Panel>
  );
}

export default DataScale;
