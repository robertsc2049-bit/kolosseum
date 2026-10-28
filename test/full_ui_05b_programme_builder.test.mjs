import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const html = fs.readFileSync("public/app/index.html", "utf8");
const app = fs.readFileSync("public/app/app.js", "utf8");
const styles = fs.readFileSync("public/app/styles.css", "utf8");
// DEV NOTE: FULL-UI-05B the completion validation list moved to React -
// see CoachProgrammeBuilderValidationList.tsx, mounted directly into the
// still-legacy #templateBuilderValidationList <ol> so its delegated click
// listener keeps working unchanged. The section's warning/complete class
// toggle stays legacy (currentTemplateBuilderIssues() computes the
// identical issues.length independently, kept in sync by convention) -
// checks against `app` for that are untouched below.
const validationList = fs.readFileSync(
  "public/app-src/screens/coach/CoachProgrammeBuilderValidationList.tsx",
  "utf8"
);
// DEV NOTE: FULL-UI-05B the save-state badge and save-detail text also
// moved to React - see CoachProgrammeBuilderSaveStatus.tsx, mounted at
// #programme-builder-save-badge-root/#programme-builder-save-detail-root.
// The badge's original id="templateBuilderSaveState" is gone -
// openTemplateBuilder()'s recovery-focus call now targets the static
// #programme-builder-save-badge-root wrapper div instead (kept
// permanently in the DOM, unlike the React-rendered badge inside it,
// since app.js's `elements` snapshot is built before the React bundle's
// script tag runs).
const saveStatus = fs.readFileSync(
  "public/app-src/screens/coach/CoachProgrammeBuilderSaveStatus.tsx",
  "utf8"
);
const programmeDraft = fs.readFileSync(
  "public/app-src/screens/coach/programmeDraft.ts",
  "utf8"
);
// DEV NOTE: FULL-UI-05B the builder tree (block/week/session/exercise)
// moved to React too - see CoachProgrammeBuilderTree.tsx, mounted
// directly into the still-legacy #templateBlocks (its three delegated
// listeners keep firing on real interaction, driving the exact same
// untouched mutation functions in app.js) - checks for the move-up/down
// buttons' markup below are repointed to that file.
const builderTree = fs.readFileSync(
  "public/app-src/screens/coach/CoachProgrammeBuilderTree.tsx",
  "utf8"
);

