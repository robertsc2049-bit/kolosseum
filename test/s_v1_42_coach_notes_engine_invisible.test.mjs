import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const NOTE_SOURCE_PATH = "server/api/coachNotes.ts";
const NOTE_TEST_PATH = "server/api/__tests__/coachNotes.test.ts";
const NOTE_COPY_PATH = "ui/copy/coach_notes_copy.json";
const COMPILE_INPUT_PATH = "src/v1CompileInputCanonicalisation.mjs";
const FACTUAL_ARTEFACT_VIEW_PATH = "src/coachFactualArtefactView.mjs";
const RELATIONSHIP_PERMISSION_PATH = "src/relationshipPermissionGuards.mjs";
const NO_COUPLING_GUARD_PATH = "ci/scripts/run_v0_no_coupling_engine_boundary_guard.mjs";

function read(path) {
  assert.equal(fs.existsSync(path), true, `${path} must exist`);
  return fs.readFileSync(path, "utf8").replace(/\r\n/g, "\n");
}

function readIfExists(path) {
  return fs.existsSync(path) ? fs.readFileSync(path, "utf8").replace(/\r\n/g, "\n") : "";
}

function assertIncludes(text, needle, label) {
  assert.equal(text.includes(needle), true, `${label} must include ${needle}`);
}

function assertNotIncludes(text, needle, label) {
  assert.equal(text.includes(needle), false, `${label} must not include ${needle}`);
}

function assertNoEngineImport(text, label) {
  for (const forbidden of [
    "@kolosseum/engine",
    "from \"../engine",
    "from \"./engine",
    "from \"../../engine",
    "engine/src/"
  ]) {
    assertNotIncludes(text, forbidden, label);
  }
}

test("S-V1-42 keeps coach notes as product-layer records only", () => {
  const source = read(NOTE_SOURCE_PATH);

  assertIncludes(source, "DEV NOTE:", NOTE_SOURCE_PATH);
  assertIncludes(source, "export function createCoachNote", NOTE_SOURCE_PATH);
  assertIncludes(source, "export function updateCoachNote", NOTE_SOURCE_PATH);
  assertIncludes(source, "export function softDeleteCoachNote", NOTE_SOURCE_PATH);
  assertIncludes(source, "export function getCoachNotesForSession", NOTE_SOURCE_PATH);
  assertIncludes(source, "export function compileIgnoringCoachNotes", NOTE_SOURCE_PATH);
  assertIncludes(source, "export function projectArtefactWithoutCoachNotes", NOTE_SOURCE_PATH);
  assertIncludes(source, "non_binding: true", NOTE_SOURCE_PATH);
  assertIncludes(source, "separated_from_factual_artefacts: true", NOTE_SOURCE_PATH);
  assertIncludes(source, "COACH_NOTE_NOT_ENGINE_INPUT", NOTE_SOURCE_PATH);
  assertNoEngineImport(source, NOTE_SOURCE_PATH);
});

test("S-V1-42 proves coach notes are ignored by compile and artefact projection probes", () => {
  const source = read(NOTE_SOURCE_PATH);
  const existingTests = read(NOTE_TEST_PATH);

  assertIncludes(source, "void coachNotes;", NOTE_SOURCE_PATH);
  assertIncludes(source, "compile_scope: \"v0_phase1_to_phase6\"", NOTE_SOURCE_PATH);
  assertIncludes(source, "phase1_canonical_input: phase1CanonicalInput", NOTE_SOURCE_PATH);
  assertIncludes(source, "return cloneJson(artefact);", NOTE_SOURCE_PATH);

  assertIncludes(existingTests, "note creation does not change engine output", NOTE_TEST_PATH);
  assertIncludes(existingTests, "note creation does not change session artefact", NOTE_TEST_PATH);
  assertIncludes(existingTests, "compileIgnoringCoachNotes(phase1, store.notes)", NOTE_TEST_PATH);
  assertIncludes(existingTests, "projectArtefactWithoutCoachNotes(artefact, store.notes)", NOTE_TEST_PATH);
});

