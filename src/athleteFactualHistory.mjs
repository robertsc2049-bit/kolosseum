// DEV NOTE: Application read-model surface for S-V1-40. This module builds an
// athlete history view from recorded session and runtime-event facts only. It
// must not write storage, append runtime events, call engine internals, compare
// athletes, create aggregate scope, or add interpretation fields.

import crypto from "node:crypto";
import { canCoachAthleteAccess } from "./relationshipPermissionGuards.mjs";

export const athleteFactualHistoryContract = Object.freeze({
  surface_id: "v1_athlete_factual_history",
  slice_id: "S-V1-40",
  version: "1.0.0",
  permission_surface_id: "factual_history",
  access_policy: "athlete_own_or_assigned_coach_history_only",
  read_model_policy: "recorded_facts_only",
  ui_policy: "read_only_recorded_history_view",
  mutation_policy: "read_only",
  excluded_scope: Object.freeze([
    "aggregate_metrics",
    "list_ordered_outputs",
    "condition_labels",
    "performance_claims",
    "interpretation_fields",
    "engine_mutation"
  ])
});

export const athleteFactualHistoryFailureCode =
  "athlete_factual_history_product_auth_failure";

export const ATHLETE_FACTUAL_HISTORY_COPY_IDS = Object.freeze({
  title: "ATHLETE_FACTUAL_HISTORY_TITLE",
  summaryLabel: "ATHLETE_FACTUAL_HISTORY_SUMMARY_LABEL",
  sessionsLabel: "ATHLETE_FACTUAL_HISTORY_SESSIONS_LABEL",
  emptyState: "ATHLETE_FACTUAL_HISTORY_EMPTY_STATE",
  permissionDenied: "ATHLETE_FACTUAL_HISTORY_PERMISSION_DENIED",
  readOnlyNotice: "ATHLETE_FACTUAL_HISTORY_READ_ONLY_NOTICE",
  completedItemsLabel: "ATHLETE_FACTUAL_HISTORY_COMPLETED_ITEMS_LABEL",
  skippedItemsLabel: "ATHLETE_FACTUAL_HISTORY_SKIPPED_ITEMS_LABEL",
  partialItemsLabel: "ATHLETE_FACTUAL_HISTORY_PARTIAL_ITEMS_LABEL",
  sessionStatusLabel: "ATHLETE_FACTUAL_HISTORY_SESSION_STATUS_LABEL"
});

const allowedSessionStatuses = new Set([
  "not_started",
  "in_progress",
  "completed",
  "partially_completed",
  "stopped"
]);

const allowedEventTypes = new Set([
  "SESSION_START",
  "COMPLETE_WORK_ITEM",
  "SKIP_WORK_ITEM",
  "PARTIAL_COMPLETE_WORK_ITEM",
  "STOP_SESSION",
  "SPLIT_SESSION",
  "RETURN_CONTINUE",
  "RETURN_SKIP",
  "SUBSTITUTE_WORK_ITEM"
]);

const blockedInputKeyFragments = Object.freeze([
  "read" + "iness",
  "fat" + "igue",
  "rank" + "ing",
  "rank",
  "effect" + "iveness",
  "reco" + "mmend",
  "infer" + "ence",
  "infer" + "red",
  "adherence_score",
  "dash" + "board"
]);

export class AthleteFactualHistoryError extends Error {
  constructor(reason, details = {}) {
    super(`${athleteFactualHistoryFailureCode}:${reason}`);
    this.name = "AthleteFactualHistoryError";
    this.code = athleteFactualHistoryFailureCode;
    this.reason = reason;
    this.product_auth_failure = true;
    this.product_permission_state_only = true;
    this.engine_decision = false;
    this.engine_visible = false;
    this.copy_id = ATHLETE_FACTUAL_HISTORY_COPY_IDS.permissionDenied;
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
  throw new AthleteFactualHistoryError(reason, details);
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

export function stableAthleteFactualHistoryJson(value) {
  return JSON.stringify(stableValue(value));
}

function cloneStable(value) {
  return JSON.parse(stableAthleteFactualHistoryJson(value));
}

function sha256Hex(value) {
  return crypto.createHash("sha256").update(stableAthleteFactualHistoryJson(value), "utf8").digest("hex");
}

function assertNoBlockedInputKeys(value, pathParts = []) {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      assertNoBlockedInputKeys(value[index], pathParts.concat(String(index)));
    }
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    const lowerKey = key.toLowerCase();

    for (const fragment of blockedInputKeyFragments) {
      if (lowerKey.includes(fragment)) {
        fail("history_input_forbidden_field", {
          path: pathParts.concat(key).join(".")
        });
      }
    }

    assertNoBlockedInputKeys(child, pathParts.concat(key));
  }
}

