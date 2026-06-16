// DEV NOTE: Application read-model surface for S-V1-41. This module builds a
// coach-facing factual artefact view from explicit stored artefact records only.
// It must not write storage, append runtime events, call engine internals, order
// athletes against each other, value coach output, or add programme outcome claims.

import crypto from "node:crypto";
import { canCoachAthleteAccess } from "./relationshipPermissionGuards.mjs";

export const coachFactualArtefactViewContract = Object.freeze({
  surface_id: "v1_coach_factual_artefact_view",
  slice_id: "S-V1-41",
  version: "1.0.0",
  permission_surface_id: "coach_factual_artefact_view",
  access_policy: "assigned_coach_only",
  read_model_policy: "recorded_facts_only",
  ui_policy: "read_only_factual_artefact_view",
  coach_note_policy: "stored_separately",
  mutation_policy: "read_only"
});

export const coachFactualArtefactViewFailureCode =
  "coach_factual_artefact_view_product_auth_failure";

export const COACH_FACTUAL_ARTEFACT_VIEW_COPY_IDS = Object.freeze({
  title: "COACH_FACTUAL_ARTEFACT_VIEW_TITLE",
  emptyState: "COACH_FACTUAL_ARTEFACT_VIEW_EMPTY_STATE",
  permissionDenied: "COACH_FACTUAL_ARTEFACT_VIEW_PERMISSION_DENIED",
  readOnlyNotice: "COACH_FACTUAL_ARTEFACT_VIEW_READ_ONLY_NOTICE",
  factsOnlyNotice: "COACH_FACTUAL_ARTEFACT_VIEW_FACTS_ONLY_NOTICE",
  runtimeEventCountLabel: "COACH_FACTUAL_ARTEFACT_VIEW_RUNTIME_EVENT_COUNT_LABEL",
  sessionStatusLabel: "COACH_FACTUAL_ARTEFACT_VIEW_SESSION_STATUS_LABEL",
  notesSeparateNotice: "COACH_FACTUAL_ARTEFACT_VIEW_NOTES_SEPARATE_NOTICE"
});

const BLOCKED_INPUT_KEYS = Object.freeze([
  "engine_input",
  "canonical_engine_input",
  "engine_truth",
  "coach_note",
  "coach_notes",
  "coachNote",
  "coachNotes",
  "programme_outcome_claim",
  "program_outcome_claim",
  "coach_numeric_assessment",
  "athlete_ordering",
  "interpretation",
  "advisory_text"
]);

export class CoachFactualArtefactViewError extends Error {
  constructor(reason, details = {}) {
    super(`${coachFactualArtefactViewFailureCode}:${reason}`);
    this.name = "CoachFactualArtefactViewError";
    this.code = coachFactualArtefactViewFailureCode;
    this.reason = reason;
    this.product_auth_failure = true;
    this.product_permission_state_only = true;
    this.engine_decision = false;
    this.engine_visible = false;
    this.copy_id = COACH_FACTUAL_ARTEFACT_VIEW_COPY_IDS.permissionDenied;
    this.details = Object.freeze({ ...details });
  }
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function fail(reason, details = {}) {
  throw new CoachFactualArtefactViewError(reason, details);
}

function stableValue(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => stableValue(entry));
  }

  if (!isRecord(value)) {
    return value;
  }

  const output = {};
  for (const key of Object.keys(value).sort()) {
    output[key] = stableValue(value[key]);
  }
  return output;
}

export function stableCoachFactualArtefactViewJson(value) {
  return JSON.stringify(stableValue(value));
}

function cloneStable(value) {
  return JSON.parse(stableCoachFactualArtefactViewJson(value));
}

function sha256Hex(value) {
  return crypto
    .createHash("sha256")
    .update(stableCoachFactualArtefactViewJson(value), "utf8")
    .digest("hex");
}

function assertNoBlockedInputKeys(value, pathParts = []) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoBlockedInputKeys(entry, pathParts.concat(String(index))));
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    if (BLOCKED_INPUT_KEYS.includes(key)) {
      fail("coach_factual_artefact_view_forbidden_input_field", {
        path: pathParts.concat(key).join(".")
      });
    }
    assertNoBlockedInputKeys(child, pathParts.concat(key));
  }
}

function requiredString(value, reason, details = {}) {
  const cleaned = cleanString(value);
  if (cleaned.length === 0) {
    fail(reason, details);
  }
  return cleaned;
}

function nullableString(value) {
  const cleaned = cleanString(value);
  return cleaned.length === 0 ? null : cleaned;
}

