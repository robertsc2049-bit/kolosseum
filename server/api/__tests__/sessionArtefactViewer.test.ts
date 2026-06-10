// v0_scope_negative_test: true
import assert from "node:assert/strict";
import test from "node:test";
import {
  assertViewerResponseFactualOnly,
  getSessionArtefactViewer,
  handleSessionArtefactViewerRequest,
  type CoachAthleteLink,
  type SessionArtefactRecord,
  type SessionArtefactViewerStore
} from "../sessionArtefactViewer";

function artefactFixture(): SessionArtefactRecord {
  return {
    artefact_id: "artefact_1",
    session_id: "session_1",
    athlete_user_id: "athlete_1",
    session_status: "partial",
    work_items: [
      {
        work_item_id: "work_1",
        display_order: 1,
        exercise_token_id: "exercise_token_back_squat",
        planned_quantity: {
          sets: 3,
          reps: 5,
          load_value: 100,
          load_unit: "kg"
        }
      },
      {
        work_item_id: "work_2",
        display_order: 2,
        exercise_token_id: "exercise_token_bench_press",
        planned_quantity: {
          sets: 3,
          reps: 5,
          load_value: 80,
          load_unit: "kg"
        }
      }
    ],
    factual_events: [
      {
        event_id: "event_1",
        event_type: "work_completed",
        work_item_id: "work_1",
        occurred_at_iso8601: "2026-05-20T10:00:00.000Z",
        recorded_at_iso8601: "2026-05-20T10:01:00.000Z",
        factual_quantity: {
          sets: 3,
          reps: 5,
          load_value: 100,
          load_unit: "kg"
        }
      },
      {
        event_id: "event_2",
        event_type: "work_partial",
        work_item_id: "work_2",
        occurred_at_iso8601: "2026-05-20T10:10:00.000Z",
        recorded_at_iso8601: "2026-05-20T10:11:00.000Z",
        factual_quantity: {
          sets: 1,
          reps: 5,
          load_value: 80,
          load_unit: "kg"
        }
      }
    ],
    source_declaration_hash: "sha256_phase1_source_hash",
    activity_id: "powerlifting",
    execution_scope: "coach_managed",
    created_at_iso8601: "2026-05-20T09:00:00.000Z",
    updated_at_iso8601: "2026-05-20T10:11:00.000Z"
  };
}

function storeFixture(links: CoachAthleteLink[] = []): SessionArtefactViewerStore {
  return {
    artefacts: [artefactFixture()],
    coach_athlete_links: links
  };
}

test("athlete can view own session artefact", () => {
  const result = getSessionArtefactViewer(
    { actor_type: "athlete", user_id: "athlete_1" },
    "artefact_1",
    storeFixture()
  );

  assert.equal(result.status, 200);
  if (result.status !== 200) return;

  assert.equal(result.body.artefact_id, "artefact_1");
  assert.equal(result.body.athlete_user_id, "athlete_1");
  assert.equal(result.body.session_status, "partial");
  assert.equal(result.body.source_declaration_hash, "sha256_phase1_source_hash");
  assert.equal(result.body.activity_id, "powerlifting");
  assert.equal(result.body.execution_scope, "coach_managed");
  assert.equal(result.body.read_only, true);
  assert.equal(result.body.work_items.length, 2);
  assert.equal(result.body.factual_events.length, 2);
  assertViewerResponseFactualOnly(result.body);
});

test("athlete cannot view another athlete artefact", () => {
  const result = getSessionArtefactViewer(
    { actor_type: "athlete", user_id: "athlete_2" },
    "artefact_1",
    storeFixture()
  );

  assert.equal(result.status, 403);
  if (result.status !== 403) return;

  assert.equal(result.body.error, "access_denied");
  assert.equal(result.body.copy_id, "ARTEFACT_ACCESS_DENIED");
});

test("accepted linked coach can view linked athlete artefact", () => {
  const result = getSessionArtefactViewer(
    { actor_type: "coach", user_id: "coach_1" },
    "artefact_1",
    storeFixture([
      {
        link_id: "link_1",
        coach_user_id: "coach_1",
        athlete_user_id: "athlete_1",
        status: "accepted"
      }
    ])
  );

  assert.equal(result.status, 200);
  if (result.status !== 200) return;

  assert.equal(result.body.athlete_user_id, "athlete_1");
  assert.equal(result.body.read_only, true);
  assertViewerResponseFactualOnly(result.body);
});

test("unlinked coach access denied", () => {
  const result = getSessionArtefactViewer(
    { actor_type: "coach", user_id: "coach_2" },
    "artefact_1",
    storeFixture([
      {
        link_id: "link_1",
        coach_user_id: "coach_1",
        athlete_user_id: "athlete_1",
        status: "accepted"
      }
    ])
  );

  assert.equal(result.status, 403);
  if (result.status !== 403) return;

  assert.equal(result.body.error, "access_denied");
});

