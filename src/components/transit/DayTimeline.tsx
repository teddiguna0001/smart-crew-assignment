import { Panel, Pill, type Tone } from "@/components/transit/primitives";
import {
  DAY_EVENTS,
  eventsUpTo,
  minutesToClock,
  useDaySimulation,
  type SimEventKind,
} from "@/lib/day-simulation";

const kindTone: Record<SimEventKind, Tone> = {
  SERVICE: "neutral",
  DEPARTURE: "primary",
  COMPLETION: "secondary",
  AVAILABLE: "secondary",
  CREW: "violet",
  PEAK: "accent",
  DISRUPTION: "destructive",
  RECOVERY: "secondary",
  MAINTENANCE: "accent",
  DEPOT: "neutral",
};

/**
 * Daily operations timeline. Every entry is derived from the simulation's own
 * trip plan, disruption record and vehicle telemetry — nothing is hardcoded.
 */
export function DayTimeline() {
  const { minute, clock } = useDaySimulation();
  const events = eventsUpTo(minute, 60);
  const upcoming = DAY_EVENTS.find((e) => e.minute > minute);

  return (
    <Panel
      title="Daily operations timeline"
      hint="Generated from the simulated day's trips, crew sign-ons, disruption and depot movements as the clock advances."
      action={
        <div className="flex items-center gap-2">
          <Pill tone="neutral">{events.length} events so far</Pill>
          <span className="num text-sm font-bold">{clock}</span>
        </div>
      }
    >
      {upcoming ? (
        <p className="label-xs mb-3 text-muted-foreground">
          Next at {minutesToClock(upcoming.minute)} · {upcoming.title}
        </p>
      ) : null}
      <ol className="max-h-[560px] space-y-1 overflow-y-auto">
        {events.map((e) => (
          <li
            key={e.id}
            className="flex gap-3 rounded-sm px-3 py-2.5 transition-colors duration-200 hover:bg-muted"
          >
            <span className="num w-14 shrink-0 text-sm font-bold">{minutesToClock(e.minute)}</span>
            <Pill tone={kindTone[e.kind]} className="shrink-0">
              {e.kind}
            </Pill>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{e.title}</p>
              <p className="text-xs text-muted-foreground">{e.detail}</p>
            </div>
          </li>
        ))}
        {!events.length && (
          <li className="px-3 py-2 text-sm text-muted-foreground">
            Press play to run the operating day.
          </li>
        )}
      </ol>
    </Panel>
  );
}
