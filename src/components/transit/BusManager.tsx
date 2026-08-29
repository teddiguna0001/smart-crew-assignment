import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DataTable, Meter, Panel, Pill, Td, Th } from "@/components/transit/primitives";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BUS_STATUSES,
  BUS_TYPES,
  assignBus,
  busesQueryKey,
  canBeAssigned,
  changeStatus,
  createBus,
  deactivateBus,
  fetchBusEvents,
  fetchBuses,
  reactivateBus,
  releaseBus,
  retireBus,
  statusTone,
  updateBus,
  type Bus,
  type BusDraft,
  type BusStatus,
} from "@/lib/fleet-api";
import { DTC_DEPOTS } from "@/data/transitData";

type DialogMode =
  | { kind: "closed" }
  | { kind: "add" }
  | { kind: "edit"; bus: Bus }
  | { kind: "view"; bus: Bus }
  | { kind: "status"; bus: Bus }
  | { kind: "assign"; bus: Bus }
  | { kind: "deactivate"; bus: Bus }
  | { kind: "retire"; bus: Bus };

const emptyDraft = (): BusDraft => ({
  bus_code: "",
  bus_number: "",
  depot: DTC_DEPOTS[0]?.name ?? "",
  capacity: 40,
  bus_type: BUS_TYPES[0],
  status: "AVAILABLE",
  model: "",
  energy_pct: 100,
  odometer_km: 0,
  current_assignment: null,
  notes: "",
});

