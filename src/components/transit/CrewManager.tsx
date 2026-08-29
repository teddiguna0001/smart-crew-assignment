import { useMemo, useState, type ReactNode } from "react";
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
  CREW_ROLES,
  CREW_SHIFTS,
  CREW_STATUSES,
  assignCrew,
  assignmentBlockReason,
  canBeAssigned,
  changeCrewStatus,
  createCrew,
  crewQueryKey,
  crewStatusTone,
  deactivateCrew,
  fetchCrew,
  fetchCrewEvents,
  reactivateCrew,
  releaseCrew,
  updateCrew,
  type Crew,
  type CrewDraft,
  type CrewStatus,
} from "@/lib/crew-api";
import { DTC_DEPOTS } from "@/data/transitData";

type DialogMode =
  | { kind: "closed" }
  | { kind: "add" }
  | { kind: "edit"; crew: Crew }
  | { kind: "view"; crew: Crew }
  | { kind: "status"; crew: Crew }
  | { kind: "assign"; crew: Crew }
  | { kind: "deactivate"; crew: Crew };

const emptyDraft = (): CrewDraft => ({
  crew_code: "",
  name: "",
  role: CREW_ROLES[0],
  depot: DTC_DEPOTS[0]?.name ?? "",
  shift: CREW_SHIFTS[0],
  status: "AVAILABLE",
  availability: "Full shift",
  phone: "",
  license_valid_till: null,
  weekly_hours: 0,
  daily_spreadover_hours: 0,
  current_assignment: null,
  notes: "",
});

