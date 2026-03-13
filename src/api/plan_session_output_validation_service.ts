/* eslint-disable @typescript-eslint/no-explicit-any */
// src/api/plan_session_output_validation_service.ts
import { upstreamBadGateway } from "./http_errors.js";

export function validatePlanSessionOutput(out: any): void {
  if (!out || out.ok !== true) {
    throw upstreamBadGateway("Engine output invalid (ok !== true)", { output: out ?? null });
  }

  if (!out.session || !Array.isArray(out.session.exercises) || out.session.exercises.length < 1) {
    throw upstreamBadGateway("Engine output invalid (missing session.exercises)", { output: out ?? null });
  }
}