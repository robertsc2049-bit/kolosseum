// DEV NOTE: FULL-UI-37 athlete goal-setting static surface contract.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const service = read("src/api/athlete_goals_service.ts");
const routes = read("src/api/athlete_goals.routes.ts");
const serverTs = read("src/server.ts");
const lifecycle = read("shared/goals/athleteGoalsLifecycle.mjs");
const recordStore = read("src/api/beta_product_record_store.ts");
const schemaSql = read("schema.sql");
const appJs = read("public/app/app.js");
const indexHtml = read("public/app/index.html");
const guard = read("ci/guards/full_ui_completion_guard.mjs");
const manifest = JSON.parse(read("product/ui/function_manifest.json"));
// DEV NOTE: the coach-side mirror moved to React - see
// public/app-src/screens/coach/AthleteGoalsPanel.tsx and its __tests__ file
// for its behavioral coverage. The athlete's own create/resolve/history
// view stays legacy.
const athleteGoalsPanel = read("public/app-src/screens/coach/AthleteGoalsPanel.tsx");
const coachWorkspaceClient = read("public/app-src/api/coachWorkspaceClient.ts");

const forbiddenEngineImports = /session_state_write_service\.js|session_state_query_service\.js|block_compile_write_service\.js|engine_runner_service\.js|@kolosseum\/engine|engine\/src\//u;

