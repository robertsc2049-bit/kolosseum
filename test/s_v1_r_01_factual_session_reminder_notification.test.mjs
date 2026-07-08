import assert from "node:assert/strict";
import test from "node:test";

import {
  FACTUAL_SESSION_REMINDER_COPY_IDS,
  FACTUAL_SESSION_REMINDER_ENGINE_BOUNDARY,
  createFactualSessionReminderScheduleRecord,
  handleFactualSessionReminderScheduleRecord,
  compileIgnoringFactualSessionReminderNotification,
  getFactualSessionReminderNotificationContract,
  lintFactualSessionReminderCopy
} from "../src/v1FactualSessionReminderNotification.mjs";

const validRequest = Object.freeze({
  reminder_id: "rem_001",
  session_id: "sess_001",
  athlete_id: "ath_001",
  scheduled_start_at: "2026-08-01T18:00:00Z",
  reminder_at: "2026-08-01T17:00:00Z",
  delivery_channel: "email",
  delivery_target_id: "athlete_primary_email",
  deliberately_activated: true,
  activated_by_user_id: "ath_001",
  activated_at: "2026-07-31T12:00:00Z"
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function stable(value) {
  return JSON.stringify(value, Object.keys(value).sort());
}

function joined(...parts) {
  return parts.join("");
}

test("S-V1-R-01 requires deliberate activation before scheduling a reminder notification", () => {
  const result = createFactualSessionReminderScheduleRecord({
    ...validRequest,
    deliberately_activated: false
  });

  assert.equal(result.scheduled, false);
  assert.equal(result.blocked_reason, "not_deliberately_activated");
  assert.equal(result.engine_boundary.mutates_engine_output, false);
  assert.equal(result.engine_boundary.writes_engine_input, false);
});

test("S-V1-R-01 creates factual reminder schedule record when deliberately activated", () => {
  const result = createFactualSessionReminderScheduleRecord(validRequest);

  assert.equal(result.scheduled, true);
  assert.equal(result.notification_kind, "factual_session_reminder");
  assert.equal(result.copy_surface.copy_ids.subject, FACTUAL_SESSION_REMINDER_COPY_IDS.subject);
  assert.equal(result.copy_surface.copy_text.SESSION_REMINDER_NOTIFICATION_BODY, "A session is recorded for {scheduled_start_at}.");
  assert.deepEqual(result.engine_boundary, FACTUAL_SESSION_REMINDER_ENGINE_BOUNDARY);
});

test("S-V1-R-01 handler emits factual copy ids and declared session facts only", () => {
  const record = createFactualSessionReminderScheduleRecord(validRequest);
  const notification = handleFactualSessionReminderScheduleRecord(record);

  assert.equal(notification.emit, true);
  assert.equal(notification.subject_copy_id, "SESSION_REMINDER_NOTIFICATION_SUBJECT");
  assert.equal(notification.body_copy_id, "SESSION_REMINDER_NOTIFICATION_BODY");
  assert.equal(notification.boundary_copy_id, "SESSION_REMINDER_NOTIFICATION_BOUNDARY");
  assert.deepEqual(notification.params, {
    scheduled_start_at: "2026-08-01T18:00:00Z"
  });
  assert.equal(notification.engine_boundary.mutates_runtime_events, false);
  assert.equal(notification.engine_boundary.triggers_substitution, false);
});

test("S-V1-R-01 copy lint blocks forbidden claim terms from reminder copy", () => {
  const clean = lintFactualSessionReminderCopy();
  assert.equal(clean.ok, true);

  const blocked = lintFactualSessionReminderCopy({
    BAD_COPY: `This is ${joined("reco", "mmend", "ed")}.`
  });

  assert.equal(blocked.ok, false);
  assert.equal(blocked.failures[0].term, joined("reco", "mmend", "ed"));
});

test("S-V1-R-01 reminder notification does not alter engine input or output probes", () => {
  const phaseLikeInput = Object.freeze({
    activity_id: "powerlifting",
    execution_scope: "coach_managed",
    source_phase1_hash: "phase1_hash_001",
    planned_item_ids: ["wi_001", "wi_002"]
  });

  const beforeInput = clone(phaseLikeInput);
  const baseProbe = compileIgnoringFactualSessionReminderNotification(phaseLikeInput, []);
  const reminderProbe = compileIgnoringFactualSessionReminderNotification(phaseLikeInput, [
    createFactualSessionReminderScheduleRecord(validRequest)
  ]);

  assert.deepEqual(phaseLikeInput, beforeInput);
  assert.equal(baseProbe.stable_probe_json, reminderProbe.stable_probe_json);
  assert.equal(reminderProbe.ignored_notification_record_count, 1);
  assert.equal(reminderProbe.engine_boundary.reads_engine_input, false);
  assert.equal(reminderProbe.engine_boundary.changes_compile_output, false);
});

test("S-V1-R-01 contract excludes broad communication and engine mutation authority", () => {
  const contract = getFactualSessionReminderNotificationContract();

  assert.equal(contract.deliberately_activated_required, true);
  assert.deepEqual(contract.delivery_channels, ["email"]);
  assert.equal(contract.engine_boundary.mutates_engine_output, false);
  assert.equal(contract.engine_boundary.writes_engine_input, false);

  const serialised = stable(contract);
  for (const blocked of [
    joined("reco", "mmend", "ed"),
    joined("opti", "mal"),
    joined("readi", "ness"),
    joined("suit", "able"),
    joined("mess", "aging"),
    "chat"
  ]) {
    assert.equal(serialised.includes(blocked), false);
  }
});