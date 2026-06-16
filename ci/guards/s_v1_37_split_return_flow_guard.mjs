// @law: Repo Governance
// @severity: medium
// @scope: repo
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repo = process.cwd();
const TOKEN = "CI_V1_SPLIT_RETURN_FLOW";

function readText(relativePath) {
  return fs.readFileSync(path.join(repo, relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function fail(message, details = {}) {
  const report = {
    ok: false,
    guard: "S-V1-37",
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
    fail(`Missing required S-V1-37 file: ${relativePath}`);
  }
}

const files = {
  source: "src/v1SplitReturnFlow.mjs",
  test: "test/s_v1_37_split_return_flow.test.mjs",
  guard: "ci/guards/s_v1_37_split_return_flow_guard.mjs",
  fixture: "ci/fixtures/v1_split_return_flow/s_v1_37_split_return_flow_cases.json",
  copy: "copy/split_return_flow_copy.json",
  doc: "docs/v1/V1_SPLIT_RETURN_FLOW.md",
  devDoc: "docs/dev/S_V1_37_SPLIT_RETURN_FLOW_DEV_NOTE.md",
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
  fail("S-V1-37 source must include a targeted DEV NOTE.");
}

if (/@kolosseum\/engine|from\s+["']\.\.\/engine|from\s+["'].*\/engine\//u.test(sourceText)) {
  fail("S-V1-37 must not import engine modules.");
}

for (const requiredExport of [
  "buildSplitReturnFlow",
  "tryBuildSplitReturnFlow",
  "handleV1SplitReturnFlowRequest",
  "splitReturnFlowContract"
]) {
  if (!sourceText.includes(requiredExport)) {
    fail(`S-V1-37 source missing export marker: ${requiredExport}`);
  }
}

for (const requiredMarker of [
  "SPLIT_SESSION",
  "RETURN_CONTINUE",
  "RETURN_SKIP",
  "single_open_split_decision",
  "resolved_return_decision_rejected",
  "return_decision_already_resolved",
  "prior_truth_mutated: false",
  "emits_factual_runtime_event: true",
  "changes_prior_events: false"
]) {
  if (!sourceText.includes(requiredMarker)) {
    fail(`S-V1-37 source missing invariant marker: ${requiredMarker}`);
  }
}

for (const forbiddenInputMarker of [
  "coach_live_change",
  "coach_override",
  "billing_state",
  "ui_state",
  "engine_truth_override"
]) {
  if (!sourceText.includes(forbiddenInputMarker)) {
    fail(`S-V1-37 source must explicitly forbid marker: ${forbiddenInputMarker}`);
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
    fail(`S-V1-37 source contains blocked fragment: ${blockedFragment}`);
  }

  if (docText.toLowerCase().includes(blockedFragment)) {
    fail(`S-V1-37 doc contains blocked fragment: ${blockedFragment}`);
  }

  for (const entry of copyEntries) {
    if (String(entry.text ?? "").toLowerCase().includes(blockedFragment)) {
      fail(`S-V1-37 copy contains blocked fragment: ${entry.copy_id}`);
    }
  }
}

if (fixture.slice_id !== "S-V1-37") {
  fail("S-V1-37 fixture slice_id mismatch.");
}

if (!fixture.session || !Array.isArray(fixture.started_events) || !Array.isArray(fixture.split_events) || !Array.isArray(fixture.negative_cases)) {
  fail("S-V1-37 fixture must include session, started_events, split_events, and negative_cases.");
}

for (const expectedReason of [
  "action_invalid",
  "return_decision_not_open",
  "return_decision_already_resolved",
  "forbidden_scope_field",
  "event_invalid"
]) {
  if (!fixture.negative_cases.some((testCase) => testCase.expected_reason === expectedReason)) {
    fail(`S-V1-37 fixture missing negative reason: ${expectedReason}`);
  }
}

assert.equal(Array.isArray(copyEntries), true, "S-V1-37 copy file must be an array.");

for (const copyId of [
  "SPLIT_RETURN_FLOW_TITLE",
  "SPLIT_RETURN_FLOW_SPLIT_ACTION",
  "SPLIT_RETURN_FLOW_RETURN_CONTINUE_ACTION",
  "SPLIT_RETURN_FLOW_RETURN_SKIP_ACTION",
  "SPLIT_RETURN_FLOW_SPLIT_RECORDED",
  "SPLIT_RETURN_FLOW_RETURN_RECORDED",
  "SPLIT_RETURN_FLOW_DECISION_RESOLVED"
]) {
  if (!copyEntries.some((entry) => entry.copy_id === copyId && entry.surface_id === "v1_split_return_flow")) {
    fail(`S-V1-37 copy id missing or wrong surface: ${copyId}`);
  }
}

for (const requiredTestMarker of [
  "records split as factual event",
  "return continue clears the open split",
  "return skip deterministically skips remaining-at-split work",
  "rejects replay of a resolved return decision",
  "API adapter maps split and return outcomes"
]) {
  if (!testText.includes(requiredTestMarker)) {
    fail(`S-V1-37 test missing proof marker: ${requiredTestMarker}`);
  }
}

for (const requiredDocLine of [
  "Split and return are factual events",
  "Return does not mutate prior truth",
  "Return decision rules are deterministic",
  "Replaying a resolved return decision is rejected"
]) {
  if (!docText.includes(requiredDocLine)) {
    fail(`S-V1-37 doc missing invariant line: ${requiredDocLine}`);
  }
}

for (const requiredDevDocLine of [
  "creates factual SPLIT_SESSION, RETURN_CONTINUE, and RETURN_SKIP event records",
  "reject resolved return decisions",
  "do not alter prior events"
]) {
  if (!devDocText.includes(requiredDevDocLine)) {
    fail(`S-V1-37 dev doc missing boundary line: ${requiredDevDocLine}`);
  }
}

for (const requiredCommand of [
  "node --test test/s_v1_37_split_return_flow.test.mjs",
  "node ci/guards/s_v1_37_split_return_flow_guard.mjs"
]) {
  if (!packageJsonText.includes(requiredCommand)) {
    fail(`package.json lint:fast missing S-V1-37 command: ${requiredCommand}`);
  }
}

if (!guardsIndexText.includes("s_v1_37_split_return_flow_guard.mjs")) {
  fail("docs/GUARDS_INDEX.md does not index S-V1-37 guard. Run npm run guard:index.");
}

if (!failureTokenIndexText.includes(TOKEN)) {
  fail("docs/dev/FAILURE_TOKEN_INDEX.md does not index S-V1-37 token.");
}

assert.ok(guardText.includes(TOKEN));

console.log(JSON.stringify({
  ok: true,
  guard: "S-V1-37",
  token: TOKEN,
  message: "Split and return flow passed."
}));