test("revoked link access denied and fails closed", () => {
  const result = getSessionArtefactViewer(
    { actor_type: "coach", user_id: "coach_1" },
    "artefact_1",
    storeFixture([
      {
        link_id: "link_1",
        coach_user_id: "coach_1",
        athlete_user_id: "athlete_1",
        status: "revoked"
      }
    ])
  );

  assert.equal(result.status, 403);
  if (result.status !== 403) return;

  assert.equal(result.body.error, "access_denied");
});

test("non-accepted coach link states are denied", () => {
  const deniedStatuses = ["invited", "rejected", "expired"] as const;

  for (const status of deniedStatuses) {
    const result = getSessionArtefactViewer(
      { actor_type: "coach", user_id: "coach_1" },
      "artefact_1",
      storeFixture([
        {
          link_id: `link_${status}`,
          coach_user_id: "coach_1",
          athlete_user_id: "athlete_1",
          status
        }
      ])
    );

    assert.equal(result.status, 403);
  }
});

test("missing artefact returns not found", () => {
  const result = getSessionArtefactViewer(
    { actor_type: "athlete", user_id: "athlete_1" },
    "missing_artefact",
    storeFixture()
  );

  assert.equal(result.status, 404);
  if (result.status !== 404) return;

  assert.equal(result.body.error, "artefact_not_found");
  assert.equal(result.body.copy_id, "ARTEFACT_NOT_FOUND");
});

test("coach cannot edit artefact through viewer endpoint", () => {
  const result = handleSessionArtefactViewerRequest(
    {
      method: "PATCH",
      path: "/v0/session-artefacts/artefact_1",
      actor: { actor_type: "coach", user_id: "coach_1" }
    },
    storeFixture([
      {
        link_id: "link_1",
        coach_user_id: "coach_1",
        athlete_user_id: "athlete_1",
        status: "accepted"
      }
    ])
  );

  assert.equal(result.status, 405);
  if (result.status !== 405) return;

  assert.equal(result.body.error, "viewer_read_only");
  assert.equal(result.body.copy_id, "VIEWER_READ_ONLY");
});

test("coach cannot override events through viewer endpoint", () => {
  const result = handleSessionArtefactViewerRequest(
    {
      method: "POST",
      path: "/v0/session-artefacts/artefact_1/events/event_1/override",
      actor: { actor_type: "coach", user_id: "coach_1" }
    },
    storeFixture([
      {
        link_id: "link_1",
        coach_user_id: "coach_1",
        athlete_user_id: "athlete_1",
        status: "accepted"
      }
    ])
  );

  assert.equal(result.status, 405);
  if (result.status !== 405) return;

  assert.equal(result.body.error, "viewer_read_only");
  assert.equal(result.body.copy_id, "VIEWER_READ_ONLY");
});

test("coach cannot edit Phase 1 through viewer endpoint", () => {
  const result = handleSessionArtefactViewerRequest(
    {
      method: "PUT",
      path: "/v0/session-artefacts/artefact_1/phase1",
      actor: { actor_type: "coach", user_id: "coach_1" }
    },
    storeFixture([
      {
        link_id: "link_1",
        coach_user_id: "coach_1",
        athlete_user_id: "athlete_1",
        status: "accepted"
      }
    ])
  );

  assert.equal(result.status, 405);
  if (result.status !== 405) return;

  assert.equal(result.body.error, "viewer_read_only");
});

test("GET request returns factual fields required by S37", () => {
  const result = handleSessionArtefactViewerRequest(
    {
      method: "GET",
      path: "/v0/session-artefacts/artefact_1",
      actor: { actor_type: "athlete", user_id: "athlete_1" }
    },
    storeFixture()
  );

  assert.equal(result.status, 200);
  if (result.status !== 200) return;

  assert.ok("session_status" in result.body);
  assert.ok("work_items" in result.body);
  assert.ok("factual_events" in result.body);
  assert.ok("created_at_iso8601" in result.body);
  assert.ok("updated_at_iso8601" in result.body);
  assert.ok("source_declaration_hash" in result.body);
  assert.ok("activity_id" in result.body);
  assert.ok("execution_scope" in result.body);
  assert.equal(result.body.read_only, true);
  assertViewerResponseFactualOnly(result.body);
});

test("viewer response does not expose interpretation fields", () => {
  const result = getSessionArtefactViewer(
    { actor_type: "athlete", user_id: "athlete_1" },
    "artefact_1",
    storeFixture()
  );

  assert.equal(result.status, 200);
  if (result.status !== 200) return;

  const serialised = JSON.stringify(result.body).toLowerCase();

  const forbiddenFragments = [
    "analytics",
    "trend",
    "ranking",
    "readiness",
    "optimisation",
    "safety",
    "compliance",
    "outcome",
    "recommendation",
    "override"
  ];

  for (const fragment of forbiddenFragments) {
    assert.equal(
      serialised.includes(fragment),
      false,
      `viewer response must not contain ${fragment}`
    );
  }
});