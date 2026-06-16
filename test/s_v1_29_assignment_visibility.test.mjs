import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  assignmentVisibilityContract,
  buildAssignmentVisibilityEngineTruthProbe,
  buildAssignmentVisibilityReadModel,
  tryBuildAssignmentVisibilityReadModel
} from "../src/programmeAssignmentVisibility.mjs";
import { handleProgrammeAssignmentVisibilityRequest } from "../src/api/programmeAssignmentVisibilityApi.mjs";

const fixture = JSON.parse(
  fs.readFileSync("ci/fixtures/v1_assignment_visibility/s_v1_29_assignment_visibility_cases.json", "utf8")
);

const negativeFixture = JSON.parse(
  fs.readFileSync("ci/fixtures/v1_assignment_visibility_negative/s_v1_29_assignment_visibility_negative.json", "utf8")
);

function ids(readModel) {
  return readModel.assignments.map((assignment) => assignment.assignment_id);
}

test("S-V1-29 exposes a closed assignment visibility contract surface", () => {
  assert.equal(assignmentVisibilityContract.surface_id, "programme_assignment_visibility");
  assert.equal(assignmentVisibilityContract.version, "1.0.0");
  assert.equal(assignmentVisibilityContract.failure_code, "assignment_visibility_product_auth_failure");
  assert.equal(assignmentVisibilityContract.failure_copy_id, "ASSIGNMENT_VISIBILITY_ACCESS_DENIED");
  assert.equal(assignmentVisibilityContract.compile_input_status, "not_consumed_until_declared_compile_input");

  for (const key of ["actor", "assignments", "relationships"]) {
    assert.ok(assignmentVisibilityContract.required_input_keys.includes(key));
  }
});

test("S-V1-29 coach sees assignments for assigned accepted athletes only", () => {
  const readModel = buildAssignmentVisibilityReadModel({
    actor: fixture.coach_actor,
    assignments: fixture.valid_assignments,
    relationships: fixture.relationships
  });

  assert.equal(readModel.actor_type, "coach");
  assert.equal(readModel.actor_id, "coach_001");
  assert.deepEqual(ids(readModel), fixture.expected_coach_visible_assignment_ids);
  assert.equal(readModel.visible_assignment_count, 1);
  assert.equal(readModel.assignments[0].visibility_reason, "coach_assigned_athlete");
  assert.equal(readModel.assignments[0].engine_visible, false);
  assert.equal(readModel.compile_input_status, "not_consumed_until_declared_compile_input");
});

test("S-V1-29 coach cannot see assignments for another coach or revoked relationship", () => {
  const readModel = buildAssignmentVisibilityReadModel({
    actor: fixture.coach_actor,
    assignments: fixture.valid_assignments,
    relationships: fixture.relationships
  });

  assert.equal(ids(readModel).includes("assignment_002"), false);
  assert.equal(ids(readModel).includes("assignment_003"), false);
});

test("S-V1-29 athlete sees own assignments only", () => {
  const readModel = buildAssignmentVisibilityReadModel({
    actor: fixture.athlete_actor,
    assignments: fixture.valid_assignments,
    relationships: fixture.relationships
  });

  assert.equal(readModel.actor_type, "athlete");
  assert.equal(readModel.actor_id, "athlete_002");
  assert.deepEqual(ids(readModel), fixture.expected_athlete_visible_assignment_ids);
  assert.equal(readModel.visible_assignment_count, 1);
  assert.equal(readModel.assignments[0].visibility_reason, "athlete_own_assignment");
});

test("S-V1-29 athlete viewing another athlete returns no assignment records", () => {
  const negativeCase = negativeFixture.cases.find((item) => item.case_id === "athlete_attempts_other_assignment");

  const readModel = buildAssignmentVisibilityReadModel(negativeCase.input);

  assert.equal(readModel.visible_assignment_count, negativeCase.expected_visible_count);
  assert.deepEqual(readModel.assignments, []);
});

test("S-V1-29 visibility refuses malformed input and forbidden broad scope fields", () => {
  const missingRelationships = negativeFixture.cases.find((item) => item.case_id === "missing_relationship_records");
  const missingResult = tryBuildAssignmentVisibilityReadModel(missingRelationships.input);

  assert.equal(missingResult.ok, false);
  assert.equal(missingResult.error.reason, missingRelationships.expected_reason);
  assert.equal(missingResult.error.product_auth_failure, true);
  assert.equal(missingResult.error.engine_decision, false);
  assert.equal(missingResult.error.engine_visible, false);

  const forbidden = negativeFixture.cases.find((item) => item.case_id === "forbidden_team_assignment_field");
  const forbiddenResult = tryBuildAssignmentVisibilityReadModel(forbidden.input);

  assert.equal(forbiddenResult.ok, false);
  assert.equal(forbiddenResult.error.reason, forbidden.expected_reason);
});

test("S-V1-29 assignment visibility state does not alter compile probe", () => {
  const first = buildAssignmentVisibilityEngineTruthProbe({
    marker: "first",
    visible_assignment_count: 0
  });

  const second = buildAssignmentVisibilityEngineTruthProbe({
    marker: "second",
    visible_assignment_count: 999
  });

  assert.equal(first.compile_input_status, "not_consumed_until_declared_compile_input");
  assert.equal(second.compile_input_status, "not_consumed_until_declared_compile_input");
  assert.equal(first.engine_visible, false);
  assert.equal(second.engine_visible, false);
  assert.deepEqual(first.assignment_probe, second.assignment_probe);
});

test("S-V1-29 API adapter returns permitted read model and maps denied visibility to product auth failure", () => {
  const okResponse = handleProgrammeAssignmentVisibilityRequest({
    method: "POST",
    body: {
      actor: fixture.coach_actor,
      assignments: fixture.valid_assignments,
      relationships: fixture.relationships
    }
  });

  assert.equal(okResponse.status, 200);
  assert.equal(okResponse.body.ok, true);
  assert.equal(okResponse.body.read_model.visible_assignment_count, 1);

  const deniedResponse = handleProgrammeAssignmentVisibilityRequest({
    method: "POST",
    body: {
      actor: {
        actor_type: "coach"
      },
      assignments: [],
      relationships: []
    }
  });

  assert.equal(deniedResponse.status, 403);
  assert.equal(deniedResponse.body.ok, false);
  assert.equal(deniedResponse.body.error.product_auth_failure, true);
  assert.equal(deniedResponse.body.error.engine_decision, false);
  assert.equal(deniedResponse.body.error.engine_visible, false);
});

test("S-V1-29 documentation binds assignment visibility without aggregate or engine mutation scope", () => {
  const doc = fs.readFileSync("docs/v1/V1_ASSIGNMENT_VISIBILITY.md", "utf8");

  assert.match(doc, /Coach sees assigned athletes only/);
  assert.match(doc, /Athlete sees own assignments only/);
  assert.match(doc, /Visibility state does not alter compile/);
  assert.match(doc, /S-V1-15/);
  assert.match(doc, /S-V1-28/);
});
