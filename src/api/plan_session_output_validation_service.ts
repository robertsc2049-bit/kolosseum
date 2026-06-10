
// DEV NOTE: API boundary surface. This file may expose or transport engine results, but must
// not bypass engine package boundaries, infer hidden truth, or let UI/product state mutate
// deterministic engine behaviour.

/* eslint-disable @typescript-eslint/no-explicit-any */
// src/api/plan_session_output_validation_service.ts
import { upstreamBadGateway } from "./http_errors.js";

export function validatePlanSessionOutput(out: any): void {
  if (!out || out.ok !== true) {
    throw upstreamBadGateway("Engine output invalid (ok !== true)", { output: out ?? null });
  }

  const session = out?.result?.session;
  if (!session || !Array.isArray(session.exercises) || session.exercises.length < 1) {
    throw upstreamBadGateway("Engine output invalid (missing result.session.exercises)", { output: out ?? null });
  }
}
