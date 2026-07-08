// @law: Repo Governance
// @severity: medium
// @scope: repo
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repo = process.cwd();
const TOKEN = "CI_V1_MOBILE_SESSION_EXECUTION_SHELL_DRIFT";

function rel(filePath) {
  return path.relative(repo, filePath).replaceAll(path.sep, "/");
}

function readText(relativePath) {
  return fs.readFileSync(path.join(repo, relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function fail(message, details = {}) {
  const report = {
    ok: false,
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
    fail(`Missing required S-V1-34 file: ${relativePath}`);
  }
  return absolute;
}

const files = {
  renderer: "src/mobileSessionExecutionShell.mjs",
  test: "test/s_v1_34_mobile_session_execution_shell.test.mjs",
  guard: "ci/guards/s_v1_34_mobile_session_execution_shell_guard.mjs",
  copy: "copy/mobile_session_execution_shell_copy.json",
  fixture: "ci/fixtures/v1_mobile_session_execution_shell/s_v1_34_mobile_session_execution_shell_cases.json",
  doc: "docs/v1/V1_MOBILE_SESSION_EXECUTION_SHELL.md",
  packageJson: "package.json",
  guardsIndex: "docs/GUARDS_INDEX.md",
  failureTokenIndex: "docs/dev/FAILURE_TOKEN_INDEX.md"
};

for (const file of Object.values(files)) {
  assertFile(file);
}

const rendererText = readText(files.renderer);
const testText = readText(files.test);
const guardText = readText(files.guard);
const docText = readText(files.doc);
const packageJsonText = readText(files.packageJson);
const guardsIndexText = readText(files.guardsIndex);

if (!rendererText.includes("DEV NOTE:")) {
  fail("S-V1-34 renderer must include a targeted DEV NOTE.");
}

if (/@kolosseum\/engine|from\s+["']\.\.\/engine|from\s+["'].*\/engine\//.test(rendererText)) {
  fail("S-V1-34 renderer must not import engine modules.");
}

if (!rendererText.includes("renderMobileSessionExecutionShell")) {
  fail("S-V1-34 renderer must export renderMobileSessionExecutionShell.");
}

if (!rendererText.includes("emits_runtime_event: false")) {
  fail("S-V1-34 renderer must declare that it does not emit runtime events.");
}

if (!rendererText.includes("writes_storage: false")) {
  fail("S-V1-34 renderer must declare that it does not write storage.");
}

if (!rendererText.includes("changes_engine_output: false")) {
  fail("S-V1-34 renderer must declare that it does not change engine output.");
}

for (const blocked of ["coach_live_mutation", "communication_surface", "media_surface", "interpreted_condition_label"]) {
  if (rendererText.includes(blocked)) {
    fail(`S-V1-34 renderer contains excluded surface marker: ${blocked}`);
  }
}

const copyEntries = readJson(files.copy);
assert.equal(Array.isArray(copyEntries), true, "S-V1-34 copy file must be an array.");
assert.equal(copyEntries.length >= 10, true, "S-V1-34 copy surface is unexpectedly small.");

const copyIds = new Set(copyEntries.map((entry) => entry.copy_id));
const requiredCopyIds = [
  "MOBILE_SESSION_EXECUTION_TITLE",
  "MOBILE_SESSION_EXECUTION_STATUS_LABEL",
  "MOBILE_SESSION_EXECUTION_WORK_ITEMS_LABEL",
  "MOBILE_SESSION_EXECUTION_CURRENT_ITEM_LABEL",
  "MOBILE_SESSION_EXECUTION_SETS_LABEL",
  "MOBILE_SESSION_EXECUTION_REPS_LABEL",
  "MOBILE_SESSION_EXECUTION_LOAD_LABEL",
  "MOBILE_SESSION_EXECUTION_COMPLETE_ACTION",
  "MOBILE_SESSION_EXECUTION_SKIP_ACTION",
  "MOBILE_SESSION_EXECUTION_SPLIT_ACTION",
  "MOBILE_SESSION_EXECUTION_RETURN_CONTINUE_ACTION",
  "MOBILE_SESSION_EXECUTION_RETURN_SKIP_ACTION",
  "MOBILE_SESSION_EXECUTION_READ_ONLY_NOTICE",
  "MOBILE_SESSION_EXECUTION_NO_WORK_ITEMS"
];

for (const copyId of requiredCopyIds) {
  if (!copyIds.has(copyId)) {
    fail(`Missing S-V1-34 copy id: ${copyId}`);
  }
}

const blockedCopyFragments = [
  "read" + "iness",
  "fat" + "igue",
  "safe" + "ty",
  "reco" + "mmend",
  "opt" + "imal",
  "suit" + "able"
];

for (const entry of copyEntries) {
  const text = String(entry.text ?? "").toLowerCase();
  if (entry.surface_id !== "mobile_session_execution_shell") {
    fail(`S-V1-34 copy entry has wrong surface_id: ${entry.copy_id}`);
  }

  for (const blocked of blockedCopyFragments) {
    if (text.includes(blocked)) {
      fail(`S-V1-34 copy contains blocked fragment: ${entry.copy_id}`);
    }
  }
}

const fixture = readJson(files.fixture);
if (fixture.slice_id !== "S-V1-34") {
  fail("S-V1-34 fixture slice_id mismatch.");
}

if (!Array.isArray(fixture.cases) || fixture.cases.length < 2) {
  fail("S-V1-34 fixture must contain at least two cases.");
}

if (!testText.includes("low-input presentation changes layout only")) {
  fail("S-V1-34 test must prove presentation-only layout variance.");
}

if (!testText.includes("without mutating supplied values")) {
  fail("S-V1-34 test must prove input immutability.");
}

if (!testText.includes("copy ids are backed by the mobile execution copy surface")) {
  fail("S-V1-34 test must prove copy registry binding.");
}

for (const requiredDocLine of [
  "UI may display execution truth",
  "must not create, mutate, or reinterpret execution truth",
  "runtime event emission from the renderer"
]) {
  if (!docText.includes(requiredDocLine)) {
    fail(`S-V1-34 doc missing boundary line: ${requiredDocLine}`);
  }
}

for (const requiredCommand of [
  "node --test test/s_v1_34_mobile_session_execution_shell.test.mjs",
  "node ci/guards/s_v1_34_mobile_session_execution_shell_guard.mjs"
]) {
  if (!packageJsonText.includes(requiredCommand)) {
    fail(`package.json lint:fast missing S-V1-34 command: ${requiredCommand}`);
  }
}

if (!guardsIndexText.includes("s_v1_34_mobile_session_execution_shell_guard.mjs")) {
  fail("docs/GUARDS_INDEX.md does not index S-V1-34 guard. Run npm run guard:index.");
}


assert.ok(rel(path.join(repo, files.renderer)).length > 0);
assert.ok(guardText.includes(TOKEN));

console.log("OK: s_v1_34_mobile_session_execution_shell_guard");
