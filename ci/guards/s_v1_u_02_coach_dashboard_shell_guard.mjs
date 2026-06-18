// @law: Repo Governance
// @severity: medium
// @scope: repo
/**
 * DEV NOTE: S-V1-U-02 coach dashboard shell guard.
 * Purpose: proves the coach dashboard shell is assigned-only, factual, and engine-inert.
 * Boundary: checks docs, copy, source modules, API adapter, UI renderer, fixture, tests, package registration, generated indexes, and checksum regeneration. It does not implement broad analytics, team, organisation, organization, commercial, marketplace, messaging, social, registry, payment, or engine behaviour.
 * Determinism: reads fixed repository files and runs the deterministic target test.
 * Failure: emits CI_V1_COACH_DASHBOARD_SHELL when shell scope widens.
 */

import fs from "node:fs";
import { spawnSync } from "node:child_process";

const GUARD = "S-V1-U-02";
const TOKEN = "CI_V1_COACH_DASHBOARD_SHELL";

function fail(message, details = {}) {
  console.error(JSON.stringify({
    ok: false,
    guard: GUARD,
    token: TOKEN,
    message,
    ...details
  }, null, 2));
  process.exitCode = 1;
}

function readText(file) {
  if (!fs.existsSync(file)) {
    fail("Missing required S-V1-U-02 file.", { file });
    return "";
  }

  return fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
}

function readJson(file) {
  const text = readText(file);
  try {
    return JSON.parse(text);
  } catch (error) {
    fail("Required S-V1-U-02 JSON file is invalid.", {
      file,
      error: String(error?.message || error)
    });
    return null;
  }
}

function assertIncludes(file, text, marker) {
  if (!text.includes(marker)) {
    fail("Required S-V1-U-02 marker missing.", {
      file,
      marker
    });
  }
}

function assertNotIncludes(file, text, marker) {
  if (text.includes(marker)) {
    fail("Forbidden S-V1-U-02 marker present.", {
      file,
      marker
    });
  }
}

function assertNotMatches(file, text, pattern, label) {
  if (pattern.test(text)) {
    fail(`Forbidden S-V1-U-02 ${label}.`, {
      file
    });
  }
}

const files = {
  doc: "docs/v1/V1_COACH_DASHBOARD_SHELL.md",
  releaseBoundary: "docs/v1/V1_RELEASE_BOUNDARY.md",
  acceptanceGate: "docs/v1/V1_ACCEPTANCE_GATE.md",
  notInScope: "docs/v1/V1_NOT_IN_SCOPE.md",
  authorityMap: "docs/v1/V1_DOC_AUTHORITY_MAP.md",
  module: "src/coachDashboardShell.mjs",
  api: "src/api/coachDashboardShellApi.mjs",
  ui: "src/coachAssignedShellProjection.mjs",
  test: "test/s_v1_u_02_coach_dashboard_shell.test.mjs",
  fixture: "ci/fixtures/v1_coach_dashboard_shell/s_v1_u_02_coach_dashboard_shell_cases.json",
  copy: "copy/coach_dashboard_shell_copy.json",
  permissionGuard: "src/relationshipPermissionGuards.mjs",
  guard: "ci/guards/s_v1_u_02_coach_dashboard_shell_guard.mjs",
  packageJson: "package.json",
  guardsIndex: "docs/GUARDS_INDEX.md",
  failureTokenIndex: "docs/dev/FAILURE_TOKEN_INDEX.md",
  checksums: "docs/checksums.sha256"
};

for (const file of Object.values(files)) {
  readText(file);
}