export function CrewManager() {
  const qc = useQueryClient();
  const { data: crew = [], isLoading, error } = useQuery({
    queryKey: crewQueryKey,
    queryFn: fetchCrew,
  });

  const [dialog, setDialog] = useState<DialogMode>({ kind: "closed" });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | CrewStatus>("ALL");
  const [draft, setDraft] = useState<CrewDraft>(emptyDraft());
  const [reason, setReason] = useState("");
  const [assignment, setAssignment] = useState("");
  const [nextStatus, setNextStatus] = useState<CrewStatus>("AVAILABLE");

  const close = () => setDialog({ kind: "closed" });

  const run = useMutation({
    mutationFn: async (action: () => Promise<unknown>) => action(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: crewQueryKey });
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
    return crew.filter((c) => {
      const matchesStatus = statusFilter === "ALL" || c.status === statusFilter;
      const matchesText =
        !q ||
        [c.crew_code, c.name, c.role, c.depot, c.shift, c.current_assignment ?? "", c.availability]
          .join(" ")
          .toLowerCase()
          .includes(q);
      return matchesStatus && matchesText;
    });
  }, [crew, search, statusFilter]);

  return (
    <>
      <Panel
        title="Crew register"
        hint="Backed by the crew database — only eligible crew can be rostered onto new trips, and every change is written to the crew member's history."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search crew ID, name, depot…"
              className="h-10 w-56"
            />
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as "ALL" | CrewStatus)}
            >
              <SelectTrigger className="h-10 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                {CREW_STATUSES.map((s) => (
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
              Add crew
            </Button>
          </div>
        }
      >
        {error ? (
          <p className="p-4 text-sm text-destructive">{(error as Error).message}</p>
        ) : isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">Loading crew…</p>
        ) : (
          <DataTable
            head={
              <>
                <Th>Crew</Th>
                <Th>Role</Th>
                <Th>Depot</Th>
                <Th>Shift</Th>
                <Th className="w-44">Spreadover today</Th>
                <Th>Availability</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </>
            }
          >
            {rows.map((c) => {
              const spread = Math.round((c.daily_spreadover_hours / 12) * 100);
              const blocked = assignmentBlockReason(c);
              return (
                <tr key={c.id} className="transition-colors duration-200 hover:bg-muted">
                  <Td>
                    <p className="font-semibold">{c.name}</p>
                    <p className="num text-xs text-muted-foreground">{c.crew_code}</p>
                  </Td>
                  <Td className="text-muted-foreground">{c.role}</Td>
                  <Td className="text-muted-foreground">{c.depot}</Td>
                  <Td className="text-muted-foreground">{c.shift}</Td>
                  <Td>
                    <p className="num text-sm font-semibold">{c.daily_spreadover_hours} h / 12 h</p>
                    <Meter
                      value={spread}
                      tone={spread > 92 ? "destructive" : spread > 75 ? "accent" : "primary"}
                      className="mt-1.5"
                    />
                  </Td>
                  <Td className="text-muted-foreground">
                    {c.current_assignment ?? c.availability}
                  </Td>
                  <Td>
                    <Pill tone={crewStatusTone(c.status)}>{c.status}</Pill>
                    <p className="label-xs mt-1 text-muted-foreground">
                      {blocked ? "Not assignable" : "Assignable"}
                    </p>
                  </Td>
                  <Td className="text-right">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDialog({ kind: "view", crew: c })}
                      >
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setDraft({
                            crew_code: c.crew_code,
                            name: c.name,
                            role: c.role,
                            depot: c.depot,
                            shift: c.shift,
                            status: c.status,
                            availability: c.availability,
                            phone: c.phone,
                            license_valid_till: c.license_valid_till,
                            weekly_hours: c.weekly_hours,
                            daily_spreadover_hours: c.daily_spreadover_hours,
                            current_assignment: c.current_assignment,
                            notes: c.notes,
                          });
                          setDialog({ kind: "edit", crew: c });
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setNextStatus(c.status);
                          setReason("");
                          setDialog({ kind: "status", crew: c });
                        }}
                      >
                        Status
                      </Button>
                      {c.status === "ASSIGNED" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => act("Crew released", () => releaseCrew(c))}
                        >
                          Release
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!canBeAssigned(c)}
                          title={blocked ?? undefined}
                          onClick={() => {
                            setAssignment("");
                            setDialog({ kind: "assign", crew: c });
                          }}
                        >
                          Assign
                        </Button>
                      )}
                      {c.status === "INACTIVE" || c.status === "UNAVAILABLE" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => act("Crew reactivated", () => reactivateCrew(c))}
                        >
                          Reactivate
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            setReason("");
                            setDialog({ kind: "deactivate", crew: c });
                          }}
                        >
                          Deactivate
                        </Button>
                      )}
                    </div>
                  </Td>
                </tr>
              );
            })}
            {!rows.length && (
              <tr>
                <Td className="text-muted-foreground">No crew match this filter.</Td>
              </tr>
            )}
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
            <DialogTitle>{dialog.kind === "edit" ? "Edit crew" : "Add crew"}</DialogTitle>
            <DialogDescription>
              Crew records are stored in the crew database and drive rostering eligibility.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Crew ID">
              <Input
                value={draft.crew_code}
                onChange={(e) => setDraft({ ...draft, crew_code: e.target.value })}
                placeholder="DTC-D-9001"
              />
            </Field>
            <Field label="Name">
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Full name"
              />
            </Field>
            <Field label="Role">
              <Select value={draft.role} onValueChange={(v) => setDraft({ ...draft, role: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CREW_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <Field label="Shift">
              <Select value={draft.shift} onValueChange={(v) => setDraft({ ...draft, shift: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CREW_SHIFTS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Status">
              <Select
                value={draft.status}
                onValueChange={(v) => setDraft({ ...draft, status: v as CrewStatus })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CREW_STATUSES.filter((s) => s !== "ASSIGNED").map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Availability">
              <Input
                value={draft.availability}
                onChange={(e) => setDraft({ ...draft, availability: e.target.value })}
                placeholder="Full shift / Depot reserve"
              />
            </Field>
            <Field label="Phone">
              <Input
                value={draft.phone ?? ""}
                onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
              />
            </Field>
            <Field label="Licence valid till">
              <Input
                type="date"
                value={draft.license_valid_till ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, license_valid_till: e.target.value || null })
                }
              />
            </Field>
            <Field label="Weekly hours">
              <Input
                type="number"
                value={draft.weekly_hours}
                onChange={(e) => setDraft({ ...draft, weekly_hours: Number(e.target.value) })}
              />
            </Field>
            <Field label="Spreadover today (h)">
              <Input
                type="number"
                value={draft.daily_spreadover_hours}
                onChange={(e) =>
                  setDraft({ ...draft, daily_spreadover_hours: Number(e.target.value) })
                }
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
              disabled={run.isPending || !draft.crew_code.trim() || !draft.name.trim()}
              onClick={() =>
                dialog.kind === "edit"
                  ? act("Crew updated", () => updateCrew(dialog.crew.id, draft))
                  : act("Crew added", () => createCrew(draft))
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
          {dialog.kind === "view" && <CrewDetail crew={dialog.crew} />}
        </DialogContent>
      </Dialog>

      {/* Change status --------------------------------------------- */}
      <Dialog open={dialog.kind === "status"} onOpenChange={(o) => !o && close()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change crew status</DialogTitle>
            <DialogDescription>
              Only AVAILABLE crew within duty-hour limits can be rostered. Off-duty, unavailable and
              inactive crew are excluded from assignment.
            </DialogDescription>
          </DialogHeader>
          <Field label="New status">
            <Select value={nextStatus} onValueChange={(v) => setNextStatus(v as CrewStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CREW_STATUSES.filter((s) => s !== "ASSIGNED").map((s) => (
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
                act("Status updated", () =>
                  changeCrewStatus(dialog.crew, nextStatus, reason || undefined),
                )
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
            <DialogTitle>Assign crew</DialogTitle>
            <DialogDescription>
              Record the trip or duty this crew member is rostered onto.
            </DialogDescription>
          </DialogHeader>
          <Field label="Assignment">
            <Input
              value={assignment}
              onChange={(e) => setAssignment(e.target.value)}
              placeholder="Trip 522-UP-0815"
            />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button
              disabled={run.isPending || !assignment.trim()}
              onClick={() =>
                dialog.kind === "assign" &&
                act("Crew assigned", () => assignCrew(dialog.crew, assignment.trim()))
              }
            >
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate -------------------------------------------------- */}
      <Dialog open={dialog.kind === "deactivate"} onOpenChange={(o) => !o && close()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Deactivate crew</DialogTitle>
            <DialogDescription>
              The crew record and full duty history are kept — the person is only removed from the
              assignable pool.
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
              variant="destructive"
              disabled={run.isPending || !reason.trim()}
              onClick={() =>
                dialog.kind === "deactivate" &&
                act("Crew deactivated", () => deactivateCrew(dialog.crew, reason.trim()))
              }
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="label-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function CrewDetail({ crew }: { crew: Crew }) {
  const { data: events = [] } = useQuery({
    queryKey: ["crew-events", crew.id],
    queryFn: () => fetchCrewEvents(crew.id),
  });

  const blocked = assignmentBlockReason(crew);

  const facts: [string, string][] = [
    ["Crew ID", crew.crew_code],
    ["Name", crew.name],
    ["Role", crew.role],
    ["Depot", crew.depot],
    ["Shift", crew.shift],
    ["Availability", crew.availability],
    ["Assignment", crew.current_assignment ?? "—"],
    ["Eligible for new trips", blocked ? `No · ${blocked}` : "Yes"],
    ["Weekly hours", `${crew.weekly_hours} h`],
    ["Spreadover today", `${crew.daily_spreadover_hours} h / 12 h`],
    ["Consecutive days", `${crew.consecutive_days}`],
    ["Punctuality", crew.punctuality_score != null ? `${crew.punctuality_score}%` : "—"],
    ["Phone", crew.phone ?? "—"],
    ["Licence valid till", crew.license_valid_till ?? "—"],
  ];

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-3">
          {crew.name}
          <Pill tone={crewStatusTone(crew.status)}>{crew.status}</Pill>
        </DialogTitle>
        <DialogDescription>{crew.notes || "No duty notes recorded."}</DialogDescription>
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
        <p className="label-xs mb-2 text-muted-foreground">Duty history</p>
        <ul className="space-y-2">
          {events.map((e) => (
            <li key={e.id} className="rounded-sm bg-muted px-3 py-2 text-xs">
              <span className="font-semibold">{e.event_type}</span>
              {e.from_status
                ? ` · ${e.from_status} → ${e.to_status}`
                : e.to_status
                  ? ` · ${e.to_status}`
                  : ""}
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
