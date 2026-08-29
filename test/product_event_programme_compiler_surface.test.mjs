// DEV NOTE: Product event programme compiler static surface contract.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const html = read("public/app/index.html");
const css = read("public/app/styles.css");
const js = read("public/app/app.js");
const service = read("src/api/event_programme_compiler_service.ts");
const templateService = read("src/api/beta18_programme_template_service.ts");
const routes = read("src/api/coach_workspace.routes.ts");
const handlers = read("src/api/coach_workspace.handlers.ts");
const blocks = read("src/api/blocks.handlers.ts");
// DEV NOTE: the profile-embedded assignment panel moved to React - see
// AthleteProfileAssignmentPanel.tsx. The standalone #view-assign twin is
// gone outright (unreachable dead code).
const assignmentPanel = read("public/app-src/screens/coach/AthleteProfileAssignmentPanel.tsx");
// DEV NOTE: the builder tree (block/week/session/exercise) moved to
// React (FULL-UI-05B) - see CoachProgrammeBuilderTree.tsx, mounted
// directly into the still-legacy #templateBlocks.
const builderTree = read("public/app-src/screens/coach/CoachProgrammeBuilderTree.tsx");

test("programme builder exposes explicit weeks-per-block and a compact add-week action", () => {
  assert.match(html, /id="templateBlocks"/u);
  assert.match(builderTree, /Weeks in block/u);
  assert.match(builderTree, /data-field="week_count"/u);
  assert.match(builderTree, /small-inline-action add-template-week/u);
  assert.match(js, /resizeBlockWeeks/u);
  assert.match(templateService, /block_week_count_mismatch/u);
  assert.match(templateService, /week_count:\s*declaredWeekCount/u);
  assert.match(css, /\.template-block-week-count-field/u);
  assert.match(css, /\.small-inline-action/u);
});

test("event compiler captures the complete scheduling anchor", () => {
  for (const id of [
    "templateEventEnabled",
    "templateEventName",
    "templateEventType",
    "templateProgrammeStartDate",
    "templateEventDate",
    "templateEventLocation",
    "templateEventTimezone",
    "templateEventNotes",
    "templateEventCountdown",
    "templateEventRequiredWeeks",
    "templateEventAllocatedWeeks",
    "compileEventCalendarButton",
    "fitFinalBlockButton"
  ]) {
    assert.ok(html.includes(`id="${id}"`), `Expected ${id}`);
  }

  assert.match(service, /training_day_count/u);
  assert.match(service, /required_week_count/u);
  assert.match(service, /allocation_state/u);
  assert.match(service, /partial_final_week_days/u);
  assert.match(service, /days_until_event_at_week_start/u);
  assert.match(service, /eventTypesByActivity/u);
  assert.match(routes, /\/event-compile-preview/u);
  assert.match(handlers, /previewEventProgrammeCalendar/u);
});

test("event calendar is persisted with the immutable programme and enforced at activation", () => {
  assert.match(templateService, /event_plan:\s*normalised\.event_plan/u);
  assert.match(templateService, /event_compile_summary:\s*normalised\.event_compile_summary/u);
  assert.match(templateService, /event_week_allocation_unbalanced/u);
  assert.match(templateService, /event_date_in_past/u);
  assert.match(templateService, /eventWeekCalendar/u);
  assert.match(templateService, /template_week_start_date/u);
  assert.match(templateService, /template_event_plan/u);
});

test("athlete and assignment surfaces receive factual event countdown data", () => {
  assert.match(html, /id="athlete-today-event-root"/u);
  assert.match(html, /id="athlete-profile-assignment-root"/u);
  assert.match(js, /countdownLabel/u);
  assert.match(js, /response\.beta_path\?\.event_plan/u);
  assert.match(assignmentPanel, /countdownLabel\(plan\.event_date/u);
  assert.match(blocks, /event_compile_summary/u);
  assert.match(blocks, /template_session_title/u);
});

test("event compiler remains arithmetic-only and contains no training recommendation logic", () => {
  assert.match(service, /explicit date and allocation arithmetic only/u);
  assert.doesNotMatch(service, /recommendation_output|readiness_score|safety_score|capability_score/iu);
  assert.doesNotMatch(js, /autoSelectBlockType|recommendBlock|inferPeak|inferReadiness/u);
});