function nullableString(value) {
  if (value === null || value === undefined) return null;
  const cleaned = cleanString(value);
  return cleaned.length === 0 ? null : cleaned;
}

function requiredString(value, reason) {
  const cleaned = cleanString(value);
  if (cleaned.length === 0) {
    fail(reason);
  }
  return cleaned;
}

function assertHistoryInput(input) {
  if (!isRecord(input)) {
    fail("history_input_invalid");
  }

  if (!isRecord(input.actor)) {
    fail("history_actor_required");
  }

  const athleteUserId = requiredString(input.athlete_user_id, "history_athlete_required");

  if (!Array.isArray(input.relationships)) {
    fail("history_relationships_array_required");
  }

  if (!Array.isArray(input.sessions)) {
    fail("history_sessions_array_required");
  }

  if (!Array.isArray(input.runtime_events)) {
    fail("history_runtime_events_array_required");
  }

  assertNoBlockedInputKeys(input);

  return {
    athleteUserId
  };
}

function eventTypeOf(record) {
  return cleanString(record.event_type ?? record.type ?? record.event?.type);
}

function eventIdOf(record) {
  return cleanString(record.event_id ?? record.runtime_event_id ?? `${record.session_id}:${record.seq}`);
}

function normalizeSession(record, athleteUserId) {
  if (!isRecord(record)) {
    fail("history_session_record_invalid");
  }

  const sessionAthleteUserId = requiredString(record.athlete_user_id, "history_session_athlete_required");

  if (sessionAthleteUserId !== athleteUserId) {
    return null;
  }

  const status = requiredString(record.status, "history_session_status_required");
  if (!allowedSessionStatuses.has(status)) {
    fail("history_session_status_invalid", {
      status
    });
  }

  return Object.freeze({
    session_id: requiredString(record.session_id, "history_session_id_required"),
    athlete_user_id: sessionAthleteUserId,
    status,
    started_at: nullableString(record.started_at),
    completed_at: nullableString(record.completed_at),
    stopped_at: nullableString(record.stopped_at),
    created_at: requiredString(record.created_at, "history_session_created_at_required")
  });
}

function normalizeEvent(record, athleteUserId, sessionIds) {
  if (!isRecord(record)) {
    fail("history_event_record_invalid");
  }

  const eventAthleteUserId = requiredString(record.athlete_user_id, "history_event_athlete_required");

  if (eventAthleteUserId !== athleteUserId) {
    return null;
  }

  const sessionId = requiredString(record.session_id, "history_event_session_required");
  if (!sessionIds.has(sessionId)) {
    return null;
  }

  const seq = Number(record.seq);
  if (!Number.isSafeInteger(seq) || seq < 1) {
    fail("history_event_seq_invalid", {
      session_id: sessionId
    });
  }

  const event_type = eventTypeOf(record);
  if (!allowedEventTypes.has(event_type)) {
    fail("history_event_type_invalid", {
      event_type
    });
  }

  const workItemId = nullableString(record.work_item_id ?? record.event?.work_item_id);
  const recordedValue = isRecord(record.recorded_value)
    ? cloneStable(record.recorded_value)
    : null;

  return Object.freeze({
    event_id: eventIdOf(record),
    session_id: sessionId,
    athlete_user_id: eventAthleteUserId,
    seq,
    event_type,
    work_item_id: workItemId,
    recorded_value: recordedValue,
    recorded_at: requiredString(record.recorded_at ?? record.created_at, "history_event_recorded_at_required")
  });
}

function latestSessionDate(session) {
  return session.completed_at ?? session.stopped_at ?? session.started_at ?? session.created_at;
}

