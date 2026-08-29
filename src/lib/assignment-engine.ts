/**
 * Automatic Resource Assignment engine.
 *
 * Deterministic, rule-based (NOT machine learning / "AI optimisation").
 * Pure functions so the logic can be unit-tested independently of the database.
 */

export type BusStatus = "active" | "maintenance" | "retired" | "inactive";
export type CrewStatus = "active" | "off_duty" | "inactive";

export interface Depot {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export interface Bus {
  id: string;
  code: string;
  depot_id: string;
  status: BusStatus;
  capacity: number;
  utilization_minutes: number;
}

export interface Crew {
  id: string;
  name: string;
  depot_id: string;
  status: CrewStatus;
  is_available: boolean;
  /** "HH:MM:SS" local duty window */
  shift_start: string;
  shift_end: string;
  utilization_minutes: number;
}

export interface Trip {
  id: string;
  code: string;
  origin_depot_id: string;
  destination: string;
  start_time: string;
  end_time: string;
  required_capacity: number;
}

export interface Booking {
  resourceId: string;
  start: number;
  end: number;
}

export interface AssignmentResult {
  tripId: string;
  tripCode: string;
  busId: string | null;
  crewId: string | null;
  score: number;
  reasons: string[];
  rejections: string[];
  feasibleCombinations: number;
  status: "assigned" | "unassigned";
}

const MINUTE = 60_000;

export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && aEnd > bStart;
}

function minutesOfDay(time: string) {
  const [h = "0", m = "0"] = time.split(":");
  return Number(h) * 60 + Number(m);
}

function haversineKm(a: Depot, b: Depot) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Step 1-4: candidate buses that may legally serve a trip. */
export function eligibleBuses(
  trip: Trip,
  buses: Bus[],
  busBookings: Booking[],
  rejections: string[],
): Bus[] {
  const start = Date.parse(trip.start_time);
  const end = Date.parse(trip.end_time);

  return buses.filter((bus) => {
    // 2/3. Remove maintenance / retired / inactive vehicles.
    if (bus.status !== "active") {
      rejections.push(`${bus.code}: status is ${bus.status}`);
      return false;
    }
    // 4. Depot / resource constraint: capacity must cover the trip demand.
    if (bus.capacity < trip.required_capacity) {
      rejections.push(
        `${bus.code}: capacity ${bus.capacity} < required ${trip.required_capacity}`,
      );
      return false;
    }
    // 8. No overlapping assignment for the same bus.
    const clash = busBookings.some(
      (b) => b.resourceId === bus.id && overlaps(start, end, b.start, b.end),
    );
    if (clash) {
      rejections.push(`${bus.code}: already booked on an overlapping trip`);
      return false;
    }
    return true;
  });
}

/** Step 5-8: candidate crew that may legally serve a trip. */
export function eligibleCrew(
  trip: Trip,
  crew: Crew[],
  crewBookings: Booking[],
  rejections: string[],
): Crew[] {
  const start = Date.parse(trip.start_time);
  const end = Date.parse(trip.end_time);
  const startDate = new Date(start);
  const endDate = new Date(end);
  const tripStartMin = startDate.getUTCHours() * 60 + startDate.getUTCMinutes();
  const tripEndMin = endDate.getUTCHours() * 60 + endDate.getUTCMinutes();

  return crew.filter((member) => {
    // 6. Remove inactive / off-duty / unavailable crew.
    if (member.status !== "active") {
      rejections.push(`${member.name}: status is ${member.status}`);
      return false;
    }
    if (!member.is_available) {
      rejections.push(`${member.name}: marked unavailable`);
      return false;
    }
    // 7. Timing conflict: the trip must sit inside the duty window.
    const shiftStart = minutesOfDay(member.shift_start);
    const shiftEnd = minutesOfDay(member.shift_end);
    const endOfDay = tripEndMin <= tripStartMin ? 24 * 60 : tripEndMin;
    if (tripStartMin < shiftStart || endOfDay > shiftEnd) {
      rejections.push(
        `${member.name}: trip outside duty window ${member.shift_start}-${member.shift_end}`,
      );
      return false;
    }
    // 8. No overlapping assignment for the same crew member.
    const clash = crewBookings.some(
      (b) => b.resourceId === member.id && overlaps(start, end, b.start, b.end),
    );
    if (clash) {
      rejections.push(`${member.name}: already booked on an overlapping trip`);
      return false;
    }
    return true;
  });
}

/**
 * Feature 9 — deterministic resource score (0-100, higher is better).
 * Components: depot proximity, capacity fit, current utilisation, idle time.
 */
export function scoreBus(
  bus: Bus,
  trip: Trip,
  depots: Map<string, Depot>,
  lastBusEnd: Map<string, number>,
) {
  const tripDepot = depots.get(trip.origin_depot_id);
  const busDepot = depots.get(bus.depot_id);
  const distanceKm =
    tripDepot && busDepot ? haversineKm(tripDepot, busDepot) : 0;

  const proximity = Math.max(0, 40 - distanceKm * 2); // 0-40
  const capacitySlack = bus.capacity - trip.required_capacity;
  const capacityFit = Math.max(0, 25 - capacitySlack); // 0-25, tighter fit is better
  const utilisation = Math.max(0, 20 - bus.utilization_minutes / 30); // 0-20
  const prevEnd = lastBusEnd.get(bus.id);
  const idleMinutes =
    prevEnd === undefined ? 120 : (Date.parse(trip.start_time) - prevEnd) / MINUTE;
  const idle = Math.max(0, 15 - Math.abs(idleMinutes - 45) / 10); // 0-15, ~45min turnaround ideal

  return round2(proximity + capacityFit + utilisation + idle);
}

