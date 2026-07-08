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
