// @law: Repo Governance
// @severity: medium
// @scope: repo
/**
 * DEV NOTE: S-V1-42 coach notes engine-invisible guard.
 * Purpose: proves the existing coach notes product surface remains outside deterministic engine inputs and related proof surfaces.
 * Boundary: checks server API source, existing coach notes tests, v1 compile rejection, factual artefact isolation, copy surface, docs, generated indexes, and lint registration.
 * Determinism: reads committed files only and emits one stable failure token.
 * Failure: emits CI_V1_COACH_NOTES_ENGINE_INVISIBLE when the note surface can affect deterministic artefacts or loses assigned relationship checks.
 */

import fs from "node:fs";
import { spawnSync } from "node:child_process";

const GUARD = "S-V1-42";
const TOKEN = "CI_V1_COACH_NOTES_ENGINE_INVISIBLE";

const FILES = Object.freeze({
  source: "server/api/coachNotes.ts",
  existingTest: "server/api/__tests__/coachNotes.test.ts",
  copy: "ui/copy/coach_notes_copy.json",
  compileInput: "src/v1CompileInputCanonicalisation.mjs",
  factualArtefactView: "src/coachFactualArtefactView.mjs",
  relationshipPermission: "src/relationshipPermissionGuards.mjs",
  noCouplingGuard: "ci/scripts/run_v0_no_coupling_engine_boundary_guard.mjs",
  sliceTest: "test/s_v1_42_coach_notes_engine_invisible.test.mjs",
  docs: "docs/v1/V1_COACH_NOTES_ENGINE_INVISIBLE.md",
  packageJson: "package.json",
  guardsIndex: "docs/GUARDS_INDEX.md",
  failureTokenIndex: "docs/dev/FAILURE_TOKEN_INDEX.md",
  checksums: "docs/checksums.sha256"
});

function fail(message, details = {}) {
  console.error(JSON.stringify({
    ok: false,
    guard: GUARD,
    token: TOKEN,
    message,
    details
  }, null, 2));
  process.exitCode = 1;
}

function read(file) {
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

function assertNotIncludes(text, needle, file) {
  if (text.includes(needle)) {
    fail(`${file} must not include ${needle}`);
  }
}

const source = read(FILES.source);
const existingTest = read(FILES.existingTest);
const copy = read(FILES.copy);
const compileInput = read(FILES.compileInput);
const factualArtefactView = read(FILES.factualArtefactView);
const relationshipPermission = read(FILES.relationshipPermission);
const noCouplingGuard = read(FILES.noCouplingGuard);
const sliceTest = read(FILES.sliceTest);
const docs = read(FILES.docs);
const packageJson = read(FILES.packageJson);
const guardsIndex = read(FILES.guardsIndex);
const failureTokenIndex = read(FILES.failureTokenIndex);
const checksums = read(FILES.checksums);

for (const required of [
  "export function createCoachNote",
  "export function updateCoachNote",
  "export function softDeleteCoachNote",
  "export function getCoachNotesForSession",
  "export function compileIgnoringCoachNotes",
  "export function projectArtefactWithoutCoachNotes",
  "void coachNotes;",
  "return cloneJson(artefact);",
  "hasAcceptedCoachAthleteLink",
  "non_binding: true",
  "separated_from_factual_artefacts: true"
]) {
  assertIncludes(source, required, FILES.source);
}

for (const forbidden of [
  "@kolosseum/engine",
  "from \"../engine",
  "from \"./engine",
  "from \"../../engine",
  "engine/src/"
]) {
  assertNotIncludes(source, forbidden, FILES.source);
}

for (const required of [
  "note creation does not change engine output",
  "note creation does not change session artefact",
  "unlinked coach cannot create note",
  "revoked link blocks note creation",
  "invited rejected and expired links block note creation",
  "athlete cannot create coach note",
  "revoked link blocks future note visibility"
]) {
  assertIncludes(existingTest, required, FILES.existingTest);
}

for (const required of [
  "\"coach_note\"",
  "\"coach_notes\"",
  "v1_compile_input_forbidden_non_engine_field_refused"
]) {
  assertIncludes(compileInput, required, FILES.compileInput);
}

for (const required of [
  "\"coach_note\"",
  "\"coach_notes\"",
  "reads_coach_notes: false",
  "calls_engine: false"
]) {
  assertIncludes(factualArtefactView, required, FILES.factualArtefactView);
}

for (const required of [
  "\"coach_notes\"",
  "coach_notes: \"coach_notes\""
]) {
  assertIncludes(relationshipPermission, required, FILES.relationshipPermission);
}

for (const required of [
  "\"/coach-notes/\"",
  "\"/coach_notes/\""
]) {
  assertIncludes(noCouplingGuard, required, FILES.noCouplingGuard);
}

for (const required of [
  "COACH_NOTE_STORED_SEPARATELY",
  "COACH_NOTE_NOT_ENGINE_INPUT",
  "COACH_NOTE_DOES_NOT_CHANGE_ARTEFACT"
]) {
  assertIncludes(copy, required, FILES.copy);
}

for (const required of [
  "S-V1-42",
  "Coach notes remain product-layer records only.",
  "No engine input field may include coach notes.",
  "No compile, replay, substitution, proof, or history surface may consume coach notes."
]) {
  assertIncludes(docs, required, FILES.docs);
}

for (const required of [
  "node --test test/s_v1_42_coach_notes_engine_invisible.test.mjs",
  "node ci/guards/s_v1_42_coach_notes_engine_invisible_guard.mjs"
]) {
  assertIncludes(packageJson, required, FILES.packageJson);
}

assertIncludes(guardsIndex, "s_v1_42_coach_notes_engine_invisible_guard.mjs", FILES.guardsIndex);
assertIncludes(failureTokenIndex, TOKEN, FILES.failureTokenIndex);

if (checksums.trim().length === 0) {
  fail(`${FILES.checksums} must not be empty after hash:write.`);
}

const child = spawnSync(process.execPath, ["--test", FILES.sliceTest], {
  encoding: "utf8",
  stdio: "pipe"
});

if (child.status !== 0) {
  fail("S-V1-42 slice test failed.", {
    stdout: child.stdout,
    stderr: child.stderr
  });
}

if (process.exitCode && process.exitCode !== 0) {
  throw new Error(`${GUARD} guard failed.`);
}

console.log(JSON.stringify({
  ok: true,
  guard: GUARD,
  token: TOKEN,
  message: "Coach notes remain engine-invisible."
}));