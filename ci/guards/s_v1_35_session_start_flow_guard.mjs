// @law: Repo Governance
// @severity: medium
// @scope: repo
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repo = process.cwd();
const TOKEN = "CI_V1_SESSION_START_FLOW";

function readText(relativePath) {
  return fs.readFileSync(path.join(repo, relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function fail(message, details = {}) {
  const report = {
    ok: false,
    guard: "S-V1-35",
    token: TOKEN,
    message,
    details
  };

  console.error(JSON.stringify(report, null, 2));
  process.exitCode = 1;
  throw new Error(message);
}

function assertFile(relativePath) {
  const absolute = path.join(repo, relativePath);
  if (!fs.existsSync(absolute)) {
    fail(`Missing required S-V1-35 file: ${relativePath}`);
  }
}

const files = {
  source: "src/v1SessionStartFlow.mjs",
  test: "test/s_v1_35_session_start_flow.test.mjs",
  guard: "ci/guards/s_v1_35_session_start_flow_guard.mjs",
  fixture: "ci/fixtures/v1_session_start_flow/s_v1_35_session_start_flow_cases.json",
  copy: "copy/session_start_flow_copy.json",
  doc: "docs/v1/V1_SESSION_START_FLOW.md",
  packageJson: "package.json",
  guardsIndex: "docs/GUARDS_INDEX.md",
  failureTokenIndex: "docs/dev/FAILURE_TOKEN_INDEX.md"
};

for (const file of Object.values(files)) {
  assertFile(file);
}

const sourceText = readText(files.source);
const testText = readText(files.test);
const guardText = readText(files.guard);
const fixture = readJson(files.fixture);
const copyEntries = readJson(files.copy);
const docText = readText(files.doc);
const packageJsonText = readText(files.packageJson);
const guardsIndexText = readText(files.guardsIndex);
const failureTokenIndexText = readText(files.failureTokenIndex);

if (!sourceText.includes("DEV NOTE:")) {
  fail("S-V1-35 source must include a targeted DEV NOTE.");
}

if (/@kolosseum\/engine|from\s+["']\.\.\/engine|from\s+["'].*\/engine\//u.test(sourceText)) {
  fail("S-V1-35 must not import engine modules.");
}

for (const requiredExport of [
  "buildSessionStartFlow",
  "tryBuildSessionStartFlow",
  "handleV1SessionStartRequest",
  "sessionStartFlowContract"
]) {
  if (!sourceText.includes(requiredExport)) {
    fail(`S-V1-35 source missing export marker: ${requiredExport}`);
  }
}

for (const requiredSourceMarker of [
  "lawful_compiled_state_required: true",
  "start_event_is_factual: true",
  "created_start_event",
  "returned_existing_start_event",
  "return_existing_start_event_only",
  "SESSION_START"
]) {
  if (!sourceText.includes(requiredSourceMarker)) {
    fail(`S-V1-35 source missing invariant marker: ${requiredSourceMarker}`);
  }
}

for (const blocked of [
  "coach_override",
  "coach_message",
  "video_url",
  "engine_truth_override",
  "progression_change",
  "extra_session_id"
]) {
  if (!sourceText.includes(blocked)) {
    fail(`S-V1-35 source must explicitly forbid marker: ${blocked}`);
  }
}

for (const blockedFragment of [
  ["reco", "mmend"].join(""),
  ["opt", "imal"].join(""),
  ["ready", "ness"].join(""),
  ["fat", "igue"].join(""),
  ["ri", "sk"].join("")
]) {
  if (sourceText.toLowerCase().includes(blockedFragment)) {
    fail(`S-V1-35 source contains blocked fragment: ${blockedFragment}`);
  }

  if (docText.toLowerCase().includes(blockedFragment)) {
    fail(`S-V1-35 doc contains blocked fragment: ${blockedFragment}`);
  }

  for (const entry of copyEntries) {
    if (String(entry.text ?? "").toLowerCase().includes(blockedFragment)) {
      fail(`S-V1-35 copy contains blocked fragment: ${entry.copy_id}`);
    }
  }
}

if (fixture.slice_id !== "S-V1-35") {
  fail("S-V1-35 fixture slice_id mismatch.");
}

if (!fixture.valid_request || !Array.isArray(fixture.negative_cases) || fixture.negative_cases.length < 3) {
  fail("S-V1-35 fixture must include valid request and negative cases.");
}

for (const expectedReason of [
  "compiled_session_missing",
  "compiled_session_invalid",
  "assignment_invalid",
  "forbidden_scope_field"
]) {
  if (!fixture.negative_cases.some((testCase) => testCase.expected_reason === expectedReason)) {
    fail(`S-V1-35 fixture missing negative reason: ${expectedReason}`);
  }
}

assert.equal(Array.isArray(copyEntries), true, "S-V1-35 copy file must be an array.");

for (const copyId of [
  "SESSION_START_FLOW_TITLE",
  "SESSION_START_FLOW_ACTION",
  "SESSION_START_FLOW_ALREADY_STARTED",
  "SESSION_START_FLOW_BLOCKED",
  "SESSION_START_FLOW_RECORDED_EVENT"
]) {
  if (!copyEntries.some((entry) => entry.copy_id === copyId && entry.surface_id === "v1_session_start_flow")) {
    fail(`S-V1-35 copy id missing or wrong surface: ${copyId}`);
  }
}

for (const requiredTestMarker of [
  "starts from lawful assigned compiled state only",
  "returns existing start event for idempotent restart path",
  "rejects invalid or missing compiled state",
  "API adapter maps valid start and missing compile rejection",
  "UI handoff is presentation-only"
]) {
  if (!testText.includes(requiredTestMarker)) {
    fail(`S-V1-35 test missing proof marker: ${requiredTestMarker}`);
  }
}

for (const requiredDocLine of [
  "starts an athlete session from an assigned compiled session",
  "factual session start event model",
  "Repeated start requests return the existing start event"
]) {
  if (!docText.includes(requiredDocLine)) {
    fail(`S-V1-35 doc missing boundary line: ${requiredDocLine}`);
  }
}

for (const requiredCommand of [
  "node --test test/s_v1_35_session_start_flow.test.mjs",
  "node ci/guards/s_v1_35_session_start_flow_guard.mjs"
]) {
  if (!packageJsonText.includes(requiredCommand)) {
    fail(`package.json lint:fast missing S-V1-35 command: ${requiredCommand}`);
  }
}

if (!guardsIndexText.includes("s_v1_35_session_start_flow_guard.mjs")) {
  fail("docs/GUARDS_INDEX.md does not index S-V1-35 guard. Run npm run guard:index.");
}

if (!failureTokenIndexText.includes(TOKEN)) {
  fail("docs/dev/FAILURE_TOKEN_INDEX.md does not index S-V1-35 token.");
}

assert.ok(guardText.includes(TOKEN));

console.log(JSON.stringify({
  ok: true,
  guard: "S-V1-35",
  token: TOKEN,
  message: "Session start flow passed."
}));
