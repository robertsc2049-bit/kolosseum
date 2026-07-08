// DEV NOTE: S-V1-43 live session status read model.
// This module projects explicit runtime state and event records into assigned-coach
// factual visibility only. It must not append events, mutate session state, call
// engine internals, create contact surfaces, stream media, control athlete execution, or
// trigger substitution.

import crypto from "node:crypto";
import { canCoachAthleteAccess } from "./relationshipPermissionGuards.mjs";

export const liveSessionStatusContract = Object.freeze({
  surface_id: "v1_live_session_status",
  slice_id: "S-V1-43",
  version: "1.0.0",
  permission_surface_id: "live_session_status",
  access_policy: "assigned_coach_only",
  read_model_policy: "recorded_runtime_facts_only",
  ui_policy: "read_only_live_status_view",
  mutation_policy: "read_only",
  allowed_statuses: Object.freeze([
    "not_started",
    "in_progress",
    "split",
    "returned",
    "partially_completed",
    "completed",
    "stopped"
  ])
});

export const liveSessionStatusFailureCode =
  "live_session_status_product_auth_failure";

export const LIVE_SESSION_STATUS_COPY_IDS = Object.freeze({
  title: "LIVE_SESSION_STATUS_TITLE",
  permissionDenied: "LIVE_SESSION_STATUS_PERMISSION_DENIED",
  readOnlyNotice: "LIVE_SESSION_STATUS_READ_ONLY_NOTICE",
  factsOnlyNotice: "LIVE_SESSION_STATUS_FACTS_ONLY_NOTICE",
  statusLabel: "LIVE_SESSION_STATUS_STATUS_LABEL",
  startedAtLabel: "LIVE_SESSION_STATUS_STARTED_AT_LABEL",
  lastEventAtLabel: "LIVE_SESSION_STATUS_LAST_EVENT_AT_LABEL",
  currentWorkItemLabel: "LIVE_SESSION_STATUS_CURRENT_WORK_ITEM_LABEL",
  lastWorkItemLabel: "LIVE_SESSION_STATUS_LAST_WORK_ITEM_LABEL",
  eventTimelineLabel: "LIVE_SESSION_STATUS_EVENT_TIMELINE_LABEL",
  emptyTimeline: "LIVE_SESSION_STATUS_EMPTY_TIMELINE"
});

const ALLOWED_STATUS_SET = new Set(liveSessionStatusContract.allowed_statuses);

const BLOCKED_INPUT_KEYS = Object.freeze([
  "coach_override",
  "coachOverride",
  "live_coach_override",
  "liveCoachOverride",
  "coach_triggered_substitution",
  "coachTriggeredSubstitution",
  "intervention",
  "coach_intervention",
  "recommended_intervention",
  "messaging",
  "message_thread",
  "chat",
  "video",
  "video_url",
  "readiness",
  "fatigue",
  "risk",
  "safety",
  "recommendation",
  "recommended_action",
  "advice",
  "optimisation",
  "optimization",
  "athlete_ranking",
  "score"
]);

const COMPLETED_EVENT_TYPES = new Set([
  "COMPLETE_WORK_ITEM",
  "WORK_ITEM_COMPLETED",
  "complete_work_item",
  "work_item_completed"
]);

const SKIPPED_EVENT_TYPES = new Set([
  "SKIP_WORK_ITEM",
  "WORK_ITEM_SKIPPED",
  "skip_work_item",
  "work_item_skipped"
]);

const PARTIAL_EVENT_TYPES = new Set([
  "PARTIAL_COMPLETE_WORK_ITEM",
  "WORK_ITEM_PARTIALLY_COMPLETED",
  "partial_complete_work_item",
  "work_item_partially_completed"
]);

const SUBSTITUTION_EVENT_TYPES = new Set([
  "SUBSTITUTE_WORK_ITEM",
  "SUBSTITUTION_RECORDED",
  "substitute_work_item",
  "substitution_recorded"
]);

const START_EVENT_TYPES = new Set([
  "SESSION_START",
  "SESSION_STARTED",
  "session_start",
  "session_started"
]);

const STOP_EVENT_TYPES = new Set([
  "STOP_SESSION",
  "SESSION_STOPPED",
  "session_stopped",
  "SESSION_STOP"
]);

const RETURN_EVENT_TYPES = new Set([
  "RETURN_CONTINUE",
  "RETURN_SKIP",
  "session_returned",
  "SESSION_RETURNED"
]);

