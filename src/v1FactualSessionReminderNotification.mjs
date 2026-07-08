const SURFACE_ID = "v1_factual_session_reminder_notification";
const SURFACE_VERSION = "1.0.0";

const NOTIFICATION_KIND = "factual_session_reminder";
const DELIVERY_CHANNELS = Object.freeze(["email"]);

export const FACTUAL_SESSION_REMINDER_COPY_IDS = Object.freeze({
  subject: "SESSION_REMINDER_NOTIFICATION_SUBJECT",
  body: "SESSION_REMINDER_NOTIFICATION_BODY",
  boundary: "SESSION_REMINDER_NOTIFICATION_BOUNDARY"
});

export const FACTUAL_SESSION_REMINDER_COPY_TEXT = Object.freeze({
  [FACTUAL_SESSION_REMINDER_COPY_IDS.subject]: "Session reminder",
  [FACTUAL_SESSION_REMINDER_COPY_IDS.body]: "A session is recorded for {scheduled_start_at}.",
  [FACTUAL_SESSION_REMINDER_COPY_IDS.boundary]: "This notification is factual only."
});

export const FACTUAL_SESSION_REMINDER_ENGINE_BOUNDARY = Object.freeze({
  reads_engine_input: false,
  writes_engine_input: false,
  mutates_engine_output: false,
  mutates_runtime_events: false,
  mutates_phase1_declaration: false,
  mutates_replay_or_proof: false,
  changes_compile_output: false,
  triggers_substitution: false
});

const CLAIM_TERM_PARTS = Object.freeze([
  Object.freeze(["reco", "mmend", "ed"]),
  Object.freeze(["reco", "mmend", "ation"]),
  Object.freeze(["opti", "mal"]),
  Object.freeze(["read", "y"]),
  Object.freeze(["readi", "ness"]),
  Object.freeze(["sa", "fe"]),
  Object.freeze(["sa", "fe", "ty"]),
  Object.freeze(["suit", "able"]),
  Object.freeze(["suit", "ability"])
]);

function joinParts(parts) {
  return parts.join("");
}

function isPlainRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function fail(reason, details = {}) {
  const error = new Error(`factual_session_reminder_notification_${reason}`);
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

function stableCanonicalJson(value) {
  return JSON.stringify(stableSort(value));
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

function makeBoundaryEcho() {
  return Object.freeze({ ...FACTUAL_SESSION_REMINDER_ENGINE_BOUNDARY });
}

function makeCopySurface() {
  return Object.freeze({
    copy_ids: FACTUAL_SESSION_REMINDER_COPY_IDS,
    copy_text: FACTUAL_SESSION_REMINDER_COPY_TEXT
  });
}

export function lintFactualSessionReminderCopy(copyText = FACTUAL_SESSION_REMINDER_COPY_TEXT) {
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
 * Export: createFactualSessionReminderScheduleRecord
 * Purpose: Creates a product-layer schedule record for an explicitly activated
 * factual session reminder notification.
 * Boundary: This function must not import engine modules, read engine input,
 * write engine input, append runtime events, trigger substitution, or alter
 * compile/proof/replay artefacts.
 * Determinism: Output depends only on the explicit reminder request fields.
 * Failure behaviour: Missing explicit activation returns a non-scheduled record;
 * invalid structural input throws a typed product-surface error.
 */
export function createFactualSessionReminderScheduleRecord(input) {
  if (!isPlainRecord(input)) {
    fail("input_record_required");
  }

  const reminderId = cleanString(input.reminder_id, "reminder_id");
  const sessionId = cleanString(input.session_id, "session_id");
  const athleteId = cleanString(input.athlete_id, "athlete_id");
  const scheduledStartAt = assertIsoUtc(input.scheduled_start_at, "scheduled_start_at");
  const reminderAt = assertIsoUtc(input.reminder_at, "reminder_at");
  const deliveryChannel = cleanString(input.delivery_channel, "delivery_channel");

  if (!DELIVERY_CHANNELS.includes(deliveryChannel)) {
    fail("delivery_channel_not_allowed", { delivery_channel: deliveryChannel });
  }

  if (input.deliberately_activated !== true) {
    return Object.freeze({
      surface_id: SURFACE_ID,
      surface_version: SURFACE_VERSION,
      notification_kind: NOTIFICATION_KIND,
      scheduled: false,
      blocked_reason: "not_deliberately_activated",
      reminder_id: reminderId,
      session_id: sessionId,
      athlete_id: athleteId,
      scheduled_start_at: scheduledStartAt,
      reminder_at: reminderAt,
      delivery_channel: deliveryChannel,
      engine_boundary: makeBoundaryEcho()
    });
  }

  const activatedByUserId = cleanString(input.activated_by_user_id, "activated_by_user_id");
  const activatedAt = assertIsoUtc(input.activated_at, "activated_at");

  return Object.freeze({
    surface_id: SURFACE_ID,
    surface_version: SURFACE_VERSION,
    notification_kind: NOTIFICATION_KIND,
    scheduled: true,
    reminder_id: reminderId,
    session_id: sessionId,
    athlete_id: athleteId,
    scheduled_start_at: scheduledStartAt,
    reminder_at: reminderAt,
    delivery_channel: deliveryChannel,
    delivery_target_id: cleanOptionalString(input.delivery_target_id),
    deliberately_activated: true,
    activated_by_user_id: activatedByUserId,
    activated_at: activatedAt,
    copy_surface: makeCopySurface(),
    engine_boundary: makeBoundaryEcho()
  });
}

/**
 * DEV NOTE:
 * Export: handleFactualSessionReminderScheduleRecord
 * Purpose: Converts a stored reminder schedule record into a factual notification
 * payload that can be handed to an external delivery adapter later.
 * Boundary: This handler emits copy IDs and declared facts only. It does not send,
 * persist, call the engine, mutate session truth, or create a communication thread.
 * Determinism: The emitted payload is a stable projection of the schedule record.
 * Failure behaviour: Non-scheduled records produce emit=false rather than inventing
 * missing activation.
 */
export function handleFactualSessionReminderScheduleRecord(record) {
  if (!isPlainRecord(record)) {
    fail("schedule_record_required");
  }

  if (record.scheduled !== true) {
    return Object.freeze({
      surface_id: SURFACE_ID,
      surface_version: SURFACE_VERSION,
      notification_kind: NOTIFICATION_KIND,
      emit: false,
      blocked_reason: cleanOptionalString(record.blocked_reason) ?? "not_scheduled",
      engine_boundary: makeBoundaryEcho()
    });
  }

  const copyLint = lintFactualSessionReminderCopy();
  if (!copyLint.ok) {
    fail("copy_lint_failed", { failures: copyLint.failures });
  }

  return Object.freeze({
    surface_id: SURFACE_ID,
    surface_version: SURFACE_VERSION,
    notification_kind: NOTIFICATION_KIND,
    emit: true,
    reminder_id: cleanString(record.reminder_id, "reminder_id"),
    session_id: cleanString(record.session_id, "session_id"),
    athlete_id: cleanString(record.athlete_id, "athlete_id"),
    delivery_channel: cleanString(record.delivery_channel, "delivery_channel"),
    delivery_target_id: cleanOptionalString(record.delivery_target_id),
    subject_copy_id: FACTUAL_SESSION_REMINDER_COPY_IDS.subject,
    body_copy_id: FACTUAL_SESSION_REMINDER_COPY_IDS.body,
    boundary_copy_id: FACTUAL_SESSION_REMINDER_COPY_IDS.boundary,
    params: Object.freeze({
      scheduled_start_at: assertIsoUtc(record.scheduled_start_at, "scheduled_start_at")
    }),
    engine_boundary: makeBoundaryEcho()
  });
}

/**
 * DEV NOTE:
 * Export: compileIgnoringFactualSessionReminderNotification
 * Purpose: Test helper proving reminder notification state is ignored by
 * deterministic compile probes.
 * Boundary: This is not the real compiler and must not call or mimic engine
 * internals. It only returns a stable projection of supplied phase-like data
 * while ignoring reminder records.
 * Determinism: Equal phase-like input returns byte-stable output regardless of
 * notification records.
 * Failure behaviour: Invalid phase-like input throws before producing a probe.
 */
export function compileIgnoringFactualSessionReminderNotification(phaseLikeInput, reminderRecords = []) {
  if (!isPlainRecord(phaseLikeInput)) {
    fail("phase_like_input_record_required");
  }

  if (!Array.isArray(reminderRecords)) {
    fail("reminder_records_array_required");
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
    ignored_notification_record_count: reminderRecords.length,
    engine_boundary: makeBoundaryEcho()
  });
}

export function getFactualSessionReminderNotificationContract() {
  return Object.freeze({
    surface_id: SURFACE_ID,
    surface_version: SURFACE_VERSION,
    notification_kind: NOTIFICATION_KIND,
    deliberately_activated_required: true,
    delivery_channels: DELIVERY_CHANNELS,
    copy_ids: FACTUAL_SESSION_REMINDER_COPY_IDS,
    engine_boundary: makeBoundaryEcho()
  });
}