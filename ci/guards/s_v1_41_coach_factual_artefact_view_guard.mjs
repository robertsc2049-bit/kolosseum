// @law: Repo Governance
// @severity: medium
// @scope: repo
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const guard = "S-V1-41";
const TOKEN = "CI_V1_COACH_FACTUAL_ARTEFACT_VIEW";

function fail(message) {
  console.error(JSON.stringify({ ok: false, guard, token: TOKEN, message }, null, 2));
  process.exitCode = 1;
}

function readText(file) {
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

function assertNotMatches(text, pattern, file, label) {
  if (pattern.test(text)) {
    fail(`${file} contains forbidden ${label}`);
  }
}

const files = {
  module: "src/coachFactualArtefactView.mjs",
  api: "src/api/coachFactualArtefactViewApi.mjs",
  ui: "src/coachFactualArtefactViewUiRenderer.mjs",
  test: "test/s_v1_41_coach_factual_artefact_view.test.mjs",
  fixture: "ci/fixtures/v1_coach_factual_artefact_view/s_v1_41_coach_factual_artefact_view_cases.json",
  copy: "copy/coach_factual_artefact_view_copy.json",
  permissionGuard: "src/relationshipPermissionGuards.mjs",
  packageJson: "package.json",
  guardsIndex: "docs/GUARDS_INDEX.md",
  failureTokenIndex: "docs/dev/FAILURE_TOKEN_INDEX.md",
  checksums: "docs/checksums.sha256"
};

const moduleText = readText(files.module);
const apiText = readText(files.api);
const uiText = readText(files.ui);
const testText = readText(files.test);
const fixtureText = readText(files.fixture);
const copyText = readText(files.copy);
const permissionText = readText(files.permissionGuard);
const packageText = readText(files.packageJson);
const guardsIndexText = readText(files.guardsIndex);
const failureTokenIndexText = readText(files.failureTokenIndex);
const checksumsText = readText(files.checksums);

assertIncludes(moduleText, "DEV NOTE:", files.module);
assertIncludes(moduleText, "coachFactualArtefactViewContract", files.module);
assertIncludes(moduleText, "permission_surface_id: \"coach_factual_artefact_view\"", files.module);
assertIncludes(moduleText, "buildCoachFactualArtefactView", files.module);
assertIncludes(moduleText, "tryBuildCoachFactualArtefactView", files.module);
assertIncludes(moduleText, "stableCoachFactualArtefactViewJson", files.module);
assertIncludes(moduleText, "appends_runtime_event: false", files.module);
assertIncludes(moduleText, "mutates_session_state: false", files.module);
assertIncludes(moduleText, "calls_engine: false", files.module);
assertIncludes(moduleText, "reads_coach_notes: false", files.module);

assertIncludes(apiText, "handleCoachFactualArtefactViewRequest", files.api);
assertIncludes(uiText, "renderCoachFactualArtefactView", files.ui);
assertIncludes(copyText, "COACH_FACTUAL_ARTEFACT_VIEW_TITLE", files.copy);
assertIncludes(copyText, "COACH_FACTUAL_ARTEFACT_VIEW_FACTS_ONLY_NOTICE", files.copy);

assertIncludes(permissionText, "\"coach_factual_artefact_view\"", files.permissionGuard);
assertIncludes(permissionText, "coach_factual_artefact_view: \"coach_factual_artefact_view\"", files.permissionGuard);

assertIncludes(testText, "S-V1-41 assigned coach sees factual artefacts for assigned athlete only", files.test);
assertIncludes(testText, "S-V1-41 unassigned coach view is rejected", files.test);
assertIncludes(testText, "S-V1-41 API returns permitted view", files.test);
assertIncludes(testText, "S-V1-41 UI renderer uses copy ids", files.test);
assertIncludes(testText, "S-V1-41 refuses coach note fields", files.test);

assertIncludes(fixtureText, "\"slice_id\": \"S-V1-41\"", files.fixture);
assertIncludes(fixtureText, "\"coach_factual_artefact_view\": true", files.fixture);
assertIncludes(fixtureText, "\"unassigned_coach_rejected\"", files.fixture);

assertIncludes(packageText, "node --test test/s_v1_41_coach_factual_artefact_view.test.mjs", files.packageJson);
assertIncludes(packageText, "node ci/guards/s_v1_41_coach_factual_artefact_view_guard.mjs", files.packageJson);
assertIncludes(guardsIndexText, "s_v1_41_coach_factual_artefact_view_guard.mjs", files.guardsIndex);
assertIncludes(failureTokenIndexText, TOKEN, files.failureTokenIndex);

if (checksumsText.trim().length === 0) {
  fail(`${files.checksums} must not be empty after hash:write.`);
}

for (const [file, text] of Object.entries({
  [files.module]: moduleText,
  [files.api]: apiText,
  [files.ui]: uiText,
  [files.fixture]: fixtureText,
  [files.copy]: copyText
})) {
  assertNotMatches(text, /\b(readiness|fatigue|adherence score|recommended|recommendation|optimise|optimize|diagnose|prescribe)\b/i, file, "claim or judgement language");
  assertNotMatches(text, /from\s+["'].*engine|@kolosseum\/engine/, file, "engine import");
}

const child = spawnSync(process.execPath, ["--test", "test/s_v1_41_coach_factual_artefact_view.test.mjs"], {
  encoding: "utf8",
  stdio: "pipe"
});

if (child.status !== 0) {
  fail(`${TOKEN}: S-V1-41 tests failed\n${child.stdout}\n${child.stderr}`);
}

if (process.exitCode && process.exitCode !== 0) {
  throw new Error("S-V1-41 guard failed.");
}

console.log(JSON.stringify({
  ok: true,
  guard,
  token: TOKEN,
  message: "Coach factual artefact view contract passed."
}));