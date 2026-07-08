import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  ATHLETE_FACTUAL_HISTORY_COPY_IDS,
  AthleteFactualHistoryError,
  assertAthleteFactualHistoryAccess,
  athleteFactualHistoryContract,
  buildAthleteFactualHistoryReadModel,
  buildAthleteFactualHistoryViewModel,
  stableAthleteFactualHistoryJson,
  tryBuildAthleteFactualHistoryReadModel
} from "../src/athleteFactualHistory.mjs";
import { handleAthleteFactualHistoryRequest } from "../src/api/athleteFactualHistoryApi.mjs";

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), relativePath), "utf8"));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const fixture = readJson("ci/fixtures/v1_athlete_factual_history/s_v1_40_athlete_factual_history_cases.json");

function requestFor(actorKey, overrides = {}) {
  return {
    actor: clone(fixture.actors[actorKey]),
    athlete_user_id: fixture.athlete_user_id,
    relationships: clone(overrides.relationships ?? fixture.relationships),
    sessions: clone(overrides.sessions ?? fixture.sessions),
    runtime_events: clone(overrides.runtime_events ?? fixture.runtime_events)
  };
}

function walkKeys(value, visit) {
  if (Array.isArray(value)) {
    for (const entry of value) walkKeys(entry, visit);
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    visit(key);
    walkKeys(child, visit);
  }
}

test("S-V1-40 exposes a closed athlete factual history contract", () => {
  assert.equal(athleteFactualHistoryContract.surface_id, "v1_athlete_factual_history");
  assert.equal(athleteFactualHistoryContract.slice_id, "S-V1-40");
  assert.equal(athleteFactualHistoryContract.permission_surface_id, "factual_history");
  assert.equal(athleteFactualHistoryContract.read_model_policy, "recorded_facts_only");
  assert.equal(athleteFactualHistoryContract.mutation_policy, "read_only");
});

test("S-V1-40 athlete can view own recorded history", () => {
  const readModel = buildAthleteFactualHistoryReadModel(requestFor("athlete_owner"));

  assert.equal(readModel.athlete_user_id, "athlete_001");
  assert.equal(readModel.viewer.actor_type, "athlete");
  assert.equal(readModel.viewer.access_reason, "athlete_own_data");
  assert.equal(readModel.recorded_summary.session_count, fixture.expected.session_count);
  assert.equal(readModel.recorded_summary.event_count, fixture.expected.event_count);
  assert.equal(readModel.recorded_summary.completed_item_count, fixture.expected.completed_item_count);
  assert.equal(readModel.recorded_summary.skipped_item_count, fixture.expected.skipped_item_count);
  assert.equal(readModel.recorded_summary.partial_item_count, fixture.expected.partial_item_count);
  assert.equal(readModel.sessions[0].session_id, fixture.expected.first_visible_session_id);
  assert.equal(readModel.mutation_contract.read_only, true);
  assert.equal(readModel.mutation_contract.writes_storage, false);
  assert.equal(readModel.mutation_contract.appends_runtime_event, false);
  assert.equal(readModel.mutation_contract.calls_engine, false);
});

test("S-V1-40 assigned coach can view assigned athlete factual history through scoped history permission", () => {
  const readModel = buildAthleteFactualHistoryReadModel(requestFor("assigned_coach"));

  assert.equal(readModel.viewer.actor_type, "coach");
  assert.equal(readModel.viewer.access_reason, "coach_assigned_to_athlete");
  assert.equal(readModel.viewer.relationship_id, "link_001");
  assert.equal(readModel.recorded_summary.session_count, fixture.expected.session_count);
});

test("S-V1-40 unassigned viewers are rejected without mutating input", () => {
  for (const testCase of fixture.negative_cases) {
    const request = requestFor(testCase.actor_key, {
      relationships: testCase.relationships ?? fixture.relationships
    });
    const before = clone(request);

    assert.throws(
      () => assertAthleteFactualHistoryAccess(request),
      (error) => {
        assert.equal(error instanceof AthleteFactualHistoryError, true);
        assert.equal(error.code, "athlete_factual_history_product_auth_failure");
        assert.equal(error.reason, testCase.expected_reason);
        assert.equal(error.product_auth_failure, true);
        assert.equal(error.engine_decision, false);
        assert.equal(error.engine_visible, false);
        return true;
      },
      testCase.case_id
    );

    assert.deepEqual(request, before, `${testCase.case_id} must not mutate input`);
  }
});

test("S-V1-40 read model includes only target athlete recorded sessions and events", () => {
  const readModel = buildAthleteFactualHistoryReadModel(requestFor("athlete_owner"));

  assert.deepEqual(readModel.sessions.map((session) => session.session_id), ["session_001", "session_002"]);
  assert.equal(readModel.sessions.some((session) => session.session_id === "session_other"), false);

  const allEventIds = readModel.sessions.flatMap((session) => session.recorded_events.map((event) => event.event_id));
  assert.equal(allEventIds.includes("event_other"), false);
  assert.deepEqual(readModel.sessions[0].recorded_events.map((event) => event.seq), [1, 2, 3, 4]);
});

