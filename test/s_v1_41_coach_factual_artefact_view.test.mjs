import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  CoachFactualArtefactViewError,
  buildCoachFactualArtefactView,
  coachFactualArtefactViewContract,
  stableCoachFactualArtefactViewJson,
  tryBuildCoachFactualArtefactView
} from "../src/coachFactualArtefactView.mjs";
import { handleCoachFactualArtefactViewRequest } from "../src/api/coachFactualArtefactViewApi.mjs";
import { renderCoachFactualArtefactView } from "../src/coachFactualArtefactViewUiRenderer.mjs";
import { canCoachAthleteAccess } from "../src/relationshipPermissionGuards.mjs";

const fixture = JSON.parse(
  fs.readFileSync("ci/fixtures/v1_coach_factual_artefact_view/s_v1_41_coach_factual_artefact_view_cases.json", "utf8")
);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function requestFor(actorKey, overrides = {}) {
  return {
    actor: clone(fixture.actors[actorKey]),
    target_athlete_user_id: overrides.target_athlete_user_id ?? "athlete_001",
    relationships: clone(overrides.relationships ?? fixture.relationships),
    artefacts: clone(overrides.artefacts ?? fixture.artefacts)
  };
}

test("S-V1-41 exposes a closed coach factual artefact view contract", () => {
  assert.equal(coachFactualArtefactViewContract.surface_id, "v1_coach_factual_artefact_view");
  assert.equal(coachFactualArtefactViewContract.slice_id, "S-V1-41");
  assert.equal(coachFactualArtefactViewContract.permission_surface_id, "coach_factual_artefact_view");
  assert.equal(coachFactualArtefactViewContract.access_policy, "assigned_coach_only");
  assert.equal(coachFactualArtefactViewContract.read_model_policy, "recorded_facts_only");
  assert.equal(coachFactualArtefactViewContract.mutation_policy, "read_only");
});

test("S-V1-41 assigned coach sees factual artefacts for assigned athlete only", () => {
  const readModel = buildCoachFactualArtefactView(requestFor("assigned_coach"));

  assert.equal(readModel.surface_id, "v1_coach_factual_artefact_view");
  assert.equal(readModel.actor_type, "coach");
  assert.equal(readModel.coach_user_id, "coach_001");
  assert.equal(readModel.target_athlete_user_id, "athlete_001");
  assert.equal(readModel.access.reason, "coach_assigned_to_athlete");
  assert.equal(readModel.access.relationship_id, "relationship_001");
  assert.equal(readModel.artefact_count, 1);
  assert.deepEqual(readModel.artefacts.map((artefact) => artefact.artefact_id), ["artefact_001"]);
  assert.equal(readModel.artefacts[0].runtime_event_count, 2);
  assert.deepEqual(readModel.artefacts[0].runtime_events.map((event) => event.seq), [1, 2]);
  assert.equal(readModel.mutation_contract.read_only, true);
  assert.equal(readModel.mutation_contract.appends_runtime_event, false);
  assert.equal(readModel.mutation_contract.mutates_session_state, false);
  assert.equal(readModel.mutation_contract.calls_engine, false);
  assert.equal(readModel.mutation_contract.reads_coach_notes, false);
});

test("S-V1-41 unassigned coach view is rejected", () => {
  const result = tryBuildCoachFactualArtefactView(requestFor("unassigned_coach"));

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, "coach_not_assigned_to_athlete");
  assert.equal(result.error.product_auth_failure, true);
  assert.equal(result.error.product_permission_state_only, true);
  assert.equal(result.error.engine_decision, false);
  assert.equal(result.error.engine_visible, false);
});

test("S-V1-41 athlete actor is rejected from coach factual artefact view", () => {
  assert.throws(
    () => buildCoachFactualArtefactView(requestFor("athlete_owner")),
    (error) => {
      assert.equal(error instanceof CoachFactualArtefactViewError, true);
      assert.equal(error.reason, "coach_factual_artefact_view_coach_actor_required");
      assert.equal(error.engine_decision, false);
      assert.equal(error.engine_visible, false);
      return true;
    }
  );
});