function numberOrNull(value) {
  return Number.isSafeInteger(value) ? value : null;
}

function assertInput(input) {
  if (!isRecord(input)) {
    fail("coach_factual_artefact_view_input_invalid");
  }

  assertNoBlockedInputKeys(input);

  if (!isRecord(input.actor)) {
    fail("coach_factual_artefact_view_actor_required");
  }

  if (cleanString(input.actor.actor_type) !== "coach") {
    fail("coach_factual_artefact_view_coach_actor_required", {
      actor_type: input.actor.actor_type ?? null
    });
  }

  const coachUserId = requiredString(
    input.actor.user_id ?? input.actor.coach_user_id ?? input.actor.coach_id,
    "coach_factual_artefact_view_coach_user_id_required"
  );

  const targetAthleteUserId = requiredString(
    input.target_athlete_user_id ?? input.athlete_user_id ?? input.athlete_id,
    "coach_factual_artefact_view_target_athlete_required"
  );

  if (!Array.isArray(input.relationships)) {
    fail("coach_factual_artefact_view_relationships_array_required");
  }

  if (!Array.isArray(input.artefacts)) {
    fail("coach_factual_artefact_view_artefacts_array_required");
  }

  return { coachUserId, targetAthleteUserId };
}

function artefactAthleteId(artefact) {
  return cleanString(
    artefact.athlete_user_id ??
    artefact.athlete_id ??
    artefact.owner_athlete_user_id
  );
}

function artefactRecordedAt(artefact) {
  return nullableString(
    artefact.recorded_at ??
    artefact.created_at ??
    artefact.completed_at ??
    artefact.updated_at
  );
}

function runtimeEventsForArtefact(artefact) {
  if (Array.isArray(artefact.runtime_events)) return artefact.runtime_events;
  if (Array.isArray(artefact.factual_events)) return artefact.factual_events;
  if (Array.isArray(artefact.events)) return artefact.events;
  return [];
}

function buildRuntimeEventFact(event, index, artefactId) {
  if (!isRecord(event)) {
    fail("coach_factual_artefact_view_runtime_event_invalid", { artefact_id: artefactId, index });
  }

  const eventType = requiredString(
    event.event_type ?? event.type,
    "coach_factual_artefact_view_runtime_event_type_required",
    { artefact_id: artefactId, index }
  );

  return Object.freeze({
    event_id: nullableString(event.event_id ?? event.runtime_event_id),
    event_type: eventType,
    seq: numberOrNull(event.seq),
    recorded_at: nullableString(event.recorded_at ?? event.created_at ?? event.timestamp),
    work_item_id: nullableString(event.work_item_id ?? event.item_id ?? event.planned_item_id)
  });
}

function buildArtefactFact(artefact, index, targetAthleteUserId) {
  if (!isRecord(artefact)) {
    fail("coach_factual_artefact_view_artefact_invalid", { index });
  }

  const artefactId = requiredString(
    artefact.artefact_id ?? artefact.artifact_id,
    "coach_factual_artefact_view_artefact_id_required",
    { index }
  );

  const sessionId = requiredString(
    artefact.session_id,
    "coach_factual_artefact_view_session_id_required",
    { artefact_id: artefactId, index }
  );

  const athleteUserId = requiredString(
    artefactAthleteId(artefact),
    "coach_factual_artefact_view_artefact_athlete_required",
    { artefact_id: artefactId, index }
  );

  if (athleteUserId !== targetAthleteUserId) {
    return null;
  }

  const events = runtimeEventsForArtefact(artefact).map((event, eventIndex) =>
    buildRuntimeEventFact(event, eventIndex, artefactId)
  );

  const orderedEvents = [...events].sort((left, right) => {
    if (left.seq !== null && right.seq !== null && left.seq !== right.seq) {
      return left.seq - right.seq;
    }
    return `${left.recorded_at ?? ""}:${left.event_id ?? ""}`.localeCompare(
      `${right.recorded_at ?? ""}:${right.event_id ?? ""}`
    );
  });

  return Object.freeze({
    artefact_id: artefactId,
    session_id: sessionId,
    athlete_user_id: athleteUserId,
    artefact_type: requiredString(
      artefact.artefact_type ?? artefact.artifact_type ?? "session_runtime_artefact",
      "coach_factual_artefact_view_artefact_type_required",
      { artefact_id: artefactId, index }
    ),
    recorded_at: artefactRecordedAt(artefact),
    session_status: nullableString(artefact.session_status ?? artefact.status),
    runtime_event_count: orderedEvents.length,
    runtime_events: Object.freeze(orderedEvents)
  });
}

