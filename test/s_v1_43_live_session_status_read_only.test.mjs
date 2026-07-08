import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  LIVE_SESSION_STATUS_COPY_IDS,
  buildLiveSessionStatus,
  liveSessionStatusContract,
  stableLiveSessionStatusJson,
  tryBuildLiveSessionStatus
} from "../src/liveSessionStatus.mjs";
import { handleLiveSessionStatusRequest } from "../src/api/liveSessionStatusApi.mjs";
import { renderLiveSessionStatus } from "../src/liveSessionStatusUiRenderer.mjs";
import { canCoachAthleteAccess } from "../src/relationshipPermissionGuards.mjs";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function acceptedRelationship(overrides = {}) {
  return {
    relationship_id: "relationship_001",
    coach_user_id: "coach_001",
    athlete_user_id: "athlete_001",
    target_athlete_user_id: "athlete_001",
    status: "accepted",
    relationship_status: "accepted",
    relationship_scope: "individual_coach_athlete",
    scope: {
      live_session_status: true,
      session_readback: true,
      coach_factual_artefact_view: true
    },
    accepted_at_iso8601: "2026-06-16T09:00:00.000Z",
    updated_at_iso8601: "2026-06-16T09:00:00.000Z",
    revoked_at_iso8601: null,
    expires_at_iso8601: null,
    ...overrides
  };
}

const fixture = Object.freeze({
  actor: Object.freeze({
    actor_type: "coach",
    user_id: "coach_001"
  }),
  unassigned_actor: Object.freeze({
    actor_type: "coach",
    user_id: "coach_002"
  }),
  athlete_actor: Object.freeze({
    actor_type: "athlete",
    user_id: "athlete_001"
  }),
  state_payload: Object.freeze({
    session_id: "session_live_001",
    status: "in_progress",
    started_at: "2026-06-16T10:00:00.000Z",
    last_event_at: "2026-06-16T10:08:00.000Z",
    current_work_item_id: "work_002",
    counts: Object.freeze({
      total: 3,
      completed: 1,
      skipped: 0,
      partial: 0,
      pending: 2
    }),
    work_items: Object.freeze({
      work_001: Object.freeze({ work_item_id: "work_001", status: "completed", label: "Work item 1" }),
      work_002: Object.freeze({ work_item_id: "work_002", status: "pending", label: "Work item 2" }),
      work_003: Object.freeze({ work_item_id: "work_003", status: "pending", label: "Work item 3" })
    })
  }),
  events_payload: Object.freeze({
    events: Object.freeze([
      Object.freeze({
        event_id: "event_001",
        event_type: "SESSION_START",
        seq: 1,
        recorded_at: "2026-06-16T10:00:00.000Z"
      }),
      Object.freeze({
        event_id: "event_002",
        event_type: "COMPLETE_WORK_ITEM",
        seq: 2,
        recorded_at: "2026-06-16T10:08:00.000Z",
        work_item_id: "work_001"
      })
    ])
  }),
  relationships: Object.freeze([acceptedRelationship()])
});

function requestFor(actor = fixture.actor, overrides = {}) {
  return {
    actor: clone(actor),
    target_athlete_user_id: "athlete_001",
    session_id: "session_live_001",
    relationships: clone(fixture.relationships),
    state_payload: clone(fixture.state_payload),
    events_payload: clone(fixture.events_payload),
    ...overrides
  };
}

test("S-V1-43 exposes a closed live session status contract", () => {
  assert.equal(liveSessionStatusContract.surface_id, "v1_live_session_status");
  assert.equal(liveSessionStatusContract.slice_id, "S-V1-43");
  assert.equal(liveSessionStatusContract.permission_surface_id, "live_session_status");
  assert.equal(liveSessionStatusContract.access_policy, "assigned_coach_only");
  assert.equal(liveSessionStatusContract.mutation_policy, "read_only");
  assert.deepEqual(liveSessionStatusContract.allowed_statuses, [
    "not_started",
    "in_progress",
    "split",
    "returned",
    "partially_completed",
    "completed",
    "stopped"
  ]);
});

test("S-V1-43 assigned coach can view live status only", () => {
  const readModel = buildLiveSessionStatus(requestFor());

  assert.equal(readModel.access.reason, "coach_assigned_to_athlete");
  assert.equal(readModel.access.product_permission_state_only, true);
  assert.equal(readModel.access.engine_decision, false);
  assert.equal(readModel.access.engine_visible, false);
  assert.equal(readModel.status, "in_progress");
  assert.equal(readModel.status_label, "in_progress");
  assert.equal(readModel.started_at, "2026-06-16T10:00:00.000Z");
  assert.equal(readModel.last_event_at, "2026-06-16T10:08:00.000Z");
  assert.equal(readModel.current_work_item.work_item_id, "work_002");
  assert.equal(readModel.last_work_item.work_item_id, "work_001");
  assert.deepEqual(readModel.counts, {
    completed: 1,
    skipped: 0,
    partial: 0,
    substituted: 0
  });
});

