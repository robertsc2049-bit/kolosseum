// @law: Repo Governance
// @severity: medium
// @scope: repo
/**
 * DEV NOTE: S-V1-U-03 coach review queue guard.
 * Purpose: proves the coach review queue stays factual, assigned-only, copy-backed, and engine-inert.
 * Boundary: checks source, API, projection, copy, docs, fixture, package wiring, generated indexes, and target tests.
 * Determinism: reads committed files only and emits a stable token.
 * Failure: emits CI_V1_COACH_REVIEW_QUEUE when queue scope widens or proof surfaces drift.
 */

import fs from "node:fs";
import { spawnSync } from "node:child_process";

const GUARD = "S-V1-U-03";
const TOKEN = "CI_V1_COACH_REVIEW_QUEUE";

const files = {
  module: "src/coachReviewQueue.mjs",
  api: "src/api/coachReviewQueueApi.mjs",
  projection: "src/coachReviewQueueProjection.mjs",
  copy: "copy/coach_review_queue_copy.json",
  doc: "docs/v1/V1_COACH_REVIEW_QUEUE.md",
  releaseBoundary: "docs/v1/V1_RELEASE_BOUNDARY.md",
  acceptanceGate: "docs/v1/V1_ACCEPTANCE_GATE.md",
  notInScope: "docs/v1/V1_NOT_IN_SCOPE.md",
  authorityMap: "docs/v1/V1_DOC_AUTHORITY_MAP.md",
  fixture: "ci/fixtures/v1_coach_review_queue/s_v1_u_03_coach_review_queue_cases.json",
  test: "test/s_v1_u_03_coach_review_queue.test.mjs",
  packageJson: "package.json",
  guardsIndex: "docs/GUARDS_INDEX.md",
  failureTokenIndex: "docs/dev/FAILURE_TOKEN_INDEX.md",
  checksums: "docs/checksums.sha256"
};

function read(path) {
  try {
    return fs.readFileSync(path, "utf8");
  } catch (error) {
    fail(`${path} missing or unreadable: ${error.message}`);
    return "";
  }
}

function fail(details) {
  console.error(JSON.stringify({
    ok: false,
    guard: GUARD,
    token: TOKEN,
    details
  }, null, 2));
  process.exitCode = 1;
}

function assertIncludes(text, needle, path) {
  if (!text.includes(needle)) {
    fail(`${path} missing required marker: ${needle}`);
  }
}

function assertNotMatches(text, regex, path, label) {
  if (regex.test(text)) {
    fail(`${path} contains forbidden ${label}: ${regex}`);
  }
}

const moduleText = read(files.module);
const apiText = read(files.api);
const projectionText = read(files.projection);
const copyText = read(files.copy);
const docText = read(files.doc);
const releaseBoundaryText = read(files.releaseBoundary);
const acceptanceText = read(files.acceptanceGate);
const notInScopeText = read(files.notInScope);
const authorityMapText = read(files.authorityMap);
const fixtureText = read(files.fixture);
const testText = read(files.test);
const packageText = read(files.packageJson);
const guardsIndexText = read(files.guardsIndex);
const failureTokenIndexText = read(files.failureTokenIndex);
const checksumsText = read(files.checksums);

assertIncludes(moduleText, "export function buildCoachReviewQueue", files.module);
assertIncludes(moduleText, "review_status_values", files.module);
assertIncludes(moduleText, "engine_visible: false", files.module);
assertIncludes(moduleText, "coach_review_queue_unknown_field", files.module);
assertIncludes(moduleText, "serialiseCoachReviewQueueProbe", files.module);
assertIncludes(apiText, "export function handleCoachReviewQueueRequest", files.api);
assertIncludes(apiText, "coach_review_queue_actor_not_coach", files.api);
assertIncludes(projectionText, "export function projectCoachReviewQueue", files.projection);
assertIncludes(projectionText, 'TITLE_COPY_ID = "coach_review_queue.title"', files.projection);
assertIncludes(projectionText, 'STATUS_COPY_ID = "coach_review_queue.review_status"', files.projection);

assertIncludes(copyText, '"copy_id": "coach_review_queue.title"', files.copy);
assertIncludes(copyText, '"copy_text": "Coach review queue"', files.copy);
assertIncludes(copyText, '"copy_id": "coach_review_queue.review_status"', files.copy);

assertIncludes(docText, "S-V1-U-03", files.doc);
assertIncludes(docText, "The coach interprets the queue. Kolosseum does not.", files.doc);
assertIncludes(docText, "The queue must be engine-inert.", files.doc);

assertIncludes(releaseBoundaryText, "<!-- S-V1-U-03:COACH-REVIEW-QUEUE:START -->", files.releaseBoundary);
assertIncludes(acceptanceText, "<!-- S-V1-U-03:COACH-REVIEW-QUEUE-ACCEPTANCE:START -->", files.acceptanceGate);
assertIncludes(notInScopeText, "<!-- S-V1-U-03:COACH-REVIEW-QUEUE-NON-SCOPE:START -->", files.notInScope);
assertIncludes(authorityMapText, "S-V1-U-03", files.authorityMap);

assertIncludes(fixtureText, '"slice_id": "S-V1-U-03"', files.fixture);
assertIncludes(fixtureText, '"coach_review_queue": true', files.fixture);
assertIncludes(testText, "S-V1-U-03 returns assigned coach review rows only", files.test);
assertIncludes(testText, "S-V1-U-03 projection emits copy ids", files.test);
assertIncludes(testText, "S-V1-U-03 queue does not alter deterministic probe input", files.test);

assertIncludes(packageText, "node --test test/s_v1_u_03_coach_review_queue.test.mjs", files.packageJson);
assertIncludes(packageText, "node ci/guards/s_v1_u_03_coach_review_queue_guard.mjs", files.packageJson);
assertIncludes(guardsIndexText, "s_v1_u_03_coach_review_queue_guard.mjs", files.guardsIndex);
assertIncludes(failureTokenIndexText, TOKEN, files.failureTokenIndex);

if (checksumsText.trim().length === 0) {
  fail(`${files.checksums} must not be empty after hash:write.`);
}

for (const [file, text] of Object.entries({
  [files.module]: moduleText,
  [files.api]: apiText,
  [files.projection]: projectionText,
  [files.copy]: copyText,
  [files.fixture]: fixtureText
})) {
  assertNotMatches(text, /\b(recommendation|recommended|alert|intervention|risk|fatigue|readiness|score|scoring|priority|urgent|adherence|should)\b/i, file, "advisory or claim language");
  assertNotMatches(text, /from\s+["'].*engine|@kolosseum\/engine/, file, "engine import");
}

const child = spawnSync(process.execPath, ["--test", "test/s_v1_u_03_coach_review_queue.test.mjs"], {
  encoding: "utf8",
  stdio: "pipe"
});

if (child.status !== 0) {
  fail(`${TOKEN}: S-V1-U-03 tests failed\n${child.stdout}\n${child.stderr}`);
}

if (process.exitCode && process.exitCode !== 0) {
  throw new Error("S-V1-U-03 guard failed.");
}

console.log(JSON.stringify({
  ok: true,
  guard: GUARD,
  token: TOKEN,
  message: "Coach review queue passed."
}));