export class LiveSessionStatusError extends Error {
  constructor(reason, details = {}) {
    super(`${liveSessionStatusFailureCode}:${reason}`);
    this.name = "LiveSessionStatusError";
    this.code = liveSessionStatusFailureCode;
    this.reason = reason;
    this.product_auth_failure = true;
    this.product_permission_state_only = true;
    this.engine_decision = false;
    this.engine_visible = false;
    this.copy_id = LIVE_SESSION_STATUS_COPY_IDS.permissionDenied;
    this.details = Object.freeze({ ...details });
  }
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fail(reason, details = {}) {
  throw new LiveSessionStatusError(reason, details);
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function nullableString(value) {
  const cleaned = cleanString(value);
  return cleaned.length > 0 ? cleaned : null;
}

function numberOrZero(value) {
  return Number.isFinite(value) ? Number(value) : 0;
}

function stableValue(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => stableValue(entry));
  }

  if (isRecord(value)) {
    const output = {};
    for (const key of Object.keys(value).sort()) {
      output[key] = stableValue(value[key]);
    }
    return output;
  }

  return value;
}

export function stableLiveSessionStatusJson(value) {
  return JSON.stringify(stableValue(value));
}

function cloneStable(value) {
  return JSON.parse(stableLiveSessionStatusJson(value));
}

function sha256Hex(value) {
  return crypto
    .createHash("sha256")
    .update(stableLiveSessionStatusJson(value), "utf8")
    .digest("hex");
}

function assertNoBlockedInputKeys(value, pathParts = []) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoBlockedInputKeys(entry, pathParts.concat(String(index))));
    return;
  }

  if (!isRecord(value)) return;

  for (const [key, child] of Object.entries(value)) {
    if (BLOCKED_INPUT_KEYS.includes(key)) {
      fail("live_session_status_forbidden_input_field", {
        path: pathParts.concat(key).join(".")
      });
    }

    assertNoBlockedInputKeys(child, pathParts.concat(key));
  }
}

function readEventsPayload(input) {
  if (isRecord(input.events_payload) && Array.isArray(input.events_payload.events)) {
    return input.events_payload.events;
  }

  if (Array.isArray(input.events_payload)) {
    return input.events_payload;
  }

  if (Array.isArray(input.events)) {
    return input.events;
  }

  if (isRecord(input.state_payload) && Array.isArray(input.state_payload.events)) {
    return input.state_payload.events;
  }

  return [];
}

function readStatePayload(input) {
  if (isRecord(input.state_payload)) return input.state_payload;
  if (isRecord(input.state)) return input.state;
  return {};
}

function eventType(event) {
  return cleanString(event?.event_type ?? event?.type);
}

function eventRecordedAt(event) {
  return nullableString(
    event?.recorded_at ??
    event?.created_at ??
    event?.timestamp ??
    event?.occurred_at ??
    event?.at
  );
}

function eventWorkItemId(event) {
  return nullableString(
    event?.work_item_id ??
    event?.item_id ??
    event?.planned_item_id ??
    event?.target_work_item_id
  );
}

function eventSeq(event) {
  return Number.isSafeInteger(event?.seq) ? event.seq : null;
}

function normaliseEventFact(event, index) {
  if (!isRecord(event)) {
    fail("live_session_status_event_invalid", { index });
  }

  const type = eventType(event);
  if (type.length === 0) {
    fail("live_session_status_event_type_required", { index });
  }

  return Object.freeze({
    event_id: nullableString(event.event_id ?? event.runtime_event_id ?? `event_${String(index + 1).padStart(3, "0")}`),
    event_type: type,
    seq: eventSeq(event),
    recorded_at: eventRecordedAt(event),
    work_item_id: eventWorkItemId(event)
  });
}

function sortEvents(events) {
  return [...events].sort((left, right) => {
    if (left.seq !== null && right.seq !== null && left.seq !== right.seq) {
      return left.seq - right.seq;
    }

    return `${left.recorded_at ?? ""}:${left.event_id ?? ""}`.localeCompare(
      `${right.recorded_at ?? ""}:${right.event_id ?? ""}`
    );
  });
}

function countEvents(events, typeSet) {
  return events.filter((event) => typeSet.has(event.event_type)).length;
}

