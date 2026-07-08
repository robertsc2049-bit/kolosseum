// @law: v1 Programme Assignment Contract
// @severity: high
// @scope: v1-product-auth

// DEV NOTE: S-V1-28 guard. This verifies the bounded programme assignment
// service and API adapter. Assignment is product/auth state only until compile
// later consumes explicit declared inputs. This guard must not permit team/org
// assignment, marketplace purchase scope, database migrations, UI, billing, or
// direct engine mutation.

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import {
  buildEngineTruthProbe,
  createProgrammeAssignment,
  programmeAssignmentContract,
  tryCreateProgrammeAssignment
} from "../../src/programmeAssignmentContract.mjs";
import { handleProgrammeAssignmentRequest } from "../../src/api/programmeAssignmentApi.mjs";

const repoRoot = process.cwd();
const TOKEN = "CI_V1_PROGRAMME_ASSIGNMENT_CONTRACT";

const requiredFiles = Object.freeze([
  "docs/v1/V1_PROGRAMME_ASSIGNMENT_CONTRACT.md",
  "src/programmeAssignmentContract.mjs",
  "src/api/programmeAssignmentApi.mjs",
  "ci/fixtures/v1_programme_assignment_contract/s_v1_28_programme_assignment_cases.json",
  "ci/fixtures/v1_programme_assignment_contract_negative/s_v1_28_unassigned_coach_assignment_negative.json",
  "test/s_v1_28_programme_assignment_contract.test.mjs",
  "ci/guards/s_v1_28_programme_assignment_contract_guard.mjs",
  "docs/v1/V1_PROGRAMME_TEMPLATE_CONTRACT.md",
  "docs/v1/V1_TEMPLATE_REGISTRY_COVERAGE.md",
  "docs/v1/V1_RELATIONSHIP_PERMISSION_GUARDS.md"
]);

function failGuard(message, details = {}) {
  console.error(JSON.stringify({
    ok: false,
    guard: "S-V1-28",
    token: TOKEN,
    message,
    ...details
  }));
  process.exit(1);
}

function readText(relativePath) {
  const fullPath = path.join(repoRoot, relativePath);

  if (!fs.existsSync(fullPath)) {
    failGuard(`missing required file: ${relativePath}`);
  }

  return fs.readFileSync(fullPath, "utf8");
}

function readJson(relativePath) {
  try {
    return JSON.parse(readText(relativePath));
  } catch (error) {
    failGuard(`invalid JSON in ${relativePath}: ${error?.message ?? String(error)}`);
  }
}

