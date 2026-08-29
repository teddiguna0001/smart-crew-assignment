import {
  applyScenario,
  createDisruption,
  getOpsState,
  previewScenario,
  resolveDisruption,
  runAssignment,
} from "@/lib/ops.functions";

/** Shared query keys + thin client wrappers around the ops server functions. */
export const opsStateQueryKey = ["ops-state"] as const;

export function fetchOpsState() {
  return getOpsState();
}

export type OpsState = Awaited<ReturnType<typeof getOpsState>>;
export type DisruptionRecord = OpsState["disruptions"][number];
export type ScenarioRecord = OpsState["scenarios"][number];
export type AssignmentRecord = OpsState["assignments"][number];

export {
  applyScenario,
  createDisruption,
  previewScenario,
  resolveDisruption,
  runAssignment,
};
