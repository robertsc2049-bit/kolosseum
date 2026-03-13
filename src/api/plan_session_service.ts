/* eslint-disable @typescript-eslint/no-explicit-any */
// src/api/plan_session_service.ts
import { runPipelineFromDist } from "./engine_runner_service.js";
import { persistEngineRunBestEffort } from "./engine_run_persistence_service.js";
import { loadPlanSessionDefaultInput } from "./plan_session_default_input_service.js";
import { validatePlanSessionOutput } from "./plan_session_output_validation_service.js";

export async function planSessionService(input: any) {
  const effectiveInput =
    input && typeof input === "object" && Object.keys(input).length > 0
      ? input
      : await loadPlanSessionDefaultInput();

  const out = await runPipelineFromDist(effectiveInput);

  validatePlanSessionOutput(out);

  await persistEngineRunBestEffort("plan_session", effectiveInput, out);

  return out;
}