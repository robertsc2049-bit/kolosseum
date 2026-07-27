// DEV NOTE: Integrated coach programme workspace static acceptance contract.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const html = read("public/app/index.html");
const css = read("public/app/styles.css");
const js = read("public/app/app.js");
const service = read("src/api/beta19_coach_workspace_service.ts");
const templates = read("src/api/beta18_programme_template_service.ts");
const phase6 = read("engine/src/phases/phase6.ts");

test("athlete management includes durable strength-reference editing", () => {
  for (const id of [
    "athleteProfilePanel",
    "athletePreferredUnit",
    "athleteRoundingIncrement",
    "athleteBodyweight",
    "athleteBenchmarkList",
    "addAthleteBenchmarkButton"
  ]) {
    assert.ok(html.includes(`id="${id}"`), `Expected ${id}`);
  }

  assert.match(js, /\/coach-workspace\/athlete-strength-profile/u);
  assert.match(js, /\/coach-workspace\/athletes/u);
  assert.match(js, /\/coach-workspace\/assignments/u);
  assert.match(js, /tested_1rm/u);
  assert.match(js, /estimated_1rm/u);
  assert.match(js, /training_max/u);
  assert.match(service, /record_sha256/u);
});

test("programme management supports nested block, week and session authoring", () => {
  assert.match(html, /Build ordered training blocks/u);
  assert.match(html, /Add training block/u);
  assert.match(js, /newTemplateBlock/u);
  assert.match(js, /addTemplateBlock/u);
  assert.match(js, /removeTemplateBlock/u);
  assert.match(js, /duplicateTemplateBlock/u);
  assert.match(js, /moveTemplateBlock/u);
  assert.match(js, /addTemplateWeek/u);
  assert.match(js, /duplicateTemplateWeek/u);
  assert.match(js, /addTemplateSession/u);
  assert.match(js, /duplicateTemplateSession/u);
  assert.match(templates, /blocks_required/u);
  assert.match(templates, /block_count_invalid/u);
});

test("programme assignment checks all percentage reference requirements", () => {
  assert.match(html, /id="assignmentRequirements"/u);
  assert.match(js, /requiredOneRmExerciseIds/u);
  assert.match(js, /Missing current strength references/u);
  assert.match(js, /assignmentSubmitButton\.disabled = true/u);
  assert.match(js, /Assignment requirements complete/u);
});

test("athlete execution receives a resolved working load without hiding the source prescription", () => {
  assert.match(templates, /intensity:\s*loadingReference/u);
  assert.match(templates, /resolved_load:\s*resolvedLoad/u);
  assert.match(phase6, /intensity: it\.intensity/u);
  assert.match(phase6, /resolved_load/u);
  assert.match(js, /resolved\.value/u);
  assert.match(js, /% 1RM/u);
});

test("workspace layouts remain responsive and product-shaped", () => {
  assert.match(css, /\.template-block-settings/u);
  assert.match(css, /\.profile-settings-grid/u);
  assert.match(css, /\.benchmark-row/u);
  assert.match(css, /@media/u);
  assert.ok(html.length > 20000);
  assert.ok(css.length > 25000);
  assert.ok(js.length > 100000);
});
