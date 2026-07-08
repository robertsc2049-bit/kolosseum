import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  buildEngineTruthProbe,
  createProgrammeAssignment,
  programmeAssignmentContract,
  tryCreateProgrammeAssignment
} from "../src/programmeAssignmentContract.mjs";
import { handleProgrammeAssignmentRequest } from "../src/api/programmeAssignmentApi.mjs";

const repoRoot = process.cwd();

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readValidRequest() {
  return clone(readJson("ci/fixtures/v1_programme_assignment_contract/s_v1_28_programme_assignment_cases.json").valid_request);
}

test("S-V1-28 exposes a closed programme assignment contract surface", () => {
  assert.equal(programmeAssignmentContract.token_prefix, "v1_programme_assignment_contract_");
  assert.deepEqual(programmeAssignmentContract.locked_activity_ids, [
    "powerlifting",
    "general_strength",
    "rugby_union"
  ]);

  for (const field of [
    "actor",
    "relationship",
    "assignment_authorisation",
    "template_coverage_entry",
    "assignment_intent",
    "engine_boundary"
  ]) {
    assert.ok(programmeAssignmentContract.required_root_keys.includes(field));
  }

  for (const forbidden of [
    "team_id",
    "organisation_id",
    "marketplace_purchase_id",
    "engine_input",
    "compile_now",
    "billing_state"
  ]) {
    assert.ok(programmeAssignmentContract.forbidden_keys.includes(forbidden));
  }
});

test("S-V1-28 authorised coach programme assignment passes", () => {
  const fixture = readJson("ci/fixtures/v1_programme_assignment_contract/s_v1_28_programme_assignment_cases.json");
  const assignment = createProgrammeAssignment(fixture.valid_request);

  assert.equal(assignment.contract_version, fixture.expected_assignment.contract_version);
  assert.equal(assignment.assignment_status, fixture.expected_assignment.assignment_status);
  assert.equal(assignment.assigned_by_coach_id, fixture.expected_assignment.assigned_by_coach_id);
  assert.equal(assignment.assigned_athlete_id, fixture.expected_assignment.assigned_athlete_id);
  assert.equal(assignment.relationship_id, fixture.expected_assignment.relationship_id);
  assert.equal(assignment.template_id, fixture.expected_assignment.template_id);
  assert.equal(assignment.activity_id, fixture.expected_assignment.activity_id);
  assert.equal(assignment.assignment_scope, fixture.expected_assignment.assignment_scope);
  assert.equal(assignment.compile_input_status, fixture.expected_assignment.compile_input_status);
  assert.equal(assignment.engine_visible, false);
  assert.equal(assignment.assignment_mutates_engine_truth, false);
  assert.equal(assignment.relationship_scope_enforced, true);
  assert.equal(assignment.marketplace_scope, false);
  assert.equal(assignment.team_assignment_scope, false);
  assert.equal(assignment.organisation_assignment_scope, false);
  assert.match(assignment.assignment_id, /^programme_assignment_[a-f0-9]{24}$/);
  assert.match(assignment.assignment_hash, /^[a-f0-9]{64}$/);
});

test("S-V1-28 unassigned coach assignment is rejected", () => {
  const fixture = readJson("ci/fixtures/v1_programme_assignment_contract_negative/s_v1_28_unassigned_coach_assignment_negative.json");

  assert.equal(fixture.expected_failure_code, "v1_programme_assignment_contract_unassigned_coach_assignment_rejected");

  const result = tryCreateProgrammeAssignment(fixture.request);

  assert.equal(result.ok, false);
  assert.equal(result.error_code, fixture.expected_failure_code);
  assert.equal(result.details.actor_coach_id, "coach_999");
  assert.equal(result.details.relationship_coach_id, "coach_001");
});

test("S-V1-28 relationship status and scope are enforced", () => {
  const pending = readValidRequest();
  pending.relationship.relationship_status = "invited";

  assert.throws(
    () => createProgrammeAssignment(pending),
    (error) => error?.code === "v1_programme_assignment_contract_relationship_not_accepted"
  );

  const team = readValidRequest();
  team.relationship.relationship_scope = "team";

  assert.throws(
    () => createProgrammeAssignment(team),
    (error) => error?.code === "v1_programme_assignment_contract_relationship_scope_invalid"
  );
});

