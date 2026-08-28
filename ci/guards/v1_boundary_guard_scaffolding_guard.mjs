// @law: Repo Governance
// @severity: medium
// @scope: repo
// @law v1_boundary_guard_scaffolding
// @severity error
// @scope v1-boundary

// DEV NOTE: CI guard surface. This file enforces a repo boundary and should fail closed with
// readable output. Do not weaken the guard to make a failing build pass; fix the underlying
// boundary drift or update the canonical contract deliberately.

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

const repoRoot = process.cwd();

const expectedFiles = [
  "docs/roadmap/V1_BOUNDARY_GUARD_SCAFFOLDING.md",
  "shared/v1-boundary/v1BoundaryGuards.mjs",
  "ci/guards/v1_boundary_guard_scaffolding_guard.mjs"
];

const requiredFunctionNames = [
  "assertCoachCanViewAthlete",
  "assertCoachCanAssignProgramme",
  "assertAthleteOwnsDeclaration",
  "assertRelationshipIsActive",
  "assertEngineInputIsCanonical",
  "assertNoCoachNoteInEngineInput",
  "assertNoBillingStateInEngineInput",
  "assertNoUiStateInEngineInput",
  "assertRegistryIdIsKnown",
  "assertActivityIsV1Supported",
  "assertSubstitutionEdgeIsAllowed",
  "assertCopyIdExists",
  "assertLiveViewIsReadOnly"
];

const forbiddenChangedPathFragments = [
  "migrations/",
  "db/migrations/",
  "registry/data/",
  "registries/data/",
  "templates/",
  "client/",
  "app/",
  "pages/",
  "ui/",
  "billing/",
  "marketplace/",
  "messaging/",
  "chat/",
  "epos/",
  "gym-access/"
];

// S18 itself added no migration. Later slices remain blocked unless an exact,
// deliberately reviewed path is recorded here. Broad migration exceptions are
// forbidden.
const explicitLaterSliceAllowedChangedPaths =
  new Set([
    "migrations/20260714_beta28_auth_rls_security.sql",
    "ci/contracts/run_pipeline_contract_versions.json",
    "ci/golden/phase1_to_phase6_output_contract.json",
    "ci/guards/golden_manifest_guard.mjs",
    "LOCKFILE_CHANGE_NOTE.md",
    "package-lock.json",
    "product/ui/full_ui_04c_coach_commercial_closure.json",
    "product/ui/full_ui_08c_strength_reference_lifecycle_closure.json",
    "product/ui/function_manifest.json",
    "shared/programme-marketplace/programmeTemplateSharingLifecycle.mjs",
    "public/app/account_ui.js",
    "public/app/app.js",
    "public/app/athlete_onboarding_ui.js",
    "public/app/coach_branding_ui.js",
    "public/app/coach_onboarding_ui.js",
    "public/app/commercial_ui.js",
    "public/app/event_lifecycle_ui.js",
    "public/app/index.html",
    "public/app/route_bootstrap.js",
    "public/app/styles.css",
    "replay/suite/beta_phase1_8/production_beta_rehearsal_manifest.json",
    "test/api_handlers_compile_block_persistence_args_contract.test.mjs",
    "test/api_handlers_compile_block_persistence_delegation.test.mjs",
    "test/ci_api_plan_session_direct_vs_empty_body_boundary_runtime_contract_wrapper.test.mjs",
    "test/ci_api_plan_session_empty_body_success_parity_runtime_contract_wrapper.test.mjs",
    "test/ci_api_plan_session_envelope_only_allowlist_boundary_runtime_contract_wrapper.test.mjs",
    "test/ci_api_plan_session_input_envelope_vs_direct_body_runtime_contract_wrapper.test.mjs",
    "test/ci_api_plan_session_invalid_body_runtime_contract_wrapper.test.mjs",
    "test/ci_api_plan_session_nested_input_precedence_boundary_runtime_contract_wrapper.test.mjs",
    "test/ci_api_plan_session_success_parity_runtime_contract_wrapper.test.mjs",
    "test/ci_api_plan_session_undeclared_top_level_fields_runtime_contract_wrapper.test.mjs",
    "test/ci_api_start_session_empty_body_boundary_runtime_contract_wrapper.test.mjs",
    "test/fixtures/golden/expected/phase1_constraints_gym_basic.json",
    "test/fixtures/golden/expected/phase1_envelope_powerlifting_default.json",
    "test/fixtures/golden/expected/phase1_equipment_dbs_only_timebox.json",
    "test/fixtures/golden/expected/phase1_equipment_plate_only.json",
    "test/fixtures/golden/expected/phase1_pain_knee_powerlifting.json",
    "test/fixtures/golden/expected/phase3_precedence_banned_over_available.json",
    "test/fixtures/golden/expected/phase3_sovereign_constraints_envelope.json",
    "test/fixtures/golden/expected/phase6_session_powerlifting_contract.json",
    "test/fixtures/golden/expected/vanilla_minimal.json",
    "test/fixtures/golden/golden_manifest.v1.json",
    "test/fixtures/golden/golden_outputs.v1.json",
    "test/fixtures/golden/golden_outputs.v1.sha256"
  ]);

