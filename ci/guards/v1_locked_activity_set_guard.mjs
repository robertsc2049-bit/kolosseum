// @law: Repo Governance
// @severity: medium
// @scope: repo
// @law v1_locked_activity_set
// @severity error
// @scope v1-boundary


// DEV NOTE: CI guard surface. This file enforces a repo boundary and should fail closed with
// readable output. Do not weaken the guard to make a failing build pass; fix the underlying
// boundary drift or update the canonical contract deliberately.

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = process.cwd();

const expectedActivities = Object.freeze([
  "powerlifting",
  "general_strength",
  "rugby_union"
]);

const rejectedExamples = Object.freeze([
  "strongman",
  "bodybuilding",
  "weightlifting",
  "combat_sports",
  "tactical",
  "running",
  "cycling",
  "swimming",
  "football",
  "soccer",
  "basketball"
]);

const requiredDocs = Object.freeze([
  "docs/roadmap/V1_SUPPORTED_ACTIVITIES_DECISION.md",
  "docs/roadmap/V1_REGISTRY_EXPANSION_TARGET.md",
  "docs/roadmap/V1_IMPLEMENTATION_READINESS_CHECKLIST.md",
  "docs/roadmap/V1_BOUNDARY_GUARD_SCAFFOLDING.md",
  "docs/roadmap/V1_LOCKED_ACTIVITY_SET_GUARD.md"
]);

function fail(message) {
  console.error(`v1_locked_activity_set_guard: FAIL: ${message}`);
  process.exit(1);
}

function readText(relativePath) {
  const fullPath = path.join(repoRoot, relativePath);

  if (!fs.existsSync(fullPath)) {
    fail(`missing required file: ${relativePath}`);
  }

  return fs.readFileSync(fullPath, "utf8");
}

function assertIncludes(text, required, context) {
  if (!text.includes(required)) {
    fail(`${context} missing required text: ${required}`);
  }
}

function assertThrowsWithCode(fn, expectedCode, context) {
  try {
    fn();
  } catch (error) {
    if (error && error.code === expectedCode) {
      return;
    }

    fail(`${context}: expected ${expectedCode}, got ${error && error.code ? error.code : "no_code"}`);
  }

  fail(`${context}: expected throw with ${expectedCode}`);
}

const boundaryModuleUrl = pathToFileURL(path.join(repoRoot, "shared/v1-boundary/v1BoundaryGuards.mjs")).href;
const boundary = await import(`${boundaryModuleUrl}?cacheBust=${Date.now()}`);

if (!Array.isArray(boundary.V1_SUPPORTED_ACTIVITIES)) {
  fail("V1_SUPPORTED_ACTIVITIES is not exported as an array");
}

if (boundary.V1_SUPPORTED_ACTIVITIES.length !== expectedActivities.length) {
  fail(`expected ${expectedActivities.length} supported activities, got ${boundary.V1_SUPPORTED_ACTIVITIES.length}`);
}

for (const activityId of expectedActivities) {
  if (!boundary.V1_SUPPORTED_ACTIVITIES.includes(activityId)) {
    fail(`locked activity missing from V1_SUPPORTED_ACTIVITIES: ${activityId}`);
  }

  boundary.assertActivityIsV1Supported(activityId);
}

for (const activityId of boundary.V1_SUPPORTED_ACTIVITIES) {
  if (!expectedActivities.includes(activityId)) {
    fail(`unexpected v1 supported activity present: ${activityId}`);
  }
}

if (typeof boundary.assertActivityIsV1Supported !== "function") {
  fail("assertActivityIsV1Supported export is not a function");
}

for (const rejected of rejectedExamples) {
  assertThrowsWithCode(
    () => boundary.assertActivityIsV1Supported(rejected),
    "v1_boundary_guard_unsupported_activity",
    `excluded activity rejection failed for ${rejected}`
  );
}

const packageText = readText("package.json");

assertIncludes(
  packageText,
  "node ci/guards/v1_locked_activity_set_guard.mjs",
  "package.json lint:fast"
);

const guardsIndexText = readText("docs/GUARDS_INDEX.md");

assertIncludes(
  guardsIndexText,
  "v1_locked_activity_set_guard",
  "docs/GUARDS_INDEX.md"
);

for (const docPath of requiredDocs) {
  const docText = readText(docPath);

  for (const activityId of expectedActivities) {
    assertIncludes(docText, activityId, docPath);
  }
}

console.log("OK: v1_locked_activity_set_guard");
