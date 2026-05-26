import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCoachQueueReviewSurface,
} from "../dist/src/coachQueueReviewSurface.js";

function baseItem(overrides = {}) {
  return {
    queue_item_id: "queue_item_001",
    coach_id: "coach_001",
    athlete_id: "athlete_001",
    coach_athlete_link_status: "linked",
    latest_session_record_status: "record_available",
    latest_checkin_record_status: "record_available",
    latest_coach_note_status: "none",
    history_count_status: "counts_available",
    source_record_refs: ["session_record_001"],
    ...overrides,
  };
}

test("linked athlete with review-required session derives review_required", () => {
  const [item] = buildCoachQueueReviewSurface([
    baseItem({ latest_session_record_status: "review_required" }),
  ]);

  assert.equal(item.queue_status, "review_required");
  assert.equal(item.review_required, true);
  assert.deepEqual(item.blocked_reasons, []);
});

test("linked athlete without review-required session derives available", () => {
  const [item] = buildCoachQueueReviewSurface([baseItem()]);

  assert.equal(item.queue_status, "available");
  assert.equal(item.review_required, false);
  assert.deepEqual(item.blocked_reasons, []);
});

test("revoked coach-athlete link derives blocked", () => {
  const [item] = buildCoachQueueReviewSurface([
    baseItem({ coach_athlete_link_status: "revoked" }),
  ]);

  assert.equal(item.queue_status, "blocked");
  assert.equal(item.review_required, false);
  assert.deepEqual(item.blocked_reasons, ["coach_athlete_link_revoked"]);
});

test("missing coach-athlete link derives blocked", () => {
  const [item] = buildCoachQueueReviewSurface([
    baseItem({ coach_athlete_link_status: "missing" }),
  ]);

  assert.equal(item.queue_status, "blocked");
  assert.equal(item.review_required, false);
  assert.deepEqual(item.blocked_reasons, ["coach_athlete_link_missing"]);
});

test("missing source refs derive blocked", () => {
  const [item] = buildCoachQueueReviewSurface([
    baseItem({ source_record_refs: [] }),
  ]);

  assert.equal(item.queue_status, "blocked");
  assert.equal(item.review_required, false);
  assert.deepEqual(item.blocked_reasons, ["source_record_missing"]);
});

test("unknown input field derives blocked", () => {
  const [item] = buildCoachQueueReviewSurface([
    baseItem({ unsupported_field: "not_allowed" }),
  ]);

  assert.equal(item.queue_status, "blocked");
  assert.equal(item.review_required, false);
  assert.deepEqual(item.blocked_reasons, ["unknown_queue_item_field"]);
});

test("unknown enum derives blocked", () => {
  const [item] = buildCoachQueueReviewSurface([
    baseItem({ latest_session_record_status: "ready_to_train" }),
  ]);

  assert.equal(item.queue_status, "blocked");
  assert.equal(item.review_required, false);
  assert.deepEqual(item.blocked_reasons, ["unknown_queue_item_status"]);
});

test("sorting is deterministic", () => {
  const output = buildCoachQueueReviewSurface([
    baseItem({
      queue_item_id: "queue_item_003",
      athlete_id: "athlete_c",
    }),
    baseItem({
      queue_item_id: "queue_item_001",
      athlete_id: "athlete_a",
      latest_session_record_status: "review_required",
    }),
    baseItem({
      queue_item_id: "queue_item_002",
      athlete_id: "athlete_b",
      coach_athlete_link_status: "revoked",
    }),
  ]);

  assert.deepEqual(
    output.map((item) => item.queue_item_id),
    ["queue_item_001", "queue_item_002", "queue_item_003"],
  );
});

test("builder does not mutate input", () => {
  const input = [baseItem({ latest_session_record_status: "review_required" })];
  const before = JSON.stringify(input);

  buildCoachQueueReviewSurface(input);

  assert.equal(JSON.stringify(input), before);
});

test("output does not contain score rank readiness safety medical optimisation or advice fields", () => {
  const [item] = buildCoachQueueReviewSurface([baseItem()]);
  const forbiddenKeys = [
    "score",
    "rank",
    "readiness",
    "readiness_certification",
    "safety",
    "medical",
    "optimisation",
    "optimization",
    "advice",
    "best_action",
    "recommendation",
  ];

  for (const key of forbiddenKeys) {
    assert.equal(Object.hasOwn(item, key), false, `${key} must not be emitted`);
  }
});