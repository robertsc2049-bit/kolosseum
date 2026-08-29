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
  assert.match(validationList, /server remains authoritative/iu);
});
