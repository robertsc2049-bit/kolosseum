import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const html = fs.readFileSync("public/app/index.html", "utf8");
const app = fs.readFileSync("public/app/app.js", "utf8");
const styles = fs.readFileSync("public/app/styles.css", "utf8");

test("FULL-UI-05B exposes persistent save and recovery state", () => {
  for (const id of [
    "templateDraftRecovery",
    "templateDraftRecoveryResumeButton",
    "templateDraftRecoveryDiscardButton",
    "templateBuilderSaveState",
    "templateBuilderSaveDetail",
    "templateBuilderDiscardButton"
  ]) {
    assert.match(html, new RegExp(`id="${id}"`, "u"));
    assert.match(app, new RegExp(`${id}: document\\.getElementById`, "u"));
  }

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
  assert.match(app, /Saving…/u);
  assert.match(app, /Save failed/u);
  assert.match(app, /Last saved/u);
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
  assert.match(app, /data-template-kind="work-item"/u);
  assert.match(app, /builder-validation-target/u);
});

test("FULL-UI-05B supports keyboard and phone operation", () => {
  assert.match(app, /event\.key\.toLowerCase\(\) === "s"/u);
  assert.match(app, /event\.key === "Escape"/u);
  assert.match(app, /saveTemplateDraft\(\)\.catch\(handleError\)/u);
  assert.match(app, /aria-label="Move block up"/u);
  assert.match(app, /aria-label="Move week down"/u);
  assert.match(app, /aria-label="Move session up"/u);
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
  assert.match(helperSource, /server remains authoritative/iu);
});
