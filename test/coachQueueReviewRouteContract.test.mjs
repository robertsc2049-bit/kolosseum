
// DEV NOTE: Human-maintained repo surface. Keep this file aligned with canonical contracts,
// deterministic checks, and developer handover standards. Do not introduce hidden defaults,
// broad discovery, or unreviewed boundary changes.

import assert from "node:assert/strict";
import test from "node:test";

import {
  createInMemoryCoachQueueReviewSource,
} from "../dist/src/coachQueueReviewApiAdapter.js";
import {
  coachQueueReviewRouteContract,
  handleCoachQueueReviewRoute,
} from "../dist/src/coachQueueReviewRouteContract.js";

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

function validRequest(overrides = {}) {
  return {
    method: "GET",
    path: "/v0/coach/queue-review",
    query: {
      coach_id: "coach_001",
    },
    ...overrides,
  };
}

test("route contract exposes expected method and path without registering Express", () => {
  assert.equal(coachQueueReviewRouteContract.method, "GET");
  assert.equal(coachQueueReviewRouteContract.path, "/v0/coach/queue-review");
  assert.equal(
    coachQueueReviewRouteContract.surface_id,
    "coach_queue_review_route_contract",
  );
});

test("GET with valid coach ID returns HTTP 200", () => {
  const source = createInMemoryCoachQueueReviewSource([baseItem()]);
  const response = handleCoachQueueReviewRoute(validRequest(), source);

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.coach_id, "coach_001");
  assert.equal(response.body.items.length, 1);
});

test("handler filters by coach ID via S50 adapter", () => {
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

  const response = handleCoachQueueReviewRoute(validRequest(), source);

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.deepEqual(
    response.body.items.map((item) => item.queue_item_id),
    ["queue_item_001"],
  );
});

test("missing coach ID returns HTTP 400", () => {
  const source = createInMemoryCoachQueueReviewSource([baseItem()]);
  const response = handleCoachQueueReviewRoute(
    {
      method: "GET",
      path: "/v0/coach/queue-review",
      query: {},
    },
    source,
  );

  assert.equal(response.status, 400);
  assert.equal(response.body.ok, false);
  assert.equal(response.body.error, "coach_id_required");
});

test("blank coach ID returns HTTP 400", () => {
  const source = createInMemoryCoachQueueReviewSource([baseItem()]);
  const response = handleCoachQueueReviewRoute(
    validRequest({ query: { coach_id: "   " } }),
    source,
  );

  assert.equal(response.status, 400);
  assert.equal(response.body.ok, false);
  assert.equal(response.body.error, "coach_id_required");
});

test("wrong method returns HTTP 405", () => {
  const source = createInMemoryCoachQueueReviewSource([baseItem()]);
  const response = handleCoachQueueReviewRoute(
    validRequest({ method: "POST" }),
    source,
  );

  assert.equal(response.status, 405);
  assert.equal(response.body.ok, false);
  assert.equal(response.body.error, "method_not_allowed");
});

test("wrong path returns HTTP 404", () => {
  const source = createInMemoryCoachQueueReviewSource([baseItem()]);
  const response = handleCoachQueueReviewRoute(
    validRequest({ path: "/v0/coach/unknown" }),
    source,
  );

  assert.equal(response.status, 404);
  assert.equal(response.body.ok, false);
  assert.equal(response.body.error, "route_not_found");
});

test("source failure returns HTTP 503", () => {
  const source = {
    listCoachQueueReviewItems() {
      throw new Error("source failure");
    },
  };

  const response = handleCoachQueueReviewRoute(validRequest(), source);

  assert.equal(response.status, 503);
  assert.equal(response.body.ok, false);
  assert.equal(response.body.error, "source_unavailable");
});

test("blocked S49/S50 record is returned without advice", () => {
  const source = createInMemoryCoachQueueReviewSource([
    baseItem({
      coach_athlete_link_status: "revoked",
    }),
  ]);

  const response = handleCoachQueueReviewRoute(validRequest(), source);

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.items[0].queue_status, "blocked");
  assert.deepEqual(response.body.items[0].blocked_reasons, [
    "coach_athlete_link_revoked",
  ]);
  assert.equal(Object.hasOwn(response.body.items[0], "advice"), false);
  assert.equal(Object.hasOwn(response.body.items[0], "recommendation"), false);
});

test("handler response contains no forbidden fields", () => {
  const source = createInMemoryCoachQueueReviewSource([baseItem()]);
  const response = handleCoachQueueReviewRoute(validRequest(), source);
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

test("handler does not mutate source records", () => {
  const source = createInMemoryCoachQueueReviewSource([
    baseItem({
      latest_session_record_status: "review_required",
    }),
  ]);
  const before = JSON.stringify(source.listCoachQueueReviewItems());

  handleCoachQueueReviewRoute(validRequest(), source);

  const after = JSON.stringify(source.listCoachQueueReviewItems());

  assert.equal(after, before);
});