function readCounts(state, events) {
  const counts = isRecord(state.counts) ? state.counts : {};

  return Object.freeze({
    completed: numberOrZero(counts.completed ?? state.completed_count ?? countEvents(events, COMPLETED_EVENT_TYPES)),
    skipped: numberOrZero(counts.skipped ?? state.skipped_count ?? countEvents(events, SKIPPED_EVENT_TYPES)),
    partial: numberOrZero(counts.partial ?? state.partial_count ?? countEvents(events, PARTIAL_EVENT_TYPES)),
    substituted: numberOrZero(counts.substituted ?? state.substituted_count ?? countEvents(events, SUBSTITUTION_EVENT_TYPES))
  });
}

function findLastEvent(events) {
  return events.length > 0 ? events[events.length - 1] : null;
}

function firstStartedAt(state, events) {
  const explicit = nullableString(state.started_at ?? state.started_at_iso8601);
  if (explicit) return explicit;

  const start = events.find((event) => START_EVENT_TYPES.has(event.event_type));
  return start?.recorded_at ?? null;
}

function lastEventAt(state, events) {
  const explicit = nullableString(state.last_event_at ?? state.last_event_at_iso8601);
  if (explicit) return explicit;

  const last = findLastEvent(events);
  return last?.recorded_at ?? null;
}

function readWorkItemValue(value) {
  if (isRecord(value)) {
    return Object.freeze({
      work_item_id: nullableString(value.work_item_id ?? value.id ?? value.item_id),
      status: nullableString(value.status),
      label: nullableString(value.label ?? value.name)
    });
  }

  const text = nullableString(value);
  return text === null ? null : Object.freeze({
    work_item_id: text,
    status: null,
    label: null
  });
}

function currentWorkItem(state) {
  const explicit = readWorkItemValue(
    state.current_work_item ??
    state.current_work_item_id ??
    state.current_item ??
    state.current_item_id
  );

  if (explicit) return explicit;

  if (isRecord(state.work_items)) {
    for (const [id, item] of Object.entries(state.work_items)) {
      if (isRecord(item) && cleanString(item.status) === "pending") {
        return Object.freeze({
          work_item_id: nullableString(item.work_item_id ?? id),
          status: "pending",
          label: nullableString(item.label ?? item.name)
        });
      }
    }
  }

  return null;
}

function lastWorkItem(events) {
  const withWorkItem = [...events].reverse().find((event) => event.work_item_id !== null);
  if (!withWorkItem) return null;

  return Object.freeze({
    work_item_id: withWorkItem.work_item_id,
    last_event_type: withWorkItem.event_type,
    recorded_at: withWorkItem.recorded_at
  });
}

function deriveStatus(state, events, counts) {
  const explicit = cleanString(state.status ?? state.session_status);
  if (ALLOWED_STATUS_SET.has(explicit)) return explicit;

  if (events.some((event) => STOP_EVENT_TYPES.has(event.event_type))) return "stopped";

  if (state.split?.active === true || state.split_active === true) return "split";

  const last = findLastEvent(events);
  if (last && RETURN_EVENT_TYPES.has(last.event_type)) return "returned";

  const started = firstStartedAt(state, events);
  if (!started) return "not_started";

  const pending = Number.isFinite(state.counts?.pending) ? Number(state.counts.pending) : null;
  if (pending === 0 && counts.skipped === 0 && counts.partial === 0) return "completed";
  if (pending === 0 && (counts.skipped > 0 || counts.partial > 0)) return "partially_completed";

  return "in_progress";
}

function assertInput(input) {
  if (!isRecord(input)) {
    fail("live_session_status_input_invalid");
  }

  assertNoBlockedInputKeys(input);

  if (!isRecord(input.actor)) {
    fail("live_session_status_actor_required");
  }

  if (cleanString(input.actor.actor_type) !== "coach") {
    fail("live_session_status_coach_actor_required", {
      actor_type: input.actor.actor_type ?? null
    });
  }

  const coachUserId = cleanString(
    input.actor.user_id ?? input.actor.coach_user_id ?? input.actor.coach_id
  );

  if (coachUserId.length === 0) {
    fail("live_session_status_coach_user_id_required");
  }

  const targetAthleteUserId = cleanString(
    input.target_athlete_user_id ?? input.athlete_user_id ?? input.athlete_id
  );

  if (targetAthleteUserId.length === 0) {
    fail("live_session_status_target_athlete_required");
  }

  const sessionId = cleanString(input.session_id ?? input.sessionId);
  if (sessionId.length === 0) {
    fail("live_session_status_session_id_required");
  }

  if (!Array.isArray(input.relationships)) {
    fail("live_session_status_relationships_array_required");
  }

  return { coachUserId, targetAthleteUserId, sessionId };
}

