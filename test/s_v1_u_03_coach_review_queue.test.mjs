import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCoachReviewQueue,
  serialiseCoachReviewQueueProbe
} from "../src/coachReviewQueue.mjs";
import { handleCoachReviewQueueRequest } from "../src/api/coachReviewQueueApi.mjs";
import { projectCoachReviewQueue } from "../src/coachReviewQueueProjection.mjs";

function baseInput() {
  return {
    actor: {
      actor_type: "coach",
      user_id: "coach-1"
    },
    relationships: [
      {
        relationship_id: "rel-1",
        relationship_scope: "individual",
        relationship_status: "accepted",
        coach_user_id: "coach-1",
        athlete_user_id: "athlete-1"
      },
      {
        relationship_id: "rel-2",
        relationship_scope: "individual",
        relationship_status: "revoked",
        coach_user_id: "coach-1",
        athlete_user_id: "athlete-2"
      },
      {
        relationship_id: "rel-3",
        relationship_scope: "individual",
        relationship_status: "accepted",
        coach_user_id: "coach-2",
        athlete_user_id: "athlete-3"
      }
    ],
    athletes: [
      {
        athlete_user_id: "athlete-1",
        athlete_display_id: "ATH-001"
      },
      {
        athlete_user_id: "athlete-2",
        athlete_display_id: "ATH-002"
      },
      {
        athlete_user_id: "athlete-3",
        athlete_display_id: "ATH-003"
      }
    ],
    sessions: [
      {
        session_id: "session-1",
        athlete_user_id: "athlete-1",
        assignment_id: "assignment-1",
        recorded_session_status: "completed",
        started_at: "2026-06-18T09:00:00.000Z",
        completed_at: "2026-06-18T09:45:00.000Z"
      },
      {
        session_id: "session-2",
        athlete_user_id: "athlete-2",
        assignment_id: "assignment-2",
        recorded_session_status: "completed",
        started_at: "2026-06-18T10:00:00.000Z",
        completed_at: "2026-06-18T10:45:00.000Z"
      },
      {
        session_id: "session-3",
        athlete_user_id: "athlete-3",
        assignment_id: "assignment-3",
        recorded_session_status: "completed",
        started_at: "2026-06-18T11:00:00.000Z",
        completed_at: "2026-06-18T11:45:00.000Z"
      }
    ],
    runtime_events: [
      {
        session_id: "session-1",
        athlete_user_id: "athlete-1",
        event_type: "work_item_completed",
        recorded_at: "2026-06-18T09:10:00.000Z"
      },
      {
        session_id: "session-1",
        athlete_user_id: "athlete-1",
        event_type: "work_item_skipped",
        recorded_at: "2026-06-18T09:20:00.000Z"
      },
      {
        session_id: "session-2",
        athlete_user_id: "athlete-2",
        event_type: "work_item_completed",
        recorded_at: "2026-06-18T10:10:00.000Z"
      }
    ],
    review_records: [
      {
        session_id: "session-1",
        athlete_user_id: "athlete-1",
        review_status: "reviewed",
        review_recorded_at: "2026-06-18T12:00:00.000Z",
        review_recorded_by_coach_user_id: "coach-1",
        deferred_until: null
      }
    ]
  };
}

test("S-V1-U-03 returns assigned coach review rows only", () => {
  const queue = buildCoachReviewQueue(baseInput());

  assert.equal(queue.surface_id, "v1_coach_review_queue");
  assert.equal(queue.coach_user_id, "coach-1");
  assert.equal(queue.queue_count, 1);
  assert.equal(queue.queue_rows[0].athlete_user_id, "athlete-1");
  assert.equal(queue.queue_rows[0].session_id, "session-1");
  assert.equal(queue.queue_rows.some((row) => row.athlete_user_id === "athlete-2"), false);
  assert.equal(queue.queue_rows.some((row) => row.athlete_user_id === "athlete-3"), false);
});

test("S-V1-U-03 queue rows show recorded facts and review status only", () => {
  const queue = buildCoachReviewQueue(baseInput());
  const row = queue.queue_rows[0];

  assert.equal(row.recorded_session_status, "completed");
  assert.equal(row.recorded_event_count, 2);
  assert.deepEqual(row.recorded_event_type_counts, {
    work_item_completed: 1,
    work_item_skipped: 1
  });
  assert.equal(row.last_recorded_event_at, "2026-06-18T09:20:00.000Z");
  assert.equal(row.review_status, "reviewed");
  assert.equal(row.review_recorded_by_coach_user_id, "coach-1");

  for (const forbiddenField of [
    "priority",
    "score",
    "recommendation",
    "intervention",
    "readiness",
    "fatigue",
    "risk"
  ]) {
    assert.equal(Object.hasOwn(row, forbiddenField), false);
  }
});

test("S-V1-U-03 uses not_recorded when no review record exists", () => {
  const input = baseInput();
  input.review_records = [];

  const queue = buildCoachReviewQueue(input);

  assert.equal(queue.queue_rows[0].review_status, "not_recorded");
  assert.equal(queue.queue_rows[0].review_recorded_at, null);
});

test("S-V1-U-03 API adapter refuses non-coach actor without engine token", () => {
  const input = baseInput();
  input.actor = {
    actor_type: "athlete",
    user_id: "athlete-1"
  };

  const response = handleCoachReviewQueueRequest({
    method: "GET",
    body: input
  });

  assert.equal(response.status, 403);
  assert.equal(response.body.ok, false);
  assert.equal(response.body.reason, "coach_review_queue_actor_not_coach");
  assert.equal(response.body.engine_visible, false);
  assert.equal(Object.hasOwn(response.body, "engine_token"), false);
});

test("S-V1-U-03 refuses unknown broad queue fields", () => {
  const input = baseInput();
  input.priority = "high";

  assert.throws(
    () => buildCoachReviewQueue(input),
    /coach_review_queue_unknown_field/
  );
});

test("S-V1-U-03 projection emits copy ids and factual fields", () => {
  const projection = projectCoachReviewQueue(buildCoachReviewQueue(baseInput()));

  assert.equal(projection.surface_id, "v1_coach_review_queue");
  assert.equal(projection.title.copy_id, "coach_review_queue.title");
  assert.equal(projection.rows.length, 1);
  assert.equal(projection.rows[0].labels.review_status.copy_id, "coach_review_queue.review_status");
  assert.equal(projection.rows[0].labels.recorded_events.copy_id, "coach_review_queue.recorded_events");
  assert.equal(projection.rows[0].engine_visible, false);
});

test("S-V1-U-03 queue does not alter deterministic probe input", () => {
  const input = baseInput();
  const probe = {
    engine_version: "EB2-1.0.0",
    phase1_schema_version: "phase1.v1",
    athlete_user_id: "athlete-1",
    declared_constraints: ["constraint-a"]
  };

  const before = serialiseCoachReviewQueueProbe(probe);
  buildCoachReviewQueue(input);
  const after = serialiseCoachReviewQueueProbe(probe);

  assert.equal(after, before);
});