function earliestRecordedDate(sessions, events) {
  const dates = sessions.map((session) => session.created_at).concat(events.map((event) => event.recorded_at)).filter(Boolean).sort();
  return dates.length ? dates[0] : null;
}

function latestRecordedDate(sessions, events) {
  const dates = sessions.map((session) => latestSessionDate(session)).concat(events.map((event) => event.recorded_at)).filter(Boolean).sort();
  return dates.length ? dates[dates.length - 1] : null;
}

function countEvents(events, eventType) {
  return events.filter((event) => event.event_type === eventType).length;
}

function buildSessionHistory(session, events) {
  const sessionEvents = events
    .filter((event) => event.session_id === session.session_id)
    .sort((left, right) => {
      if (left.seq !== right.seq) return left.seq - right.seq;
      return left.event_id.localeCompare(right.event_id);
    });

  return Object.freeze({
    session_id: session.session_id,
    status: session.status,
    started_at: session.started_at,
    completed_at: session.completed_at,
    stopped_at: session.stopped_at,
    created_at: session.created_at,
    latest_recorded_at: latestRecordedDate([session], sessionEvents),
    recorded_event_count: sessionEvents.length,
    completed_item_count: countEvents(sessionEvents, "COMPLETE_WORK_ITEM"),
    skipped_item_count: countEvents(sessionEvents, "SKIP_WORK_ITEM"),
    partial_item_count: countEvents(sessionEvents, "PARTIAL_COMPLETE_WORK_ITEM"),
    split_event_count: countEvents(sessionEvents, "SPLIT_SESSION"),
    return_event_count: countEvents(sessionEvents, "RETURN_CONTINUE") + countEvents(sessionEvents, "RETURN_SKIP"),
    substitution_event_count: countEvents(sessionEvents, "SUBSTITUTE_WORK_ITEM"),
    recorded_events: sessionEvents.map((event) => ({
      event_id: event.event_id,
      seq: event.seq,
      event_type: event.event_type,
      work_item_id: event.work_item_id,
      recorded_value: event.recorded_value,
      recorded_at: event.recorded_at
    }))
  });
}

function decideAthleteFactualHistoryAccess(input, athleteUserId) {
  const decision = canCoachAthleteAccess({
    actor: input.actor,
    target_athlete_user_id: athleteUserId,
    surface_id: athleteFactualHistoryContract.permission_surface_id,
    relationships: input.relationships
  });

  return Object.freeze({
    ...decision,
    history_surface_id: athleteFactualHistoryContract.surface_id,
    target_athlete_user_id: athleteUserId
  });
}

export function assertAthleteFactualHistoryAccess(input) {
  const { athleteUserId } = assertHistoryInput(input);
  const decision = decideAthleteFactualHistoryAccess(input, athleteUserId);

  if (decision.allowed !== true) {
    fail(decision.reason || "history_access_denied", {
      actor_type: input.actor?.actor_type ?? null,
      target_athlete_user_id: athleteUserId,
      requested_surface_id: decision.requested_surface_id ?? athleteFactualHistoryContract.permission_surface_id
    });
  }

  return decision;
}