test("FULL-UI-05B exposes persistent save and recovery state", () => {
  for (const id of [
    "templateDraftRecovery",
    "templateDraftRecoveryResumeButton",
    "templateDraftRecoveryDiscardButton",
    "templateBuilderDiscardButton"
  ]) {
    assert.match(html, new RegExp(`id="${id}"`, "u"));
    assert.match(app, new RegExp(`${id}: document\\.getElementById`, "u"));
  }

  for (const id of ["programme-builder-save-badge-root", "programme-builder-save-detail-root"]) {
    assert.match(html, new RegExp(`id="${id}"`, "u"));
  }
  assert.match(app, /templateBuilderSaveBadgeRoot: document\.getElementById\("programme-builder-save-badge-root"\)/u);
  assert.match(saveStatus, /function CoachProgrammeBuilderSaveBadge/u);
  assert.match(saveStatus, /function CoachProgrammeBuilderSaveDetail/u);

  assert.match(app, /templateDraftSavedSnapshot/u);
  assert.match(app, /templateDraftWasOpen/u);
  assert.match(app, /function templateDraftIsDirty\(/u);
  assert.match(app, /function hasRecoverableTemplateDraft\(/u);
  assert.match(app, /function renderTemplateRecovery\(/u);
  assert.match(app, /function resumeRecoveredTemplateDraft\(/u);
});

test("FULL-UI-05B warns before discarding unsaved changes", () => {
  assert.match(app, /function confirmTemplateBuilderDeparture\(/u);
  assert.match(app, /This programme has unsaved changes/u);
  assert.match(app, /globalThis\.addEventListener\("beforeunload"/u);
  assert.match(app, /event\.returnValue = ""/u);
  assert.match(app, /view !== "templates"/u);
  assert.match(app, /closeTemplateBuilder\(\{\s*force: true/u);
});

test("FULL-UI-05B gives durable save feedback and duplicate-submit protection", () => {
  assert.match(app, /let templateBuilderSaving = false/u);
  assert.match(programmeDraft, /Saving…/u);
  assert.match(programmeDraft, /Save failed/u);
  assert.match(programmeDraft, /Last saved/u);
  assert.match(app, /elements\.saveTemplateButton\.disabled = templateBuilderSaving/u);
  assert.match(app, /state\.templateDraftSavedAt/u);
  assert.match(app, /templateDraftSnapshot\(state\.templateDraft\)/u);
});

test("FULL-UI-05B links every visible validation issue to a builder field", () => {
  for (const id of [
    "templateBuilderValidation",
    "templateBuilderValidationList"
  ]) {
    assert.match(html, new RegExp(`id="${id}"`, "u"));
  }

  assert.match(app, /function currentTemplateBuilderIssues\(/u);
  assert.match(app, /function templateValidationSelector\(/u);
  assert.match(app, /function focusTemplateValidationIssue\(/u);
  assert.match(app, /data-builder-validation-index/u);
  assert.match(builderTree, /"data-template-kind": "work-item"/u);
  assert.match(app, /builder-validation-target/u);
});

test("FULL-UI-05B a just-completed template's builder correctly resets its dirty/unsaved-changes baseline, and the validation list stops showing the unresolvable draft-only issue", () => {
  // Regression: completeOpenTemplate()'s final openTemplateBuilder() call
  // used to pass preserveBaseline: true, which skipped resetting
  // templateDraftSavedSnapshot to match the just-completed template - so
  // templateDraftIsDirty() compared the new (now "complete"-status) draft
  // against a stale "draft"-status snapshot taken moments earlier by
  // saveTemplateDraft(), and always came back dirty. The other two
  // legitimate preserveBaseline: true callers (recovered-draft reopening,
  // resumeRecoveredTemplateDraft()) are untouched by this check.
  const completeOpenTemplateBody = app.slice(
    app.indexOf("async function completeOpenTemplate("),
    app.indexOf("async function activateTemplateById(")
  );
  assert.doesNotMatch(completeOpenTemplateBody, /preserveBaseline:\s*true/u);
  assert.match(completeOpenTemplateBody, /templateRecordToDraft\(completed\)/u);

  // currentTemplateBuilderIssues() drives the outer #templateBuilderValidation
  // wrapper's warning/complete class - it must also treat a non-draft
  // record as clean (no issues), matching CoachProgrammeBuilderValidationList.tsx's
  // own guard below, rather than perpetually reporting the single
  // unresolvable "only a draft programme can be marked complete" issue as
  // an outstanding warning once a programme is already complete/active.
  assert.match(app, /record\.template_status !== "draft"\) return \[\]/u);
  assert.match(validationList, /draft\.template_status !== "draft"/u);
  assert.match(validationList, /Completion checks apply to draft versions only\./u);
});

test("FULL-UI-05B supports keyboard and phone operation", () => {
  assert.match(app, /event\.key\.toLowerCase\(\) === "s"/u);
  assert.match(app, /event\.key === "Escape"/u);
  assert.match(app, /saveTemplateDraft\(\)\.catch\(handleError\)/u);
  assert.match(builderTree, /aria-label="Move block up"/u);
  assert.match(builderTree, /aria-label="Move week down"/u);
  assert.match(builderTree, /aria-label="Move session up"/u);
  assert.match(styles, /\/\* FULL-UI-05B programme builder state and recovery \*\//u);
  assert.match(styles, /@media \(max-width: 760px\)/u);
  assert.match(styles, /min-height: 44px/u);
  assert.match(styles, /\.template-validation-link:focus-visible/u);
});

test("FULL-UI-05B remains presentation-only and engine-inert", () => {
  const start = app.indexOf(
    "// FULL-UI-05B: programme builder state, recovery, validation links and keyboard support."
  );
  const end = app.indexOf("function openTemplateBuilder", start);
  const helperSource = app.slice(start, end);

  assert.ok(start >= 0);
  assert.ok(end > start);
  assert.doesNotMatch(
    helperSource,
    /runPipelineFromDist|planSessionService|compileBlock|engine_runner/u
  );
  assert.match(helperSource, /programmeActivationIssues/u);
  // #1076 rewrote this list's "The server remains authoritative" pass
  // message into plain consumer language ("All checks pass.") - the
  // presentation-only/engine-inert invariant this test cares about is
  // still documented (and enforced above via programmeActivationIssues)
  // by the component's own DEV NOTE, which is what we check here instead.
  assert.match(validationList, /same rules engine/u);
});

// Pulls one top-level declaration out of app.js - top-level declarations
// start at column 0, so the next unindented line that opens another
// declaration (or a top-level comment/listener) bounds it.
function extractTopLevel(source, startMarker) {
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, `expected to find ${startMarker} in app.js`);
  const rest = source.slice(start + startMarker.length);
  const next = rest.search(/\n(?:async function |function |const |let |document\.|\/\/)/u);
  return source.slice(start, start + startMarker.length + next);
}

function loadDraftRecoveryHarness(storage) {
  const source = [
    'const STORAGE_KEY = "kolosseum.product.app.v1";',
    extractTopLevel(app, "const DEFAULT_STATE = "),
    extractTopLevel(app, "const UNSAVED_STATE_KEYS = "),
    ...[
      "cloneDefaultState",
      "normalisePersistedTemplateDraft",
      "loadState",
      "saveState",
      "applyAccountIdentity",
      "templateDraftSnapshot",
      "templateDraftIsDirty",
      "currentTemplateDraftOwnerUserId",
      "hasRecoverableTemplateDraft",
      "clearTemplateDraftState"
    ].map((name) => extractTopLevel(app, `function ${name}(`)),
    "let templateBuilderSaveError = \"\";",
    "function broadcastProgrammeDraft() {}",
    "const state = loadState();",
    "return { state, saveState, applyAccountIdentity, hasRecoverableTemplateDraft, currentTemplateDraftOwnerUserId };"
  ].join("\n");
  return new Function("localStorage", source)(storage);
}

function fakeLocalStorage() {
  const items = new Map();
  return {
    getItem: (key) => (items.has(key) ? items.get(key) : null),
    setItem: (key, value) => items.set(key, String(value)),
    removeItem: (key) => items.delete(key)
  };
}

function coachAccount(userId) {
  return { user_id: userId, actor_type: "coach", display_name: userId, email: `${userId}@example.test` };
}

// Mirrors what openTemplateBuilder() + one edit leave in state: an open,
// dirty draft owned by the signed-in coach.
function leaveDirtyDraft(harness) {
  const { state } = harness;
  state.templateDraft = {
    template_id: "tmpl_progression_check",
    template_name: "Progression check",
    template_status: "draft",
    blocks: []
  };
  state.templateDraftSavedSnapshot = JSON.stringify({ ...state.templateDraft, template_name: "Old name" });
  state.templateDraftWasOpen = true;
  state.templateDraftOwnerUserId = harness.currentTemplateDraftOwnerUserId();
  harness.saveState();
}

test("FULL-UI-05B a recovered browser draft is only offered back to the coach who left it", () => {
  const storage = fakeLocalStorage();

  const coachA = loadDraftRecoveryHarness(storage);
  coachA.applyAccountIdentity(coachAccount("coach_a"));
  leaveDirtyDraft(coachA);
  assert.equal(coachA.hasRecoverableTemplateDraft(), true);

  // Coach A reloads the page: the draft is still theirs to recover.
  const coachAReloaded = loadDraftRecoveryHarness(storage);
  coachAReloaded.applyAccountIdentity(coachAccount("coach_a"));
  assert.equal(coachAReloaded.hasRecoverableTemplateDraft(), true);
  assert.equal(coachAReloaded.state.templateDraft.template_id, "tmpl_progression_check");

  // A different coach signs in on the same browser (no sign-out between,
  // e.g. coach A's session expired): never offered, and coach A's draft is
  // dropped rather than kept around.
  const coachB = loadDraftRecoveryHarness(storage);
  coachB.applyAccountIdentity(coachAccount("coach_b"));
  assert.equal(coachB.hasRecoverableTemplateDraft(), false);
  assert.equal(coachB.state.templateDraft, null);
  assert.equal(coachB.state.templateDraftOwnerUserId, "");
});

test("FULL-UI-05B a draft persisted before drafts recorded an owner is never offered", () => {
  const storage = fakeLocalStorage();
  const harness = loadDraftRecoveryHarness(storage);
  harness.applyAccountIdentity(coachAccount("coach_a"));
  leaveDirtyDraft(harness);
  harness.state.templateDraftOwnerUserId = "";
  assert.equal(harness.hasRecoverableTemplateDraft(), false);
});
