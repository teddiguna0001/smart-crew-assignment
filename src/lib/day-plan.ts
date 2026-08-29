import { DTC_ROUTES, INITIAL_TRIPS, LIVE_BUSES } from "@/data/transitData";

/* ------------------------------------------------------------------ *
 * Operating-day trip plan.
 *
 * Pure, dependency-free (no React) so it can also be evaluated inside
 * server functions where the assignment / scenario engines run.
 * ------------------------------------------------------------------ */

export const SERVICE_START_MIN = 6 * 60; // 06:00
export const SERVICE_END_MIN = 22 * 60; // 22:00

export function minutesToClock(mins: number) {
  const m = Math.max(0, Math.round(mins));
  return `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export function clockToMinutes(clock: string) {
  const [h, m] = clock.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export interface PlannedTrip {
  id: string;
  tripCode: string;
  busId: string;
  regNumber: string;
  routeNumber: string;
  origin: string;
  destination: string;
  startMin: number;
  endMin: number;
  direction: "UP" | "DOWN";
  depot: string;
  crew: string;
  scheduled: boolean; // came from the published schedule rather than the headway plan
}

export const routeByNumber = new Map(DTC_ROUTES.map((r) => [r.routeNumber, r]));

/** Build the operating-day duty plan for every bus from its route + headway. */
function buildPlan(): PlannedTrip[] {
  const trips: PlannedTrip[] = [];

  LIVE_BUSES.forEach((bus, busIndex) => {
    const route = routeByNumber.get(bus.routeNumber);
    if (!route || route.coordinates.length < 2) return;

    const runMins = Math.max(20, route.avgDurationMins);
    const layover = Math.max(8, Math.round(route.frequencyMins / 2));
    // Stagger pull-outs so the depot does not release every bus at once.
    let cursor = SERVICE_START_MIN + (busIndex % 6) * route.frequencyMins;
    let leg = 0;

    while (cursor + runMins <= SERVICE_END_MIN) {
      const up = leg % 2 === 0;
      const start = cursor;
      const end = cursor + runMins;
      const published = INITIAL_TRIPS.find(
        (t) =>
          t.assignedBus.startsWith(bus.regNumber) &&
          Math.abs(clockToMinutes(t.startTime) - start) <= runMins / 2,
      );

      trips.push({
        id: published?.id ?? `${bus.busId}-${leg}`,
        tripCode:
          published?.tripCode ??
          `${route.routeNumber}-${up ? "UP" : "DN"}-${minutesToClock(start).replace(":", "")}`,
        busId: bus.busId,
        regNumber: bus.regNumber,
        routeNumber: route.routeNumber,
        origin: up ? route.origin : route.destination,
        destination: up ? route.destination : route.origin,
        startMin: published ? clockToMinutes(published.startTime) : start,
        endMin: published ? clockToMinutes(published.endTime) : end,
        direction: up ? "UP" : "DOWN",
        depot: published?.depot ?? bus.depot,
        crew: published?.assignedDriver ?? bus.driverName,
        scheduled: Boolean(published),
      });

      cursor = end + layover;
      leg += 1;
    }
  });

  return trips.sort((a, b) => a.startMin - b.startMin);
}

export const DAY_PLAN = buildPlan();
