import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { PageHead } from "@/components/transit/primitives";
import { SimulationControls } from "@/components/transit/SimulationControls";
import { DayTimeline } from "@/components/transit/DayTimeline";

const NetworkMap = lazy(() =>
  import("@/components/transit/NetworkMap").then((m) => ({ default: m.NetworkMap })),
);

export const Route = createFileRoute("/map")({
  head: () => ({
    meta: [
      { title: "Route Map — DTC TransitOps" },
      {
        name: "description",
        content:
          "Interactive OpenStreetMap view of DTC corridors, depots and simulated bus positions with route search and selection.",
      },
      { property: "og:title", content: "Route Map — DTC TransitOps" },
      {
        property: "og:description",
        content: "Search, select and inspect live DTC corridors, depots and buses on one map.",
      },
    ],
  }),
  component: MapPage,
});

function MapPage() {
  return (
    <div className="space-y-8">
      <PageHead
        eyebrow="Network geography"
        title="Route map"
        description="Every corridor drawn from the operational route register — the same data the scheduler and the simulation run on."
      />
      <SimulationControls />
      <ClientOnly
        fallback={
          <div className="h-[640px] w-full animate-pulse rounded-md bg-muted" aria-hidden="true" />
        }
      >
        <Suspense
          fallback={<div className="h-[640px] w-full animate-pulse rounded-md bg-muted" />}
        >
          <NetworkMap />
        </Suspense>
      </ClientOnly>
      <DayTimeline />
    </div>
  );
}
