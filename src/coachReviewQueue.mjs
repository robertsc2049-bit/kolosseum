/**
 * DEV NOTE: S-V1-U-03 factual coach review queue read model.
 * Purpose: builds assigned-coach review rows from explicit relationship, session, event, and review-record facts.
 * Boundary: product read model only; it emits recorded fields without interpretive labels, ordered importance, prompts, or engine calls.
 * Determinism: same explicit input returns the same frozen row order and payload.
 * Failure: unknown fields, malformed actors, and unassigned rows fail closed or are excluded without fallback visibility.
 */

const SURFACE_ID = "v1_coach_review_queue";
const REVIEW_SURFACE_ID = "coach_review_queue";
const REVIEW_STATUS_VALUES = new Set(["not_recorded", "reviewed", "deferred"]);

export class CoachReviewQueueError extends Error {
  constructor(reason, details = {}) {
    super(reason);
    this.name = "CoachReviewQueueError";
    this.reason = reason;
    this.details = Object.freeze({ ...details });
  }
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanString(value, field) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new CoachReviewQueueError("coach_review_queue_invalid_field", { field });
  }
  return value.trim();
}

function cleanOptionalString(value, field) {
  if (value === undefined || value === null) {
    return null;
  }
  return cleanString(value, field);
}

function assertRecord(value, reason, details = {}) {
  if (!isRecord(value)) {
    throw new CoachReviewQueueError(reason, details);
  }
}

function assertAllowedKeys(record, allowedKeys, path) {
  for (const key of Object.keys(record)) {
    if (!allowedKeys.has(key)) {
      throw new CoachReviewQueueError("coach_review_queue_unknown_field", { path, field: key });
    }
  }
}

function stableJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }

  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }

  return JSON.stringify(value);
}

function freezeArray(values) {
  return Object.freeze(values.map((value) => Object.freeze(value)));
}

function relationshipIdOf(relationship) {
  return cleanString(relationship.relationship_id, "relationship.relationship_id");
}

function isAcceptedAssignedRelationship(relationship, coachUserId) {
  return (
    isRecord(relationship) &&
    relationship.relationship_scope === "individual" &&
    relationship.relationship_status === "accepted" &&
    relationship.coach_user_id === coachUserId &&
    typeof relationship.athlete_user_id === "string" &&
    relationship.athlete_user_id.trim().length > 0
  );
}

function buildAssignedAthleteMap(relationships, coachUserId) {
  const assigned = new Map();

  for (const relationship of relationships) {
    if (!isAcceptedAssignedRelationship(relationship, coachUserId)) {
      continue;
    }

    const athleteUserId = cleanString(relationship.athlete_user_id, "relationship.athlete_user_id");
    if (!assigned.has(athleteUserId)) {
      assigned.set(athleteUserId, Object.freeze({
        athlete_user_id: athleteUserId,
        relationship_id: relationshipIdOf(relationship)
      }));
    }
  }

  return assigned;
}

function buildAthleteDisplayMap(athletes) {
  const display = new Map();

  for (const athlete of athletes) {
    assertRecord(athlete, "coach_review_queue_invalid_athlete");
    assertAllowedKeys(athlete, new Set(["athlete_user_id", "athlete_display_id"]), "athletes[]");

    const athleteUserId = cleanString(athlete.athlete_user_id, "athlete.athlete_user_id");
    display.set(athleteUserId, cleanOptionalString(athlete.athlete_display_id, "athlete.athlete_display_id") ?? athleteUserId);
  }

  return display;
}

function normaliseSession(session) {
  assertRecord(session, "coach_review_queue_invalid_session");
  assertAllowedKeys(session, new Set([
    "session_id",
    "athlete_user_id",
    "assignment_id",
    "recorded_session_status",
    "started_at",
    "completed_at"
  ]), "sessions[]");

  return Object.freeze({
    session_id: cleanString(session.session_id, "session.session_id"),
    athlete_user_id: cleanString(session.athlete_user_id, "session.athlete_user_id"),
    assignment_id: cleanOptionalString(session.assignment_id, "session.assignment_id"),
    recorded_session_status: cleanString(session.recorded_session_status, "session.recorded_session_status"),
    started_at: cleanOptionalString(session.started_at, "session.started_at"),
    completed_at: cleanOptionalString(session.completed_at, "session.completed_at")
  });
}

