import { createServerFn } from "@tanstack/react-start";
import type { DisruptionInput, ScenarioInput } from "@/lib/ops-engine";

/** Full operational state: resources, published assignments, incidents, scenarios. */
export const getOpsState = createServerFn({ method: "GET" }).handler(async () => {
  const { doListState } = await import("@/lib/ops.server");
  return doListState();
});

/** Feature 8 — automatic resource assignment (preview or published). */
export const runAssignment = createServerFn({ method: "POST" })
  .inputValidator((input: { persist: boolean }) => input)
  .handler(async ({ data }) => {
    const { doAutoAssign } = await import("@/lib/ops.server");
    return doAutoAssign(data.persist);
  });

/** Feature 6 — raise a disruption, compute impact and publish the recovery. */
export const createDisruption = createServerFn({ method: "POST" })
  .inputValidator((input: DisruptionInput & { location?: string }) => input)
  .handler(async ({ data }) => {
    const { doCreateDisruption } = await import("@/lib/ops.server");
    return doCreateDisruption(data);
  });

export const resolveDisruption = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const { doResolveDisruption } = await import("@/lib/ops.server");
    return doResolveDisruption(data.id);
  });

/** Feature 7 — what-if scenario: computed and stored, schedule untouched. */
export const previewScenario = createServerFn({ method: "POST" })
  .inputValidator((input: ScenarioInput) => input)
  .handler(async ({ data }) => {
    const { doPreviewScenario } = await import("@/lib/ops.server");
    return doPreviewScenario(data);
  });

/** Feature 7 — commit a scenario to the live operational schedule. */
export const applyScenario = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const { doApplyScenario } = await import("@/lib/ops.server");
    return doApplyScenario(data.id);
  });