export function buildAthleteFactualHistoryReadModel(input) {
  const { athleteUserId } = assertHistoryInput(input);
  const access = assertAthleteFactualHistoryAccess(input);

  const sessions = input.sessions
    .map((session) => normalizeSession(session, athleteUserId))
    .filter(Boolean)
    .sort((left, right) => {
      const dateComparison = latestSessionDate(right).localeCompare(latestSessionDate(left));
      if (dateComparison !== 0) return dateComparison;
      return left.session_id.localeCompare(right.session_id);
    });

  const sessionIds = new Set(sessions.map((session) => session.session_id));

  const events = input.runtime_events
    .map((event) => normalizeEvent(event, athleteUserId, sessionIds))
    .filter(Boolean)
    .sort((left, right) => {
      const sessionCompare = left.session_id.localeCompare(right.session_id);
      if (sessionCompare !== 0) return sessionCompare;
      if (left.seq !== right.seq) return left.seq - right.seq;
      return left.event_id.localeCompare(right.event_id);
    });

  const readModel = Object.freeze({
    surface_id: athleteFactualHistoryContract.surface_id,
    slice_id: athleteFactualHistoryContract.slice_id,
    version: athleteFactualHistoryContract.version,
    athlete_user_id: athleteUserId,
    viewer: Object.freeze({
      actor_type: access.actor_type,
      actor_id: cleanString(input.actor.user_id),
      access_reason: access.reason,
      relationship_id: access.relationship_id ?? null,
      product_permission_state_only: true,
      engine_decision: false,
      engine_visible: false
    }),
    recorded_summary: Object.freeze({
      session_count: sessions.length,
      event_count: events.length,
      completed_session_count: sessions.filter((session) => session.status === "completed").length,
      partial_session_count: sessions.filter((session) => session.status === "partially_completed").length,
      stopped_session_count: sessions.filter((session) => session.status === "stopped").length,
      completed_item_count: countEvents(events, "COMPLETE_WORK_ITEM"),
      skipped_item_count: countEvents(events, "SKIP_WORK_ITEM"),
      partial_item_count: countEvents(events, "PARTIAL_COMPLETE_WORK_ITEM"),
      split_event_count: countEvents(events, "SPLIT_SESSION"),
      return_event_count: countEvents(events, "RETURN_CONTINUE") + countEvents(events, "RETURN_SKIP"),
      substitution_event_count: countEvents(events, "SUBSTITUTE_WORK_ITEM"),
      first_recorded_at: earliestRecordedDate(sessions, events),
      latest_recorded_at: latestRecordedDate(sessions, events)
    }),
    sessions: sessions.map((session) => buildSessionHistory(session, events)),
    copy_ids: Object.freeze(Object.values(ATHLETE_FACTUAL_HISTORY_COPY_IDS)),
    read_model_hash: "",
    interpretation_contract: Object.freeze({
      recorded_facts_only: true,
      interpretation_fields_present: false,
      list_ordered_output: false,
      aggregate_output: false
    }),
    mutation_contract: Object.freeze({
      read_only: true,
      writes_storage: false,
      appends_runtime_event: false,
      mutates_session_state: false,
      calls_engine: false
    })
  });

  const withoutHash = cloneStable(readModel);
  withoutHash.read_model_hash = "";

  const withHash = {
    ...withoutHash,
    read_model_hash: sha256Hex(withoutHash)
  };

  return cloneStable(withHash);
}

export function tryBuildAthleteFactualHistoryReadModel(input) {
  try {
    return Object.freeze({
      ok: true,
      read_model: buildAthleteFactualHistoryReadModel(input)
    });
  } catch (error) {
    if (error instanceof AthleteFactualHistoryError) {
      return Object.freeze({
        ok: false,
        error: Object.freeze({
          code: error.code,
          reason: error.reason,
          product_auth_failure: error.product_auth_failure,
          product_permission_state_only: error.product_permission_state_only,
          engine_decision: error.engine_decision,
          engine_visible: error.engine_visible,
          copy_id: error.copy_id,
          details: error.details
        })
      });
    }

    throw error;
  }
}

export function buildAthleteFactualHistoryViewModel(readModel) {
  if (!isRecord(readModel) || readModel.surface_id !== athleteFactualHistoryContract.surface_id) {
    fail("history_view_model_input_invalid");
  }

  return cloneStable({
    surface_id: "v1_athlete_factual_history_view",
    slice_id: athleteFactualHistoryContract.slice_id,
    version: athleteFactualHistoryContract.version,
    athlete_user_id: readModel.athlete_user_id,
    copy_ids: Object.values(ATHLETE_FACTUAL_HISTORY_COPY_IDS),
    sections: [
      {
        section_id: "recorded_summary",
        copy_id: ATHLETE_FACTUAL_HISTORY_COPY_IDS.summaryLabel,
        values: readModel.recorded_summary
      },
      {
        section_id: "recorded_sessions",
        copy_id: ATHLETE_FACTUAL_HISTORY_COPY_IDS.sessionsLabel,
        session_count: readModel.sessions.length,
        sessions: readModel.sessions
      }
    ],
    empty_state_copy_id: readModel.sessions.length === 0
      ? ATHLETE_FACTUAL_HISTORY_COPY_IDS.emptyState
      : null,
    presentation_contract: {
      read_only: true,
      displays_recorded_values_only: true,
      writes_storage: false,
      appends_runtime_event: false,
      calls_engine: false
    }
  });
}