function normaliseRuntimeEvent(event) {
  assertRecord(event, "coach_review_queue_invalid_runtime_event");
  assertAllowedKeys(event, new Set([
    "session_id",
    "athlete_user_id",
    "event_type",
    "recorded_at"
  ]), "runtime_events[]");

  return Object.freeze({
    session_id: cleanString(event.session_id, "runtime_event.session_id"),
    athlete_user_id: cleanString(event.athlete_user_id, "runtime_event.athlete_user_id"),
    event_type: cleanString(event.event_type, "runtime_event.event_type"),
    recorded_at: cleanOptionalString(event.recorded_at, "runtime_event.recorded_at")
  });
}

function normaliseReviewRecord(record) {
  assertRecord(record, "coach_review_queue_invalid_review_record");
  assertAllowedKeys(record, new Set([
    "session_id",
    "athlete_user_id",
    "review_status",
    "review_recorded_at",
    "review_recorded_by_coach_user_id",
    "deferred_until"
  ]), "review_records[]");

  const reviewStatus = cleanString(record.review_status, "review_record.review_status");
  if (!REVIEW_STATUS_VALUES.has(reviewStatus)) {
    throw new CoachReviewQueueError("coach_review_queue_review_status_invalid", { review_status: reviewStatus });
  }

  return Object.freeze({
    session_id: cleanString(record.session_id, "review_record.session_id"),
    athlete_user_id: cleanString(record.athlete_user_id, "review_record.athlete_user_id"),
    review_status: reviewStatus,
    review_recorded_at: cleanOptionalString(record.review_recorded_at, "review_record.review_recorded_at"),
    review_recorded_by_coach_user_id: cleanOptionalString(record.review_recorded_by_coach_user_id, "review_record.review_recorded_by_coach_user_id"),
    deferred_until: cleanOptionalString(record.deferred_until, "review_record.deferred_until")
  });
}

function reviewKey(sessionId, athleteUserId) {
  return `${athleteUserId}::${sessionId}`;
}

function buildReviewMap(reviewRecords) {
  const reviewMap = new Map();

  for (const record of reviewRecords.map(normaliseReviewRecord)) {
    reviewMap.set(reviewKey(record.session_id, record.athlete_user_id), record);
  }

  return reviewMap;
}

function eventFactsForSession(events, session) {
  const matching = events.filter((event) => (
    event.session_id === session.session_id &&
    event.athlete_user_id === session.athlete_user_id
  ));

  const eventCounts = Object.create(null);
  for (const event of matching) {
    eventCounts[event.event_type] = (eventCounts[event.event_type] ?? 0) + 1;
  }

  const recordedAtValues = matching
    .map((event) => event.recorded_at)
    .filter((value) => typeof value === "string" && value.length > 0)
    .sort();

  return Object.freeze({
    recorded_event_count: matching.length,
    recorded_event_type_counts: Object.freeze({ ...eventCounts }),
    last_recorded_event_at: recordedAtValues.length > 0 ? recordedAtValues[recordedAtValues.length - 1] : null
  });
}

function buildQueueRow({ session, assignedRelationship, athleteDisplayId, eventFacts, reviewRecord }) {
  const reviewStatus = reviewRecord?.review_status ?? "not_recorded";

  return Object.freeze({
    surface_id: REVIEW_SURFACE_ID,
    athlete_user_id: session.athlete_user_id,
    athlete_display_id: athleteDisplayId,
    relationship_id: assignedRelationship.relationship_id,
    session_id: session.session_id,
    assignment_id: session.assignment_id,
    recorded_session_status: session.recorded_session_status,
    started_at: session.started_at,
    completed_at: session.completed_at,
    recorded_event_count: eventFacts.recorded_event_count,
    recorded_event_type_counts: eventFacts.recorded_event_type_counts,
    last_recorded_event_at: eventFacts.last_recorded_event_at,
    review_status: reviewStatus,
    review_recorded_at: reviewRecord?.review_recorded_at ?? null,
    review_recorded_by_coach_user_id: reviewRecord?.review_recorded_by_coach_user_id ?? null,
    deferred_until: reviewRecord?.deferred_until ?? null,
    engine_visible: false
  });
}

