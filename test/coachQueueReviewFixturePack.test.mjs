import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  createInMemoryCoachQueueReviewSource,
} from "../dist/src/coachQueueReviewApiAdapter.js";
import {
  handleCoachQueueReviewRoute,
} from "../dist/src/coachQueueReviewRouteContract.js";

const repoRoot = process.cwd();
const fixtureDir = join(repoRoot, "test", "fixtures", "coach-queue-review");

function readJsonFixture(fileName) {
  return JSON.parse(readFileSync(join(fixtureDir, fileName), "utf8"));
}

function primaryCoachRequest() {
  return {
    method: "GET",
    path: "/v0/coach/queue-review",
    query: {
      coach_id: "coach_fixture_primary",
    },
  };
}

function emptyCoachRequest() {
  return {
    method: "GET",
    path: "/v0/coach/queue-review",
    query: {
      coach_id: "coach_fixture_empty",
    },
  };
}

function missingCoachRequest() {
  return {
    method: "GET",
    path: "/v0/coach/queue-review",
    query: {},
  };
}

function forbiddenTokens() {
  return [
    "score",
    "rank",
    "readiness_certification",
    "safety",
    "medical",
    "optimisation",
    "optimization",
    "best_action",
    "recommendation",
    "advice"
  ];
}

test("fixture JSON is valid and readable", () => {
  const sourceRecords = readJsonFixture("source_records.json");
  const expectedResponses = readJsonFixture("expected_route_responses.json");

  assert.equal(
    sourceRecords.fixture_pack_id,
    "coach_queue_review_read_model_source_records",
  );
  assert.equal(
    expectedResponses.fixture_pack_id,
    "coach_queue_review_expected_route_responses",
  );
  assert.equal(Array.isArray(sourceRecords.records), true);
  assert.equal(typeof expectedResponses.responses, "object");
});

test("fixture source records match expected successful route output", () => {
  const sourceRecords = readJsonFixture("source_records.json");
  const expectedResponses = readJsonFixture("expected_route_responses.json");
  const source = createInMemoryCoachQueueReviewSource(sourceRecords.records);

  const actual = handleCoachQueueReviewRoute(primaryCoachRequest(), source);

  assert.deepEqual(actual, expectedResponses.responses.primary_coach_queue);
});

test("queue order is deterministic", () => {
  const sourceRecords = readJsonFixture("source_records.json");
  const source = createInMemoryCoachQueueReviewSource(sourceRecords.records);

  const actual = handleCoachQueueReviewRoute(primaryCoachRequest(), source);

  assert.deepEqual(
    actual.body.items.map((item) => item.queue_item_id),
    [
      "queue_item_review_001",
      "queue_item_blocked_revoked_001",
      "queue_item_blocked_missing_source_001",
      "queue_item_available_001",
    ],
  );
});

test("coach filtering excludes other-coach records", () => {
  const sourceRecords = readJsonFixture("source_records.json");
  const source = createInMemoryCoachQueueReviewSource(sourceRecords.records);

  const actual = handleCoachQueueReviewRoute(primaryCoachRequest(), source);
  const queueItemIds = actual.body.items.map((item) => item.queue_item_id);

  assert.equal(queueItemIds.includes("queue_item_other_coach_001"), false);
});

test("empty queue fixture is stable", () => {
  const sourceRecords = readJsonFixture("source_records.json");
  const expectedResponses = readJsonFixture("expected_route_responses.json");
  const source = createInMemoryCoachQueueReviewSource(sourceRecords.records);

  const actual = handleCoachQueueReviewRoute(emptyCoachRequest(), source);

  assert.deepEqual(actual, expectedResponses.responses.empty_coach_queue);
});

test("missing coach ID fixture is stable", () => {
  const sourceRecords = readJsonFixture("source_records.json");
  const expectedResponses = readJsonFixture("expected_route_responses.json");
  const source = createInMemoryCoachQueueReviewSource(sourceRecords.records);

  const actual = handleCoachQueueReviewRoute(missingCoachRequest(), source);

  assert.deepEqual(actual, expectedResponses.responses.missing_coach_id);
});

test("expected fixture outputs contain no forbidden fields", () => {
  const expectedResponses = readJsonFixture("expected_route_responses.json");
  const serialized = JSON.stringify(expectedResponses);

  for (const token of forbiddenTokens()) {
    assert.equal(
      serialized.includes(token),
      false,
      `${token} must not appear in expected fixture outputs`,
    );
  }
});

test("fixture source records are not mutated by route handling", () => {
  const sourceRecords = readJsonFixture("source_records.json");
  const before = JSON.stringify(sourceRecords.records);
  const source = createInMemoryCoachQueueReviewSource(sourceRecords.records);

  handleCoachQueueReviewRoute(primaryCoachRequest(), source);

  assert.equal(JSON.stringify(sourceRecords.records), before);
});