test("S-V1-42 blocks coach notes from v1 compile input and factual artefact read input", () => {
  const compileInput = read(COMPILE_INPUT_PATH);
  const artefactView = read(FACTUAL_ARTEFACT_VIEW_PATH);

  assertIncludes(compileInput, "\"coach_note\"", COMPILE_INPUT_PATH);
  assertIncludes(compileInput, "\"coach_notes\"", COMPILE_INPUT_PATH);
  assertIncludes(compileInput, "v1_compile_input_forbidden_non_engine_field_refused", COMPILE_INPUT_PATH);

  assertIncludes(artefactView, "\"coach_note\"", FACTUAL_ARTEFACT_VIEW_PATH);
  assertIncludes(artefactView, "\"coach_notes\"", FACTUAL_ARTEFACT_VIEW_PATH);
  assertIncludes(artefactView, "reads_coach_notes: false", FACTUAL_ARTEFACT_VIEW_PATH);
  assertIncludes(artefactView, "calls_engine: false", FACTUAL_ARTEFACT_VIEW_PATH);
});

test("S-V1-42 keeps coach note access scoped to relationship authority", () => {
  const source = read(NOTE_SOURCE_PATH);
  const existingTests = read(NOTE_TEST_PATH);
  const relationshipPermission = read(RELATIONSHIP_PERMISSION_PATH);

  assertIncludes(source, "hasAcceptedCoachAthleteLink", NOTE_SOURCE_PATH);
  assertIncludes(source, "actor.actor_type !== \"coach\"", NOTE_SOURCE_PATH);
  assertIncludes(source, "actor.user_id !== note.coach_user_id", NOTE_SOURCE_PATH);

  assertIncludes(existingTests, "unlinked coach cannot create note", NOTE_TEST_PATH);
  assertIncludes(existingTests, "revoked link blocks note creation", NOTE_TEST_PATH);
  assertIncludes(existingTests, "invited rejected and expired links block note creation", NOTE_TEST_PATH);
  assertIncludes(existingTests, "coach linked to another athlete cannot create note", NOTE_TEST_PATH);
  assertIncludes(existingTests, "athlete cannot create coach note", NOTE_TEST_PATH);
  assertIncludes(existingTests, "revoked link blocks future note visibility", NOTE_TEST_PATH);

  assertIncludes(relationshipPermission, "\"coach_notes\"", RELATIONSHIP_PERMISSION_PATH);
  assertIncludes(relationshipPermission, "coach_notes: \"coach_notes\"", RELATIONSHIP_PERMISSION_PATH);
});

test("S-V1-42 keeps replay substitution proof and history surfaces outside coach notes", () => {
  const substitution = readIfExists("src/substitutionEngineContract.mjs");
  const runtimeReducer = readIfExists("src/sessionRuntimeEventReducer.mjs");
  const factualHistory = readIfExists("src/athleteFactualHistory.mjs");
  const sessionReadback = readIfExists("src/sessionStateEventsReadback.mjs");
  const noCouplingGuard = read(NO_COUPLING_GUARD_PATH);

  for (const [label, text] of Object.entries({
    substitution,
    runtimeReducer,
    factualHistory,
    sessionReadback
  })) {
    if (text.length === 0) continue;
    assertNotIncludes(text, "coach_notes", label);
    assertNotIncludes(text, "coachNote", label);
    assertNotIncludes(text, "coach_note", label);
  }

  assertIncludes(noCouplingGuard, "\"/coach-notes/\"", NO_COUPLING_GUARD_PATH);
  assertIncludes(noCouplingGuard, "\"/coach_notes/\"", NO_COUPLING_GUARD_PATH);
});

test("S-V1-42 copy is explicit about separation from deterministic surfaces", () => {
  const copy = JSON.parse(read(NOTE_COPY_PATH));
  const serialised = JSON.stringify(copy);

  assert.equal(copy.copy_surface_id, "coach_notes");
  assertIncludes(serialised, "COACH_NOTE_STORED_SEPARATELY", NOTE_COPY_PATH);
  assertIncludes(serialised, "COACH_NOTE_NOT_ENGINE_INPUT", NOTE_COPY_PATH);
  assertIncludes(serialised, "COACH_NOTE_DOES_NOT_CHANGE_ARTEFACT", NOTE_COPY_PATH);

  for (const blocked of ["recommendation", "optimal", "diagnose", "prescribe"]) {
    assertNotIncludes(serialised.toLowerCase(), blocked, NOTE_COPY_PATH);
  }
});