const docText = readText(files.doc);
const releaseBoundaryText = readText(files.releaseBoundary);
const acceptanceGateText = readText(files.acceptanceGate);
const notInScopeText = readText(files.notInScope);
const authorityMapText = readText(files.authorityMap);
const moduleText = readText(files.module);
const apiText = readText(files.api);
const uiText = readText(files.ui);
const testText = readText(files.test);
const fixtureText = readText(files.fixture);
const copyText = readText(files.copy);
const permissionText = readText(files.permissionGuard);
const guardText = readText(files.guard);
const packageText = readText(files.packageJson);
const guardsIndexText = readText(files.guardsIndex);
const failureTokenIndexText = readText(files.failureTokenIndex);
const checksumsText = readText(files.checksums);

for (const marker of [
  "Status: active v1 coach dashboard shell boundary document.",
  "Slice: S-V1-U-02.",
  "assigned-only",
  "buildCoachDashboardShell",
  "buildCoachAssignedAthleteRows",
  "User-facing text must resolve through `copy/coach_dashboard_shell_copy.json`.",
  "If a coach is not assigned to an athlete through an accepted individual coach-athlete relationship, that athlete must not appear in the coach dashboard shell."
]) {
  assertIncludes(files.doc, docText, marker);
}

for (const marker of [
  "S-V1-U-02:COACH-DASHBOARD-SHELL:START",
  "docs/v1/V1_COACH_DASHBOARD_SHELL.md",
  "assigned-athlete rows only",
  "engine-inert"
]) {
  assertIncludes(files.releaseBoundary, releaseBoundaryText, marker);
}

for (const marker of [
  "S-V1-U-02:COACH-DASHBOARD-SHELL-ACCEPTANCE:START",
  "assigned coach sees assigned athlete row",
  "unassigned athlete row is absent",
  "coach dashboard shell emits copy ids"
]) {
  assertIncludes(files.acceptanceGate, acceptanceGateText, marker);
}

for (const marker of [
  "S-V1-U-02:COACH-DASHBOARD-SHELL-NON-SCOPE:START",
  "broad analytics dashboard",
  "team dashboard",
  "organisation dashboard",
  "organization dashboard",
  "commercial dashboard"
]) {
  assertIncludes(files.notInScope, notInScopeText, marker);
}

for (const marker of [
  "S-V1-U-02",
  "V1_COACH_DASHBOARD_SHELL.md",
  "coachDashboardShell.mjs",
  "coachDashboardShellApi.mjs"
]) {
  assertIncludes(files.authorityMap, authorityMapText, marker);
}

for (const marker of [
  "DEV NOTE:",
  "coachDashboardShellContract",
  "surface_id: \"v1_coach_dashboard_shell\"",
  "slice_id: \"S-V1-U-02\"",
  "permission_surface_id: \"coach_dashboard_shell\"",
  "product_permission_state_only: true",
  "engine_visible: false",
  "assertCoachDashboardInput",
  "listAssignedCoachAthleteIds",
  "buildCoachAssignedAthleteRows",
  "buildCoachDashboardShell",
  "tryBuildCoachDashboardShell",
  "compileIgnoringCoachDashboardShell"
]) {
  assertIncludes(files.module, moduleText, marker);
}

for (const marker of [
  "getCoachDashboardShellResponse",
  "requireCoachDashboardShellResponse",
  "engine_visible: false"
]) {
  assertIncludes(files.api, apiText, marker);
}

for (const marker of [
  "projectCoachAssignedShell",
  "copy_id",
  "coach_dashboard_shell.title",
  "engine_visible: false"
]) {
  assertIncludes(files.ui, uiText, marker);
}

for (const marker of [
  "S-V1-U-02 returns assigned coach athlete rows only",
  "S-V1-U-02 refuses unknown broad dashboard fields",
  "S-V1-U-02 shell does not alter compile input"
]) {
  assertIncludes(files.test, testText, marker);
}

for (const marker of [
  "s_v1_u_02_coach_dashboard_shell_cases",
  "\"slice_id\": \"S-V1-U-02\"",
  "\"expected_visible_athlete_ids\""
]) {
  assertIncludes(files.fixture, fixtureText, marker);
}

