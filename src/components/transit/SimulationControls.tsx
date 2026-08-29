import { Panel, Pill } from "@/components/transit/primitives";
import { Slider } from "@/components/ui/slider";
import {
  SERVICE_END_MIN,
  SERVICE_START_MIN,
  SPEED_OPTIONS,
  busesAt,
  minutesToClock,
  useDaySimulation,
  type SimSpeed,
} from "@/lib/day-simulation";

/** Clock + transport controls for the 24-hour operational simulation. */
export function SimulationControls() {
  const { minute, playing, speed, clock, controls } = useDaySimulation();
  const buses = busesAt(minute);
  const running = buses.filter((b) => b.simStatus === "IN_SERVICE").length;
  const pct = Math.round(
    ((minute - SERVICE_START_MIN) / (SERVICE_END_MIN - SERVICE_START_MIN)) * 100,
  );

  return (
    <Panel
      title="24-hour operational simulation"
      hint="Modelled, not live GPS. Bus positions are interpolated along the real route geometry from each trip's start and end time against the simulation clock."
      action={
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone="neutral">Operational Simulation</Pill>
          <span className="num text-2xl font-bold">{clock}</span>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => controls.toggle()}
            className="label-xs rounded-sm bg-ink px-5 py-3 text-ink-foreground transition-all duration-200 hover:scale-105"
          >
            {playing ? "Pause" : "Play"}
          </button>
          <button
            onClick={() => controls.reset()}
            className="label-xs rounded-sm bg-muted px-5 py-3 text-muted-foreground transition-all duration-200 hover:scale-105"
          >
            Reset
          </button>
          <div className="ml-auto flex gap-1 rounded-md bg-muted p-1.5">
            {SPEED_OPTIONS.map((s: SimSpeed) => (
              <button
                key={s}
                onClick={() => controls.setSpeed(s)}
                className={`label-xs num rounded-sm px-4 py-2 transition-all duration-200 hover:scale-105 ${
                  speed === s ? "bg-ink text-ink-foreground" : "text-muted-foreground"
                }`}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>

        <div>
          <Slider
            value={[minute]}
            min={SERVICE_START_MIN}
            max={SERVICE_END_MIN}
            step={1}
            onValueChange={([v]) => controls.seek(v ?? SERVICE_START_MIN)}
          />
          <div className="label-xs mt-2 flex justify-between text-muted-foreground">
            <span>{minutesToClock(SERVICE_START_MIN)} service start</span>
            <span className="num">{pct}% of operating day</span>
            <span>{minutesToClock(SERVICE_END_MIN)} last pull-in</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Pill tone="primary">{running} buses in service</Pill>
          <Pill tone="secondary">
            {buses.filter((b) => b.simStatus === "AT_TERMINAL").length} at terminal
          </Pill>
          <Pill tone="accent">
            {buses.filter((b) => b.simStatus === "AT_DEPOT").length} at depot
          </Pill>
        </div>
      </div>
    </Panel>
  );
}
