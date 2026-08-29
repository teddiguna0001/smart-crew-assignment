import { useEffect, useState } from "react";
import { DTC_ROUTES, LIVE_BUSES } from "@/data/transitData";
import type { ActiveBusPosition } from "@/lib/transit-types";

/**
 * Shared operational simulation state.
 *
 * Buses start from their last reported telemetry position and are advanced
 * along the real polyline of the route they are running, at their reported
 * speed. Buses without a usable position (no coordinates, or a route with no
 * geometry) are never given a fabricated location — they are simply skipped.
 */

export interface SimulatedBus extends ActiveBusPosition {
  progressKm: number;
}

const EARTH_R = 6371;

function haversineKm(a: [number, number], b: [number, number]) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_R * Math.asin(Math.sqrt(h));
}

function nearestIndex(path: [number, number][], point: [number, number]) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < path.length; i += 1) {
    const d = haversineKm(path[i]!, point);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** Walk `km` forward along the polyline from `startIndex`, wrapping at the end. */
function advance(path: [number, number][], startIndex: number, km: number) {
  let remaining = km;
  let i = startIndex;
  while (remaining > 0) {
    const from = path[i % path.length]!;
    const to = path[(i + 1) % path.length]!;
    const seg = haversineKm(from, to);
    if (seg >= remaining && seg > 0) {
      const t = remaining / seg;
      return {
        position: [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t] as [
          number,
          number,
        ],
        index: i % path.length,
      };
    }
    remaining -= seg;
    i += 1;
    if (i - startIndex > path.length * 2) break;
  }
  return { position: path[i % path.length]!, index: i % path.length };
}

function isValidPosition(lat: unknown, lng: unknown) {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

export function simulateBuses(elapsedSeconds: number): SimulatedBus[] {
  const out: SimulatedBus[] = [];
  for (const bus of LIVE_BUSES) {
    if (!isValidPosition(bus.lat, bus.lng)) continue;
    const route = DTC_ROUTES.find((r) => r.routeNumber === bus.routeNumber);
    const path = route?.coordinates;
    if (!path || path.length < 2 || bus.status === "standby" || bus.speedKmph <= 0) {
      out.push({ ...bus, progressKm: 0 });
      continue;
    }
    const km = (bus.speedKmph * elapsedSeconds) / 3600;
    const start = nearestIndex(path, [bus.lat, bus.lng]);
    const { position } = advance(path, start, km);
    out.push({ ...bus, lat: position[0], lng: position[1], progressKm: km });
  }
  return out;
}

/** Live simulated fleet positions, ticking every `intervalMs`. */
export function useSimulatedBuses(intervalMs = 4000, running = true) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed((e) => e + intervalMs / 1000), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, running]);

  return simulateBuses(elapsed);
}