test("S-V1-43 unassigned coach and athlete actor are rejected without mutating input", () => {
  for (const request of [
    requestFor(fixture.unassigned_actor),
    requestFor(fixture.athlete_actor),
    requestFor(fixture.actor, { relationships: [] })
  ]) {
    const before = clone(request);
    const result = tryBuildLiveSessionStatus(request);

    assert.equal(result.ok, false);
    assert.equal(result.error.product_auth_failure, true);
    assert.equal(result.error.engine_decision, false);
    assert.equal(result.error.engine_visible, false);
    assert.deepEqual(request, before);
  }
});

test("S-V1-43 watching does not alter reducer output or session state", () => {
  const request = requestFor();
  const beforeState = stableLiveSessionStatusJson(request.state_payload);
  const beforeEvents = stableLiveSessionStatusJson(request.events_payload);

  const first = buildLiveSessionStatus(request);
  const second = buildLiveSessionStatus(clone(request));

  assert.equal(stableLiveSessionStatusJson(request.state_payload), beforeState);
  assert.equal(stableLiveSessionStatusJson(request.events_payload), beforeEvents);
  assert.equal(first.read_model_hash, second.read_model_hash);
  assert.equal(stableLiveSessionStatusJson(first), stableLiveSessionStatusJson(second));

  assert.deepEqual(first.mutation_contract, {
    read_only: true,
    appends_runtime_event: false,
    mutates_session_state: false,
    calls_engine: false,
    coach_control_surface_present: false,
    coach_contact_surface_present: false,
    media_stream_surface_present: false,
    coach_substitution_control_present: false
  });
});

test("S-V1-43 status labels are factual closed values only", () => {
  for (const status of liveSessionStatusContract.allowed_statuses) {
    const request = requestFor(fixture.actor, {
      state_payload: {
        ...clone(fixture.state_payload),
        status
      }
    });

    const readModel = buildLiveSessionStatus(request);
    assert.equal(readModel.status, status);
    assert.equal(readModel.status_label, status);
  }
});

test("S-V1-43 API and UI return read-only factual live status", () => {
  const response = handleLiveSessionStatusRequest({ body: requestFor() });

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.read_model.surface_id, liveSessionStatusContract.surface_id);
  assert.equal(response.body.ui_model.presentation_contract.read_only, true);
  assert.equal(response.body.ui_model.presentation_contract.coach_action_controls_present, false);
  assert.equal(response.body.ui_model.presentation_contract.coach_contact_surface_present, false);
  assert.equal(response.body.ui_model.presentation_contract.media_stream_surface_present, false);
  assert.equal(response.body.ui_model.presentation_contract.coach_substitution_control_present, false);
  assert.equal(response.body.ui_model.presentation_contract.calls_engine, false);
  assert.ok(response.body.ui_model.copy_ids.includes(LIVE_SESSION_STATUS_COPY_IDS.readOnlyNotice));

  const rendered = renderLiveSessionStatus(response.body.read_model);
  assert.equal(rendered.display.status, "in_progress");
  assert.equal(rendered.display.event_count, 2);
});

test("S-V1-43 relationship permission guard admits live_session_status only for valid relationship scope", () => {
  const allowed = canCoachAthleteAccess({
    actor: clone(fixture.actor),
    target_athlete_user_id: "athlete_001",
    surface_id: "live_session_status",
    relationships: clone(fixture.relationships)
  });

  assert.equal(allowed.allowed, true);
  assert.equal(allowed.engine_decision, false);
  assert.equal(allowed.engine_visible, false);

  const denied = canCoachAthleteAccess({
    actor: clone(fixture.unassigned_actor),
    target_athlete_user_id: "athlete_001",
    surface_id: "live_session_status",
    relationships: clone(fixture.relationships)
  });

  assert.equal(denied.allowed, false);
  assert.equal(denied.product_auth_failure, true);
  assert.equal(denied.engine_decision, false);
});

test("S-V1-43 copy is factual and claim-safe", () => {
  const copy = JSON.parse(fs.readFileSync("copy/live_session_status_copy.json", "utf8"));
  const serialised = JSON.stringify(copy).toLowerCase();

  assert.equal(copy.copy_surface_id, "live_session_status");

  for (const copyId of Object.values(LIVE_SESSION_STATUS_COPY_IDS)) {
    assert.match(JSON.stringify(copy), new RegExp(copyId));
  }

  for (const blocked of [
    "recommend",
    "optimal",
    "readiness",
    "fatigue",
    "risk",
    "safe",
    "intervene",
    "message athlete",
    "video call",
    "override",
    "trigger substitution"
  ]) {
    assert.equal(serialised.includes(blocked), false, `copy must not include ${blocked}`);
  }
});