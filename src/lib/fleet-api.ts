import { supabase } from "@/integrations/supabase/client";
import type { Tone } from "@/components/transit/primitives";

export const BUS_STATUSES = [
  "AVAILABLE",
  "ASSIGNED",
  "MAINTENANCE",
  "INACTIVE",
  "RETIRED",
] as const;

export type BusStatus = (typeof BUS_STATUSES)[number];

export interface Bus {
  id: string;
  bus_code: string;
  bus_number: string;
  depot: string;
  capacity: number;
  bus_type: string;
  status: BusStatus;
  model: string | null;
  energy_pct: number;
  odometer_km: number;
  current_assignment: string | null;
  last_maintenance: string | null;
  next_inspection_due: string | null;
  efficiency_score: number | null;
  retired_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BusEvent {
  id: string;
  bus_id: string;
  event_type: string;
  from_status: BusStatus | null;
  to_status: BusStatus | null;
  detail: string | null;
  created_at: string;
}

export const BUS_TYPES = [
  "Low Floor Electric",
  "Standard CNG AC",
  "Standard CNG Non-AC",
  "Electric Midi",
] as const;

/** Only AVAILABLE vehicles may be dispatched onto a trip. */
export function canBeAssigned(bus: Pick<Bus, "status">) {
  return bus.status === "AVAILABLE";
}

export function isOperational(bus: Pick<Bus, "status">) {
  return bus.status === "AVAILABLE" || bus.status === "ASSIGNED";
}

export function statusTone(status: BusStatus): Tone {
  switch (status) {
    case "ASSIGNED":
      return "primary";
    case "AVAILABLE":
      return "secondary";
    case "MAINTENANCE":
      return "accent";
    case "INACTIVE":
      return "violet";
    case "RETIRED":
      return "destructive";
    default:
      return "neutral";
  }
}

export const busesQueryKey = ["buses"] as const;

export async function fetchBuses(): Promise<Bus[]> {
  const { data, error } = await supabase
    .from("buses")
    .select("*")
    .order("bus_code", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Bus[];
}

export async function fetchBusEvents(busId: string): Promise<BusEvent[]> {
  const { data, error } = await supabase
    .from("bus_events")
    .select("*")
    .eq("bus_id", busId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as BusEvent[];
}

async function logEvent(input: {
  busId: string;
  eventType: string;
  from?: BusStatus | null;
  to?: BusStatus | null;
  detail?: string | null;
}) {
  const { error } = await supabase.from("bus_events").insert({
    bus_id: input.busId,
    event_type: input.eventType,
    from_status: input.from ?? null,
    to_status: input.to ?? null,
    detail: input.detail ?? null,
  });
  if (error) throw new Error(error.message);
}

export type BusDraft = {
  bus_code: string;
  bus_number: string;
  depot: string;
  capacity: number;
  bus_type: string;
  status: BusStatus;
  model: string | null;
  energy_pct: number;
  odometer_km: number;
  current_assignment: string | null;
  notes: string | null;
};

export async function createBus(draft: BusDraft): Promise<Bus> {
  const { data, error } = await supabase.from("buses").insert(draft).select().single();
  if (error) throw new Error(error.message);
  const bus = data as Bus;
  await logEvent({
    busId: bus.id,
    eventType: "CREATED",
    to: bus.status,
    detail: `Registered at ${bus.depot}`,
  });
  return bus;
}

export async function updateBus(id: string, patch: Partial<BusDraft>): Promise<Bus> {
  const { data, error } = await supabase
    .from("buses")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  const bus = data as Bus;
  await logEvent({ busId: id, eventType: "UPDATED", to: bus.status, detail: "Details edited" });
  return bus;
}

async function transition(
  bus: Bus,
  next: BusStatus,
  eventType: string,
  patch: Partial<Bus> = {},
  detail?: string,
): Promise<Bus> {
  const { data, error } = await supabase
    .from("buses")
    .update({ status: next, ...patch })
    .eq("id", bus.id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  await logEvent({
    busId: bus.id,
    eventType,
    from: bus.status,
    to: next,
    detail: detail ?? null,
  });
  return data as Bus;
}

export function changeStatus(bus: Bus, next: BusStatus, detail?: string) {
  if (bus.status === "RETIRED") throw new Error("A retired vehicle cannot change status.");
  if (next === "ASSIGNED" && !canBeAssigned(bus))
    throw new Error(`A bus in ${bus.status} state cannot be assigned.`);
  const patch: Partial<Bus> = next === "ASSIGNED" ? {} : { current_assignment: null };
  return transition(bus, next, "STATUS_CHANGE", patch, detail);
}

export function assignBus(bus: Bus, assignment: string) {
  if (!canBeAssigned(bus)) throw new Error(`Only AVAILABLE buses can be assigned (this bus is ${bus.status}).`);
  return transition(bus, "ASSIGNED", "ASSIGNED", { current_assignment: assignment }, assignment);
}

export function releaseBus(bus: Bus) {
  if (bus.status !== "ASSIGNED") throw new Error("This bus is not currently assigned.");
  return transition(bus, "AVAILABLE", "RELEASED", { current_assignment: null }, "Returned to available pool");
}

export function deactivateBus(bus: Bus, reason: string) {
  if (bus.status === "RETIRED") throw new Error("A retired vehicle cannot be deactivated.");
  return transition(bus, "INACTIVE", "DEACTIVATED", { current_assignment: null }, reason);
}

export function reactivateBus(bus: Bus) {
  if (bus.status !== "INACTIVE" && bus.status !== "MAINTENANCE")
    throw new Error("Only inactive or in-maintenance buses can be reactivated.");
  return transition(bus, "AVAILABLE", "REACTIVATED", { current_assignment: null }, "Returned to service");
}

export function retireBus(bus: Bus, reason: string) {
  if (bus.status === "RETIRED") throw new Error("This bus is already retired.");
  return transition(
    bus,
    "RETIRED",
    "RETIRED",
    { current_assignment: null, retired_at: new Date().toISOString() },
    reason,
  );
}
