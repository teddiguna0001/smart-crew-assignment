import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BatteryCharging, IdCard, Wrench } from "lucide-react";
import { Metric, PageHead } from "@/components/transit/primitives";
import { BusManager } from "@/components/transit/BusManager";
import { busesQueryKey, fetchBuses } from "@/lib/fleet-api";
import { CrewManager } from "@/components/transit/CrewManager";
import { crewQueryKey, fetchCrew } from "@/lib/crew-api";

export const Route = createFileRoute("/fleet")({
  head: () => ({
    meta: [
      { title: "Fleet & Crew — DTC TransitOps" },
      {
        name: "description",
        content:
          "Vehicle availability, state of charge, maintenance windows and CMVR-compliant crew duty hours for DTC depots.",
      },
      { property: "og:title", content: "Fleet & Crew — DTC TransitOps" },
      {
        property: "og:description",
        content: "Vehicle availability, maintenance windows and crew duty-hour compliance.",
      },
    ],
  }),
  component: FleetCrew,
});

function FleetCrew() {
  const [tab, setTab] = useState<"fleet" | "crew">("fleet");

  const { data: buses = [] } = useQuery({ queryKey: busesQueryKey, queryFn: fetchBuses });

  const available = buses.filter((b) => b.status === "AVAILABLE").length;
  const workshop = buses.filter((b) => b.status === "MAINTENANCE").length;
  const { data: crew = [] } = useQuery({ queryKey: crewQueryKey, queryFn: fetchCrew });
  const restCrew = crew.filter((c) => c.status === "OFF_DUTY").length;
  const overSpread = crew.filter((c) => c.daily_spreadover_hours > 11).length;

  return (
    <div className="space-y-8">
      <PageHead
        eyebrow="Resource pool"
        title="Fleet & crew"
        description="Vehicle health and duty-hour compliance feed straight into the solver — a bus in the workshop or a driver at 12 hours is never assigned."
        aside={
          <div className="flex gap-2 rounded-md bg-muted p-1.5">
            {(["fleet", "crew"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`label-xs rounded-sm px-5 py-3 transition-all duration-200 hover:scale-105 ${
                  tab === t ? "bg-ink text-ink-foreground" : "text-muted-foreground"
                }`}
              >
                {t === "fleet" ? "Vehicles" : "Crew roster"}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Vehicles tracked"
          value={buses.length}
          tone="primary"
          icon={<BatteryCharging className="h-5 w-5" strokeWidth={2.4} />}
        />
        <Metric label="Available pool" value={available} tone="secondary" delta="Assignable right now" />
        <Metric
          label="In workshop"
          value={workshop}
          tone="accent"
          icon={<Wrench className="h-5 w-5" strokeWidth={2.4} />}
        />
        <Metric
          label="Spreadover risk"
          value={overSpread}
          tone={overSpread ? "destructive" : "secondary"}
          delta={`${restCrew} crew currently in mandated rest`}
          icon={<IdCard className="h-5 w-5" strokeWidth={2.4} />}
        />
      </div>

      {tab === "fleet" ? (
        <BusManager />
      ) : (
        <CrewManager />
      )}
    </div>
  );
}