function sortArtefacts(artefacts) {
  return [...artefacts].sort((left, right) => {
    const leftKey = `${left.session_id}:${left.recorded_at ?? ""}:${left.artefact_id}`;
    const rightKey = `${right.session_id}:${right.recorded_at ?? ""}:${right.artefact_id}`;
    return leftKey.localeCompare(rightKey);
  });
}

export function decideCoachFactualArtefactViewAccess(input) {
  const { coachUserId, targetAthleteUserId } = assertInput(input);

  const decision = canCoachAthleteAccess({
    actor: {
      ...input.actor,
      actor_type: "coach",
      user_id: coachUserId,
      coach_user_id: coachUserId
    },
    target_athlete_user_id: targetAthleteUserId,
    surface_id: coachFactualArtefactViewContract.permission_surface_id,
    relationships: input.relationships
  });

  return Object.freeze({
    ...decision,
    view_surface_id: coachFactualArtefactViewContract.surface_id,
    target_athlete_user_id: targetAthleteUserId,
    coach_user_id: coachUserId
  });
}

export function assertCoachFactualArtefactViewAccess(input) {
  const decision = decideCoachFactualArtefactViewAccess(input);

  if (decision.allowed !== true) {
    fail(decision.reason || "coach_factual_artefact_view_access_denied", {
      actor_type: input?.actor?.actor_type ?? null,
      coach_user_id: decision.coach_user_id ?? null,
      target_athlete_user_id: decision.target_athlete_user_id,
      requested_surface_id: decision.requested_surface_id ?? coachFactualArtefactViewContract.permission_surface_id
    });
  }

  return decision;
}

/**
 * FUNCTION NOTE:
 * Export: buildCoachFactualArtefactView
 * Purpose: Creates the S-V1-41 assigned-coach factual artefact read model from explicit stored product records.
 * Inputs: Uses explicit actor, relationship records, target athlete id, and artefact records only.
 * Output: Returns a stable read-only envelope with recorded artefact/event facts and copy ids.
 * Boundary: Must not call engine code, append runtime events, mutate session state, include coach notes, or add programme outcome claims.
 * Determinism: The same explicit input produces byte-stable JSON and the same read_model_hash.
 * Failure: Missing permission, malformed artefacts, blocked input keys, or non-coach actors fail closed.
 */
export function buildCoachFactualArtefactView(input) {
  const access = assertCoachFactualArtefactViewAccess(input);

  const artefacts = sortArtefacts(
    input.artefacts
      .map((artefact, index) => buildArtefactFact(artefact, index, access.target_athlete_user_id))
      .filter(Boolean)
  );

  const readModel = {
    surface_id: coachFactualArtefactViewContract.surface_id,
    slice_id: coachFactualArtefactViewContract.slice_id,
    version: coachFactualArtefactViewContract.version,
    actor_type: "coach",
    coach_user_id: access.coach_user_id,
    target_athlete_user_id: access.target_athlete_user_id,
    access: Object.freeze({
      allowed: true,
      reason: access.reason,
      relationship_id: access.relationship_id ?? null,
      requested_surface_id: access.requested_surface_id ?? coachFactualArtefactViewContract.permission_surface_id,
      product_permission_state_only: true,
      engine_decision: false,
      engine_visible: false
    }),
    artefact_count: artefacts.length,
    artefacts: Object.freeze(artefacts),
    copy_ids: Object.freeze(Object.values(COACH_FACTUAL_ARTEFACT_VIEW_COPY_IDS)),
    coach_note_policy: coachFactualArtefactViewContract.coach_note_policy,
    read_model_hash: "",
    mutation_contract: Object.freeze({
      read_only: true,
      appends_runtime_event: false,
      mutates_session_state: false,
      calls_engine: false,
      reads_coach_notes: false
    })
  };

  const withoutHash = cloneStable(readModel);
  withoutHash.read_model_hash = "";
  readModel.read_model_hash = sha256Hex(withoutHash);

  return cloneStable(readModel);
}

export function tryBuildCoachFactualArtefactView(input) {
  try {
    return Object.freeze({ ok: true, read_model: buildCoachFactualArtefactView(input) });
  } catch (error) {
    if (error instanceof CoachFactualArtefactViewError) {
      return Object.freeze({
        ok: false,
        error: Object.freeze({
          code: error.code,
          copy_id: error.copy_id,
          reason: error.reason,
          details: error.details,
          product_auth_failure: true,
          product_permission_state_only: true,
          engine_decision: false,
          engine_visible: false
        })
      });
    }
    throw error;
  }
}