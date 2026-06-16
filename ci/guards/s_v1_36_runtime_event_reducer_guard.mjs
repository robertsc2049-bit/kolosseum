// @law: Repo Governance
// @severity: medium
// @scope: repo
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repo = process.cwd();
const TOKEN = "CI_V1_RUNTIME_EVENT_REDUCER";

function readText(relativePath) {
  return fs.readFileSync(path.join(repo, relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function fail(message, details = {}) {
  const report = {
    ok: false,
    guard: "S-V1-36",
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
    fail(`Missing required S-V1-36 file: ${relativePath}`);
  }
}

const files = {
  source: "src/v1RuntimeEventReducer.mjs",
  test: "test/s_v1_36_runtime_event_reducer.test.mjs",
  guard: "ci/guards/s_v1_36_runtime_event_reducer_guard.mjs",
  fixture: "ci/fixtures/v1_runtime_event_reducer/s_v1_36_runtime_event_reducer_cases.json",
  doc: "docs/v1/V1_RUNTIME_EVENT_REDUCER_CONTRACT.md",
  devDoc: "docs/dev/S_V1_36_RUNTIME_EVENT_REDUCER_DEV_NOTE.md",
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
const docText = readText(files.doc);
const devDocText = readText(files.devDoc);
const packageJsonText = readText(files.packageJson);
const guardsIndexText = readText(files.guardsIndex);
const failureTokenIndexText = readText(files.failureTokenIndex);

if (!sourceText.includes("DEV NOTE:")) {
  fail("S-V1-36 source must include a targeted DEV NOTE.");
}

if (/@kolosseum\/engine|from\s+["']\.\.\/engine|from\s+["'].*\/engine\//u.test(sourceText)) {
  fail("S-V1-36 must not import engine modules.");
}

for (const requiredExport of [
  "initialiseV1RuntimeState",
  "validateV1RuntimeEvent",
  "applyV1RuntimeEvent",
  "appendV1RuntimeEventLog",
  "replayV1RuntimeEvents",
  "tryReplayV1RuntimeEvents",
  "stableRuntimeReducerJson",
  "v1RuntimeEventReducerContract"
]) {
  if (!sourceText.includes(requiredExport)) {
    fail(`S-V1-36 source missing export marker: ${requiredExport}`);
  }
}

for (const requiredSourceMarker of [
  "append_only_exact_next_seq",
  "event_seq_gap",
  "duplicate_event_id",
  "event_order_invalid",
  "duplicate_work_item_terminal_event",
  "forbidden_reducer_input",
  "SESSION_START",
  "COMPLETE_WORK_ITEM",
  "RETURN_SKIP"
]) {
  if (!sourceText.includes(requiredSourceMarker)) {
    fail(`S-V1-36 source missing reducer invariant marker: ${requiredSourceMarker}`);
  }
}

for (const forbiddenInputMarker of [
  "coach_notes",
  "billing_state",
  "ui_state"
]) {
  if (!sourceText.includes(forbiddenInputMarker)) {
    fail(`S-V1-36 source must explicitly forbid reducer input marker: ${forbiddenInputMarker}`);
  }
}

for (const blockedFragment of [
  ["reco", "mmend"].join(""),
  ["opt", "imal"].join(""),
  ["ready", "ness"].join(""),
  ["fat", "igue"].join(""),
  ["ri", "sk"].join(""),
  ["rank", "ing"].join(""),
  ["dash", "board"].join("")
]) {
  if (sourceText.toLowerCase().includes(blockedFragment)) {
    fail(`S-V1-36 source contains blocked fragment: ${blockedFragment}`);
  }
}

if (fixture.slice_id !== "S-V1-36") {
  fail("S-V1-36 fixture slice_id mismatch.");
}

if (!fixture.session || !Array.isArray(fixture.valid_events) || !Array.isArray(fixture.negative_cases)) {
  fail("S-V1-36 fixture must include session, valid_events, and negative_cases.");
}

for (const expectedReason of [
  "event_invalid",
  "event_seq_gap",
  "duplicate_event_id",
  "unknown_work_item",
  "event_order_invalid",
  "forbidden_reducer_input"
]) {
  if (!fixture.negative_cases.some((testCase) => testCase.expected_reason === expectedReason)) {
    fail(`S-V1-36 fixture missing negative reason: ${expectedReason}`);
  }
}

for (const requiredTestMarker of [
  "reduces accepted events deterministically without mutating input",
  "append helper enforces exact append-only event log",
  "invalid events fail closed and preserve previous state",
  "replay returns the same state as incremental reduction",
  "duplicate terminal work-item event is rejected idempotently"
]) {
  if (!testText.includes(requiredTestMarker)) {
    fail(`S-V1-36 test missing proof marker: ${requiredTestMarker}`);
  }
}

for (const requiredDocLine of [
  "Events are append-only",
  "The reducer is deterministic",
  "Invalid events fail closed",
  "Replaying the same event list returns the same state"
]) {
  if (!docText.includes(requiredDocLine)) {
    fail(`S-V1-36 doc missing invariant line: ${requiredDocLine}`);
  }
}

for (const requiredDevDocLine of [
  "does not replace the v0 persistence path",
  "reject invalid events before state mutation",
  "do not add coach notes, billing state, or UI state to reducer input"
]) {
  if (!devDocText.includes(requiredDevDocLine)) {
    fail(`S-V1-36 dev doc missing boundary line: ${requiredDevDocLine}`);
  }
}

for (const requiredCommand of [
  "node --test test/s_v1_36_runtime_event_reducer.test.mjs",
  "node ci/guards/s_v1_36_runtime_event_reducer_guard.mjs"
]) {
  if (!packageJsonText.includes(requiredCommand)) {
    fail(`package.json lint:fast missing S-V1-36 command: ${requiredCommand}`);
  }
}

if (!guardsIndexText.includes("s_v1_36_runtime_event_reducer_guard.mjs")) {
  fail("docs/GUARDS_INDEX.md does not index S-V1-36 guard. Run npm run guard:index.");
}

if (!failureTokenIndexText.includes(TOKEN)) {
  fail("docs/dev/FAILURE_TOKEN_INDEX.md does not index S-V1-36 token.");
}

assert.ok(guardText.includes(TOKEN));

console.log(JSON.stringify({
  ok: true,
  guard: "S-V1-36",
  token: TOKEN,
  message: "Runtime event reducer v1 contract passed."
}));
