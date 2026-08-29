import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import { Panel, Pill } from "@/components/transit/primitives";
import { Input } from "@/components/ui/input";
import { DTC_DEPOTS, DTC_ROUTES } from "@/data/transitData";
import { busesAt, useDaySimulation } from "@/lib/day-simulation";
import { busTone } from "@/lib/transit-ui";
import { busesQueryKey, fetchBuses, statusTone } from "@/lib/fleet-api";
import type { DTCRoute } from "@/lib/transit-types";

const DELHI: [number, number] = [28.6139, 77.209];

function FitToRoute({ route }: { route: DTCRoute | null }) {
  const map = useMap();
  useEffect(() => {
    if (!route || route.coordinates.length < 2) return;
    map.fitBounds(route.coordinates as [number, number][], { padding: [32, 32] });
  }, [route, map]);
  return null;
}

/** Terminal (end-point) stops derived from the route's own geometry. */
function routeTerminals(route: DTCRoute) {
  const first = route.coordinates[0];
  const last = route.coordinates[route.coordinates.length - 1];
  if (!first || !last) return [];
  return [
    { name: route.origin, position: first },
    { name: route.destination, position: last },
  ];
}

export function NetworkMap() {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(DTC_ROUTES[0]?.id ?? null);
  const { minute, clock } = useDaySimulation();
  const buses = useMemo(() => busesAt(minute), [minute]);
  const { data: fleet = [] } = useQuery({ queryKey: busesQueryKey, queryFn: fetchBuses });

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return DTC_ROUTES;
    return DTC_ROUTES.filter((r) =>
      [r.routeNumber, r.name, r.origin, r.destination, r.corridorType]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [query]);

  const selected = DTC_ROUTES.find((r) => r.id === selectedId) ?? null;
  const visibleBuses = selected
    ? buses.filter((b) => b.routeNumber === selected.routeNumber)
    : buses;

  return (
    <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
      <div className="space-y-4">
        <Panel title="Routes" hint="Search the live route register and select a corridor.">
          <div className="space-y-3">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search route number, terminal…"
              className="h-10"
            />
            <ul className="max-h-[420px] space-y-1 overflow-y-auto">
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => setSelectedId(r.id)}
                    className={`w-full rounded-sm px-3 py-2.5 text-left transition-colors duration-200 ${
                      r.id === selectedId ? "bg-ink text-ink-foreground" : "hover:bg-muted"
                    }`}
                  >
                    <span className="num text-sm font-bold">{r.routeNumber}</span>
                    <span className="ml-2 text-xs opacity-80">{r.corridorType}</span>
                    <p className="mt-0.5 text-xs opacity-70">{r.name}</p>
                  </button>
                </li>
              ))}
              {!results.length && (
                <li className="px-3 py-2 text-xs text-muted-foreground">No routes match that search.</li>
              )}
            </ul>
          </div>
        </Panel>

        {selected && (
          <Panel title={`Route ${selected.routeNumber}`} hint={selected.name}>
            <dl className="grid grid-cols-2 gap-3">
              {[
                ["Origin", selected.origin],
                ["Destination", selected.destination],
                ["Distance", `${selected.distanceKm} km`],
                ["Run time", `${selected.avgDurationMins} min`],
                ["Headway", `${selected.frequencyMins} min`],
                ["Stops", `${selected.stopsCount}`],
                ["Buses on route", `${visibleBuses.length} tracked`],
                ["Corridor", selected.corridorType],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="label-xs text-muted-foreground">{k}</dt>
                  <dd className="text-sm font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        )}
      </div>

      <Panel
        className="min-w-0"
        title="Network map"
        hint="OpenStreetMap corridors, depots and operational-simulation vehicle positions (modelled, not live GPS)."
        bodyClassName="p-0"
        action={
          <button
            onClick={() => setSelectedId(null)}
            className="label-xs rounded-sm bg-muted px-3 py-2 text-muted-foreground transition-all duration-200 hover:scale-105"
          >
            Show whole network
          </button>
        }
      >
        <div className="h-[640px] w-full overflow-hidden rounded-md">
          <MapContainer center={DELHI} zoom={11} className="h-full w-full" scrollWheelZoom>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitToRoute route={selected} />

            {DTC_ROUTES.map((r) => {
              const dim = selected && selected.id !== r.id;
              return (
                <Polyline
                  key={r.id}
                  positions={r.coordinates}
                  pathOptions={{
                    color: r.color,
                    weight: selected?.id === r.id ? 7 : 3,
                    opacity: dim ? 0.22 : 0.9,
                  }}
                  eventHandlers={{ click: () => setSelectedId(r.id) }}
                >
                  <Popup>
                    <p className="text-sm font-semibold">
                      Route {r.routeNumber} · {r.corridorType}
                    </p>
                    <p className="text-xs">{r.name}</p>
                    <p className="text-xs">
                      {r.distanceKm} km · {r.avgDurationMins} min · every {r.frequencyMins} min ·{" "}
                      {r.stopsCount} stops
                    </p>
                    <p className="text-xs">{r.activeBuses} buses rostered</p>
                  </Popup>
                </Polyline>
              );
            })}

            {selected &&
              routeTerminals(selected).map((stop) => (
                <CircleMarker
                  key={`${selected.id}-${stop.name}`}
                  center={stop.position}
                  radius={7}
                  pathOptions={{ color: selected.color, fillColor: "#ffffff", fillOpacity: 1, weight: 3 }}
                >
                  <Popup>
                    <p className="text-sm font-semibold">{stop.name}</p>
                    <p className="text-xs">Terminal stop · Route {selected.routeNumber}</p>
                  </Popup>
                </CircleMarker>
              ))}

            {DTC_DEPOTS.map((d) => (
              <CircleMarker
                key={d.id}
                center={[d.lat, d.lng]}
                radius={9}
                pathOptions={{ color: "#111111", fillColor: "#facc15", fillOpacity: 1, weight: 3 }}
              >
                <Popup>
                  <p className="text-sm font-semibold">{d.name}</p>
                  <p className="text-xs">Depot code {d.code}</p>
                  <p className="text-xs">
                    Fleet {d.totalFleet} · on road {d.activeFleet} · standby {d.standbyFleet} · workshop{" "}
                    {d.maintenanceFleet}
                  </p>
                  <p className="text-xs">
                    {d.manager} · {d.phone}
                  </p>
                  <p className="text-xs">
                    {fleet.filter((b) => b.depot === d.name).length} vehicles in the fleet register
                  </p>
                </Popup>
              </CircleMarker>
            ))}

            {visibleBuses.map((b) => {
              const record = fleet.find((f) => f.bus_number === b.regNumber || f.bus_code === b.busId);
              return (
                <CircleMarker
                  key={b.busId}
                  center={[b.lat, b.lng]}
                  radius={6}
                  pathOptions={{
                    color: "#ffffff",
                    fillColor: b.status === "on-time" ? "#16a34a" : b.status === "delayed" ? "#f97316" : "#dc2626",
                    fillOpacity: 1,
                    weight: 2,
                  }}
                >
                  <Popup>
                    <p className="text-sm font-semibold">
                      {b.regNumber} · Route {b.routeNumber}
                    </p>
                    <p className="text-xs">
                      {b.driverName} · {b.speedKmph} km/h · next stop {b.nextStop}
                    </p>
                    <p className="text-xs">
                      {b.passengers} on board · {b.batteryOrFuelPct}% {b.fuelType} · {b.depot}
                    </p>
                    <p className="text-xs">
                      {b.tripCode} · {b.tripWindow} · {b.tripProgressPct}% through trip
                    </p>
                    <p className="text-xs">
                      {b.status === "on-time" ? "On time" : `${b.delayMins} min late`}
                      {record ? ` · fleet status ${record.status} · ${record.capacity} seats` : ""}
                    </p>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
        </div>
        <div className="flex flex-wrap items-center gap-2 p-4">
          <Pill tone="primary">{DTC_ROUTES.length} routes</Pill>
          <Pill tone="accent">{DTC_DEPOTS.length} depots</Pill>
          <Pill tone={busTone("on-time")}>{visibleBuses.length} buses simulated</Pill>
          <Pill tone="neutral">Operational simulation · {clock}</Pill>
          {fleet.length ? <Pill tone={statusTone("AVAILABLE")}>{fleet.filter((f) => f.status === "AVAILABLE").length} available</Pill> : null}
        </div>
      </Panel>
    </div>
  );
}

export default NetworkMap;