test("S-V1-28 assignment authorisation is separate from relationship acceptance and must be granted", () => {
  const denied = readValidRequest();
  denied.assignment_authorisation.authorisation_status = "denied";

  assert.throws(
    () => createProgrammeAssignment(denied),
    (error) => error?.code === "v1_programme_assignment_contract_authorisation_not_granted"
  );

  const mismatched = readValidRequest();
  mismatched.assignment_authorisation.relationship_id = "relationship_other";

  assert.throws(
    () => createProgrammeAssignment(mismatched),
    (error) => error?.code === "v1_programme_assignment_contract_authorisation_relationship_mismatch"
  );
});

test("S-V1-28 template coverage must bind to S-V1-26 and S-V1-27", () => {
  const badTemplate = readValidRequest();
  badTemplate.template_coverage_entry.template_contract_version = "S-V1-99";

  assert.throws(
    () => createProgrammeAssignment(badTemplate),
    (error) => error?.code === "v1_programme_assignment_contract_template_contract_version_invalid"
  );

  const badCoverage = readValidRequest();
  badCoverage.template_coverage_entry.coverage_contract_version = "S-V1-99";

  assert.throws(
    () => createProgrammeAssignment(badCoverage),
    (error) => error?.code === "v1_programme_assignment_contract_coverage_contract_version_invalid"
  );

  const unsupported = readValidRequest();
  unsupported.template_coverage_entry.activity_id = "strongman";

  assert.throws(
    () => createProgrammeAssignment(unsupported),
    (error) => error?.code === "v1_programme_assignment_contract_unsupported_activity_refused"
  );
});

test("S-V1-28 assignment refuses team organisation marketplace billing and engine-input fields", () => {
  for (const [field, value] of [
    ["team_id", "team_001"],
    ["organisation_id", "org_001"],
    ["marketplace_purchase_id", "purchase_001"],
    ["billing_state", "paid"],
    ["engine_input", { compile: true }],
    ["compile_now", true]
  ]) {
    const request = readValidRequest();
    request[field] = value;

    assert.throws(
      () => createProgrammeAssignment(request),
      (error) =>
        error?.code === "v1_programme_assignment_contract_forbidden_assignment_scope_field" &&
        error?.details?.field === field
    );
  }
});

test("S-V1-28 assignment does not alter engine truth until compile consumes declared inputs", () => {
  const request = readValidRequest();

  const before = buildEngineTruthProbe({
    phase1_payload_hash: "phase1_same",
    registry_bundle_hash: "registry_same"
  });

  const assignment = createProgrammeAssignment(request);

  const after = buildEngineTruthProbe({
    phase1_payload_hash: "phase1_same",
    registry_bundle_hash: "registry_same"
  });

  assert.equal(assignment.engine_visible, false);
  assert.equal(assignment.assignment_mutates_engine_truth, false);
  assert.equal(assignment.compile_input_status, "not_consumed_until_declared_compile_input");
  assert.deepEqual(after, before);
});

test("S-V1-28 API adapter creates authorised assignment and maps unassigned coach to product-auth failure", () => {
  const okResponse = handleProgrammeAssignmentRequest({
    method: "POST",
    path: "/v1/programme-assignments",
    body: readValidRequest()
  });

  assert.equal(okResponse.status, 201);
  assert.equal(okResponse.body.ok, true);
  assert.equal(okResponse.body.assignment.assignment_status, "assigned");

  const negative = readJson("ci/fixtures/v1_programme_assignment_contract_negative/s_v1_28_unassigned_coach_assignment_negative.json");
  const rejected = handleProgrammeAssignmentRequest({
    method: "POST",
    path: "/v1/programme-assignments",
    body: negative.request
  });

  assert.equal(rejected.status, 403);
  assert.equal(rejected.body.ok, false);
  assert.equal(rejected.body.error_code, negative.expected_failure_code);
});

test("S-V1-28 documentation binds assignment without team organisation marketplace purchase or engine mutation scope", () => {
  const doc = fs.readFileSync(path.join(repoRoot, "docs", "v1", "V1_PROGRAMME_ASSIGNMENT_CONTRACT.md"), "utf8");

  assert.match(doc, /S-V1-28/);
  assert.match(doc, /programme assignment contract/);
  assert.match(doc, /Only authorised coach can assign/);
  assert.match(doc, /Assignment does not alter engine truth until compile consumes declared inputs/);
  assert.match(doc, /Athlete relationship scope enforced/);
  assert.match(doc, /No team assignments are added by this slice/);
  assert.match(doc, /No organisation assignments are added by this slice/);
  assert.match(doc, /No marketplace purchases are added by this slice/);
});