function assertIncludes(text, required, context) {
  if (!text.includes(required)) {
    failGuard(`${context} missing required text: ${required}`);
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

for (const file of requiredFiles) {
  readText(file);
}

for (const forbiddenPath of [
  "db/schema/programme_assignments.sql",
  "db/migrations/s_v1_28_programme_assignment.sql",
  "app/programme-assignments",
  "server/routes/programmeAssignments.ts",
  "marketplace/programmeAssignments.mjs",
  "teams/programmeAssignments.mjs",
  "organisations/programmeAssignments.mjs",
  "organizations/programmeAssignments.mjs"
]) {
  if (fs.existsSync(path.join(repoRoot, forbiddenPath))) {
    failGuard(`forbidden active assignment surface present: ${forbiddenPath}`);
  }
}

const positiveFixture = readJson("ci/fixtures/v1_programme_assignment_contract/s_v1_28_programme_assignment_cases.json");
const negativeFixture = readJson("ci/fixtures/v1_programme_assignment_contract_negative/s_v1_28_unassigned_coach_assignment_negative.json");

if (positiveFixture.slice_id !== "S-V1-28") {
  failGuard("positive fixture slice_id must be S-V1-28");
}

if (negativeFixture.slice_id !== "S-V1-28") {
  failGuard("negative fixture slice_id must be S-V1-28");
}

if (negativeFixture.expected_failure_code !== "v1_programme_assignment_contract_unassigned_coach_assignment_rejected") {
  failGuard("negative fixture expected_failure_code mismatch");
}

const assignment = createProgrammeAssignment(positiveFixture.valid_request);

if (assignment.assigned_by_coach_id !== "coach_001") {
  failGuard("authorised assignment did not preserve assigning coach");
}

if (assignment.assigned_athlete_id !== "athlete_001") {
  failGuard("authorised assignment did not preserve assigned athlete");
}

if (assignment.engine_visible !== false || assignment.assignment_mutates_engine_truth !== false) {
  failGuard("assignment must remain engine-invisible and non-mutating");
}

if (assignment.compile_input_status !== "not_consumed_until_declared_compile_input") {
  failGuard("assignment compile input status drifted");
}

const rejected = tryCreateProgrammeAssignment(negativeFixture.request);

if (rejected.ok !== false || rejected.error_code !== negativeFixture.expected_failure_code) {
  failGuard("unassigned coach negative fixture did not fail closed", {
    result: rejected
  });
}

const before = buildEngineTruthProbe({ phase1_payload_hash: "same_phase1", registry_bundle_hash: "same_registry" });
createProgrammeAssignment(positiveFixture.valid_request);
const after = buildEngineTruthProbe({ phase1_payload_hash: "same_phase1", registry_bundle_hash: "same_registry" });

if (JSON.stringify(before) !== JSON.stringify(after)) {
  failGuard("programme assignment changed engine truth probe output");
}

const badScopes = [
  ["team_id", "team_001"],
  ["organisation_id", "org_001"],
  ["marketplace_purchase_id", "purchase_001"],
  ["billing_state", "paid"],
  ["engine_input", { compile: true }]
];

for (const [field, value] of badScopes) {
  const request = clone(positiveFixture.valid_request);
  request[field] = value;

  const result = tryCreateProgrammeAssignment(request);

  if (result.ok !== false || result.error_code !== "v1_programme_assignment_contract_forbidden_assignment_scope_field") {
    failGuard(`forbidden assignment field did not fail closed: ${field}`, {
      result
    });
  }
}

const apiOk = handleProgrammeAssignmentRequest({
  method: "POST",
  path: "/v1/programme-assignments",
  body: positiveFixture.valid_request
});

if (apiOk.status !== 201 || apiOk.body?.ok !== true) {
  failGuard("programme assignment API adapter did not return 201 for authorised assignment");
}

const apiRejected = handleProgrammeAssignmentRequest({
  method: "POST",
  path: "/v1/programme-assignments",
  body: negativeFixture.request
});

if (apiRejected.status !== 403 || apiRejected.body?.error_code !== negativeFixture.expected_failure_code) {
  failGuard("programme assignment API adapter did not map unassigned coach to 403");
}

for (const required of [
  "team_id",
  "organisation_id",
  "marketplace_purchase_id",
  "engine_input",
  "compile_now",
  "billing_state"
]) {
  if (!programmeAssignmentContract.forbidden_keys.includes(required)) {
    failGuard(`programme assignment contract missing forbidden key: ${required}`);
  }
}

const docText = readText("docs/v1/V1_PROGRAMME_ASSIGNMENT_CONTRACT.md");
const s26Text = readText("docs/v1/V1_PROGRAMME_TEMPLATE_CONTRACT.md");
const s27Text = readText("docs/v1/V1_TEMPLATE_REGISTRY_COVERAGE.md");
const s15Text = readText("docs/v1/V1_RELATIONSHIP_PERMISSION_GUARDS.md");
const packageText = readText("package.json");
const guardsIndexText = readText("docs/GUARDS_INDEX.md");
const failureTokenText = readText("docs/dev/FAILURE_TOKEN_INDEX.md");

for (const requiredText of [
  "S-V1-28",
  "programme assignment contract",
  "Only authorised coach can assign",
  "Assignment does not alter engine truth until compile consumes declared inputs",
  "Athlete relationship scope enforced",
  "assignment_authorisation",
  "programme_assignment",
  "coach_athlete_assigned_execution",
  "not_consumed_until_declared_compile_input",
  "No team assignments are added by this slice",
  "No organisation assignments are added by this slice",
  "No marketplace purchases are added by this slice"
]) {
  assertIncludes(docText, requiredText, "docs/v1/V1_PROGRAMME_ASSIGNMENT_CONTRACT.md");
}

for (const requiredText of [
  "programme template contract",
  "coach_athlete_assigned_execution",
  "formula and progression internals remain protected"
]) {
  assertIncludes(s26Text, requiredText, "docs/v1/V1_PROGRAMME_TEMPLATE_CONTRACT.md");
}

for (const requiredText of [
  "template registry coverage",
  "declared_for_v1_coverage",
  "Template coverage is explicit"
]) {
  assertIncludes(s27Text, requiredText, "docs/v1/V1_TEMPLATE_REGISTRY_COVERAGE.md");
}

for (const requiredText of [
  "assertCoachCanViewAthlete"
]) {
  assertIncludes(s15Text, requiredText, "docs/v1/V1_RELATIONSHIP_PERMISSION_GUARDS.md");
}

assertIncludes(
  packageText,
  "node --test test/s_v1_28_programme_assignment_contract.test.mjs",
  "package.json lint:fast"
);

assertIncludes(
  packageText,
  "node ci/guards/s_v1_28_programme_assignment_contract_guard.mjs",
  "package.json lint:fast"
);

assertIncludes(
  guardsIndexText,
  "s_v1_28_programme_assignment_contract_guard",
  "docs/GUARDS_INDEX.md"
);

assertIncludes(
  failureTokenText,
  TOKEN,
  "docs/dev/FAILURE_TOKEN_INDEX.md"
);

console.log(JSON.stringify({
  ok: true,
  guard: "S-V1-28",
  token: TOKEN,
  message: "Programme assignment contract passed."
}));
