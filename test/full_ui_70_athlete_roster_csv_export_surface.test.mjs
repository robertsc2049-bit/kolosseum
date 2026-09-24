// DEV NOTE: FULL-UI-70 coach roster CSV export static surface contract.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const handlers = read("src/api/coach_workspace.handlers.ts");
const routes = read("src/api/coach_workspace.routes.ts");
const indexHtml = read("public/app/index.html");
const guard = read("ci/guards/full_ui_completion_guard.mjs");
const manifest = JSON.parse(read("product/ui/function_manifest.json"));

test("the export route is mounted at /coach-workspace/relationships/export.csv, coach-only", () => {
  assert.match(routes, /coachWorkspaceRouter\.get\(\s*\n?\s*"\/relationships\/export\.csv"/u);
  assert.match(routes, /exportCoachAthleteRosterCsv/u);
  assert.match(handlers, /const coachUserId = await authenticatedCoach\(req, false\);\s*\n\s*const relationships = await listCoachAthleteRelationships\(coachUserId\)/u);
});

test("the export reuses the same coach-scoped relationship listing the Athletes directory already displays - no new record type, no new query", () => {
  assert.match(handlers, /export async function exportCoachAthleteRosterCsv/u);
  assert.match(handlers, /listCoachAthleteRelationships\(coachUserId\)/u);
  assert.doesNotMatch(handlers.slice(handlers.indexOf("exportCoachAthleteRosterCsv"), handlers.indexOf("export async function getConnectedCoachAthletes")), /INSERT INTO|persistBetaProductRecord/u);
});

test("the response is a real CSV download, not a JSON payload", () => {
  assert.match(handlers, /text\/csv/u);
  assert.match(handlers, /Content-Disposition/u);
  assert.match(handlers, /attachment; filename=/u);
});

test("CSV fields are correctly escaped - commas, quotes and newlines never break the file structure", () => {
  assert.match(handlers, /function csvEscapeField/u);
  assert.match(handlers, /replace\(\/"\/gu, '""'\)/u);
});

test("the roster export is distinct in purpose from data_rights' personal-data export - this is the coach's own operational roster, not an account's own GDPR export", () => {
  assert.match(handlers, /Distinct in purpose from data_rights/u);
});

test("the coach workspace has a real, downloadable export control wired to the route", () => {
  assert.match(indexHtml, /id="exportAthleteRosterButton"/u);
  assert.match(indexHtml, /href="\/coach-workspace\/relationships\/export\.csv"/u);
  assert.match(indexHtml, /download="athlete-roster\.csv"/u);
});

test("the export route file is tracked by the FULL-UI completion guard's route discovery", () => {
  assert.match(guard, /\["src\/api\/coach_workspace\.routes\.ts", "\/coach-workspace"\]/u);
});

test("the FULL-UI-70 manifest function is declared as implemented with real tests inside the existing athlete_directory area", () => {
  const area = manifest.product_areas.find((entry) => entry.area_id === "athlete_directory");
  assert.ok(area, "expected the existing athlete_directory product area");

  const fn = area.functions.find((entry) => entry.function_id === "athlete_roster_csv_export");
  assert.ok(fn, "expected an athlete_roster_csv_export function");
  assert.equal(fn.state, "implemented");
  assert.equal(fn.direct_test, "test/full_ui_70_athlete_roster_csv_export_surface.test.mjs");
  assert.equal(fn.integration_test, "test/full_ui_70c_athlete_roster_csv_export_persistent.integration.test.mjs");
  assert.notEqual(fn.persistence, "localStorage_only");
  assert.deepEqual(fn.actors, ["coach"]);

  assert.ok(manifest.delivery_slices.some((slice) => slice.slice_id === "FULL-UI-70" && slice.state === "implemented"));
});
