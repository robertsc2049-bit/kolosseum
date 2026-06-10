import assert from "node:assert/strict";
import test from "node:test";

import {
  createInMemoryCoachQueueReviewSource,
  getCoachQueueReviewApiAdapterResponse,
} from "../dist/src/coachQueueReviewApiAdapter.js";

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

test("missing coach ID is refused", () => {
  const source = createInMemoryCoachQueueReviewSource([baseItem()]);
  const response = getCoachQueueReviewApiAdapterResponse({}, source);

  assert.equal(response.ok, false);
  assert.equal(response.error, "coach_id_required");
});

test("blank coach ID is refused", () => {
  const source = createInMemoryCoachQueueReviewSource([baseItem()]);
  const response = getCoachQueueReviewApiAdapterResponse(
    { coach_id: "   " },
    source,
  );

  assert.equal(response.ok, false);
  assert.equal(response.error, "coach_id_required");
});

test("adapter filters records by coach ID", () => {
  const source = createInMemoryCoachQueueReviewSource([
    baseItem({
      queue_item_id: "queue_item_001",
      coach_id: "coach_001",
      athlete_id: "athlete_001",
    }),
    baseItem({
      queue_item_id: "queue_item_002",
      coach_id: "coach_002",
      athlete_id: "athlete_002",
    }),
  ]);

  const response = getCoachQueueReviewApiAdapterResponse(
    { coach_id: "coach_001" },
    source,
  );

  assert.equal(response.ok, true);
  assert.equal(response.items.length, 1);
  assert.equal(response.items[0].queue_item_id, "queue_item_001");
  assert.equal(response.items[0].coach_id, "coach_001");
});

test("adapter delegates status derivation to S49 builder", () => {
  const source = createInMemoryCoachQueueReviewSource([
    baseItem({
      latest_session_record_status: "review_required",
    }),
  ]);

  const response = getCoachQueueReviewApiAdapterResponse(
    { coach_id: "coach_001" },
    source,
  );

  assert.equal(response.ok, true);
  assert.equal(response.items[0].queue_status, "review_required");
  assert.equal(response.items[0].review_required, true);
});

test("adapter returns deterministic queue order", () => {
  const source = createInMemoryCoachQueueReviewSource([
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

  const response = getCoachQueueReviewApiAdapterResponse(
    { coach_id: "coach_001" },
    source,
  );

  assert.equal(response.ok, true);
  assert.deepEqual(
    response.items.map((item) => item.queue_item_id),
    ["queue_item_001", "queue_item_002", "queue_item_003"],
  );
});

test("adapter returns blocked records from S49 builder without advice", () => {
  const source = createInMemoryCoachQueueReviewSource([
    baseItem({
      coach_athlete_link_status: "missing",
    }),
  ]);

  const response = getCoachQueueReviewApiAdapterResponse(
    { coach_id: "coach_001" },
    source,
  );

  assert.equal(response.ok, true);
  assert.equal(response.items[0].queue_status, "blocked");
  assert.deepEqual(response.items[0].blocked_reasons, [
    "coach_athlete_link_missing",
  ]);
  assert.equal(Object.hasOwn(response.items[0], "recommendation"), false);
  assert.equal(Object.hasOwn(response.items[0], "advice"), false);
});

test("source failure returns source_unavailable", () => {
  const source = {
    listCoachQueueReviewItems() {
      throw new Error("source failure");
    },
  };

  const response = getCoachQueueReviewApiAdapterResponse(
    { coach_id: "coach_001" },
    source,
  );

  assert.equal(response.ok, false);
  assert.equal(response.error, "source_unavailable");
});

test("adapter output contains no forbidden fields", () => {
  const source = createInMemoryCoachQueueReviewSource([baseItem()]);
  const response = getCoachQueueReviewApiAdapterResponse(
    { coach_id: "coach_001" },
    source,
  );

  assert.equal(response.ok, true);

  const serialized = JSON.stringify(response);
  const forbiddenTokens = [
    "score",
    "rank",
    "readiness_certification",
    "safety",
    "medical",
    "optimisation",
    "optimization",
    "best_action",
    "recommendation",
  ];

  for (const token of forbiddenTokens) {
    assert.equal(
      serialized.includes(token),
      false,
      `${token} must not be emitted`,
    );
  }
});

test("in-memory source returns copies not shared mutable records", () => {
  const source = createInMemoryCoachQueueReviewSource([baseItem()]);
  const first = source.listCoachQueueReviewItems();
  first[0].source_record_refs.push("mutated_ref");

  const second = source.listCoachQueueReviewItems();

  assert.deepEqual(second[0].source_record_refs, ["session_record_001"]);
});

test("adapter does not mutate source records", () => {
  const item = baseItem({
    latest_session_record_status: "review_required",
  });
  const source = createInMemoryCoachQueueReviewSource([item]);
  const before = JSON.stringify(source.listCoachQueueReviewItems());

  getCoachQueueReviewApiAdapterResponse({ coach_id: "coach_001" }, source);

  const after = JSON.stringify(source.listCoachQueueReviewItems());

  assert.equal(after, before);
});