/* eslint-disable @typescript-eslint/no-explicit-any */
// src/api/plan_session_request_normalization_service.ts
import { loadPlanSessionDefaultInput } from "./plan_session_default_input_service.js";

export async function normalizePlanSessionRequest(input: any): Promise<any> {
  return input && typeof input === "object" && Object.keys(input).length > 0
    ? input
    : await loadPlanSessionDefaultInput();
}