// @law: Repo Governance
// @severity: medium
// @scope: repo
import fs from "node:fs";
import path from "node:path";

const repo = process.cwd();
const TOKEN = "CI_V1_SESSION_STATE_EVENTS_READBACK";

function fail(message) {
  console.error(JSON.stringify({
    ok: false,
    guard: "S-V1-39",
    token: TOKEN,
    message
  }, null, 2));
  process.exitCode = 1;
}

function readText(relativePath) {
  const absolute = path.join(repo, relativePath);
  if (!fs.existsSync(absolute)) {
    fail(`Missing required file: ${relativePath}`);
    return "";
  }
  return fs.readFileSync(absolute, "utf8").replace(/\r\n/g, "\n");
}

function assertIncludes(text, needle, file) {
  if (!text.includes(needle)) {
    fail(`${file} must include ${needle}`);
  }
}

function assertNotMatches(text, pattern, file, label) {
  if (pattern.test(text)) {
    fail(`${file} contains forbidden ${label}`);
  }
}

const files = {
  module: "src/sessionStateEventsReadback.mjs",
  test: "test/s_v1_39_session_state_events_readback.test.mjs",
  fixture: "ci/fixtures/v1_session_state_events_readback/s_v1_39_session_state_events_readback_cases.json",
  guard: "ci/guards/s_v1_39_session_state_events_readback_guard.mjs",
  permissionGuard: "src/relationshipPermissionGuards.mjs",
  packageJson: "package.json",
  guardsIndex: "docs/GUARDS_INDEX.md",
  failureTokenIndex: "docs/dev/FAILURE_TOKEN_INDEX.md",
  checksums: "docs/checksums.sha256"
};

const moduleText = readText(files.module);
const testText = readText(files.test);
const fixtureText = readText(files.fixture);
const permissionText = readText(files.permissionGuard);
const packageText = readText(files.packageJson);
const guardsIndexText = readText(files.guardsIndex);
const failureTokenIndexText = readText(files.failureTokenIndex);
const checksumsText = readText(files.checksums);

assertIncludes(moduleText, "DEV NOTE:", files.module);
assertIncludes(moduleText, "sessionStateEventsReadbackContract", files.module);
assertIncludes(moduleText, "permission_surface_id: \"session_readback\"", files.module);
assertIncludes(moduleText, "buildSessionStateReadback", files.module);
assertIncludes(moduleText, "buildSessionEventsReadback", files.module);
assertIncludes(moduleText, "stableSessionReadbackJson", files.module);
assertIncludes(moduleText, "appends_runtime_event: false", files.module);
assertIncludes(moduleText, "mutates_session_state: false", files.module);
assertIncludes(moduleText, "calls_engine: false", files.module);

assertIncludes(permissionText, "\"session_readback\"", files.permissionGuard);
assertIncludes(permissionText, "session_readback: \"session_readback\"", files.permissionGuard);

assertIncludes(testText, "S-V1-39 athlete can read own session state and events", files.test);
assertIncludes(testText, "S-V1-39 assigned coach can read assigned athlete session state and events", files.test);
assertIncludes(testText, "S-V1-39 unassigned actors are rejected", files.test);
assertIncludes(testText, "S-V1-39 state readback is byte-stable", files.test);
assertIncludes(testText, "S-V1-39 events readback is byte-stable", files.test);

assertIncludes(fixtureText, "\"slice_id\": \"S-V1-39\"", files.fixture);
assertIncludes(fixtureText, "\"session_readback\": true", files.fixture);
assertIncludes(fixtureText, "\"unassigned_coach_rejected\"", files.fixture);

assertIncludes(packageText, "node --test test/s_v1_39_session_state_events_readback.test.mjs", files.packageJson);
assertIncludes(packageText, "node ci/guards/s_v1_39_session_state_events_readback_guard.mjs", files.packageJson);
assertIncludes(guardsIndexText, "s_v1_39_session_state_events_readback_guard.mjs", files.guardsIndex);
assertIncludes(failureTokenIndexText, TOKEN, files.failureTokenIndex);

if (checksumsText.trim().length === 0) {
  fail(`${files.checksums} must not be empty after hash:write.`);
}

for (const [file, text] of Object.entries({
  [files.module]: moduleText,
  [files.test]: testText,
  [files.fixture]: fixtureText
})) {
  assertNotMatches(text, /\b(readiness|fatigue|adherence score|recommended|recommendation|optimise|optimize|diagnose|prescribe)\b/i, file, "claim or judgement language");
  assertNotMatches(text, /from\s+["'].*engine|@kolosseum\/engine/, file, "engine import");
}

if (!/surface_id:\s*"v1_session_state_events_readback"/.test(moduleText)) {
  fail(`${files.module} must expose the S-V1-39 readback surface id.`);
}

if (process.exitCode && process.exitCode !== 0) {
  throw new Error("S-V1-39 guard failed.");
}

console.log(JSON.stringify({
  ok: true,
  guard: "S-V1-39",
  token: TOKEN,
  message: "Session state/events readback contract passed."
}));
