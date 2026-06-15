// @law: v1 Supported Activity Boundary
// @severity: high
// @scope: v1-boundary

// DEV NOTE: S-V1-20 boundary guard. This guard closes the v1 supported
// activity set by proving the named doc, fixture, test, package wiring, and
// boundary module all agree. Do not widen this list inside product, registry,
// fixture, or template work. Use a deliberate boundary-change slice instead.

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = process.cwd();

const TOKEN = "CI_V1_SUPPORTED_ACTIVITY_SET_LOCK";

const expectedActivities = Object.freeze([
  "powerlifting",
  "general_strength",
  "rugby_union"
]);

const requiredFiles = Object.freeze([
  "docs/v1/V1_SUPPORTED_ACTIVITY_SET_LOCK.md",
  "docs/roadmap/V1_SUPPORTED_ACTIVITIES_DECISION.md",
  "docs/roadmap/V1_LOCKED_ACTIVITY_SET_GUARD.md",
  "docs/v1/V1_RELEASE_BOUNDARY.md",
  "ci/fixtures/v1_supported_activity_set_lock_negative/s_v1_20_unsupported_activity_negative.json",
  "test/s_v1_20_supported_activity_set_lock.test.mjs",
  "ci/guards/s_v1_20_supported_activity_set_lock_guard.mjs"
]);

function fail(message) {
  console.error(JSON.stringify({
    ok: false,
    guard: "S-V1-20",
    token: TOKEN,
    message
  }));
  process.exit(1);
}

function readText(relativePath) {
  const fullPath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(fullPath)) {
    fail(`missing required file: ${relativePath}`);
  }
  return fs.readFileSync(fullPath, "utf8");
}

function readJson(relativePath) {
  try {
    return JSON.parse(readText(relativePath));
  } catch (error) {
    fail(`invalid JSON in ${relativePath}: ${error?.message ?? String(error)}`);
  }
}

function assertIncludes(text, required, context) {
  if (!text.includes(required)) {
    fail(`${context} missing required text: ${required}`);
  }
}

function assertArrayEquals(actual, expected, context) {
  if (!Array.isArray(actual)) {
    fail(`${context} is not an array`);
  }

  if (actual.length !== expected.length) {
    fail(`${context} length mismatch: expected ${expected.length}, got ${actual.length}`);
  }

  for (let i = 0; i < expected.length; i++) {
    if (actual[i] !== expected[i]) {
      fail(`${context} mismatch at index ${i}: expected ${expected[i]}, got ${actual[i]}`);
    }
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

for (const file of requiredFiles) {
  readText(file);
}

const boundaryModuleUrl = pathToFileURL(path.join(repoRoot, "shared/v1-boundary/v1BoundaryGuards.mjs")).href;
const boundary = await import(`${boundaryModuleUrl}?s_v1_20=${Date.now()}`);

assertArrayEquals(
  boundary.V1_SUPPORTED_ACTIVITIES,
  expectedActivities,
  "V1_SUPPORTED_ACTIVITIES"
);

if (typeof boundary.assertActivityIsV1Supported !== "function") {
  fail("assertActivityIsV1Supported export is not a function");
}

for (const activityId of expectedActivities) {
  const result = boundary.assertActivityIsV1Supported(activityId);
  if (result !== true) {
    fail(`supported activity did not pass boundary helper: ${activityId}`);
  }
}

const fixturePath = "ci/fixtures/v1_supported_activity_set_lock_negative/s_v1_20_unsupported_activity_negative.json";
const fixture = readJson(fixturePath);

if (fixture.slice_id !== "S-V1-20") {
  fail(`${fixturePath} slice_id must be S-V1-20`);
}

assertArrayEquals(
  fixture.locked_supported_activity_ids,
  expectedActivities,
  `${fixturePath}.locked_supported_activity_ids`
);

if (fixture.expected_rejection_code !== "v1_boundary_guard_unsupported_activity") {
  fail(`${fixturePath} expected_rejection_code must be v1_boundary_guard_unsupported_activity`);
}

if (!Array.isArray(fixture.unsupported_activity_ids) || fixture.unsupported_activity_ids.length === 0) {
  fail(`${fixturePath} must include unsupported_activity_ids`);
}

for (const activityId of fixture.unsupported_activity_ids) {
  if (expectedActivities.includes(activityId)) {
    fail(`${fixturePath} wrongly lists supported activity as unsupported: ${activityId}`);
  }

  assertThrowsWithCode(
    () => boundary.assertActivityIsV1Supported(activityId),
    fixture.expected_rejection_code,
    `unsupported activity rejection failed for ${activityId}`
  );
}

const docText = readText("docs/v1/V1_SUPPORTED_ACTIVITY_SET_LOCK.md");
assertIncludes(docText, "S-V1-20", "docs/v1/V1_SUPPORTED_ACTIVITY_SET_LOCK.md");
assertIncludes(docText, fixturePath, "docs/v1/V1_SUPPORTED_ACTIVITY_SET_LOCK.md");

for (const activityId of expectedActivities) {
  assertIncludes(docText, activityId, "docs/v1/V1_SUPPORTED_ACTIVITY_SET_LOCK.md");
}

const packageText = readText("package.json");
assertIncludes(
  packageText,
  "node --test test/s_v1_20_supported_activity_set_lock.test.mjs",
  "package.json lint:fast"
);
assertIncludes(
  packageText,
  "node ci/guards/s_v1_20_supported_activity_set_lock_guard.mjs",
  "package.json lint:fast"
);

console.log(JSON.stringify({
  ok: true,
  guard: "S-V1-20",
  token: TOKEN,
  message: "Supported activity set lock passed."
}));