function fail(message) {
  console.error(`v1_boundary_guard_scaffolding_guard: FAIL: ${message}`);
  process.exit(1);
}

function assertFileExists(relativePath) {
  if (!fs.existsSync(path.join(repoRoot, relativePath))) {
    fail(`missing required file: ${relativePath}`);
  }
}

function readText(relativePath) {
  assertFileExists(relativePath);
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function gitOutput(args) {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}

function changedFilesAgainstOriginMain() {
  try {
    const base = gitOutput(["merge-base", "HEAD", "origin/main"]);
    if (!base) {
      return [];
    }

    const output = gitOutput(["diff", "--name-only", `${base}..HEAD`]);
    return output ? output.split(/\r?\n/u).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function assertThrowsWithCode(fn, code) {
  try {
    fn();
  } catch (error) {
    if (error && error.code === code) {
      return;
    }

    fail(`expected ${code}, got ${error && error.code ? error.code : "no_code"}`);
  }

  fail(`expected throw with ${code}`);
}

for (const relativePath of expectedFiles) {
  assertFileExists(relativePath);
}

const docText = readText("docs/roadmap/V1_BOUNDARY_GUARD_SCAFFOLDING.md");
const guardText = readText("shared/v1-boundary/v1BoundaryGuards.mjs");
const packageText = readText("package.json");

for (const required of [
  "S18 - v1 boundary guard scaffolding",
  "v1 boundary guard scaffold exists",
  "no database migration is added",
  "no registry content is added",
  "no template content is added",
  "no UI screen is added"
]) {
  if (!docText.includes(required)) {
    fail(`roadmap doc missing required text: ${required}`);
  }
}

for (const functionName of requiredFunctionNames) {
  if (!guardText.includes(`export function ${functionName}`)) {
    fail(`guard scaffold missing export function: ${functionName}`);
  }
}

if (!guardText.includes("v1_boundary_guard_")) {
  fail("guard scaffold missing required failure-token prefix");
}

if (!packageText.includes("node ci/guards/v1_boundary_guard_scaffolding_guard.mjs")) {
  fail("package.json lint:fast does not invoke v1 boundary scaffold guard");
}

const changedFiles = changedFilesAgainstOriginMain();

for (const changedFile of changedFiles) {
  const normalised = changedFile.replace(/\\/gu, "/");

  if (
    explicitLaterSliceAllowedChangedPaths
      .has(normalised)
  ) {
    continue;
  }

  for (const forbiddenFragment of forbiddenChangedPathFragments) {
    if (normalised.includes(forbiddenFragment)) {
      fail(`forbidden path changed in S18: ${changedFile}`);
    }
  }
}

const guardModuleUrl = pathToFileURL(path.join(repoRoot, "shared/v1-boundary/v1BoundaryGuards.mjs")).href;
const guards = await import(`${guardModuleUrl}?cacheBust=${Date.now()}`);

for (const functionName of requiredFunctionNames) {
  if (typeof guards[functionName] !== "function") {
    fail(`guard export is not a function: ${functionName}`);
  }
}

if (!Array.isArray(guards.V1_SUPPORTED_ACTIVITIES)) {
  fail("V1_SUPPORTED_ACTIVITIES export is not an array");
}

for (const activityId of ["powerlifting", "general_strength", "rugby_union"]) {
  guards.assertActivityIsV1Supported(activityId);
}

for (const activityId of ["strongman", "bodybuilding", "weightlifting", "combat_sports"]) {
  assertThrowsWithCode(
    () => guards.assertActivityIsV1Supported(activityId),
    "v1_boundary_guard_unsupported_activity"
  );
}

guards.assertCoachCanViewAthlete({
  relationshipState: "relationship_active",
  coachId: "coach_1",
  athleteId: "athlete_1"
});

assertThrowsWithCode(
  () => guards.assertCoachCanViewAthlete({
    relationshipState: "invite_pending",
    coachId: "coach_1",
    athleteId: "athlete_1"
  }),
  "v1_boundary_guard_relationship_not_active"
);

guards.assertCoachCanAssignProgramme({
  relationshipState: "relationship_active",
  coachId: "coach_1",
  athleteId: "athlete_1",
  assignmentActivityId: "powerlifting"
});

assertThrowsWithCode(
  () => guards.assertCoachCanAssignProgramme({
    relationshipState: "relationship_active",
    coachId: "coach_1",
    athleteId: "athlete_1",
    assignmentActivityId: "strongman"
  }),
  "v1_boundary_guard_unsupported_activity"
);

guards.assertAthleteOwnsDeclaration({
  athleteId: "athlete_1",
  declarationAthleteId: "athlete_1"
});

assertThrowsWithCode(
  () => guards.assertAthleteOwnsDeclaration({
    athleteId: "athlete_1",
    declarationAthleteId: "athlete_2"
  }),
  "v1_boundary_guard_declaration_owner_mismatch"
);

guards.assertEngineInputIsCanonical({
  activity_id: "general_strength",
  registry_ids: ["exercise_1"]
});

assertThrowsWithCode(
  () => guards.assertEngineInputIsCanonical({
    activity_id: "general_strength",
    coach_note: "do more"
  }),
  "v1_boundary_guard_coach_note_in_engine_input"
);

assertThrowsWithCode(
  () => guards.assertEngineInputIsCanonical({
    activity_id: "general_strength",
    billing_state: "paid"
  }),
  "v1_boundary_guard_billing_state_in_engine_input"
);

assertThrowsWithCode(
  () => guards.assertEngineInputIsCanonical({
    activity_id: "general_strength",
    ui_state: "drawer_open"
  }),
  "v1_boundary_guard_ui_state_in_engine_input"
);

guards.assertRegistryIdIsKnown("exercise_1", ["exercise_1"]);

assertThrowsWithCode(
  () => guards.assertRegistryIdIsKnown("unknown", ["exercise_1"]),
  "v1_boundary_guard_unknown_registry_id"
);

guards.assertSubstitutionEdgeIsAllowed({
  sourceExerciseId: "exercise_1",
  targetExerciseId: "exercise_2",
  substitutionEdgeId: "edge_1",
  sourceActivityId: "powerlifting",
  targetActivityId: "powerlifting"
});

assertThrowsWithCode(
  () => guards.assertSubstitutionEdgeIsAllowed({
    sourceExerciseId: "exercise_1",
    targetExerciseId: "exercise_2",
    substitutionEdgeId: "edge_1",
    sourceActivityId: "powerlifting",
    targetActivityId: "rugby_union"
  }),
  "v1_boundary_guard_substitution_crosses_activity"
);

guards.assertCopyIdExists("copy_1", ["copy_1"]);

assertThrowsWithCode(
  () => guards.assertCopyIdExists("unknown", ["copy_1"]),
  "v1_boundary_guard_unknown_copy_id"
);

guards.assertLiveViewIsReadOnly({ action: "view" });
guards.assertLiveViewIsReadOnly({ action: "read" });
guards.assertLiveViewIsReadOnly({ action: "status" });

assertThrowsWithCode(
  () => guards.assertLiveViewIsReadOnly({ action: "mutate_session" }),
  "v1_boundary_guard_live_view_not_read_only"
);

console.log("OK: v1_boundary_guard_scaffolding_guard");
