// @law: Repo Governance
// @severity: medium
// @scope: repo
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const GUARD = "S-V1-40";
const TOKEN = "CI_V1_ATHLETE_FACTUAL_HISTORY";

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

function readText(path) {
  if (!fs.existsSync(path)) {
    fail("Missing required S-V1-40 file.", { path });
    return "";
  }

  return fs.readFileSync(path, "utf8").replace(/\r\n/g, "\n");
}

function readJson(path) {
  const text = readText(path);
  try {
    return JSON.parse(text);
  } catch (error) {
    fail("Required S-V1-40 JSON file is invalid.", {
      path,
      error: String(error?.message || error)
    });
    return null;
  }
}

function assertIncludes(path, text, marker) {
  if (!text.includes(marker)) {
    fail("Required S-V1-40 marker missing.", {
      path,
      marker
    });
  }
}

function assertNotMatches(path, text, pattern, label) {
  if (pattern.test(text)) {
    fail(`Forbidden S-V1-40 ${label}.`, {
      path
    });
  }
}

const files = {
  module: "src/athleteFactualHistory.mjs",
  api: "src/api/athleteFactualHistoryApi.mjs",
  test: "test/s_v1_40_athlete_factual_history.test.mjs",
  guard: "ci/guards/s_v1_40_athlete_factual_history_guard.mjs",
  fixture: "ci/fixtures/v1_athlete_factual_history/s_v1_40_athlete_factual_history_cases.json",
  copy: "copy/athlete_factual_history_copy.json",
  doc: "docs/v1/V1_ATHLETE_FACTUAL_HISTORY.md",
  packageJson: "package.json",
  guardsIndex: "docs/GUARDS_INDEX.md",
  failureTokenIndex: "docs/dev/FAILURE_TOKEN_INDEX.md",
  checksums: "docs/checksums.sha256"
};

for (const file of Object.values(files)) {
  readText(file);
}

const moduleText = readText(files.module);
const apiText = readText(files.api);
const testText = readText(files.test);
const guardText = readText(files.guard);
const fixtureText = readText(files.fixture);
const copyText = readText(files.copy);
const docText = readText(files.doc);
const packageText = readText(files.packageJson);
const guardsIndexText = readText(files.guardsIndex);
const failureTokenIndexText = readText(files.failureTokenIndex);
const checksumsText = readText(files.checksums);

for (const marker of [
  "DEV NOTE:",
  "athleteFactualHistoryContract",
  "surface_id: \"v1_athlete_factual_history\"",
  "slice_id: \"S-V1-40\"",
  "permission_surface_id: \"factual_history\"",
  "buildAthleteFactualHistoryReadModel",
  "tryBuildAthleteFactualHistoryReadModel",
  "buildAthleteFactualHistoryViewModel",
  "stableAthleteFactualHistoryJson",
  "recorded_facts_only: true",
  "writes_storage: false",
  "appends_runtime_event: false",
  "calls_engine: false"
]) {
  assertIncludes(files.module, moduleText, marker);
}

for (const marker of [
  "handleAthleteFactualHistoryRequest",
  "buildAthleteFactualHistoryReadModel",
  "buildAthleteFactualHistoryViewModel",
  "status: 200",
  "status: 403"
]) {
  assertIncludes(files.api, apiText, marker);
}

for (const marker of [
  "S-V1-40 athlete can view own recorded history",
  "S-V1-40 unassigned viewers are rejected without mutating input",
  "S-V1-40 read model includes only target athlete recorded sessions and events",
  "S-V1-40 API adapter returns read model and UI model",
  "S-V1-40 copy lint keeps athlete history copy factual"
]) {
  assertIncludes(files.test, testText, marker);
}

for (const marker of [
  "\"slice_id\": \"S-V1-40\"",
  "\"athlete_user_id\": \"athlete_001\"",
  "\"other_athlete_rejected\"",
  "\"unassigned_coach_rejected\"",
  "\"history_counts\": true"
]) {
  assertIncludes(files.fixture, fixtureText, marker);
}

for (const marker of [
  "ATHLETE_FACTUAL_HISTORY_TITLE",
  "ATHLETE_FACTUAL_HISTORY_READ_ONLY_NOTICE",
  "This view shows recorded facts only."
]) {
  assertIncludes(files.copy, copyText, marker);
}

for (const marker of [
  "Slice: S-V1-40",
  "Surface: `v1_athlete_factual_history`",
  "History shows recorded facts only.",
  "No inference.",
  "Athlete can view own history.",
  "No analytics dashboards, rankings, readiness labels, or effectiveness claims."
]) {
  assertIncludes(files.doc, docText, marker);
}

for (const marker of [
  "node --test test/s_v1_40_athlete_factual_history.test.mjs",
  "node ci/guards/s_v1_40_athlete_factual_history_guard.mjs"
]) {
  assertIncludes(files.packageJson, packageText, marker);
}

assertIncludes(files.guardsIndex, guardsIndexText, "s_v1_40_athlete_factual_history_guard.mjs");
assertIncludes(files.failureTokenIndex, failureTokenIndexText, TOKEN);

if (checksumsText.trim().length === 0) {
  fail("checksums file must not be empty after hash:write.");
}

for (const [path, text] of Object.entries({
  [files.module]: moduleText,
  [files.api]: apiText,
  [files.copy]: copyText
})) {
  assertNotMatches(path, text, /\b(readiness|fatigue|adherence score|recommended|recommendation|effectiveness|ranking|rankings|dashboard|diagnose|prescribe|optimise|optimize)\b/i, "claim or judgement language");
  assertNotMatches(path, text, /from\s+["'].*engine|@kolosseum\/engine/, "engine import");
}

const copy = readJson(files.copy);
if (!Array.isArray(copy) || copy.length < 8) {
  fail("S-V1-40 copy surface is unexpectedly small.");
}

for (const entry of copy) {
  if (entry.surface_id !== "athlete_factual_history") {
    fail("S-V1-40 copy entry has wrong surface_id.", {
      copy_id: entry.copy_id
    });
  }
}

const fixture = readJson(files.fixture);
if (fixture.slice_id !== "S-V1-40") {
  fail("S-V1-40 fixture slice_id mismatch.");
}

const child = spawnSync(process.execPath, ["--test", "test/s_v1_40_athlete_factual_history.test.mjs"], {
  encoding: "utf8",
  stdio: "pipe"
});

if (child.status !== 0) {
  fail("S-V1-40 target test failed from guard.", {
    stdout: child.stdout,
    stderr: child.stderr
  });
}

if (!guardText.includes(TOKEN)) {
  fail("S-V1-40 guard must include uppercase CI token.");
}

if (process.exitCode && process.exitCode !== 0) {
  throw new Error("S-V1-40 athlete factual history guard failed.");
}

console.log(JSON.stringify({
  ok: true,
  guard: GUARD,
  token: TOKEN,
  message: "Athlete factual history passed."
}));