export function decideLiveSessionStatusAccess(input) {
  const { coachUserId, targetAthleteUserId, sessionId } = assertInput(input);

  const decision = canCoachAthleteAccess({
    actor: {
      ...input.actor,
      actor_type: "coach",
      user_id: coachUserId,
      coach_user_id: coachUserId
    },
    target_athlete_user_id: targetAthleteUserId,
    surface_id: liveSessionStatusContract.permission_surface_id,
    relationships: input.relationships
  });

  return Object.freeze({
    ...decision,
    view_surface_id: liveSessionStatusContract.surface_id,
    target_athlete_user_id: targetAthleteUserId,
    coach_user_id: coachUserId,
    session_id: sessionId
  });
}

export function assertLiveSessionStatusAccess(input) {
  const decision = decideLiveSessionStatusAccess(input);

  if (decision.allowed !== true) {
    fail(decision.reason || "live_session_status_access_denied", {
      actor_type: input?.actor?.actor_type ?? null,
      coach_user_id: decision.coach_user_id ?? null,
      target_athlete_user_id: decision.target_athlete_user_id,
      session_id: decision.session_id,
      requested_surface_id: decision.requested_surface_id ?? liveSessionStatusContract.permission_surface_id
    });
  }

  return decision;
}

/**
 * FUNCTION NOTE:
 * Export: buildLiveSessionStatus
 * Purpose: Builds assigned-coach live session status from explicit state and runtime event records.
 * Inputs: Uses actor, relationship records, target athlete id, session id, state payload, and events payload only.
 * Output: Returns a stable read-only envelope with factual status, counts, current/last work item, and timeline.
 * Boundary: Does not call engine code, append events, mutate session state, create contact surfaces, stream media, control sessions, or trigger substitution.
 * Determinism: Same explicit input returns the same read_model_hash and stable JSON.
 * Failure: Missing permission, malformed input, or forbidden live-control fields fail closed.
 */
export function buildLiveSessionStatus(input) {
  const access = assertLiveSessionStatusAccess(input);
  const state = cloneStable(readStatePayload(input));
  const events = sortEvents(readEventsPayload(input).map((event, index) => normaliseEventFact(event, index)));
  const counts = readCounts(state, events);
  const status = deriveStatus(state, events, counts);

  const readModel = {
    surface_id: liveSessionStatusContract.surface_id,
    slice_id: liveSessionStatusContract.slice_id,
    version: liveSessionStatusContract.version,
    actor_type: "coach",
    coach_user_id: access.coach_user_id,
    target_athlete_user_id: access.target_athlete_user_id,
    session_id: access.session_id,
    access: Object.freeze({
      allowed: true,
      reason: access.reason,
      relationship_id: access.relationship_id ?? null,
      requested_surface_id: access.requested_surface_id ?? liveSessionStatusContract.permission_surface_id,
      product_permission_state_only: true,
      engine_decision: false,
      engine_visible: false
    }),
    status,
    status_label: status,
    allowed_statuses: Object.freeze([...liveSessionStatusContract.allowed_statuses]),
    started_at: firstStartedAt(state, events),
    last_event_at: lastEventAt(state, events),
    counts,
    current_work_item: currentWorkItem(state),
    last_work_item: lastWorkItem(events),
    event_timeline: Object.freeze(events),
    copy_ids: Object.freeze(Object.values(LIVE_SESSION_STATUS_COPY_IDS)),
    read_model_hash: "",
    mutation_contract: Object.freeze({
      read_only: true,
      appends_runtime_event: false,
      mutates_session_state: false,
      calls_engine: false,
      coach_control_surface_present: false,
      coach_contact_surface_present: false,
      media_stream_surface_present: false,
      coach_substitution_control_present: false
    })
  };

  readModel.read_model_hash = sha256Hex({
    ...readModel,
    read_model_hash: ""
  });

  return cloneStable(readModel);
}

export function tryBuildLiveSessionStatus(input) {
  try {
    return Object.freeze({ ok: true, read_model: buildLiveSessionStatus(input) });
  } catch (error) {
    if (error instanceof LiveSessionStatusError) {
      return Object.freeze({
        ok: false,
        error: Object.freeze({
          code: error.code,
          copy_id: error.copy_id,
          reason: error.reason,
          details: error.details,
          product_auth_failure: true,
          engine_decision: false,
          engine_visible: false
        })
      });
    }

    throw error;
  }
}