import type { Tone } from "@/components/transit/primitives";

/** Maps domain statuses to design-system tones so colour meaning stays consistent. */
export function busTone(status: string): Tone {
  switch (status) {
    case "on-time":
      return "secondary";
    case "delayed":
      return "accent";
    case "critical-delay":
    case "disrupted":
      return "destructive";
    default:
      return "neutral";
  }
}

export function tripTone(status: string): Tone {
  switch (status) {
    case "Completed":
      return "secondary";
    case "In-Transit":
      return "primary";
    case "Delayed":
      return "accent";
    case "Conflict":
    case "Cancelled":
      return "destructive";
    default:
      return "neutral";
  }
}

export function fleetTone(status: string): Tone {
  switch (status) {
    case "Active Route":
      return "primary";
    case "Standby":
      return "secondary";
    case "Scheduled Maintenance":
      return "accent";
    case "Breakdown":
      return "destructive";
    default:
      return "neutral";
  }
}

export function crewTone(status: string): Tone {
  switch (status) {
    case "On-Duty":
      return "primary";
    case "Available":
      return "secondary";
    case "Rest Period":
      return "accent";
    case "Sick/Leave":
      return "destructive";
    default:
      return "neutral";
  }
}

export function severityTone(severity: string): Tone {
  switch (severity) {
    case "Critical":
      return "destructive";
    case "High":
      return "accent";
    case "Moderate":
      return "primary";
    default:
      return "neutral";
  }
}

export const inr = (value: number) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
