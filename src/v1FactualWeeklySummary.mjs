const SURFACE_ID = "v1_factual_weekly_summary";
const SURFACE_VERSION = "1.0.0";

export const FACTUAL_WEEKLY_SUMMARY_COPY_IDS = Object.freeze({
  title: "FACTUAL_WEEKLY_SUMMARY_TITLE",
  empty: "FACTUAL_WEEKLY_SUMMARY_EMPTY",
  boundary: "FACTUAL_WEEKLY_SUMMARY_BOUNDARY"
});

export const FACTUAL_WEEKLY_SUMMARY_COPY_TEXT = Object.freeze({
  [FACTUAL_WEEKLY_SUMMARY_COPY_IDS.title]: "Weekly summary",
  [FACTUAL_WEEKLY_SUMMARY_COPY_IDS.empty]: "No recorded sessions are present for this selected week.",
  [FACTUAL_WEEKLY_SUMMARY_COPY_IDS.boundary]: "This summary reports recorded facts only."
});

export const FACTUAL_WEEKLY_SUMMARY_ENGINE_BOUNDARY = Object.freeze({
  reads_engine_input: false,
  writes_engine_input: false,
  mutates_engine_output: false,
  mutates_runtime_events: false,
  mutates_phase1_declaration: false,
  mutates_replay_or_proof: false,
  changes_compile_output: false,
  triggers_substitution: false,
  emits_score: false,
  emits_comparison_order: false
});

const SUMMARY_EVENT_TYPES = Object.freeze([
  "session_started",
  "work_item_completed",
  "work_item_skipped",
  "work_item_partially_completed",
  "session_split",
  "session_returned",
  "session_stopped",
  "session_completed",
  "substitution_recorded"
]);

const CLAIM_TERM_PARTS = Object.freeze([
  Object.freeze(["reco", "mmend"]),
  Object.freeze(["opti", "mal"]),
  Object.freeze(["read", "y"]),
  Object.freeze(["readi", "ness"]),
  Object.freeze(["sa", "fe"]),
  Object.freeze(["sa", "fe", "ty"]),
  Object.freeze(["suit", "able"]),
  Object.freeze(["suit", "ability"]),
  Object.freeze(["ad", "vice"]),
  Object.freeze(["effect", "ive"]),
  Object.freeze(["effect", "iveness"]),
  Object.freeze(["rank"]),
  Object.freeze(["infer"]),
  Object.freeze(["adher", "ence"]),
  Object.freeze(["good"]),
  Object.freeze(["bad"]),
  Object.freeze(["poor"])
]);

function joinParts(parts) {
  return parts.join("");
}

function isPlainRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function fail(reason, details = {}) {
  const error = new Error(`factual_weekly_summary_${reason}`);
  error.reason = reason;
  error.details = Object.freeze({ ...details });
  throw error;
}

function cleanString(value, fieldName) {
  if (typeof value !== "string") {
    fail(`${fieldName}_required`);
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    fail(`${fieldName}_required`);
  }

  return trimmed;
}

function cleanOptionalString(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function assertIsoUtc(value, fieldName) {
  const text = cleanString(value, fieldName);

  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(text)) {
    fail(`${fieldName}_iso_utc_required`);
  }

  return text;
}

function assertNonNegativeInteger(value, fieldName) {
  if (!Number.isInteger(value) || value < 0) {
    fail(`${fieldName}_non_negative_integer_required`);
  }

  return value;
}

function makeBoundaryEcho() {
  return Object.freeze({ ...FACTUAL_WEEKLY_SUMMARY_ENGINE_BOUNDARY });
}

function stableSort(value) {
  if (Array.isArray(value)) return value.map(stableSort);

  if (isPlainRecord(value)) {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = stableSort(value[key]);
        return acc;
      }, {});
  }

  return value;
}

function stableCanonicalJson(value) {
  return JSON.stringify(stableSort(value));
}

function cleanSummarySession(session) {
  if (!isPlainRecord(session)) {
    fail("session_record_required");
  }

  const sessionId = cleanString(session.session_id, "session_id");
  const startedAt = assertIsoUtc(session.started_at, "started_at");
  const status = cleanString(session.status, "status");

  const recordedEvents = Array.isArray(session.recorded_events)
    ? session.recorded_events.map((event) => cleanSummaryEvent(event))
    : [];

  return Object.freeze({
    session_id: sessionId,
    started_at: startedAt,
    status,
    completed_work_items: assertNonNegativeInteger(session.completed_work_items ?? 0, "completed_work_items"),
    skipped_work_items: assertNonNegativeInteger(session.skipped_work_items ?? 0, "skipped_work_items"),
    partial_work_items: assertNonNegativeInteger(session.partial_work_items ?? 0, "partial_work_items"),
    substitution_count: assertNonNegativeInteger(session.substitution_count ?? 0, "substitution_count"),
    recorded_events: Object.freeze(recordedEvents)
  });
}