/**
 * FUNCTION NOTE:
 * Export: buildCoachReviewQueue
 * Purpose: Builds factual review rows for sessions belonging to athletes assigned to the requesting coach.
 * Inputs: Explicit actor, relationships, athletes, sessions, runtime events, and review records.
 * Output: Frozen read model with recorded facts and review status only.
 * Boundary: Coach review visibility only; no interpretive labels, ordered importance, prompts, engine input, or engine output.
 * Determinism: Row order is sorted by recorded timestamps and ids, independent of input array order.
 * Failure: Unknown fields and malformed input fail closed; unassigned sessions are excluded.
 */
export function buildCoachReviewQueue(input) {
  assertRecord(input, "coach_review_queue_input_invalid");
  assertAllowedKeys(input, new Set([
    "actor",
    "relationships",
    "athletes",
    "sessions",
    "runtime_events",
    "review_records"
  ]), "input");

  assertRecord(input.actor, "coach_review_queue_actor_invalid");
  assertAllowedKeys(input.actor, new Set(["actor_type", "user_id"]), "actor");

  if (input.actor.actor_type !== "coach") {
    throw new CoachReviewQueueError("coach_review_queue_actor_not_coach", {
      actor_type: input.actor.actor_type
    });
  }

  const coachUserId = cleanString(input.actor.user_id, "actor.user_id");

  for (const [field, value] of Object.entries({
    relationships: input.relationships,
    athletes: input.athletes,
    sessions: input.sessions,
    runtime_events: input.runtime_events,
    review_records: input.review_records
  })) {
    if (!Array.isArray(value)) {
      throw new CoachReviewQueueError("coach_review_queue_array_required", { field });
    }
  }

  const assignedAthletes = buildAssignedAthleteMap(input.relationships, coachUserId);
  const athleteDisplay = buildAthleteDisplayMap(input.athletes);
  const sessions = input.sessions.map(normaliseSession);
  const runtimeEvents = input.runtime_events.map(normaliseRuntimeEvent);
  const reviewMap = buildReviewMap(input.review_records);

  const rows = [];

  for (const session of sessions) {
    const assignedRelationship = assignedAthletes.get(session.athlete_user_id);
    if (!assignedRelationship) {
      continue;
    }

    const eventFacts = eventFactsForSession(runtimeEvents, session);
    const reviewRecord = reviewMap.get(reviewKey(session.session_id, session.athlete_user_id));

    rows.push(buildQueueRow({
      session,
      assignedRelationship,
      athleteDisplayId: athleteDisplay.get(session.athlete_user_id) ?? session.athlete_user_id,
      eventFacts,
      reviewRecord
    }));
  }

  rows.sort((left, right) => {
    const leftTime = left.last_recorded_event_at ?? left.completed_at ?? left.started_at ?? "";
    const rightTime = right.last_recorded_event_at ?? right.completed_at ?? right.started_at ?? "";
    return rightTime.localeCompare(leftTime) ||
      left.athlete_user_id.localeCompare(right.athlete_user_id) ||
      left.session_id.localeCompare(right.session_id);
  });

  return Object.freeze({
    surface_id: SURFACE_ID,
    coach_user_id: coachUserId,
    queue_rows: freezeArray(rows),
    queue_count: rows.length,
    review_status_values: Object.freeze([...REVIEW_STATUS_VALUES].sort()),
    engine_visible: false
  });
}

export function serialiseCoachReviewQueueProbe(value) {
  return stableJson(value);
}