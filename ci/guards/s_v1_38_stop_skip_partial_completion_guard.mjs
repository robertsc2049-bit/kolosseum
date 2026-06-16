// @law: Repo Governance
// @severity: medium
// @scope: repo
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repo = process.cwd();
const TOKEN = "CI_V1_STOP_SKIP_PARTIAL_COMPLETION";

function readText(relativePath) {
  return fs.readFileSync(path.join(repo, relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function fail(message, details = {}) {
  const report = {
    ok: false,
    guard: "S-V1-38",
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
    fail(`Missing required S-V1-38 file: ${relativePath}`);
  }
}

const files = {
  source: "src/v1StopSkipPartialCompletionFlow.mjs",
  test: "test/s_v1_38_stop_skip_partial_completion.test.mjs",
  guard: "ci/guards/s_v1_38_stop_skip_partial_completion_guard.mjs",
  fixture: "ci/fixtures/v1_stop_skip_partial_completion/s_v1_38_stop_skip_partial_completion_cases.json",
  copy: "copy/stop_skip_partial_completion_copy.json",
  doc: "docs/v1/V1_STOP_SKIP_PARTIAL_COMPLETION.md",
  devDoc: "docs/dev/S_V1_38_STOP_SKIP_PARTIAL_COMPLETION_DEV_NOTE.md",
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
const devDocText = readText(files.devDoc);
const packageJsonText = readText(files.packageJson);
const guardsIndexText = readText(files.guardsIndex);
const failureTokenIndexText = readText(files.failureTokenIndex);

if (!sourceText.includes("DEV NOTE:")) {
  fail("S-V1-38 source must include a targeted DEV NOTE.");
}

if (/@kolosseum\/engine|from\s+["']\.\.\/engine|from\s+["'].*\/engine\//u.test(sourceText)) {
  fail("S-V1-38 must not import engine modules.");
}

for (const requiredExport of [
  "buildStopSkipPartialCompletionFlow",
  "tryBuildStopSkipPartialCompletionFlow",
  "handleV1StopSkipPartialCompletionRequest",
  "stopSkipPartialCompletionContract"
]) {
  if (!sourceText.includes(requiredExport)) {
    fail(`S-V1-38 source missing export marker: ${requiredExport}`);
  }
}

for (const requiredMarker of [
  "STOP_SESSION",
  "SKIP_WORK_ITEM",
  "PARTIAL_COMPLETE_WORK_ITEM",
  "recorded_event_log_only",
  "prior_truth_mutated: false",
  "includes_only_recorded_events: true",
  "emits_factual_runtime_event: true",
  "changes_prior_events: false",
  "adds_judgement_value: false"
]) {
  if (!sourceText.includes(requiredMarker)) {
    fail(`S-V1-38 source missing invariant marker: ${requiredMarker}`);
  }
}

for (const forbiddenInputMarker of [
  "coach_live_change",
  "coach_override",
  "billing_state",
  "ui_state",
  "engine_truth_override",
  "judgement_language",
  "score_value"
]) {
  if (!sourceText.includes(forbiddenInputMarker)) {
    fail(`S-V1-38 source must explicitly forbid marker: ${forbiddenInputMarker}`);
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
    fail(`S-V1-38 source contains blocked fragment: ${blockedFragment}`);
  }

  if (docText.toLowerCase().includes(blockedFragment)) {
    fail(`S-V1-38 doc contains blocked fragment: ${blockedFragment}`);
  }

  for (const entry of copyEntries) {
    if (String(entry.text ?? "").toLowerCase().includes(blockedFragment)) {
      fail(`S-V1-38 copy contains blocked fragment: ${entry.copy_id}`);
    }
  }
}

const blockedCopyFragments = [
  ["good", " ", "adher", "ence"].join(""),
  ["bad", " ", "adher", "ence"].join(""),
  ["poor", " ", "adher", "ence"].join(""),
  ["adher", "ence", " ", "score"].join(""),
  ["coaching", " ", "ad", "vice"].join(""),
  ["judg", "ement"].join(""),
  ["judg", "ment"].join("")
];

for (const entry of copyEntries) {
  const text = String(entry.text ?? "").toLowerCase();
  for (const fragment of blockedCopyFragments) {
    if (text.includes(fragment)) {
      fail(`S-V1-38 copy contains blocked copy fragment: ${entry.copy_id}`, { fragment });
    }
  }
}

if (fixture.slice_id !== "S-V1-38") {
  fail("S-V1-38 fixture slice_id mismatch.");
}

if (!fixture.session || !Array.isArray(fixture.started_events) || !Array.isArray(fixture.negative_cases)) {
  fail("S-V1-38 fixture must include session, started_events, and negative_cases.");
}

for (const expectedReason of [
  "action_invalid",
  "session_terminal",
  "split_open",
  "partial_quantity_invalid",
  "unknown_work_item",
  "work_item_terminal",
  "forbidden_scope_field",
  "event_invalid"
]) {
  if (!fixture.negative_cases.some((testCase) => testCase.expected_reason === expectedReason)) {
    fail(`S-V1-38 fixture missing negative reason: ${expectedReason}`);
  }
}

assert.equal(Array.isArray(copyEntries), true, "S-V1-38 copy file must be an array.");

for (const copyId of [
  "STOP_SKIP_PARTIAL_TITLE",
  "STOP_SKIP_PARTIAL_STOP_ACTION",
  "STOP_SKIP_PARTIAL_SKIP_ACTION",
  "STOP_SKIP_PARTIAL_PARTIAL_ACTION",
  "STOP_SKIP_PARTIAL_STOP_RECORDED",
  "STOP_SKIP_PARTIAL_SKIP_RECORDED",
  "STOP_SKIP_PARTIAL_PARTIAL_RECORDED",
  "STOP_SKIP_PARTIAL_HISTORY_LABEL"
]) {
  if (!copyEntries.some((entry) => entry.copy_id === copyId && entry.surface_id === "v1_stop_skip_partial_completion_flow")) {
    fail(`S-V1-38 copy id missing or wrong surface: ${copyId}`);
  }
}

for (const requiredTestMarker of [
  "records stop as a factual session event",
  "records skip as a factual work-item event",
  "records partial completion as factual quantity payload",
  "history reflects recorded events only",
  "copy lint keeps stop skip partial copy factual"
]) {
  if (!testText.includes(requiredTestMarker)) {
    fail(`S-V1-38 test missing proof marker: ${requiredTestMarker}`);
  }
}

for (const requiredDocLine of [
  "Events are factual",
  "Copy remains factual and non-judgemental",
  "History reflects recorded events only"
]) {
  if (!docText.includes(requiredDocLine)) {
    fail(`S-V1-38 doc missing invariant line: ${requiredDocLine}`);
  }
}

for (const requiredDevDocLine of [
  "records STOP_SESSION, SKIP_WORK_ITEM, and PARTIAL_COMPLETE_WORK_ITEM events",
  "reject invalid partial quantity payloads",
  "do not alter prior events"
]) {
  if (!devDocText.includes(requiredDevDocLine)) {
    fail(`S-V1-38 dev doc missing boundary line: ${requiredDevDocLine}`);
  }
}

for (const requiredCommand of [
  "node --test test/s_v1_38_stop_skip_partial_completion.test.mjs",
  "node ci/guards/s_v1_38_stop_skip_partial_completion_guard.mjs"
]) {
  if (!packageJsonText.includes(requiredCommand)) {
    fail(`package.json lint:fast missing S-V1-38 command: ${requiredCommand}`);
  }
}

if (!guardsIndexText.includes("s_v1_38_stop_skip_partial_completion_guard.mjs")) {
  fail("docs/GUARDS_INDEX.md does not index S-V1-38 guard. Run npm run guard:index.");
}

if (!failureTokenIndexText.includes(TOKEN)) {
  fail("docs/dev/FAILURE_TOKEN_INDEX.md does not index S-V1-38 token.");
}

assert.ok(guardText.includes(TOKEN));

console.log(JSON.stringify({
  ok: true,
  guard: "S-V1-38",
  token: TOKEN,
  message: "Stop skip partial completion flow passed."
}));