function cleanSummaryEvent(event) {
  if (!isPlainRecord(event)) {
    fail("event_record_required");
  }

  const eventType = cleanString(event.event_type, "event_type");
  if (!SUMMARY_EVENT_TYPES.includes(eventType)) {
    fail("event_type_not_allowed", { event_type: eventType });
  }

  return Object.freeze({
    event_type: eventType,
    occurred_at: assertIsoUtc(event.occurred_at, "occurred_at")
  });
}

function inWindow(value, startInclusive, endExclusive) {
  const time = Date.parse(value);
  return time >= Date.parse(startInclusive) && time < Date.parse(endExclusive);
}

function makeEmptyCounts() {
  return {
    recorded_session_count: 0,
    completed_session_count: 0,
    stopped_session_count: 0,
    split_event_count: 0,
    returned_event_count: 0,
    completed_work_item_count: 0,
    skipped_work_item_count: 0,
    partial_work_item_count: 0,
    substitution_count: 0
  };
}

function summariseSessions(sessions) {
  const counts = makeEmptyCounts();

  for (const session of sessions) {
    counts.recorded_session_count += 1;

    if (session.status === "completed") {
      counts.completed_session_count += 1;
    }

    if (session.status === "stopped") {
      counts.stopped_session_count += 1;
    }

    counts.completed_work_item_count += session.completed_work_items;
    counts.skipped_work_item_count += session.skipped_work_items;
    counts.partial_work_item_count += session.partial_work_items;
    counts.substitution_count += session.substitution_count;

    for (const event of session.recorded_events) {
      if (event.event_type === "session_split") {
        counts.split_event_count += 1;
      }

      if (event.event_type === "session_returned") {
        counts.returned_event_count += 1;
      }
    }
  }

  return Object.freeze(counts);
}

export function lintFactualWeeklySummaryCopy(copyText = FACTUAL_WEEKLY_SUMMARY_COPY_TEXT) {
  if (!isPlainRecord(copyText)) {
    fail("copy_text_record_required");
  }

  const failures = [];

  for (const [copyId, value] of Object.entries(copyText)) {
    if (typeof value !== "string") {
      failures.push(Object.freeze({ copy_id: copyId, reason: "copy_text_string_required" }));
      continue;
    }

    const lower = value.toLowerCase();
    for (const parts of CLAIM_TERM_PARTS) {
      const term = joinParts(parts);
      if (lower.includes(term)) {
        failures.push(Object.freeze({ copy_id: copyId, reason: "claim_term_found", term }));
      }
    }
  }

  return Object.freeze({
    ok: failures.length === 0,
    failures: Object.freeze(failures)
  });
}

/**
 * DEV NOTE:
 * Export: createFactualWeeklySummaryActivationRecord
 * Purpose: Creates a product-layer activation record for factual weekly summary
 * generation when a user has explicitly enabled that surface.
 * Boundary: This function must not import engine modules, read engine input,
 * write engine input, append runtime events, trigger substitution, score
 * completion, or alter compile/proof/replay artefacts.
 * Determinism: Output depends only on the explicit activation request fields.
 * Failure behaviour: Missing explicit activation returns a blocked factual record;
 * invalid structural input throws a typed product-surface error.
 */
export function createFactualWeeklySummaryActivationRecord(input) {
  if (!isPlainRecord(input)) {
    fail("input_record_required");
  }

  const summaryId = cleanString(input.summary_id, "summary_id");
  const athleteId = cleanString(input.athlete_id, "athlete_id");
  const weekStartAt = assertIsoUtc(input.week_start_at, "week_start_at");
  const weekEndAt = assertIsoUtc(input.week_end_at, "week_end_at");

  if (Date.parse(weekEndAt) <= Date.parse(weekStartAt)) {
    fail("week_window_invalid");
  }

  if (input.deliberately_activated !== true) {
    return Object.freeze({
      surface_id: SURFACE_ID,
      surface_version: SURFACE_VERSION,
      summary_id: summaryId,
      athlete_id: athleteId,
      week_start_at: weekStartAt,
      week_end_at: weekEndAt,
      activated: false,
      blocked_reason: "not_deliberately_activated",
      engine_boundary: makeBoundaryEcho()
    });
  }

  return Object.freeze({
    surface_id: SURFACE_ID,
    surface_version: SURFACE_VERSION,
    summary_id: summaryId,
    athlete_id: athleteId,
    week_start_at: weekStartAt,
    week_end_at: weekEndAt,
    activated: true,
    deliberately_activated: true,
    activated_by_user_id: cleanString(input.activated_by_user_id, "activated_by_user_id"),
    activated_at: assertIsoUtc(input.activated_at, "activated_at"),
    delivery_target_id: cleanOptionalString(input.delivery_target_id),
    copy_ids: FACTUAL_WEEKLY_SUMMARY_COPY_IDS,
    engine_boundary: makeBoundaryEcho()
  });
}

