import { DTC_ROUTES, INITIAL_DISRUPTION } from "@/data/transitData";
import {
  DAY_PLAN,
  DISRUPTION_MIN,
  SERVICE_START_MIN,
  busesAt,
  type PlannedTrip,
} from "@/lib/day-simulation";

/* ------------------------------------------------------------------ *
 * Feature 10 — Route-level operational performance.
 *
 * Every number here is derived from the operating-day plan (DAY_PLAN)
 * and the simulation clock. Nothing is hardcoded. Metrics that the
 * current data model cannot support are returned as `null` with an
 * explicit reason, so the UI renders "Not available" / "Insufficient
 * data" instead of a fabricated percentage.
 * ------------------------------------------------------------------ */

export type Unavailable = "Not available" | "Insufficient data";

/** A metric that is either a real derived number or an honest gap. */
export type MetricResult =
  | { available: true; value: number }
  | { available: false; reason: Unavailable; note: string };

const ok = (value: number): MetricResult => ({ available: true, value });
const gap = (reason: Unavailable, note: string): MetricResult => ({
  available: false,
  reason,
  note,
});

export interface RoutePerformance {
  routeId: string;
  routeNumber: string;
  name: string;
  color: string;
  totalTrips: number;
  completedTrips: number;
  inProgressTrips: number;
  pendingTrips: number;
  assignedBuses: number;
  activeBuses: number;
  assignedCrew: number;
  avgTripDurationMin: MetricResult;
  delayedTrips: MetricResult;
  disruptedTrips: MetricResult;
  cancelledTrips: MetricResult;
  serviceCoveragePct: MetricResult;
  busUtilisationPct: MetricResult;
  crewUtilisationPct: MetricResult;
}

/** Minutes of a trip that fall inside the elapsed part of the day. */
function elapsedTripMinutes(trip: PlannedTrip, simMinute: number) {
  return Math.max(0, Math.min(trip.endMin, simMinute) - trip.startMin);
}

/** Is this trip running under the modelled disruption window? */
function isDisrupted(trip: PlannedTrip) {
  if (trip.routeNumber !== INITIAL_DISRUPTION.routeNumber) return false;
  return trip.startMin < DISRUPTION_MIN + 20 && trip.endMin > DISRUPTION_MIN;
}

export function routePerformanceAt(simMinute: number): RoutePerformance[] {
  const elapsed = Math.max(0, simMinute - SERVICE_START_MIN);
  const live = busesAt(simMinute);

  return DTC_ROUTES.map((route) => {
    const trips = DAY_PLAN.filter((t) => t.routeNumber === route.routeNumber);
    const completed = trips.filter((t) => t.endMin <= simMinute);
    const inProgress = trips.filter((t) => t.startMin <= simMinute && t.endMin > simMinute);
    const pending = trips.filter((t) => t.startMin > simMinute);

    const buses = new Set(trips.map((t) => t.busId));
    const crew = new Set(trips.map((t) => t.crew));
    const activeBuses = new Set(
      live
        .filter((b) => b.simStatus === "IN_SERVICE" && b.routeNumber === route.routeNumber)
        .map((b) => b.busId),
    );

    // Average duration of trips actually operated so far.
    const durations = completed.map((t) => t.endMin - t.startMin);
    const avgTripDurationMin = durations.length
      ? ok(Math.round(durations.reduce((s, d) => s + d, 0) / durations.length))
      : gap("Insufficient data", "No trip on this corridor has completed yet today.");

    const disrupted = trips.filter(isDisrupted);
    const disruptedTrips =
      simMinute >= DISRUPTION_MIN
        ? ok(disrupted.length)
        : gap("Not available", "Disruption has not occurred at the current simulation time.");

    // Coverage = share of the planned trips that have run or are running.
    const serviceCoveragePct = trips.length
      ? ok(Math.round(((completed.length + inProgress.length) / trips.length) * 100))
      : gap("Insufficient data", "No trips are planned on this corridor.");

    // Utilisation = operated vehicle-minutes / available vehicle-minutes so far.
    const operatedMinutes = trips.reduce((s, t) => s + elapsedTripMinutes(t, simMinute), 0);
    const busCapacityMinutes = buses.size * elapsed;
    const crewCapacityMinutes = crew.size * elapsed;

    const busUtilisationPct =
      busCapacityMinutes > 0
        ? ok(Math.min(100, Math.round((operatedMinutes / busCapacityMinutes) * 100)))
        : gap("Insufficient data", "Service has not started at the current simulation time.");

    const crewUtilisationPct =
      crewCapacityMinutes > 0
        ? ok(Math.min(100, Math.round((operatedMinutes / crewCapacityMinutes) * 100)))
        : gap("Insufficient data", "Service has not started at the current simulation time.");

    return {
      routeId: route.id,
      routeNumber: route.routeNumber,
      name: route.name,
      color: route.color,
      totalTrips: trips.length,
      completedTrips: completed.length,
      inProgressTrips: inProgress.length,
      pendingTrips: pending.length,
      assignedBuses: buses.size,
      activeBuses: activeBuses.size,
      assignedCrew: crew.size,
      avgTripDurationMin,
      delayedTrips: gap(
        "Not available",
        "Actual arrival times are not recorded, so lateness cannot be measured.",
      ),
      disruptedTrips,
      cancelledTrips: gap(
        "Not available",
        "The operating-day model has no cancellation events to count.",
      ),
      serviceCoveragePct,
      busUtilisationPct,
      crewUtilisationPct,
    };
  }).sort((a, b) => b.totalTrips - a.totalTrips);
}

/** Formats a metric for display, never inventing a value. */
export function metricText(metric: MetricResult, unit = "") {
  return metric.available ? `${metric.value}${unit}` : metric.reason;
}