test("S-V1-41 read model is byte-stable for the same explicit input", () => {
  const first = buildCoachFactualArtefactView(requestFor("assigned_coach"));
  const second = buildCoachFactualArtefactView(requestFor("assigned_coach"));

  assert.equal(stableCoachFactualArtefactViewJson(first), stableCoachFactualArtefactViewJson(second));
  assert.equal(first.read_model_hash, second.read_model_hash);
});

test("S-V1-41 API returns permitted view and maps refused view to product auth failure", () => {
  const okResponse = handleCoachFactualArtefactViewRequest({
    method: "POST",
    body: requestFor("assigned_coach")
  });

  assert.equal(okResponse.status, 200);
  assert.equal(okResponse.body.ok, true);
  assert.equal(okResponse.body.read_model.artefact_count, 1);

  const deniedResponse = handleCoachFactualArtefactViewRequest({
    method: "POST",
    body: requestFor("unassigned_coach")
  });

  assert.equal(deniedResponse.status, 403);
  assert.equal(deniedResponse.body.ok, false);
  assert.equal(deniedResponse.body.error.product_auth_failure, true);
  assert.equal(deniedResponse.body.error.engine_decision, false);
  assert.equal(deniedResponse.body.error.engine_visible, false);
});

test("S-V1-41 UI renderer uses copy ids and recorded row facts only", () => {
  const readModel = buildCoachFactualArtefactView(requestFor("assigned_coach"));
  const ui = renderCoachFactualArtefactView(readModel);

  assert.equal(ui.ok, true);
  assert.equal(ui.ui_surface_id, "coach_factual_artefact_view_ui");
  assert.equal(ui.artefact_count, 1);
  assert.deepEqual(ui.rows.map((row) => row.artefact_id), ["artefact_001"]);
  assert.ok(ui.copy_ids.includes("COACH_FACTUAL_ARTEFACT_VIEW_TITLE"));
  assert.ok(ui.copy_ids.includes("COACH_FACTUAL_ARTEFACT_VIEW_READ_ONLY_NOTICE"));
  assert.ok(ui.rows[0].copy_ids.includes("COACH_FACTUAL_ARTEFACT_VIEW_RUNTIME_EVENT_COUNT_LABEL"));
});

test("S-V1-41 refuses coach note fields inside factual artefact view input", () => {
  const request = requestFor("assigned_coach");
  request.coach_notes = [];

  const result = tryBuildCoachFactualArtefactView(request);

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, "coach_factual_artefact_view_forbidden_input_field");
  assert.equal(result.error.details.path, "coach_notes");
});

test("S-V1-41 relationship permission guard admits coach_factual_artefact_view only for valid relationship scope", () => {
  const allowed = canCoachAthleteAccess({
    actor: clone(fixture.actors.assigned_coach),
    target_athlete_user_id: "athlete_001",
    surface_id: "coach_factual_artefact_view",
    relationships: clone(fixture.relationships)
  });

  const denied = canCoachAthleteAccess({
    actor: clone(fixture.actors.unassigned_coach),
    target_athlete_user_id: "athlete_001",
    surface_id: "coach_factual_artefact_view",
    relationships: clone(fixture.relationships)
  });

  assert.equal(allowed.allowed, true);
  assert.equal(allowed.reason, "coach_assigned_to_athlete");
  assert.equal(denied.allowed, false);
  assert.equal(denied.reason, "coach_not_assigned_to_athlete");
});

test("S-V1-41 source and copy keep factual artefact view outside engine and coach notes", () => {
  const source = fs.readFileSync("src/coachFactualArtefactView.mjs", "utf8");
  const apiSource = fs.readFileSync("src/api/coachFactualArtefactViewApi.mjs", "utf8");
  const uiSource = fs.readFileSync("src/coachFactualArtefactViewUiRenderer.mjs", "utf8");
  const copy = fs.readFileSync("copy/coach_factual_artefact_view_copy.json", "utf8");

  for (const text of [source, apiSource, uiSource]) {
    assert.equal(text.includes("@kolosseum/engine"), false);
    assert.equal(text.includes("from \"../engine"), false);
    assert.equal(text.includes("from \"./engine"), false);
  }

  const serialisedCopy = copy.toLowerCase();
  for (const blocked of ["best", "optimal", "diagnose", "prescribe"]) {
    assert.equal(serialisedCopy.includes(blocked), false);
  }
});