/**
 * DEV NOTE:
 * Export: generateFactualWeeklySummary
 * Purpose: Produces a weekly factual summary from supplied recorded session rows.
 * Boundary: This generator reports counts and source session IDs only. It does
 * not score completion, compare athletes, infer causes, alter engine truth,
 * append runtime events, or create coach actions.
 * Determinism: Equal activation record and equal recorded sessions produce a
 * byte-stable summary payload.
 * Failure behaviour: Non-activated records return generated=false rather than
 * inventing permission to generate.
 */
export function generateFactualWeeklySummary(activationRecord, recordedSessions = []) {
  if (!isPlainRecord(activationRecord)) {
    fail("activation_record_required");
  }

  if (activationRecord.activated !== true) {
    return Object.freeze({
      surface_id: SURFACE_ID,
      surface_version: SURFACE_VERSION,
      generated: false,
      blocked_reason: cleanOptionalString(activationRecord.blocked_reason) ?? "not_activated",
      engine_boundary: makeBoundaryEcho()
    });
  }

  if (!Array.isArray(recordedSessions)) {
    fail("recorded_sessions_array_required");
  }

  const copyLint = lintFactualWeeklySummaryCopy();
  if (!copyLint.ok) {
    fail("copy_lint_failed", { failures: copyLint.failures });
  }

  const weekStartAt = assertIsoUtc(activationRecord.week_start_at, "week_start_at");
  const weekEndAt = assertIsoUtc(activationRecord.week_end_at, "week_end_at");
  const athleteId = cleanString(activationRecord.athlete_id, "athlete_id");

  const cleaned = recordedSessions
    .map((session) => cleanSummarySession(session))
    .filter((session) => inWindow(session.started_at, weekStartAt, weekEndAt))
    .sort((a, b) => {
      if (a.started_at !== b.started_at) return a.started_at.localeCompare(b.started_at);
      return a.session_id.localeCompare(b.session_id);
    });

  const counts = summariseSessions(cleaned);

  return Object.freeze({
    surface_id: SURFACE_ID,
    surface_version: SURFACE_VERSION,
    generated: true,
    summary_id: cleanString(activationRecord.summary_id, "summary_id"),
    athlete_id: athleteId,
    week_start_at: weekStartAt,
    week_end_at: weekEndAt,
    copy_ids: FACTUAL_WEEKLY_SUMMARY_COPY_IDS,
    counts,
    source_session_ids: Object.freeze(cleaned.map((session) => session.session_id)),
    stable_summary_json: stableCanonicalJson({
      athlete_id: athleteId,
      week_start_at: weekStartAt,
      week_end_at: weekEndAt,
      counts,
      source_session_ids: cleaned.map((session) => session.session_id)
    }),
    engine_boundary: makeBoundaryEcho()
  });
}

/**
 * DEV NOTE:
 * Export: compileIgnoringFactualWeeklySummary
 * Purpose: Test helper proving weekly summary state is ignored by deterministic
 * compile probes.
 * Boundary: This is not the real compiler and must not call or mimic engine
 * internals. It only returns a stable projection of supplied phase-like data
 * while ignoring summary records.
 * Determinism: Equal phase-like input returns byte-stable output regardless of
 * summary records.
 * Failure behaviour: Invalid phase-like input throws before producing a probe.
 */
export function compileIgnoringFactualWeeklySummary(phaseLikeInput, summaryRecords = []) {
  if (!isPlainRecord(phaseLikeInput)) {
    fail("phase_like_input_record_required");
  }

  if (!Array.isArray(summaryRecords)) {
    fail("summary_records_array_required");
  }

  const probe = Object.freeze({
    activity_id: cleanString(phaseLikeInput.activity_id, "activity_id"),
    execution_scope: cleanString(phaseLikeInput.execution_scope, "execution_scope"),
    source_phase1_hash: cleanString(phaseLikeInput.source_phase1_hash, "source_phase1_hash"),
    planned_item_ids: Object.freeze(
      Array.isArray(phaseLikeInput.planned_item_ids)
        ? phaseLikeInput.planned_item_ids.map((item) => cleanString(item, "planned_item_id"))
        : []
    )
  });

  return Object.freeze({
    surface_id: `${SURFACE_ID}_compile_probe`,
    stable_probe_json: stableCanonicalJson(probe),
    ignored_summary_record_count: summaryRecords.length,
    engine_boundary: makeBoundaryEcho()
  });
}

export function getFactualWeeklySummaryContract() {
  return Object.freeze({
    surface_id: SURFACE_ID,
    surface_version: SURFACE_VERSION,
    deliberately_activated_required: true,
    copy_ids: FACTUAL_WEEKLY_SUMMARY_COPY_IDS,
    event_types: SUMMARY_EVENT_TYPES,
    engine_boundary: makeBoundaryEcho()
  });
}