export function scoreCrew(
  member: Crew,
  trip: Trip,
  depots: Map<string, Depot>,
  lastCrewEnd: Map<string, number>,
) {
  const tripDepot = depots.get(trip.origin_depot_id);
  const crewDepot = depots.get(member.depot_id);
  const distanceKm =
    tripDepot && crewDepot ? haversineKm(tripDepot, crewDepot) : 0;

  const proximity = Math.max(0, 40 - distanceKm * 2);
  const utilisation = Math.max(0, 30 - member.utilization_minutes / 20);

  const endDate = new Date(Date.parse(trip.end_time));
  const tripEndMin = endDate.getUTCHours() * 60 + endDate.getUTCMinutes();
  const shiftEnd = minutesOfDay(member.shift_end);
  const scheduleCompatibility = Math.min(15, (shiftEnd - tripEndMin) / 20); // slack left in shift

  const prevEnd = lastCrewEnd.get(member.id);
  const idleMinutes =
    prevEnd === undefined ? 120 : (Date.parse(trip.start_time) - prevEnd) / MINUTE;
  const idle = Math.max(0, 15 - Math.abs(idleMinutes - 45) / 10);

  return round2(proximity + utilisation + Math.max(0, scheduleCompatibility) + idle);
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export interface PlanInput {
  trips: Trip[];
  buses: Bus[];
  crew: Crew[];
  depots: Depot[];
}

/**
 * Runs the full 10-step pipeline over every scheduled trip, in chronological
 * order, maintaining live booking state so nothing double-books.
 */
export function planAssignments(input: PlanInput): AssignmentResult[] {
  const depots = new Map(input.depots.map((d) => [d.id, d]));
  const busBookings: Booking[] = [];
  const crewBookings: Booking[] = [];
  const lastBusEnd = new Map<string, number>();
  const lastCrewEnd = new Map<string, number>();
  const busLoad = new Map(input.buses.map((b) => [b.id, b.utilization_minutes]));
  const crewLoad = new Map(input.crew.map((c) => [c.id, c.utilization_minutes]));

  const trips = [...input.trips].sort(
    (a, b) => Date.parse(a.start_time) - Date.parse(b.start_time),
  );

  return trips.map((trip) => {
    const rejections: string[] = [];
    const start = Date.parse(trip.start_time);
    const end = Date.parse(trip.end_time);
    const durationMin = (end - start) / MINUTE;

    const buses = eligibleBuses(
      trip,
      input.buses.map((b) => ({ ...b, utilization_minutes: busLoad.get(b.id) ?? 0 })),
      busBookings,
      rejections,
    );
    const crew = eligibleCrew(
      trip,
      input.crew.map((c) => ({ ...c, utilization_minutes: crewLoad.get(c.id) ?? 0 })),
      crewBookings,
      rejections,
    );

    // 9. Generate feasible combinations, 10. select the best-scoring one.
    let best: { bus: Bus; member: Crew; score: number } | null = null;
    for (const bus of buses) {
      const bs = scoreBus(bus, trip, depots, lastBusEnd);
      for (const member of crew) {
        const cs = scoreCrew(member, trip, depots, lastCrewEnd);
        const combined = round2(bs * 0.5 + cs * 0.5);
        const better =
          best === null ||
          combined > best.score ||
          // deterministic tie-break on stable codes
          (combined === best.score &&
            `${bus.code}|${member.name}` < `${best.bus.code}|${best.member.name}`);
        if (better) best = { bus, member, score: combined };
      }
    }

    if (!best) {
      return {
        tripId: trip.id,
        tripCode: trip.code,
        busId: null,
        crewId: null,
        score: 0,
        reasons: [],
        rejections,
        feasibleCombinations: 0,
        status: "unassigned" as const,
      };
    }

    busBookings.push({ resourceId: best.bus.id, start, end });
    crewBookings.push({ resourceId: best.member.id, start, end });
    lastBusEnd.set(best.bus.id, end);
    lastCrewEnd.set(best.member.id, end);
    busLoad.set(best.bus.id, (busLoad.get(best.bus.id) ?? 0) + durationMin);
    crewLoad.set(best.member.id, (crewLoad.get(best.member.id) ?? 0) + durationMin);

    const tripDepot = depots.get(trip.origin_depot_id);
    const busDepot = depots.get(best.bus.depot_id);
    return {
      tripId: trip.id,
      tripCode: trip.code,
      busId: best.bus.id,
      crewId: best.member.id,
      score: best.score,
      reasons: [
        `${buses.length} eligible bus(es) x ${crew.length} eligible crew = ${buses.length * crew.length} feasible combinations`,
        `Bus ${best.bus.code} (capacity ${best.bus.capacity} for ${trip.required_capacity} pax)`,
        tripDepot && busDepot
          ? `Depot proximity: ${haversineKm(tripDepot, busDepot).toFixed(1)} km from ${busDepot.name}`
          : "Depot proximity: same depot",
        `Crew ${best.member.name} on duty ${best.member.shift_start}-${best.member.shift_end}`,
      ],
      rejections,
      feasibleCombinations: buses.length * crew.length,
      status: "assigned" as const,
    };
  });
}
