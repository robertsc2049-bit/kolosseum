// @law: Repo Governance
// @severity: medium
// @scope: repo
/**
 * DEV NOTE: S-V1-U-04 template assignment UI guard.
 * Purpose: proves the template assignment UI stays authorised-coach-only, copy-backed, hidden-internal-free, and engine-inert.
 * Boundary: checks source, API, projection, copy, docs, fixture, tests, package wiring, generated indexes, and target tests.
 * Determinism: reads committed files only and emits a stable token.
 * Failure: emits CI_V1_TEMPLATE_ASSIGNMENT_UI when the surface crosses assignment UI boundaries.
 */

import fs from "node:fs";
import { spawnSync } from "node:child_process";

const GUARD = "S-V1-U-04";
const TOKEN = "CI_V1_TEMPLATE_ASSIGNMENT_UI";

const files = {
  module: "src/v1TemplateAssignmentUi.mjs",
  api: "src/api/v1TemplateAssignmentUiApi.mjs",
  projection: "src/v1TemplateAssignmentProjection.mjs",
  copy: "copy/template_assignment_ui_copy.json",
  doc: "docs/v1/V1_TEMPLATE_ASSIGNMENT_UI.md",
  releaseBoundary: "docs/v1/V1_RELEASE_BOUNDARY.md",
  acceptanceGate: "docs/v1/V1_ACCEPTANCE_GATE.md",
  notInScope: "docs/v1/V1_NOT_IN_SCOPE.md",
  authorityMap: "docs/v1/V1_DOC_AUTHORITY_MAP.md",
  test: "test/s_v1_u_04_template_assignment_ui.test.mjs",
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

function assertNotIncludes(text, needle, path) {
  if (text.includes(needle)) {
    fail(`${path} contains forbidden marker: ${needle}`);
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
const testText = read(files.test);
const packageText = read(files.packageJson);
const guardsIndexText = read(files.guardsIndex);
const failureTokenIndexText = read(files.failureTokenIndex);
const checksumsText = read(files.checksums);

assertIncludes(moduleText, "export function buildTemplateAssignmentUi", files.module);
assertIncludes(moduleText, "export function submitTemplateAssignmentFromUi", files.module);
assertIncludes(moduleText, "HIDDEN_INTERNAL_KEYS", files.module);
assertIncludes(moduleText, "template_assignment_ui_hidden_internal_present", files.module);
assertIncludes(moduleText, "declared_compile_path_required: true", files.module);
assertIncludes(moduleText, "engine_visible: false", files.module);
assertIncludes(apiText, "export function handleTemplateAssignmentUiRequest", files.api);
assertIncludes(apiText, "template_assignment_ui_actor_not_coach", files.api);
assertIncludes(projectionText, "export function projectTemplateAssignmentUi", files.projection);
assertIncludes(projectionText, 'TITLE_COPY_ID = "template_assignment_ui.title"', files.projection);
assertIncludes(copyText, '"copy_id": "template_assignment_ui.title"', files.copy);
assertIncludes(copyText, '"copy_text": "Template assignment"', files.copy);
assertIncludes(copyText, '"copy_id": "template_assignment_ui.submit"', files.copy);

assertIncludes(docText, "S-V1-U-04", files.doc);
assertIncludes(docText, "The UI is authorised-coach only.", files.doc);
assertIncludes(docText, "The UI must not expose hidden template internals.", files.doc);
assertIncludes(docText, "The UI is engine-inert.", files.doc);

assertIncludes(releaseBoundaryText, "<!-- S-V1-U-04:TEMPLATE-ASSIGNMENT-UI:START -->", files.releaseBoundary);
assertIncludes(acceptanceText, "<!-- S-V1-U-04:TEMPLATE-ASSIGNMENT-UI-ACCEPTANCE:START -->", files.acceptanceGate);
assertIncludes(notInScopeText, "<!-- S-V1-U-04:TEMPLATE-ASSIGNMENT-UI-NON-SCOPE:START -->", files.notInScope);
assertIncludes(authorityMapText, "<!-- S-V1-U-04:DOC-AUTHORITY:START -->", files.authorityMap);

assertIncludes(testText, "S-V1-U-04 builds assignment UI for authorised coach only", files.test);
assertIncludes(testText, "S-V1-U-04 rejects template hidden internals before UI exposure", files.test);
assertIncludes(testText, "S-V1-U-04 assignment UI cannot mutate deterministic probe", files.test);

assertIncludes(packageText, "node --test test/s_v1_u_04_template_assignment_ui.test.mjs", files.packageJson);
assertIncludes(packageText, "node ci/guards/s_v1_u_04_template_assignment_ui_guard.mjs", files.packageJson);
assertIncludes(guardsIndexText, "s_v1_u_04_template_assignment_ui_guard.mjs", files.guardsIndex);
assertIncludes(failureTokenIndexText, TOKEN, files.failureTokenIndex);

if (checksumsText.trim().length === 0) {
  fail(`${files.checksums} must not be empty after hash:write.`);
}

for (const [file, text] of Object.entries({
  [files.module]: moduleText,
  [files.api]: apiText,
  [files.projection]: projectionText,
  [files.copy]: copyText,
})) {
  assertNotMatches(text, /\b(marketplace|royalty|royalties|revenue[_ -]?share|coach-to-coach|coach to coach|licence sale|license sale|commerce)\b/i, file, "commerce or sharing scope");
  assertNotMatches(text, /\b(recommendation|recommended|alert|intervention|risk|fatigue|readiness|score|scoring|priority|urgent|adherence|optimal|effective|suitable|safe)\b/i, file, "advisory or claim language");
  assertNotMatches(text, /from\s+["'].*engine|@kolosseum\/engine/, file, "engine import");
}

for (const forbiddenOutputField of [
  "formula_text:",
  "progression_logic:",
  "template_internals:",
  "calculation_source:"
]) {
  assertNotIncludes(moduleText, forbiddenOutputField, files.module);
  assertNotIncludes(projectionText, forbiddenOutputField, files.projection);
}

const child = spawnSync(process.execPath, ["--test", "test/s_v1_u_04_template_assignment_ui.test.mjs"], {
  encoding: "utf8",
  stdio: "pipe"
});

if (child.status !== 0) {
  fail(`${TOKEN}: S-V1-U-04 tests failed\n${child.stdout}\n${child.stderr}`);
}

if (process.exitCode && process.exitCode !== 0) {
  throw new Error("S-V1-U-04 guard failed.");
}

console.log(JSON.stringify({
  ok: true,
  guard: GUARD,
  token: TOKEN,
  message: "Template assignment UI passed."
}));