for (const marker of [
  "\"copy_surface_id\": \"v1_coach_dashboard_shell\"",
  "\"copy_id\": \"coach_dashboard_shell.title\"",
  "\"copy_id\": \"coach_dashboard_shell.assigned_athletes\""
]) {
  assertIncludes(files.copy, copyText, marker);
}

for (const marker of [
  "assertCoachCanViewAthlete",
  "assertCoachAthleteAccess",
  "relationship_permission_product_auth_failure"
]) {
  assertIncludes(files.permissionGuard, permissionText, marker);
}

for (const marker of [
  "node --test test/s_v1_u_02_coach_dashboard_shell.test.mjs",
  "node ci/guards/s_v1_u_02_coach_dashboard_shell_guard.mjs"
]) {
  assertIncludes(files.packageJson, packageText, marker);
}

for (const marker of [
  "s_v1_u_02_coach_dashboard_shell_guard.mjs",
  "CI_V1_COACH_DASHBOARD_SHELL"
]) {
  assertIncludes(files.guard, guardText, marker);
}

assertIncludes(files.guardsIndex, guardsIndexText, "ci/guards/s_v1_u_02_coach_dashboard_shell_guard.mjs");
assertIncludes(files.failureTokenIndex, failureTokenIndexText, "CI_V1_COACH_DASHBOARD_SHELL");

if (checksumsText.trim().length === 0) {
  fail("docs/checksums.sha256 must not be empty after hash:write.");
}

assertIncludes(files.checksums, checksumsText, "GUARDS_INDEX.md");
assertIncludes(files.releaseBoundary, releaseBoundaryText, "V1_COACH_DASHBOARD_SHELL.md");

for (const marker of [
  "from \"../engine",
  "from \"./engine",
  "from \"../src/engine",
  "Date.now",
  "randomUUID",
  "fetch(",
  "process.env",
  "stripe",
  "password",
  "session_token",
  "marketplace",
  "message_thread",
  "chat_thread",
  "social_graph",
  "team_role_create",
  "organisation_role_create",
  "organization_role_create",
  "gym_role_create",
  "federation_role_create"
]) {
  assertNotIncludes(files.module, moduleText, marker);
  assertNotIncludes(files.api, apiText, marker);
  assertNotIncludes(files.ui, uiText, marker);
}

for (const [file, text] of [
  [files.doc, docText],
  [files.module, moduleText],
  [files.api, apiText],
  [files.ui, uiText],
  [files.copy, copyText]
]) {
  assertNotMatches(file, text, /\b(recommend|recommended|recommendation|score|scoring|rank|ranking|readiness|fatigue|risk|safe|safety|suitable|suitability|optimal|optimise|optimize|best)\b/i, "claim or valence term");
}

const fixture = readJson(files.fixture);
if (fixture?.slice_id !== "S-V1-U-02") {
  fail("S-V1-U-02 fixture slice_id mismatch.");
}

const copy = readJson(files.copy);
if (copy?.copy_surface_id !== "v1_coach_dashboard_shell") {
  fail("S-V1-U-02 copy surface mismatch.");
}

if (!Array.isArray(copy?.entries) || copy.entries.length < 5) {
  fail("S-V1-U-02 copy registry must include shell labels.");
}

const child = spawnSync(process.execPath, ["--test", "test/s_v1_u_02_coach_dashboard_shell.test.mjs"], {
  encoding: "utf8",
  stdio: "pipe"
});

if (child.status !== 0) {
  fail("S-V1-U-02 target test failed from guard.", {
    stdout: child.stdout,
    stderr: child.stderr
  });
}

if (process.exitCode && process.exitCode !== 0) {
  throw new Error("S-V1-U-02 coach dashboard shell guard failed.");
}

console.log(JSON.stringify({
  ok: true,
  guard: GUARD,
  token: TOKEN,
  message: "Coach dashboard shell passed."
}));