import { supabase } from "@/integrations/supabase/client";
import type { Tone } from "@/components/transit/primitives";

export const CREW_STATUSES = [
  "AVAILABLE",
  "ASSIGNED",
  "OFF_DUTY",
  "UNAVAILABLE",
  "INACTIVE",
] as const;

export type CrewStatus = (typeof CREW_STATUSES)[number];

export const CREW_ROLES = ["Driver", "Conductor", "Shift In-Charge"] as const;

export const CREW_SHIFTS = [
  "Morning (06:00-14:00)",
  "Afternoon (14:00-22:00)",
  "Night (22:00-06:00)",
  "Split Shift",
  "Full day (06:00-22:00)",
] as const;

export interface Crew {
  id: string;
  crew_code: string;
  name: string;
  role: string;
  depot: string;
  shift: string;
  status: CrewStatus;
  availability: string;
  phone: string | null;
  license_valid_till: string | null;
  weekly_hours: number;
  daily_spreadover_hours: number;
  consecutive_days: number;
  punctuality_score: number | null;
  current_assignment: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrewEvent {
  id: string;
  crew_id: string;
  event_type: string;
  from_status: CrewStatus | null;
  to_status: CrewStatus | null;
  detail: string | null;
  created_at: string;
}

/** Statutory-style eligibility: only rested, available, licensed crew may be rostered. */
export function assignmentBlockReason(crew: Pick<Crew, "status" | "daily_spreadover_hours" | "license_valid_till">) {
  if (crew.status !== "AVAILABLE") return `Crew is ${crew.status.replace("_", " ")}, not available`;
  if (crew.daily_spreadover_hours >= 12) return "Daily spreadover limit (12 h) reached";
  if (crew.license_valid_till && new Date(crew.license_valid_till) < new Date())
    return "Licence has expired";
  return null;
}

export function canBeAssigned(crew: Pick<Crew, "status" | "daily_spreadover_hours" | "license_valid_till">) {
  return assignmentBlockReason(crew) === null;
}

export function crewStatusTone(status: CrewStatus): Tone {
  switch (status) {
    case "ASSIGNED":
      return "primary";
    case "AVAILABLE":
      return "secondary";
    case "OFF_DUTY":
      return "accent";
    case "UNAVAILABLE":
      return "destructive";
    case "INACTIVE":
      return "violet";
    default:
      return "neutral";
  }
}

export const crewQueryKey = ["crew"] as const;

export async function fetchCrew(): Promise<Crew[]> {
  const { data, error } = await supabase
    .from("crew")
    .select("*")
    .order("crew_code", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Crew[];
}

export async function fetchCrewEvents(crewId: string): Promise<CrewEvent[]> {
  const { data, error } = await supabase
    .from("crew_events")
    .select("*")
    .eq("crew_id", crewId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as CrewEvent[];
}

async function logEvent(input: {
  crewId: string;
  eventType: string;
  from?: CrewStatus | null;
  to?: CrewStatus | null;
  detail?: string | null;
}) {
  const { error } = await supabase.from("crew_events").insert({
    crew_id: input.crewId,
    event_type: input.eventType,
    from_status: input.from ?? null,
    to_status: input.to ?? null,
    detail: input.detail ?? null,
  });
  if (error) throw new Error(error.message);
}

export type CrewDraft = {
  crew_code: string;
  name: string;
  role: string;
  depot: string;
  shift: string;
  status: CrewStatus;
  availability: string;
  phone: string | null;
  license_valid_till: string | null;
  weekly_hours: number;
  daily_spreadover_hours: number;
  current_assignment: string | null;
  notes: string | null;
};

export async function createCrew(draft: CrewDraft): Promise<Crew> {
  const { data, error } = await supabase.from("crew").insert(draft).select().single();
  if (error) throw new Error(error.message);
  const crew = data as Crew;
  await logEvent({
    crewId: crew.id,
    eventType: "CREATED",
    to: crew.status,
    detail: `Added to ${crew.depot} roster`,
  });
  return crew;
}

export async function updateCrew(id: string, patch: Partial<CrewDraft>): Promise<Crew> {
  const { data, error } = await supabase.from("crew").update(patch).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  const crew = data as Crew;
  await logEvent({ crewId: id, eventType: "UPDATED", to: crew.status, detail: "Details edited" });
  return crew;
}

async function transition(
  crew: Crew,
  next: CrewStatus,
  eventType: string,
  patch: Partial<Crew> = {},
  detail?: string,
): Promise<Crew> {
  const { data, error } = await supabase
    .from("crew")
    .update({ status: next, ...patch })
    .eq("id", crew.id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  await logEvent({
    crewId: crew.id,
    eventType,
    from: crew.status,
    to: next,
    detail: detail ?? null,
  });
  return data as Crew;
}

export function changeCrewStatus(crew: Crew, next: CrewStatus, detail?: string) {
  if (next === "ASSIGNED" && !canBeAssigned(crew))
    throw new Error(assignmentBlockReason(crew) ?? "This crew member cannot be assigned.");
  const patch: Partial<Crew> = next === "ASSIGNED" ? {} : { current_assignment: null };
  return transition(crew, next, "STATUS_CHANGE", patch, detail);
}

export function assignCrew(crew: Crew, assignment: string) {
  const blocked = assignmentBlockReason(crew);
  if (blocked) throw new Error(`Cannot assign ${crew.name}: ${blocked}.`);
  return transition(crew, "ASSIGNED", "ASSIGNED", { current_assignment: assignment }, assignment);
}

export function releaseCrew(crew: Crew) {
  if (crew.status !== "ASSIGNED") throw new Error("This crew member is not currently assigned.");
  return transition(
    crew,
    "AVAILABLE",
    "RELEASED",
    { current_assignment: null },
    "Returned to the available pool",
  );
}

export function deactivateCrew(crew: Crew, reason: string) {
  if (crew.status === "INACTIVE") throw new Error("This crew member is already inactive.");
  return transition(crew, "INACTIVE", "DEACTIVATED", { current_assignment: null }, reason);
}

export function reactivateCrew(crew: Crew) {
  if (crew.status !== "INACTIVE" && crew.status !== "UNAVAILABLE")
    throw new Error("Only inactive or unavailable crew can be reactivated.");
  return transition(
    crew,
    "AVAILABLE",
    "REACTIVATED",
    { current_assignment: null },
    "Returned to duty roster",
  );
}
