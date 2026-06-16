// @law: Repo Governance
// @severity: medium
// @scope: repo
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";

import {
  assignmentVisibilityContract,
  buildAssignmentVisibilityEngineTruthProbe,
  buildAssignmentVisibilityReadModel,
  tryBuildAssignmentVisibilityReadModel
} from "../../src/programmeAssignmentVisibility.mjs";
import { handleProgrammeAssignmentVisibilityRequest } from "../../src/api/programmeAssignmentVisibilityApi.mjs";

const guard = "S-V1-29";
const TOKEN = "CI_V1_ASSIGNMENT_VISIBILITY";

const requiredFiles = [
  "src/programmeAssignmentVisibility.mjs",
  "src/api/programmeAssignmentVisibilityApi.mjs",
  "test/s_v1_29_assignment_visibility.test.mjs",
  "ci/guards/s_v1_29_assignment_visibility_guard.mjs",
  "docs/v1/V1_ASSIGNMENT_VISIBILITY.md",
  "ci/fixtures/v1_assignment_visibility/s_v1_29_assignment_visibility_cases.json",
  "ci/fixtures/v1_assignment_visibility_negative/s_v1_29_assignment_visibility_negative.json"
];

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) {
    throw new Error(`${TOKEN}: missing required file ${file}`);
  }
}

const fixture = JSON.parse(
  fs.readFileSync("ci/fixtures/v1_assignment_visibility/s_v1_29_assignment_visibility_cases.json", "utf8")
);

assert.equal(assignmentVisibilityContract.surface_id, "programme_assignment_visibility");
assert.equal(assignmentVisibilityContract.failure_code, "assignment_visibility_product_auth_failure");
assert.equal(assignmentVisibilityContract.failure_copy_id, "ASSIGNMENT_VISIBILITY_ACCESS_DENIED");
assert.equal(assignmentVisibilityContract.compile_input_status, "not_consumed_until_declared_compile_input");

const coachReadModel = buildAssignmentVisibilityReadModel({
  actor: fixture.coach_actor,
  assignments: fixture.valid_assignments,
  relationships: fixture.relationships
});

assert.deepEqual(
  coachReadModel.assignments.map((assignment) => assignment.assignment_id),
  ["assignment_001"]
);
assert.equal(coachReadModel.engine_visible, false);
assert.equal(coachReadModel.compile_input_status, "not_consumed_until_declared_compile_input");

const athleteReadModel = buildAssignmentVisibilityReadModel({
  actor: fixture.athlete_actor,
  assignments: fixture.valid_assignments,
  relationships: fixture.relationships
});

assert.deepEqual(
  athleteReadModel.assignments.map((assignment) => assignment.assignment_id),
  ["assignment_002"]
);
assert.equal(athleteReadModel.engine_visible, false);

const denied = tryBuildAssignmentVisibilityReadModel({
  actor: {
    actor_type: "coach"
  },
  assignments: [],
  relationships: []
});

assert.equal(denied.ok, false);
assert.equal(denied.error.product_auth_failure, true);
assert.equal(denied.error.engine_decision, false);
assert.equal(denied.error.engine_visible, false);

const probeA = buildAssignmentVisibilityEngineTruthProbe({
  visible_assignment_count: 0
});
const probeB = buildAssignmentVisibilityEngineTruthProbe({
  visible_assignment_count: 100
});

assert.deepEqual(probeA.assignment_probe, probeB.assignment_probe);
assert.equal(probeA.engine_visible, false);
assert.equal(probeB.engine_visible, false);

const apiResponse = handleProgrammeAssignmentVisibilityRequest({
  method: "POST",
  body: {
    actor: fixture.coach_actor,
    assignments: fixture.valid_assignments,
    relationships: fixture.relationships
  }
});

assert.equal(apiResponse.status, 200);
assert.equal(apiResponse.body.ok, true);

const source = fs.readFileSync("src/programmeAssignmentVisibility.mjs", "utf8");
const apiSource = fs.readFileSync("src/api/programmeAssignmentVisibilityApi.mjs", "utf8");
const testSource = fs.readFileSync("test/s_v1_29_assignment_visibility.test.mjs", "utf8");
const doc = fs.readFileSync("docs/v1/V1_ASSIGNMENT_VISIBILITY.md", "utf8");
const packageJson = fs.readFileSync("package.json", "utf8");

for (const phrase of [
  "Coach sees assigned athletes only",
  "Athlete sees own assignments only",
  "Visibility state does not alter compile",
  "S-V1-15",
  "S-V1-28"
]) {
  assert.match(doc, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

for (const forbidden of [
  "team_dashboard",
  "organisation_dashboard",
  "organization_dashboard",
  "commercial_dashboard",
  "recommendation_score",
  "readiness_score"
]) {
  assert.equal(source.includes(forbidden), false, `${forbidden} must not appear in active visibility source`);
  assert.equal(apiSource.includes(forbidden), false, `${forbidden} must not appear in active visibility API source`);
}

for (const expected of [
  "S-V1-29 coach sees assignments for assigned accepted athletes only",
  "S-V1-29 athlete sees own assignments only",
  "S-V1-29 assignment visibility state does not alter compile probe"
]) {
  assert.match(testSource, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

for (const expected of [
  "node --test test/s_v1_29_assignment_visibility.test.mjs",
  "node ci/guards/s_v1_29_assignment_visibility_guard.mjs"
]) {
  assert.ok(packageJson.includes(expected), `package.json must include ${expected}`);
}

const child = spawnSync(process.execPath, ["--test", "test/s_v1_29_assignment_visibility.test.mjs"], {
  encoding: "utf8",
  stdio: "pipe"
});

if (child.status !== 0) {
  throw new Error(`${TOKEN}: S-V1-29 tests failed\n${child.stdout}\n${child.stderr}`);
}

console.log(JSON.stringify({
  ok: true,
  guard,
  token: TOKEN,
  message: "Assignment visibility passed."
}));