export function BusManager() {
  const qc = useQueryClient();
  const { data: buses = [], isLoading, error } = useQuery({
    queryKey: busesQueryKey,
    queryFn: fetchBuses,
  });

  const [dialog, setDialog] = useState<DialogMode>({ kind: "closed" });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | BusStatus>("ALL");
  const [draft, setDraft] = useState<BusDraft>(emptyDraft());
  const [reason, setReason] = useState("");
  const [assignment, setAssignment] = useState("");
  const [nextStatus, setNextStatus] = useState<BusStatus>("AVAILABLE");

  const close = () => setDialog({ kind: "closed" });

  const run = useMutation({
    mutationFn: async (action: () => Promise<unknown>) => action(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: busesQueryKey });
      close();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const act = (label: string, action: () => Promise<unknown>) =>
    run.mutate(
      async () => {
        const res = await action();
        toast.success(label);
        return res;
      },
      { onError: (e: Error) => toast.error(e.message) },
    );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return buses.filter((b) => {
      const matchesStatus = statusFilter === "ALL" || b.status === statusFilter;
      const matchesText =
        !q ||
        [b.bus_code, b.bus_number, b.depot, b.bus_type, b.model ?? "", b.current_assignment ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(q);
      return matchesStatus && matchesText;
    });
  }, [buses, search, statusFilter]);

  return (
    <>
      <Panel
        title="Vehicle inventory"
        hint="Backed by the fleet database — every status change is written to the vehicle's permanent history."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search registration, depot, type…"
              className="h-10 w-56"
            />
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as "ALL" | BusStatus)}
            >
              <SelectTrigger className="h-10 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                {BUS_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              className="h-10"
              onClick={() => {
                setDraft(emptyDraft());
                setDialog({ kind: "add" });
              }}
            >
              Add bus
            </Button>
          </div>
        }
      >
        {error ? (
          <p className="p-4 text-sm text-destructive">{(error as Error).message}</p>
        ) : isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">Loading fleet…</p>
        ) : (
          <DataTable
            head={
              <>
                <Th>Registration</Th>
                <Th>Type</Th>
                <Th>Depot</Th>
                <Th className="w-40">Charge / fuel</Th>
                <Th className="text-right">Odometer</Th>
                <Th>Assignment</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </>
            }
          >
            {rows.map((b) => (
              <tr key={b.id} className="transition-colors duration-200 hover:bg-muted">
                <Td>
                  <p className="num font-semibold">{b.bus_number}</p>
                  <p className="text-xs text-muted-foreground">
                    {b.bus_code} · {b.model ?? "—"} · {b.capacity} seats
                  </p>
                </Td>
                <Td className="text-muted-foreground">{b.bus_type}</Td>
                <Td className="text-muted-foreground">{b.depot}</Td>
                <Td>
                  <p className="num text-sm font-semibold">{b.energy_pct}%</p>
                  <Meter
                    value={b.energy_pct}
                    tone={b.energy_pct < 25 ? "destructive" : b.energy_pct < 55 ? "accent" : "secondary"}
                    className="mt-1.5"
                  />
                </Td>
                <Td className="num text-right">{b.odometer_km.toLocaleString("en-IN")}</Td>
                <Td className="text-muted-foreground">{b.current_assignment ?? "—"}</Td>
                <Td>
                  <Pill tone={statusTone(b.status)}>{b.status}</Pill>
                  <p className="label-xs mt-1 text-muted-foreground">
                    {canBeAssigned(b) ? "Assignable" : "Not assignable"}
                  </p>
                </Td>
                <Td className="text-right">
                  <div className="flex flex-wrap justify-end gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => setDialog({ kind: "view", bus: b })}>
                      View
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={b.status === "RETIRED"}
                      onClick={() => {
                        setDraft({
                          bus_code: b.bus_code,
                          bus_number: b.bus_number,
                          depot: b.depot,
                          capacity: b.capacity,
                          bus_type: b.bus_type,
                          status: b.status,
                          model: b.model,
                          energy_pct: b.energy_pct,
                          odometer_km: b.odometer_km,
                          current_assignment: b.current_assignment,
                          notes: b.notes,
                        });
                        setDialog({ kind: "edit", bus: b });
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={b.status === "RETIRED"}
                      onClick={() => {
                        setNextStatus(b.status);
                        setReason("");
                        setDialog({ kind: "status", bus: b });
                      }}
                    >
                      Status
                    </Button>
                    {b.status === "ASSIGNED" ? (
                      <Button size="sm" variant="outline" onClick={() => act("Bus released", () => releaseBus(b))}>
                        Release
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!canBeAssigned(b)}
                        onClick={() => {
                          setAssignment("");
                          setDialog({ kind: "assign", bus: b });
                        }}
                      >
                        Assign
                      </Button>
                    )}
                    {b.status === "INACTIVE" || b.status === "MAINTENANCE" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => act("Bus reactivated", () => reactivateBus(b))}
                      >
                        Reactivate
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={b.status === "RETIRED"}
                        onClick={() => {
                          setReason("");
                          setDialog({ kind: "deactivate", bus: b });
                        }}
                      >
                        Deactivate
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={b.status === "RETIRED"}
                      onClick={() => {
                        setReason("");
                        setDialog({ kind: "retire", bus: b });
                      }}
                    >
                      Retire
                    </Button>
                  </div>
                </Td>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>

      {/* Add / edit ------------------------------------------------- */}
      <Dialog
        open={dialog.kind === "add" || dialog.kind === "edit"}
        onOpenChange={(o) => !o && close()}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{dialog.kind === "edit" ? "Edit bus" : "Add bus"}</DialogTitle>
            <DialogDescription>
              Vehicle records are stored in the fleet database and drive assignment eligibility.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Bus ID">
              <Input
                value={draft.bus_code}
                onChange={(e) => setDraft({ ...draft, bus_code: e.target.value })}
                placeholder="BUS-1301"
              />
            </Field>
            <Field label="Bus number">
              <Input
                value={draft.bus_number}
                onChange={(e) => setDraft({ ...draft, bus_number: e.target.value })}
                placeholder="DL-1PD-0001"
              />
            </Field>
            <Field label="Depot">
              <Select value={draft.depot} onValueChange={(v) => setDraft({ ...draft, depot: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DTC_DEPOTS.map((d) => (
                    <SelectItem key={d.id} value={d.name}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Type">
              <Select value={draft.bus_type} onValueChange={(v) => setDraft({ ...draft, bus_type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BUS_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Capacity">
              <Input
                type="number"
                value={draft.capacity}
                onChange={(e) => setDraft({ ...draft, capacity: Number(e.target.value) })}
              />
            </Field>
            <Field label="Status">
              <Select
                value={draft.status}
                onValueChange={(v) => setDraft({ ...draft, status: v as BusStatus })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BUS_STATUSES.filter((s) => s !== "ASSIGNED" && s !== "RETIRED").map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Model">
              <Input
                value={draft.model ?? ""}
                onChange={(e) => setDraft({ ...draft, model: e.target.value })}
              />
            </Field>
            <Field label="Charge / fuel %">
              <Input
                type="number"
                value={draft.energy_pct}
                onChange={(e) => setDraft({ ...draft, energy_pct: Number(e.target.value) })}
              />
            </Field>
            <Field label="Odometer (km)">
              <Input
                type="number"
                value={draft.odometer_km}
                onChange={(e) => setDraft({ ...draft, odometer_km: Number(e.target.value) })}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Notes">
                <Textarea
                  value={draft.notes ?? ""}
                  onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                  rows={2}
                />
              </Field>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button
              disabled={run.isPending || !draft.bus_code.trim() || !draft.bus_number.trim()}
              onClick={() =>
                dialog.kind === "edit"
                  ? act("Bus updated", () => updateBus(dialog.bus.id, draft))
                  : act("Bus added", () => createBus(draft))
              }
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View ------------------------------------------------------- */}
      <Dialog open={dialog.kind === "view"} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          {dialog.kind === "view" && <BusDetail bus={dialog.bus} />}
        </DialogContent>
      </Dialog>

      {/* Change status --------------------------------------------- */}
      <Dialog open={dialog.kind === "status"} onOpenChange={(o) => !o && close()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change status</DialogTitle>
            <DialogDescription>
              Only AVAILABLE buses can be dispatched. Maintenance, inactive and retired vehicles are
              excluded from assignment.
            </DialogDescription>
          </DialogHeader>
          <Field label="New status">
            <Select value={nextStatus} onValueChange={(v) => setNextStatus(v as BusStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BUS_STATUSES.filter((s) => s !== "ASSIGNED").map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Reason / note">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button
              disabled={run.isPending}
              onClick={() =>
                dialog.kind === "status" &&
                act("Status updated", () => changeStatus(dialog.bus, nextStatus, reason || undefined))
              }
            >
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign ----------------------------------------------------- */}
      <Dialog open={dialog.kind === "assign"} onOpenChange={(o) => !o && close()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign bus</DialogTitle>
            <DialogDescription>Record the route or trip this vehicle is dispatched to.</DialogDescription>
          </DialogHeader>
          <Field label="Assignment">
            <Input
              value={assignment}
              onChange={(e) => setAssignment(e.target.value)}
              placeholder="Route 522 / Trip 522-UP-0815"
            />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button
              disabled={run.isPending || !assignment.trim()}
              onClick={() =>
                dialog.kind === "assign" && act("Bus assigned", () => assignBus(dialog.bus, assignment.trim()))
              }
            >
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate / retire ---------------------------------------- */}
      <Dialog
        open={dialog.kind === "deactivate" || dialog.kind === "retire"}
        onOpenChange={(o) => !o && close()}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dialog.kind === "retire" ? "Retire bus" : "Deactivate bus"}</DialogTitle>
            <DialogDescription>
              The vehicle record and its full operational history are kept — the bus is only removed from
              the assignable pool.
            </DialogDescription>
          </DialogHeader>
          <Field label="Reason">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button
              variant={dialog.kind === "retire" ? "destructive" : "default"}
              disabled={run.isPending || !reason.trim()}
              onClick={() => {
                if (dialog.kind === "retire") act("Bus retired", () => retireBus(dialog.bus, reason.trim()));
                else if (dialog.kind === "deactivate")
                  act("Bus deactivated", () => deactivateBus(dialog.bus, reason.trim()));
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="label-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function BusDetail({ bus }: { bus: Bus }) {
  const { data: events = [] } = useQuery({
    queryKey: ["bus-events", bus.id],
    queryFn: () => fetchBusEvents(bus.id),
  });

  const facts: [string, string][] = [
    ["Bus ID", bus.bus_code],
    ["Bus number", bus.bus_number],
    ["Depot", bus.depot],
    ["Type", bus.bus_type],
    ["Capacity", `${bus.capacity} seats`],
    ["Model", bus.model ?? "—"],
    ["Charge / fuel", `${bus.energy_pct}%`],
    ["Odometer", `${bus.odometer_km.toLocaleString("en-IN")} km`],
    ["Assignment", bus.current_assignment ?? "—"],
    ["Availability", canBeAssigned(bus) ? "Assignable" : "Not assignable"],
    ["Last maintenance", bus.last_maintenance ?? "—"],
    ["Next inspection", bus.next_inspection_due ?? "—"],
    ["Retired at", bus.retired_at ? new Date(bus.retired_at).toLocaleString("en-IN") : "—"],
  ];

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-3">
          {bus.bus_number}
          <Pill tone={statusTone(bus.status)}>{bus.status}</Pill>
        </DialogTitle>
        <DialogDescription>{bus.notes || "No operational notes recorded."}</DialogDescription>
      </DialogHeader>
      <dl className="grid grid-cols-2 gap-3">
        {facts.map(([k, v]) => (
          <div key={k}>
            <dt className="label-xs text-muted-foreground">{k}</dt>
            <dd className="text-sm font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      <div>
        <p className="label-xs mb-2 text-muted-foreground">Operational history</p>
        <ul className="space-y-2">
          {events.map((e) => (
            <li key={e.id} className="rounded-sm bg-muted px-3 py-2 text-xs">
              <span className="font-semibold">{e.event_type}</span>
              {e.from_status ? ` · ${e.from_status} → ${e.to_status}` : e.to_status ? ` · ${e.to_status}` : ""}
              {e.detail ? ` · ${e.detail}` : ""}
              <span className="block text-muted-foreground">
                {new Date(e.created_at).toLocaleString("en-IN")}
              </span>
            </li>
          ))}
          {!events.length && <li className="text-xs text-muted-foreground">No history yet.</li>}
        </ul>
      </div>
    </>
  );
}
