// DEV NOTE: FULL-UI-64 athlete weekly check-in static surface contract.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const service = read("src/api/weekly_checkin_service.ts");
const routes = read("src/api/weekly_checkins.routes.ts");
const serverTs = read("src/server.ts");
const lifecycle = read("shared/weekly-checkins/weeklyCheckinLifecycle.mjs");
const recordStore = read("src/api/beta_product_record_store.ts");
const schemaSql = read("schema.sql");
const appJs = read("public/app/app.js");
const indexHtml = read("public/app/index.html");
const guard = read("ci/guards/full_ui_completion_guard.mjs");
const manifest = JSON.parse(read("product/ui/function_manifest.json"));

const forbiddenEngineImports = /session_state_write_service\.js|session_state_query_service\.js|block_compile_write_service\.js|engine_runner_service\.js|@kolosseum\/engine|engine\/src\//u;

test("weekly check-ins is mounted at /weekly-checkins with athlete write routes and a read-only coach route", () => {
  assert.match(serverTs, /app\.use\("\/weekly-checkins", weeklyCheckinsRouter\)/u);
  assert.match(routes, /weeklyCheckinsRouter\.post\(\s*\n?\s*"\/"/u);
  assert.match(routes, /weeklyCheckinsRouter\.get\(\s*\n?\s*"\/"/u);
  assert.match(routes, /weeklyCheckinsRouter\.get\(\s*\n?\s*"\/coach\/:athlete_user_id"/u);
});

test("there is no coach write path - a check-in is the athlete's own self-report", () => {
  assert.doesNotMatch(routes, /weeklyCheckinsRouter\.(post|put|patch|delete)\(\s*\n?\s*"\/coach/u);
  assert.doesNotMatch(service, /export async function .*Coach.*submit/iu);
});

test("identity is resolved from the session cookie only, never a client-supplied user_id", () => {
  assert.doesNotMatch(routes, /request\.body\.(?:coach_|athlete_)?user_id|request\.query\.(?:coach_|athlete_)?user_id/u);
  assert.match(routes, /async function authenticatedAthlete/u);
  assert.match(routes, /authenticatedCoach\(request, false\)/u);
});

test("a coach relationship must be accepted before a coach can read an athlete's check-ins", () => {
  assert.match(service, /relationship_state !== "accepted"/u);
  assert.match(service, /relationship\.coach_user_id !== coachUserId/u);
  assert.match(service, /relationship\.athlete_user_id !== athleteUserId/u);
});

test("a second submission for an already-submitted week is rejected, never silently overwritten or deduped", () => {
  assert.match(service, /already_submitted_for_week/u);
  assert.doesNotMatch(service, /UPDATE beta_product_records|DELETE FROM beta_product_records/u);
});

test("every check-in field is a raw self-rating, never a computed or weighted score", () => {
  for (const field of [
    "factual_user_supplied_state: true",
    "immutable_reference_history: true",
    "inference_applied: false",
    "readiness_semantics: false",
    "safety_semantics: false",
    "suitability_semantics: false",
    "recommendation_semantics: false",
    "engine_visible: false",
    "compile_reference_visible: false"
  ]) {
    assert.ok(service.includes(field), `expected weekly check-in record to declare ${field}`);
  }
});

test("ratings are constrained to a 1-5 integer range and the note is capped at 280 characters", () => {
  assert.match(lifecycle, /RATING_MIN = 1/u);
  assert.match(lifecycle, /RATING_MAX = 5/u);
  assert.match(lifecycle, /Number\.isInteger\(number\)/u);
  assert.match(lifecycle, /MAX_NOTE_LENGTH = 280/u);
});

test("only the exact declared fields are accepted - no unknown field passes through", () => {
  assert.match(lifecycle, /exactKeys\(/u);
  assert.match(lifecycle, /weekly_checkin_unknown_field/u);
});

test("the weekly_checkin_entry record type is registered in the record store and schema check constraint", () => {
  assert.match(recordStore, /"weekly_checkin_entry"/u);
  assert.match(recordStore, /case "weekly_checkin_entry":/u);
  assert.match(schemaSql, /'weekly_checkin_entry'/u);
});

test("no weekly-checkins file imports any engine-truth service", () => {
  for (const source of [service, routes, lifecycle]) {
    assert.doesNotMatch(source, forbiddenEngineImports);
  }
});

test("the weekly-checkins route file is tracked by the FULL-UI completion guard's route discovery", () => {
  assert.match(guard, /\["src\/api\/weekly_checkins\.routes\.ts", "\/weekly-checkins"\]/u);
});

test("the athlete and coach weekly check-in panels exist as real controls, and free-text is escaped before rendering", () => {
  assert.match(indexHtml, /id="weeklyCheckinForm"/u);
  assert.match(indexHtml, /id="weeklyCheckinWeekStartInput"/u);
  assert.match(indexHtml, /id="weeklyCheckinEnergyInput"/u);
  assert.match(indexHtml, /id="weeklyCheckinMotivationInput"/u);
  assert.match(indexHtml, /id="weeklyCheckinSleepInput"/u);
  assert.match(indexHtml, /id="weeklyCheckinNoteInput"/u);
  assert.match(indexHtml, /id="weeklyCheckinList"/u);
  assert.match(indexHtml, /id="athleteDetailWeeklyCheckinList"/u);

  assert.match(appJs, /escapeHtml\(checkin\.note\)/u);
  assert.match(appJs, /async function refreshWeeklyCheckins/u);
  assert.match(appJs, /async function submitWeeklyCheckin/u);
  assert.match(appJs, /async function refreshCoachAthleteWeeklyCheckins/u);
});

test("weekly check-ins are refreshed alongside the other history and athlete-detail panels", () => {
  assert.match(appJs, /refreshWeeklyCheckins\(\{ quiet: true \}\)\.catch\(\(\) => \{\}\)/u);
  assert.match(appJs, /refreshCoachAthleteWeeklyCheckins\(/u);
});

test("the FULL-UI-64 manifest area declares all three functions as implemented with real routes and tests", () => {
  const area = manifest.product_areas.find((entry) => entry.area_id === "weekly_checkins");
  assert.ok(area, "expected a weekly_checkins product area");
  assert.equal(area.slice_id, "FULL-UI-64");
  assert.equal(area.state, "implemented");

  const functionIds = area.functions.map((fn) => fn.function_id);
  assert.deepEqual(
    functionIds.sort(),
    ["weekly_checkin_list_athlete", "weekly_checkin_list_coach", "weekly_checkin_submit"]
  );

  for (const fn of area.functions) {
    assert.equal(fn.state, "implemented");
    assert.equal(fn.integration_test, "test/full_ui_64c_weekly_checkins_persistent.integration.test.mjs");
    assert.equal(fn.direct_test, "test/full_ui_64_weekly_checkins_surface.test.mjs");
    assert.notEqual(fn.persistence, "localStorage_only");
  }

  assert.ok(manifest.delivery_slices.some((slice) => slice.slice_id === "FULL-UI-64" && slice.state === "implemented"));
});

test("athlete functions reuse the athlete_history route_id and the coach function reuses coach_athlete_detail", () => {
  const area = manifest.product_areas.find((entry) => entry.area_id === "weekly_checkins");
  for (const functionId of ["weekly_checkin_submit", "weekly_checkin_list_athlete"]) {
    const fn = area.functions.find((entry) => entry.function_id === functionId);
    assert.equal(fn.route_id, "athlete_history", functionId);
  }
  const coachFn = area.functions.find((fn) => fn.function_id === "weekly_checkin_list_coach");
  assert.equal(coachFn.route_id, "coach_athlete_detail");
});
