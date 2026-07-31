
// DEV NOTE: API boundary surface. Pure, stateless substitution lookup - never
// mutates a session or a runtime event. The lawful result is returned for
// display; if the athlete proceeds, the client tags the eventual
// COMPLETE_EXERCISE/SKIP_EXERCISE event with the returned exercise/edge ids,
// which session_state_write_service.ts verifies against the same registry
// before it is durably recorded.

import { badRequest } from "./http_errors.js";
import { getSessionStateQuery } from "./session_state_query_service.js";
import { buildV1SubstitutionInput } from "./session_substitution_registry.js";
// @ts-ignore - .mjs source, no type declarations
import { tryBuildV1SubstitutionResult } from "../v1SubstitutionEngineContract.mjs";

export async function requestSessionSubstitution(
  session_id: string,
  exerciseId: string,
  unavailableEquipmentIdsInput: unknown
): Promise<Record<string, unknown>> {
  const id = typeof exerciseId === "string" ? exerciseId.trim() : "";
  if (!id) throw badRequest("Missing exercise_id");

  const statePayload: any = await getSessionStateQuery(session_id);
  const remaining = Array.isArray(statePayload?.remaining_exercises) ? statePayload.remaining_exercises : [];
  const isActionable = remaining.some((ex: any) => ex?.exercise_id === id);
  if (!isActionable) {
    throw badRequest("Exercise is not currently actionable in this session", {
      failure_token: "substitution_exercise_not_actionable"
    });
  }

  const unavailableEquipmentIds = Array.isArray(unavailableEquipmentIdsInput)
    ? unavailableEquipmentIdsInput.filter((v): v is string => typeof v === "string" && v.length > 0)
    : [];

  const input = buildV1SubstitutionInput(id, unavailableEquipmentIds);
  if (!input) {
    throw badRequest("Exercise is not eligible for a substitution lookup", {
      failure_token: "substitution_exercise_not_in_registry"
    });
  }

  return tryBuildV1SubstitutionResult(input) as Record<string, unknown>;
}
