import { useSyncExternalStore } from "react";
import { DTC_ROUTES, INITIAL_TRIPS, LIVE_BUSES, INITIAL_DISRUPTION } from "@/data/transitData";
import type { ActiveBusPosition } from "@/lib/transit-types";

/* ------------------------------------------------------------------ *
 * 24-hour Operational Simulation.
 *
 * This is a deterministic model of the operating day, NOT live GPS.
 * Every bus position is interpolated along the real route polyline from
 * the trip's start time, end time and the current simulation clock.
 * ------------------------------------------------------------------ */

export const SERVICE_START_MIN = 6 * 60; // 06:00
export const SERVICE_END_MIN = 22 * 60; // 22:00
export const SPEED_OPTIONS = [1, 5, 10, 30] as const;
export type SimSpeed = (typeof SPEED_OPTIONS)[number];

export function minutesToClock(mins: number) {
  const m = Math.max(0, Math.round(mins));
  return `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function clockToMinutes(clock: string) {
  const [h, m] = clock.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/* ---------------------------- trip plan ---------------------------- */

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

const routeByNumber = new Map(DTC_ROUTES.map((r) => [r.routeNumber, r]));

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
        tripCode: published?.tripCode ?? `${route.routeNumber}-${up ? "UP" : "DN"}-${minutesToClock(start).replace(":", "")}`,
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

/* ------------------------ geometry interpolation ------------------- */

function cumulative(path: [number, number][]) {
  const acc = [0];
  for (let i = 1; i < path.length; i += 1) {
    const [aLat, aLng] = path[i - 1]!;
    const [bLat, bLng] = path[i]!;
    acc.push(acc[i - 1]! + Math.hypot(bLat - aLat, bLng - aLng));
  }
  return acc;
}

const pathCache = new Map<string, { path: [number, number][]; acc: number[] }>();

function geometry(routeNumber: string) {
  const cached = pathCache.get(routeNumber);
  if (cached) return cached;
  const route = routeByNumber.get(routeNumber);
  if (!route) return null;
  const entry = { path: route.coordinates, acc: cumulative(route.coordinates) };
  pathCache.set(routeNumber, entry);
  return entry;
}

/** Point at fraction `t` (0-1) along the route polyline, plus heading. */
function pointAt(routeNumber: string, t: number, reverse: boolean) {
  const geo = geometry(routeNumber);
  if (!geo) return null;
  const { path, acc } = geo;
  const total = acc[acc.length - 1]!;
  if (!total) return null;
  const frac = Math.min(1, Math.max(0, reverse ? 1 - t : t));
  const target = frac * total;

  let i = 1;
  while (i < acc.length - 1 && acc[i]! < target) i += 1;
  const segStart = acc[i - 1]!;
  const segLen = acc[i]! - segStart || 1;
  const k = (target - segStart) / segLen;
  const a = path[i - 1]!;
  const b = path[i]!;
  const lat = a[0] + (b[0] - a[0]) * k;
  const lng = a[1] + (b[1] - a[1]) * k;
  const dir = reverse ? -1 : 1;
  const heading =
    (Math.atan2((b[1] - a[1]) * dir, (b[0] - a[0]) * dir) * 180) / Math.PI;
  return { lat, lng, heading: (heading + 360) % 360 };
}

/** Reported time of the live disruption, parsed from its own record. */
export const DISRUPTION_MIN = (() => {
  const m = INITIAL_DISRUPTION.timestamp.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!m) return 10 * 60 + 45;
  let h = Number(m[1]);
  if (m[3]?.toUpperCase() === "PM" && h < 12) h += 12;
  if (m[3]?.toUpperCase() === "AM" && h === 12) h = 0;
  return h * 60 + Number(m[2]);
})();

/* ---------------------------- derived state ------------------------ */

export interface SimulatedBus extends ActiveBusPosition {
  tripCode: string;
  tripProgressPct: number;
  tripWindow: string;
  simStatus: "IN_SERVICE" | "AT_TERMINAL" | "AT_DEPOT";
}

const busByRegistration = new Map(LIVE_BUSES.map((b) => [b.busId, b]));

/** Positions of all buses at a given simulated minute, derived from the plan. */
export function busesAt(simMinute: number): SimulatedBus[] {
  const out: SimulatedBus[] = [];

  busByRegistration.forEach((bus) => {
    const busTrips = DAY_PLAN.filter((t) => t.busId === bus.busId);
    if (!busTrips.length) return;

    const active = busTrips.find((t) => simMinute >= t.startMin && simMinute < t.endMin);
    const disrupted =
      active &&
      active.routeNumber === INITIAL_DISRUPTION.routeNumber &&
      simMinute >= DISRUPTION_MIN &&
      simMinute < DISRUPTION_MIN + 20;

    if (active) {
      const t = (simMinute - active.startMin) / (active.endMin - active.startMin);
      const p = pointAt(active.routeNumber, disrupted ? Math.min(t, 0.5) : t, active.direction === "DOWN");
      if (!p) return;
      out.push({
        ...bus,
        lat: p.lat,
        lng: p.lng,
        heading: Math.round(p.heading),
        speedKmph: disrupted ? 0 : bus.speedKmph,
        status: disrupted ? "disrupted" : bus.status,
        tripCode: active.tripCode,
        tripProgressPct: Math.round(t * 100),
        tripWindow: `${minutesToClock(active.startMin)}–${minutesToClock(active.endMin)}`,
        simStatus: "IN_SERVICE",
      });
      return;
    }

    const last = [...busTrips].reverse().find((t) => t.endMin <= simMinute);
    const next = busTrips.find((t) => t.startMin > simMinute);
    const restingAt = last ?? busTrips[0]!;
    const atDepot = !last || !next;
    const p = pointAt(restingAt.routeNumber, last ? 1 : 0, restingAt.direction === "DOWN");
    if (!p) return;
    out.push({
      ...bus,
      lat: p.lat,
      lng: p.lng,
      speedKmph: 0,
      status: "on-time",
      tripCode: next ? `Next ${next.tripCode}` : "Day complete",
      tripProgressPct: 0,
      tripWindow: next ? `departs ${minutesToClock(next.startMin)}` : "—",
      simStatus: atDepot ? "AT_DEPOT" : "AT_TERMINAL",
    });
  });

  return out;
}

/* ------------------------------ events ----------------------------- */

export type SimEventKind =
  | "SERVICE"
  | "DEPARTURE"
  | "COMPLETION"
  | "AVAILABLE"
  | "CREW"
  | "PEAK"
  | "DISRUPTION"
  | "RECOVERY"
  | "MAINTENANCE"
  | "DEPOT";

export interface SimEvent {
  id: string;
  minute: number;
  kind: SimEventKind;
  title: string;
  detail: string;
}

function buildEvents(): SimEvent[] {
  const events: SimEvent[] = [
    {
      id: "svc-start",
      minute: SERVICE_START_MIN,
      kind: "SERVICE",
      title: "Service start",
      detail: `${DAY_PLAN.length} trips planned across ${new Set(DAY_PLAN.map((t) => t.routeNumber)).size} corridors`,
    },
  ];

  DAY_PLAN.forEach((trip) => {
    events.push({
      id: `${trip.id}-crew`,
      minute: Math.max(SERVICE_START_MIN, trip.startMin - 5),
      kind: "CREW",
      title: `Crew signed on for ${trip.tripCode}`,
      detail: `${trip.crew} · ${trip.depot} depot`,
    });
    events.push({
      id: `${trip.id}-dep`,
      minute: trip.startMin,
      kind: "DEPARTURE",
      title: `${trip.regNumber} departed ${trip.origin}`,
      detail: `Route ${trip.routeNumber} ${trip.direction} · arrives ${trip.destination} at ${minutesToClock(trip.endMin)}`,
    });
    events.push({
      id: `${trip.id}-end`,
      minute: trip.endMin,
      kind: "COMPLETION",
      title: `Trip ${trip.tripCode} completed`,
      detail: `${trip.regNumber} arrived ${trip.destination}`,
    });
    events.push({
      id: `${trip.id}-avail`,
      minute: trip.endMin + 1,
      kind: "AVAILABLE",
      title: `${trip.regNumber} available at ${trip.destination}`,
      detail: "Bus released back into the assignable pool",
    });
  });

  // Peak periods derived from the density of concurrent trips.
  for (let m = SERVICE_START_MIN; m <= SERVICE_END_MIN; m += 30) {
    const running = DAY_PLAN.filter((t) => m >= t.startMin && m < t.endMin).length;
    const prev = DAY_PLAN.filter((t) => m - 30 >= t.startMin && m - 30 < t.endMin).length;
    if (running >= Math.max(4, Math.ceil(LIVE_BUSES.length * 0.7)) && running > prev) {
      events.push({
        id: `peak-${m}`,
        minute: m,
        kind: "PEAK",
        title: "Peak period entered",
        detail: `${running} buses running simultaneously`,
      });
    }
  }

  // Disruption + recovery, derived from the live disruption record.
  const dMin = DISRUPTION_MIN;
  const affected = DAY_PLAN.filter(
    (t) => t.routeNumber === INITIAL_DISRUPTION.routeNumber && t.startMin <= dMin + 60 && t.endMin >= dMin,
  );
  events.push({
    id: "disruption",
    minute: dMin,
    kind: "DISRUPTION",
    title: `Route ${INITIAL_DISRUPTION.routeNumber} ${INITIAL_DISRUPTION.type.toLowerCase()}`,
    detail: INITIAL_DISRUPTION.impactSummary,
  });
  events.push({
    id: "disruption-impact",
    minute: dMin + 1,
    kind: "DISRUPTION",
    title: `${affected.length} trips affected`,
    detail: affected.map((t) => t.tripCode).slice(0, 4).join(", ") || "Assessing impact",
  });
  events.push({
    id: "disruption-replace",
    minute: dMin + 2,
    kind: "RECOVERY",
    title: "Replacement assignment initiated",
    detail: "Standby bus and eligible relief crew rostered from the nearest depot",
  });
  events.push({
    id: "disruption-recovered",
    minute: dMin + 20,
    kind: "RECOVERY",
    title: "Recovery completed",
    detail: `Route ${INITIAL_DISRUPTION.routeNumber} back to planned headway`,
  });

  // Maintenance flags derived from bus telemetry.
  LIVE_BUSES.filter((b) => b.batteryOrFuelPct < 30).forEach((b, i) => {
    events.push({
      id: `maint-${b.busId}`,
      minute: 13 * 60 + i * 15,
      kind: "MAINTENANCE",
      title: `${b.regNumber} pulled for ${b.fuelType === "EV" ? "opportunity charge" : "refuelling"}`,
      detail: `${b.batteryOrFuelPct}% remaining at ${b.depot}`,
    });
  });

  // Depot returns from each bus's final trip.
  const lastByBus = new Map<string, PlannedTrip>();
  DAY_PLAN.forEach((t) => {
    const cur = lastByBus.get(t.busId);
    if (!cur || t.endMin > cur.endMin) lastByBus.set(t.busId, t);
  });
  lastByBus.forEach((t) => {
    events.push({
      id: `${t.busId}-depot`,
      minute: Math.min(SERVICE_END_MIN, t.endMin + 10),
      kind: "DEPOT",
      title: `${t.regNumber} returned to ${t.depot} depot`,
      detail: "Pull-in complete, vehicle stabled for the night",
    });
  });

  return events.sort((a, b) => a.minute - b.minute || a.id.localeCompare(b.id));
}

export const DAY_EVENTS = buildEvents();

export function eventsUpTo(simMinute: number, limit = 40) {
  const passed = DAY_EVENTS.filter((e) => e.minute <= simMinute);
  return passed.slice(-limit).reverse();
}

/* ------------------------------- store ----------------------------- */

interface SimState {
  minute: number;
  playing: boolean;
  speed: SimSpeed;
}

let state: SimState = { minute: SERVICE_START_MIN, playing: false, speed: 5 };
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function emit() {
  listeners.forEach((l) => l());
}

function set(patch: Partial<SimState>) {
  state = { ...state, ...patch };
  emit();
}

const TICK_MS = 250;

function ensureTimer() {
  if (state.playing && !timer) {
    timer = setInterval(() => {
      const next = state.minute + (state.speed * TICK_MS) / 1000 / 60 * 60;
      if (next >= SERVICE_END_MIN) {
        state = { ...state, minute: SERVICE_END_MIN, playing: false };
        stopTimer();
      } else {
        state = { ...state, minute: next };
      }
      emit();
    }, TICK_MS);
  } else if (!state.playing) {
    stopTimer();
  }
}

function stopTimer() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

export const simulationControls = {
  play() {
    if (state.minute >= SERVICE_END_MIN) set({ minute: SERVICE_START_MIN });
    set({ playing: true });
    ensureTimer();
  },
  pause() {
    set({ playing: false });
    ensureTimer();
  },
  toggle() {
    state.playing ? simulationControls.pause() : simulationControls.play();
  },
  reset() {
    set({ minute: SERVICE_START_MIN, playing: false });
    ensureTimer();
  },
  seek(minute: number) {
    set({ minute: Math.min(SERVICE_END_MIN, Math.max(SERVICE_START_MIN, minute)) });
  },
  setSpeed(speed: SimSpeed) {
    set({ speed });
  },
};

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => state;

export function useDaySimulation() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return {
    ...snapshot,
    clock: minutesToClock(snapshot.minute),
    controls: simulationControls,
  };
}
