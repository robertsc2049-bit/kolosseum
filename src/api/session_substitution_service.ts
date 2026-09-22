
// DEV NOTE: API boundary surface. Pure, stateless substitution lookup - never
// mutates a session or a runtime event. The lawful result is returned for
// display; if the athlete proceeds, the client tags the eventual
// COMPLETE_EXERCISE/SKIP_EXERCISE event with the returned exercise/edge ids,
// which session_state_write_service.ts verifies against the same registry
// before it is durably recorded.

import { pool } from "../db/pool.js";
import { badRequest } from "./http_errors.js";
import { getSessionStateQuery } from "./session_state_query_service.js";
import { buildV1SubstitutionInput } from "./session_substitution_registry.js";
import { getAthleteDeclaredActivityAndPosition } from "./athlete_onboarding_service.js";
// @ts-ignore - .mjs source, no type declarations
import { tryBuildV1SubstitutionResult } from "../v1SubstitutionEngineContract.mjs";

async function loadSessionActivityAndSubjectUserId(
  session_id: string
): Promise<{ activityId: string; subjectUserId: string | null }> {
  const result = await pool.query(
    `SELECT b.phase1_input ->> 'activity_id' AS activity_id, s.beta_subject_user_id AS subject_user_id
     FROM sessions s
     JOIN blocks b ON b.block_id = s.block_id
     WHERE s.session_id = $1`,
    [session_id]
  );
  const row = result.rows[0];
  return {
    activityId: typeof row?.activity_id === "string" ? row.activity_id : "",
    subjectUserId: typeof row?.subject_user_id === "string" && row.subject_user_id.length > 0
      ? row.subject_user_id
      : null
  };
}

// Position is only used as a suggestion-time narrowing signal (see the DEV
// NOTE atop rugby_union_position_substitution_profile.ts) - only trusted
// when declared under the SAME activity as this (frozen) session, so an
// athlete who has since switched activity can never have a stale/foreign
// position narrow a session compiled under a different activity_id.
async function resolveSubstitutionPosition(
  sessionActivityId: string,
  subjectUserId: string | null
): Promise<string | null> {
  if (!subjectUserId) return null;
  const declared = await getAthleteDeclaredActivityAndPosition(subjectUserId);
  if (declared.activity_id !== sessionActivityId) return null;
  return declared.position;
}

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

  const { activityId, subjectUserId } = await loadSessionActivityAndSubjectUserId(session_id);
  const position = await resolveSubstitutionPosition(activityId, subjectUserId);
  const input = buildV1SubstitutionInput(id, unavailableEquipmentIds, activityId, position);
  if (!input) {
    throw badRequest("Exercise is not eligible for a substitution lookup", {
      failure_token: "substitution_exercise_not_in_registry"
    });
  }

  return tryBuildV1SubstitutionResult(input) as Record<string, unknown>;
}