test("S-V1-40 read model remains byte-stable for same explicit input", () => {
  const request = requestFor("athlete_owner");
  const first = buildAthleteFactualHistoryReadModel(request);
  const second = buildAthleteFactualHistoryReadModel(clone(request));

  assert.equal(stableAthleteFactualHistoryJson(first), stableAthleteFactualHistoryJson(second));
  assert.equal(first.read_model_hash, second.read_model_hash);
});

test("S-V1-40 read model omits interpretation-style fields", () => {
  const readModel = buildAthleteFactualHistoryReadModel(requestFor("athlete_owner"));
  const blockedFragments = [
    "read" + "iness",
    "fat" + "igue",
    "rank" + "ing",
    "effect" + "iveness",
    "reco" + "mmend",
    "infer" + "ence",
    "infer" + "red",
    "adherence"
  ];

  walkKeys(readModel, (key) => {
    const lowerKey = key.toLowerCase();
    for (const fragment of blockedFragments) {
      assert.equal(lowerKey.includes(fragment), false, `${key} must not appear in factual history read model`);
    }
  });

  assert.equal(readModel.interpretation_contract.recorded_facts_only, true);
  assert.equal(readModel.interpretation_contract.interpretation_fields_present, false);
  assert.equal(readModel.interpretation_contract.list_ordered_output, false);
  assert.equal(readModel.interpretation_contract.aggregate_output, false);
});

test("S-V1-40 API adapter returns read model and UI model or product permission failure", () => {
  const okResponse = handleAthleteFactualHistoryRequest({
    method: "POST",
    body: requestFor("athlete_owner")
  });

  assert.equal(okResponse.status, 200);
  assert.equal(okResponse.body.ok, true);
  assert.equal(okResponse.body.read_model.recorded_summary.session_count, fixture.expected.session_count);
  assert.equal(okResponse.body.view_model.surface_id, "v1_athlete_factual_history_view");
  assert.equal(okResponse.body.view_model.presentation_contract.read_only, true);

  const deniedResponse = handleAthleteFactualHistoryRequest({
    method: "POST",
    body: requestFor("unassigned_coach")
  });

  assert.equal(deniedResponse.status, 403);
  assert.equal(deniedResponse.body.ok, false);
  assert.equal(deniedResponse.body.error.product_auth_failure, true);
  assert.equal(deniedResponse.body.error.engine_decision, false);
  assert.equal(deniedResponse.body.error.engine_visible, false);
});

test("S-V1-40 UI model is read-only and backed by copy ids", () => {
  const readModel = buildAthleteFactualHistoryReadModel(requestFor("athlete_owner"));
  const viewModel = buildAthleteFactualHistoryViewModel(readModel);

  assert.equal(viewModel.surface_id, "v1_athlete_factual_history_view");
  assert.deepEqual(viewModel.copy_ids, Object.values(ATHLETE_FACTUAL_HISTORY_COPY_IDS));
  assert.equal(viewModel.sections.length, 2);
  assert.equal(viewModel.presentation_contract.read_only, true);
  assert.equal(viewModel.presentation_contract.displays_recorded_values_only, true);
  assert.equal(viewModel.presentation_contract.writes_storage, false);
  assert.equal(viewModel.presentation_contract.calls_engine, false);
});

test("S-V1-40 copy lint keeps athlete history copy factual", () => {
  const copyEntries = readJson("copy/athlete_factual_history_copy.json");
  const copyIds = new Set(copyEntries.map((entry) => entry.copy_id));
  const blockedFragments = [
    "read" + "iness",
    "fat" + "igue",
    "rank",
    "effect" + "ive",
    "reco" + "mmend",
    "adherence",
    "good",
    "bad",
    "poor",
    "better",
    "safe"
  ];

  for (const copyId of Object.values(ATHLETE_FACTUAL_HISTORY_COPY_IDS)) {
    assert.equal(copyIds.has(copyId), true, `${copyId} missing from copy surface`);
  }

  for (const entry of copyEntries) {
    assert.equal(entry.surface_id, "athlete_factual_history");
    assert.equal(typeof entry.text, "string");
    assert.equal(entry.text.length > 0, true);

    const text = entry.text.toLowerCase();
    for (const fragment of blockedFragments) {
      assert.equal(text.includes(fragment), false, `${entry.copy_id} contains blocked copy fragment ${fragment}`);
    }
  }
});

test("S-V1-40 try wrapper returns stable denied result", () => {
  const result = tryBuildAthleteFactualHistoryReadModel(requestFor("other_athlete"));

  assert.equal(result.ok, false);
  assert.equal(result.error.code, "athlete_factual_history_product_auth_failure");
  assert.equal(result.error.reason, "athlete_not_own_data");
  assert.equal(result.error.product_auth_failure, true);
  assert.equal(result.error.engine_decision, false);
  assert.equal(result.error.engine_visible, false);
});
