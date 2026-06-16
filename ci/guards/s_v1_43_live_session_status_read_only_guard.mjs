// @law: Repo Governance
// @severity: medium
// @scope: repo
/**
 * DEV NOTE: S-V1-43 live session status read-only guard.
 * Purpose: proves live session status remains assigned-coach factual visibility only.
 * Boundary: checks source, API, UI, copy, tests, docs, generated indexes, and lint registration.
 * Determinism: reads committed files and runs the S-V1-43 test file.
 * Failure: emits CI_V1_LIVE_SESSION_STATUS_READ_ONLY when live status gains mutation, advice, contact, media, control, or coach-triggered substitution behaviour.
 */

import fs from "node:fs";
import { spawnSync } from "node:child_process";

const GUARD = "S-V1-43";
const TOKEN = "CI_V1_LIVE_SESSION_STATUS_READ_ONLY";

const FILES = Object.freeze({
  source: "src/liveSessionStatus.mjs",
  ui: "src/liveSessionStatusUiRenderer.mjs",
  api: "src/api/liveSessionStatusApi.mjs",
  copy: "copy/live_session_status_copy.json",
  test: "test/s_v1_43_live_session_status_read_only.test.mjs",
  docs: "docs/v1/V1_LIVE_SESSION_STATUS_READ_ONLY.md",
  relationshipPermission: "src/relationshipPermissionGuards.mjs",
  relationshipPermissionTest: "test/s_v1_15_relationship_permission_guards.test.mjs",
  packageJson: "package.json",
  guardsIndex: "docs/GUARDS_INDEX.md",
  failureTokenIndex: "docs/dev/FAILURE_TOKEN_INDEX.md",
  checksums: "docs/checksums.sha256"
});

function fail(message, details = {}) {
  console.error(JSON.stringify({
    ok: false,
    guard: GUARD,
    token: TOKEN,
    message,
    details
  }, null, 2));
  process.exitCode = 1;
}

function read(file) {
  if (!fs.existsSync(file)) {
    fail(`Missing required file: ${file}`);
    return "";
  }

  return fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
}

function assertIncludes(text, needle, file) {
  if (!text.includes(needle)) {
    fail(`${file} must include ${needle}`);
  }
}

function assertNotIncludes(text, needle, file) {
  if (text.includes(needle)) {
    fail(`${file} must not include ${needle}`);
  }
}

const source = read(FILES.source);
const ui = read(FILES.ui);
const api = read(FILES.api);
const copy = read(FILES.copy);
const test = read(FILES.test);
const docs = read(FILES.docs);
const relationshipPermission = read(FILES.relationshipPermission);
const relationshipPermissionTest = read(FILES.relationshipPermissionTest);
const packageJson = read(FILES.packageJson);
const guardsIndex = read(FILES.guardsIndex);
const failureTokenIndex = read(FILES.failureTokenIndex);
const checksums = read(FILES.checksums);

for (const required of [
  "surface_id: \"v1_live_session_status\"",
  "slice_id: \"S-V1-43\"",
  "permission_surface_id: \"live_session_status\"",
  "access_policy: \"assigned_coach_only\"",
  "mutation_policy: \"read_only\"",
  "\"not_started\"",
  "\"in_progress\"",
  "\"split\"",
  "\"returned\"",
  "\"partially_completed\"",
  "\"completed\"",
  "\"stopped\"",
  "export function buildLiveSessionStatus",
  "export function tryBuildLiveSessionStatus",
  "read_only: true",
  "appends_runtime_event: false",
  "mutates_session_state: false",
  "calls_engine: false",
  "coach_control_surface_present: false",
  "coach_contact_surface_present: false",
  "media_stream_surface_present: false",
  "coach_substitution_control_present: false"
]) {
  assertIncludes(source, required, FILES.source);
}

for (const forbidden of [
  "@kolosseum/engine",
  "from \"../engine",
  "from \"./engine",
  "engine/src/"
]) {
  assertNotIncludes(source, forbidden, FILES.source);
  assertNotIncludes(api, forbidden, FILES.api);
}

for (const required of [
  "export function renderLiveSessionStatus",
  "read_only: true",
  "coach_action_controls_present: false",
  "coach_contact_surface_present: false",
  "media_stream_surface_present: false",
  "coach_substitution_control_present: false",
  "calls_engine: false"
]) {
  assertIncludes(ui, required, FILES.ui);
}

for (const required of [
  "handleLiveSessionStatusRequest",
  "status: 200",
  "status: 403",
  "mutation_policy: \"read_only\""
]) {
  assertIncludes(api, required, FILES.api);
}

for (const required of [
  "\"copy_surface_id\": \"live_session_status\"",
  "LIVE_SESSION_STATUS_READ_ONLY_NOTICE",
  "LIVE_SESSION_STATUS_FACTS_ONLY_NOTICE",
  "LIVE_SESSION_STATUS_STATUS_LABEL",
  "LIVE_SESSION_STATUS_EVENT_TIMELINE_LABEL"
]) {
  assertIncludes(copy, required, FILES.copy);
}

for (const blocked of [
  "recommended",
  "optimal",
  "readiness",
  "fatigue",
  "message athlete",
  "video call",
  "trigger substitution"
]) {
  assertNotIncludes(copy.toLowerCase(), blocked, FILES.copy);
}

for (const required of [
  "\"live_session_status\"",
  "live_session_status: \"live_session_status\""
]) {
  assertIncludes(relationshipPermission, required, FILES.relationshipPermission);
}

assertIncludes(relationshipPermissionTest, "\"live_session_status\"", FILES.relationshipPermissionTest);

for (const required of [
  "watching does not alter reducer output or session state",
  "assigned coach can view live status only",
  "copy is factual and claim-safe",
  "coach_substitution_control_present",
  "coach_action_controls_present"
]) {
  assertIncludes(test, required, FILES.test);
}

for (const required of [
  "S-V1-43",
  "live_session_status",
  "Assigned coach can view live status only.",
  "Watching does not mutate session state.",
  "Status labels are factual only."
]) {
  assertIncludes(docs, required, FILES.docs);
}

for (const required of [
  "node --test test/s_v1_43_live_session_status_read_only.test.mjs",
  "node ci/guards/s_v1_43_live_session_status_read_only_guard.mjs"
]) {
  assertIncludes(packageJson, required, FILES.packageJson);
}

assertIncludes(guardsIndex, "s_v1_43_live_session_status_read_only_guard.mjs", FILES.guardsIndex);
assertIncludes(failureTokenIndex, TOKEN, FILES.failureTokenIndex);

if (checksums.trim().length === 0) {
  fail(`${FILES.checksums} must not be empty after hash:write.`);
}

const child = spawnSync(process.execPath, ["--test", FILES.test], {
  encoding: "utf8",
  stdio: "pipe"
});

if (child.status !== 0) {
  fail("S-V1-43 slice test failed.", {
    stdout: child.stdout,
    stderr: child.stderr
  });
}

if (process.exitCode && process.exitCode !== 0) {
  throw new Error(`${GUARD} guard failed.`);
}

console.log(JSON.stringify({
  ok: true,
  guard: GUARD,
  token: TOKEN,
  message: "Live session status remains read-only factual visibility."
}));