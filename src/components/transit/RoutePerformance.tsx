import { useMemo } from "react";
import { DataTable, Meter, Panel, Pill, Td, Th } from "@/components/transit/primitives";
import { useDaySimulation } from "@/lib/day-simulation";
import { metricText, routePerformanceAt, type MetricResult } from "@/lib/route-performance";

/** Renders a derived metric, or the honest gap when it cannot be calculated. */
function MetricCell({ metric, unit = "" }: { metric: MetricResult; unit?: string }) {
  if (!metric.available) {
    return (
      <span className="label-xs text-muted-foreground" title={metric.note}>
        {metric.reason}
      </span>
    );
  }
  return <span className="num font-semibold">{metricText(metric, unit)}</span>;
}

/**
 * Feature 10 — route-level operational performance, computed from the
 * operating-day plan and the simulation clock. No hardcoded percentages.
 */
export function RoutePerformance() {
  const { minute, clock } = useDaySimulation();
  const rows = useMemo(() => routePerformanceAt(minute), [minute]);

  const totals = rows.reduce(
    (acc, r) => ({
      trips: acc.trips + r.totalTrips,
      completed: acc.completed + r.completedTrips,
      active: acc.active + r.activeBuses,
    }),
    { trips: 0, completed: 0, active: 0 },
  );

  return (
    <Panel
      title="Route performance"
      hint="Trips, coverage and utilisation derived from the operating-day plan at the current simulation time. Metrics the data cannot support are shown as unavailable rather than estimated."
      action={
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone="neutral">Simulation clock {clock}</Pill>
          <Pill tone="primary">{totals.completed}/{totals.trips} trips completed</Pill>
          <Pill tone="secondary">{totals.active} buses running</Pill>
        </div>
      }
    >
      <DataTable
        head={
          <>
            <Th>Route</Th>
            <Th>Trips</Th>
            <Th>Completed</Th>
            <Th>Buses</Th>
            <Th>Avg duration</Th>
            <Th>Delayed</Th>
            <Th>Disrupted</Th>
            <Th>Cancelled</Th>
            <Th className="min-w-[150px]">Coverage</Th>
            <Th>Bus util.</Th>
            <Th>Crew util.</Th>
          </>
        }
      >
        {rows.map((r) => (
          <tr key={r.routeId} className="transition-colors duration-200 hover:bg-muted">
            <Td>
              <div className="flex items-center gap-2">
                <span
                  className="h-3 w-3 shrink-0 rounded-sm"
                  style={{ backgroundColor: r.color }}
                  aria-hidden
                />
                <div>
                  <p className="num font-semibold">{r.routeNumber}</p>
                  <p className="text-xs text-muted-foreground">{r.name}</p>
                </div>
              </div>
            </Td>
            <Td className="num">{r.totalTrips}</Td>
            <Td>
              <span className="num font-semibold">{r.completedTrips}</span>
              <span className="text-xs text-muted-foreground"> · {r.inProgressTrips} running</span>
            </Td>
            <Td>
              <span className="num font-semibold">{r.activeBuses}</span>
              <span className="text-xs text-muted-foreground"> of {r.assignedBuses} assigned</span>
            </Td>
            <Td>
              <MetricCell metric={r.avgTripDurationMin} unit=" min" />
            </Td>
            <Td>
              <MetricCell metric={r.delayedTrips} />
            </Td>
            <Td>
              <MetricCell metric={r.disruptedTrips} />
            </Td>
            <Td>
              <MetricCell metric={r.cancelledTrips} />
            </Td>
            <Td>
              {r.serviceCoveragePct.available ? (
                <div className="min-w-[120px]">
                  <span className="num text-sm font-semibold">
                    {r.serviceCoveragePct.value}%
                  </span>
                  <Meter value={r.serviceCoveragePct.value} tone="primary" className="mt-2" />
                </div>
              ) : (
                <MetricCell metric={r.serviceCoveragePct} />
              )}
            </Td>
            <Td>
              <MetricCell metric={r.busUtilisationPct} unit="%" />
            </Td>
            <Td>
              <MetricCell metric={r.crewUtilisationPct} unit="%" />
            </Td>
          </tr>
        ))}
      </DataTable>
      <p className="mt-4 text-xs text-muted-foreground">
        Delayed and cancelled trips are not measurable from the current operating-day model — actual
        arrival times and cancellation events are not recorded, so they are reported as
        “Not available” rather than estimated.
      </p>
    </Panel>
  );
}

export default RoutePerformance;
