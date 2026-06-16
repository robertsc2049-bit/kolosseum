import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  SessionStateEventsReadbackError,
  assertSessionReadbackAccess,
  buildSessionEventsReadback,
  buildSessionStateReadback,
  decideSessionReadbackAccess,
  sessionStateEventsReadbackContract,
  stableSessionReadbackJson
} from "../src/sessionStateEventsReadback.mjs";
import { canCoachAthleteAccess } from "../src/relationshipPermissionGuards.mjs";

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), relativePath), "utf8"));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const fixture = readJson("ci/fixtures/v1_session_state_events_readback/s_v1_39_session_state_events_readback_cases.json");

function requestFor(actorKey, overrides = {}) {
  return {
    actor: clone(fixture.actors[actorKey]),
    session: clone(fixture.session),
    relationships: clone(overrides.relationships ?? fixture.relationships),
    state_payload: clone(fixture.state_payload),
    events_payload: clone(fixture.events_payload)
  };
}

test("S-V1-39 exposes a closed session state and events readback contract", () => {
  assert.equal(sessionStateEventsReadbackContract.surface_id, "v1_session_state_events_readback");
  assert.equal(sessionStateEventsReadbackContract.slice_id, "S-V1-39");
  assert.equal(sessionStateEventsReadbackContract.permission_surface_id, "session_readback");
  assert.deepEqual(sessionStateEventsReadbackContract.readback_types, ["state", "events"]);
  assert.equal(sessionStateEventsReadbackContract.mutation_policy, "read_only");
});

test("S-V1-39 athlete can read own session state and events", () => {
  const state = buildSessionStateReadback(requestFor("athlete_owner"));
  const events = buildSessionEventsReadback(requestFor("athlete_owner"));

  assert.equal(state.session_id, "session_s_v1_39_001");
  assert.equal(state.readback_type, "state");
  assert.equal(state.access.reason, "athlete_own_data");
  assert.equal(state.mutation_contract.read_only, true);
  assert.equal(state.mutation_contract.appends_runtime_event, false);
  assert.equal(state.mutation_contract.mutates_session_state, false);
  assert.equal(state.mutation_contract.calls_engine, false);

  assert.equal(events.session_id, "session_s_v1_39_001");
  assert.equal(events.readback_type, "events");
  assert.equal(events.access.reason, "athlete_own_data");
  assert.equal(events.payload.events.length, 2);
});

test("S-V1-39 assigned coach can read assigned athlete session state and events", () => {
  const state = buildSessionStateReadback(requestFor("assigned_coach"));
  const events = buildSessionEventsReadback(requestFor("assigned_coach"));

  assert.equal(state.access.reason, "coach_assigned_to_athlete");
  assert.equal(state.access.relationship_id, "relationship_001");
  assert.equal(events.access.reason, "coach_assigned_to_athlete");
  assert.equal(events.access.relationship_id, "relationship_001");
});

test("S-V1-39 unassigned actors are rejected without mutating readback payloads", () => {
  for (const testCase of fixture.negative_cases) {
    const request = requestFor(testCase.actor_key, {
      relationships: testCase.relationships ?? fixture.relationships
    });
    const before = clone(request);

    assert.throws(
      () => assertSessionReadbackAccess(request),
      (error) => {
        assert.equal(error instanceof SessionStateEventsReadbackError, true);
        assert.equal(error.code, "session_state_events_readback_permission_denied");
        assert.equal(error.reason, testCase.expected_reason);
        assert.equal(error.engine_decision, false);
        assert.equal(error.engine_visible, false);
        return true;
      },
      testCase.case_id
    );

    assert.deepEqual(request, before, `${testCase.case_id} must not mutate input`);
  }
});

test("S-V1-39 state readback is byte-stable for the same explicit input", () => {
  const request = requestFor("assigned_coach");
  const first = buildSessionStateReadback(request);
  const second = buildSessionStateReadback(clone(request));

  assert.equal(stableSessionReadbackJson(first), stableSessionReadbackJson(second));
  assert.equal(first.payload_sha256, second.payload_sha256);
});

test("S-V1-39 events readback is byte-stable and preserves seq order", () => {
  const request = requestFor("assigned_coach");
  const first = buildSessionEventsReadback(request);
  const second = buildSessionEventsReadback(clone(request));

  assert.equal(stableSessionReadbackJson(first), stableSessionReadbackJson(second));
  assert.equal(first.payload_sha256, second.payload_sha256);
  assert.deepEqual(first.payload.events.map((event) => event.seq), [1, 2]);
});

test("S-V1-39 events readback rejects out-of-order event rows", () => {
  const request = requestFor("assigned_coach");
  request.events_payload.events = [...request.events_payload.events].reverse();

  assert.throws(
    () => buildSessionEventsReadback(request),
    (error) => {
      assert.equal(error instanceof SessionStateEventsReadbackError, true);
      assert.equal(error.reason, "readback_events_not_seq_ordered");
      return true;
    }
  );
});

test("S-V1-39 relationship permission guard admits session_readback surface only for valid relationship scope", () => {
  const allowed = canCoachAthleteAccess({
    actor: clone(fixture.actors.assigned_coach),
    target_athlete_user_id: "athlete_001",
    surface_id: "session_readback",
    relationships: clone(fixture.relationships)
  });

  const denied = canCoachAthleteAccess({
    actor: clone(fixture.actors.unassigned_coach),
    target_athlete_user_id: "athlete_001",
    surface_id: "session_readback",
    relationships: clone(fixture.relationships)
  });

  assert.equal(allowed.allowed, true);
  assert.equal(allowed.reason, "coach_assigned_to_athlete");
  assert.equal(denied.allowed, false);
  assert.equal(denied.reason, "coach_not_assigned_to_athlete");
});
