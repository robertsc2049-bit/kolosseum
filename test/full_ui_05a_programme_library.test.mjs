import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const html = fs.readFileSync("public/app/index.html", "utf8");
const app = fs.readFileSync("public/app/app.js", "utf8");
const styles = fs.readFileSync("public/app/styles.css", "utf8");
const routes = fs.readFileSync("public/app/route_bootstrap.js", "utf8");

// DEV NOTE: FULL-UI-05A metric cards, search/filter/sort and card list
// (read-only) moved to React - see
// public/app-src/screens/coach/CoachProgrammeLibraryPanel.tsx/
// useCoachProgrammeLibrary.ts, mounted at #templates-metrics-root/
// #templates-library-root (both now static ids in index.html, checked
// below). The programme detail panel and builder stay legacy - the rest of
// this file's checks against `app`/`html` for those are untouched.
const libraryPanel = fs.readFileSync(
  "public/app-src/screens/coach/CoachProgrammeLibraryPanel.tsx",
  "utf8"
);
const libraryHook = fs.readFileSync(
  "public/app-src/screens/coach/useCoachProgrammeLibrary.ts",
  "utf8"
);

test("FULL-UI-05A exposes programme search filter sort and factual state counts", () => {
  for (const id of ["templates-metrics-root", "templates-library-root"]) {
    assert.match(html, new RegExp(`id="${id}"`, "u"));
  }

  assert.match(libraryPanel, /placeholder="Name, activity, event or version"/u);
  assert.match(libraryPanel, /programme-clear-filters/u);
  assert.match(libraryPanel, /Superseded versions/u);
  assert.match(libraryHook, /function filteredProgrammeTemplates\(/u);
  assert.match(libraryHook, /function programmeDisplayState\(/u);
  assert.match(libraryPanel, /usage_desc/u);
  assert.match(libraryHook, /superseded/u);
});

test("FULL-UI-05A opens a complete programme detail and preview surface", () => {
  for (const id of [
    "templateDetailPanel",
    "templateDetailVersionFamily",
    "templateDetailUsage",
    "templateDetailValidation",
    "templateDetailPreview"
  ]) {
    assert.match(html, new RegExp(`id="${id}"`, "u"));
  }

  assert.match(app, /function renderProgrammeDetail\(/u);
  assert.match(app, /function programmePreviewHtml\(/u);
  assert.match(app, /programme-preview-block/u);
  assert.match(app, /planned_sets/u);
  assert.match(app, /rest_seconds/u);
  assert.match(app, /exerciseDisplayName/u);
});

test("FULL-UI-05A derives factual version families and superseded states", () => {
  assert.match(app, /function programmeFamilyVersions\(/u);
  assert.match(app, /function programmeDisplayState\(/u);
  assert.match(app, /\["active", "archived"\]\.includes/u);
  assert.match(app, /programmeVersionNumber/u);
  assert.match(app, /template-version-open/u);
});

test("FULL-UI-05A displays assignment usage before archive", () => {
  assert.match(app, /function programmeAssignmentUsage\(/u);
  assert.match(app, /state\.coachAssignments/u);
  assert.match(app, /globalThis\.confirm\(confirmation\)/u);
  assert.match(app, /assignment record/u);
  assert.match(app, /Existing assignments retain this version/u);
});

test("FULL-UI-05A provides a full visible activation validation summary", () => {
  assert.match(app, /function programmeActivationIssues\(/u);
  assert.match(app, /session_work_item_count_invalid/u);
  assert.match(app, /exercise_not_in_active_registry/u);
  assert.match(app, /duplicate_exercise_in_session/u);
  assert.match(app, /percent_1rm_invalid/u);
  assert.match(app, /rest_seconds_invalid/u);
  assert.match(app, /event_week_allocation_unbalanced/u);
  assert.match(app, /programme-validation-list/u);
});

test("FULL-UI-05A direct programme routes open programme detail", () => {
  assert.match(routes, /target\.querySelector\("\.template-detail"\)/u);
  assert.match(app, /#\/coach\/programmes\/\$\{encodeURIComponent/u);
  assert.match(libraryPanel, /className="button secondary small-button template-detail"/u);
});

test("FULL-UI-05A remains responsive and engine-inert", () => {
  assert.match(styles, /\.programme-library-controls/u);
  assert.match(styles, /\.programme-detail-grid/u);
  assert.match(styles, /\.programme-preview-week/u);
  assert.match(styles, /@media \(max-width: 760px\)/u);

  const helperStart = app.indexOf("// FULL-UI-05A:");
  const helperEnd = app.indexOf("function templateStatusBadge", helperStart);
  const helperSource = app.slice(helperStart, helperEnd);

  assert.ok(helperStart >= 0);
  assert.ok(helperEnd > helperStart);
  assert.doesNotMatch(helperSource, /runPipelineFromDist|planSessionService|compileBlock|engine_runner/u);
});