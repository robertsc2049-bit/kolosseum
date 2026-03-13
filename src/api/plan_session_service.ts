/* eslint-disable @typescript-eslint/no-explicit-any */
// src/api/plan_session_service.ts
import {
  upstreamBadGateway
} from "./http_errors.js";
import { runPipelineFromDist } from "./engine_runner_service.js";
import { persistEngineRunBestEffort } from "./engine_run_persistence_service.js";
import { loadPlanSessionDefaultInput } from "./plan_session_default_input_service.js";

export async function planSessionService(input: any) {
  const effectiveInput =
    input && typeof input === "object" && Object.keys(input).length > 0
      ? input
      : await loadPlanSessionDefaultInput();

  const out = await runPipelineFromDist(effectiveInput);

  if (!out || out.ok !== true) {
    throw upstreamBadGateway("Engine output invalid (ok !== true)", { output: out ?? null });
  }

  if (!out.session || !Array.isArray(out.session.exercises) || out.session.exercises.length < 1) {
    throw upstreamBadGateway("Engine output invalid (missing session.exercises)", { output: out ?? null });
  }

  await persistEngineRunBestEffort("plan_session", effectiveInput, out);

  return out;
}