test("athlete goals is mounted at /athlete-goals with athlete write routes and a read-only coach route", () => {
  assert.match(serverTs, /app\.use\("\/athlete-goals", athleteGoalsRouter\)/u);
  assert.match(routes, /athleteGoalsRouter\.post\(\s*\n?\s*"\/"/u);
  assert.match(routes, /athleteGoalsRouter\.get\(\s*\n?\s*"\/"/u);
  assert.match(routes, /athleteGoalsRouter\.post\(\s*\n?\s*"\/:goal_id\/resolve"/u);
  assert.match(routes, /athleteGoalsRouter\.get\(\s*\n?\s*"\/coach\/:athlete_user_id"/u);
});

test("there is no coach write path - a goal is the athlete's own declared target", () => {
  assert.doesNotMatch(routes, /athleteGoalsRouter\.(post|put|patch|delete)\(\s*\n?\s*"\/coach/u);
  assert.doesNotMatch(service, /export async function .*Coach.*(create|resolve)/iu);
});

test("identity is resolved from the session cookie only, never a client-supplied user_id", () => {
  assert.doesNotMatch(routes, /request\.body\.(?:coach_|athlete_)?user_id|request\.query\.(?:coach_|athlete_)?user_id/u);
  assert.match(routes, /async function authenticatedAthlete/u);
  assert.match(routes, /authenticatedCoach\(request, false\)/u);
});

test("this slice reuses the existing body-metrics reader rather than issuing a duplicate query per goal", () => {
  assert.match(service, /listBodyMetricHistoryForAthlete/u);
  assert.match(service, /listBodyMetricHistoryForCoach/u);
});

test("a coach relationship must be accepted before a coach can read an athlete's goals", () => {
  assert.match(service, /relationship_state !== "accepted"/u);
  assert.match(service, /relationship\.coach_user_id !== coachUserId/u);
  assert.match(service, /relationship\.athlete_user_id !== athleteUserId/u);
});

test("a goal record is superseded on resolve, never updated or deleted in place", () => {
  assert.match(service, /persistBetaProductRecord/u);
  assert.doesNotMatch(service, /UPDATE beta_product_records|DELETE FROM beta_product_records/u);
});

test("target_value is required exactly when metric_type is present, and rejected otherwise", () => {
  assert.match(lifecycle, /athlete_goal_target_value_without_metric_type/u);
  assert.match(lifecycle, /athlete_goal_target_value_invalid/u);
});

test("baseline and progress are pure computed facts, never fabricated from missing data", () => {
  assert.match(lifecycle, /baseline_value: null/u);
  assert.match(lifecycle, /let progressPercentage = null/u);
  assert.match(lifecycle, /let isGoalMet = null/u);
});

test("progress_percentage is deliberately clamped to a 0-100 progress-bar range", () => {
  assert.match(lifecycle, /clamp\(/u);
});

test("the athlete_goal record type is registered in the record store and schema check constraint", () => {
  assert.match(recordStore, /"athlete_goal"/u);
  assert.match(recordStore, /case "athlete_goal":/u);
  assert.match(schemaSql, /'athlete_goal'/u);
});

test("no athlete-goals file imports any engine-truth service", () => {
  for (const source of [service, routes, lifecycle]) {
    assert.doesNotMatch(source, forbiddenEngineImports);
  }
});

test("the athlete-goals route file is tracked by the FULL-UI completion guard's route discovery", () => {
  assert.match(guard, /\["src\/api\/athlete_goals\.routes\.ts", "\/athlete-goals"\]/u);
});

test("the athlete and coach goal panels exist as real controls", () => {
  assert.match(indexHtml, /id="athleteGoalCreateForm"/u);
  assert.match(indexHtml, /id="athleteGoalLabelInput"/u);
  assert.match(indexHtml, /id="athleteGoalMetricSelect"/u);
  assert.match(indexHtml, /id="athleteGoalTargetValueInput"/u);
  assert.match(indexHtml, /id="athleteGoalList"/u);
  assert.match(indexHtml, /id="athlete-goals-root"/u);

  assert.match(appJs, /async function refreshAthleteGoals/u);
  assert.match(appJs, /async function createAthleteGoal/u);
  assert.match(appJs, /async function resolveAthleteGoal/u);
  assert.match(athleteGoalsPanel, /useAthleteGoals/u);
  assert.match(athleteGoalsPanel, /goal_label/u);
});

test("goals are refreshed alongside the other history and athlete-detail panels", () => {
  assert.match(appJs, /refreshAthleteGoals\(\{ quiet: true \}\)\.catch\(\(\) => \{\}\)/u);
  assert.match(coachWorkspaceClient, /athlete-goals\/coach\//u);
});

test("the FULL-UI-37 manifest area declares all four functions as implemented with real routes and tests", () => {
  const area = manifest.product_areas.find((entry) => entry.area_id === "athlete_goals");
  assert.ok(area, "expected an athlete_goals product area");
  assert.equal(area.slice_id, "FULL-UI-37");
  assert.equal(area.state, "implemented");

  const functionIds = area.functions.map((fn) => fn.function_id);
  assert.deepEqual(
    functionIds.sort(),
    ["athlete_goal_create", "athlete_goal_list_athlete", "athlete_goal_list_coach", "athlete_goal_resolve"]
  );

  // NOTE: the coach function's direct_test points at its React component
  // test now (see the DEV NOTE above) - the athlete functions stay on this
  // file since refreshAthleteGoals/createAthleteGoal/resolveAthleteGoal
  // stay legacy.
  const expectedDirectTest = {
    athlete_goal_create: "test/full_ui_37_athlete_goals_surface.test.mjs",
    athlete_goal_resolve: "test/full_ui_37_athlete_goals_surface.test.mjs",
    athlete_goal_list_athlete: "test/full_ui_37_athlete_goals_surface.test.mjs",
    athlete_goal_list_coach: "public/app-src/__tests__/AthleteGoalsPanel.test.tsx"
  };

  for (const fn of area.functions) {
    assert.equal(fn.state, "implemented");
    assert.equal(fn.integration_test, "test/full_ui_37_athlete_goals_persistent.integration.test.mjs");
    assert.equal(fn.direct_test, expectedDirectTest[fn.function_id]);
    assert.notEqual(fn.persistence, "localStorage_only");
  }

  assert.ok(manifest.delivery_slices.some((slice) => slice.slice_id === "FULL-UI-37" && slice.state === "implemented"));
});

test("athlete functions reuse the athlete_history route_id and the coach function reuses coach_athlete_detail", () => {
  const area = manifest.product_areas.find((entry) => entry.area_id === "athlete_goals");
  for (const functionId of ["athlete_goal_create", "athlete_goal_resolve", "athlete_goal_list_athlete"]) {
    const fn = area.functions.find((entry) => entry.function_id === functionId);
    assert.equal(fn.route_id, "athlete_history", functionId);
  }
  const coachFn = area.functions.find((fn) => fn.function_id === "athlete_goal_list_coach");
  assert.equal(coachFn.route_id, "coach_athlete_detail");
});
