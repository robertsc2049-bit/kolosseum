// DEV NOTE: FULL-UI-36 progress insights static surface contract.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const service = read("src/api/progress_insights_service.ts");
const routes = read("src/api/progress_insights.routes.ts");
const serverTs = read("src/server.ts");
const athleteHistoryService = read("src/api/athlete_history_service.ts");
const habitTrackingService = read("src/api/habit_tracking_service.ts");
const appJs = read("public/app/app.js");
const indexHtml = read("public/app/index.html");
const guard = read("ci/guards/full_ui_completion_guard.mjs");
const manifest = JSON.parse(read("product/ui/function_manifest.json"));
// DEV NOTE: the coach-side mirror moved to React - see
// public/app-src/screens/coach/AthleteProgressInsightsPanel.tsx and its
// __tests__ file for its behavioral coverage.
const athleteProgressInsightsPanel = read(
  "public/app-src/screens/coach/AthleteProgressInsightsPanel.tsx"
);
const coachWorkspaceClient = read("public/app-src/api/coachWorkspaceClient.ts");
// DEV NOTE: the athlete's own view also moved to React - see
// public/app-src/screens/athlete/AthleteSelfProgressInsightsPanel.tsx
// (named "Self" to avoid colliding with the coach-mirror component above)
// and its __tests__ file for its behavioral coverage.
const athleteSelfProgressInsightsPanel = read(
  "public/app-src/screens/athlete/AthleteSelfProgressInsightsPanel.tsx"
);
const useProgressInsightsHook = read("public/app-src/screens/athlete/useProgressInsights.ts");

const forbiddenEngineImports = /session_state_write_service\.js|session_state_query_service\.js|block_compile_write_service\.js|engine_runner_service\.js|@kolosseum\/engine|engine\/src\//u;

test("progress insights is mounted at /progress-insights with both read-only routes and no write path", () => {
  assert.match(serverTs, /app\.use\("\/progress-insights", progressInsightsRouter\)/u);
  assert.match(routes, /progressInsightsRouter\.get\(\s*\n?\s*"\/"/u);
  assert.match(routes, /progressInsightsRouter\.get\(\s*\n?\s*"\/coach\/:athlete_user_id"/u);
  assert.doesNotMatch(routes, /progressInsightsRouter\.(post|put|patch|delete)\(/u);
});

test("identity is resolved from the session cookie only, never a client-supplied user_id", () => {
  assert.doesNotMatch(routes, /request\.body\.(?:coach_|athlete_)?user_id|request\.query\.(?:coach_|athlete_)?user_id/u);
  assert.match(routes, /async function authenticatedAthlete/u);
  assert.match(routes, /authenticatedCoach\(request, false\)/u);
});

test("this slice reuses existing readers rather than issuing duplicate queries", () => {
  assert.match(service, /loadEnrichedAthleteSessions/u);
  assert.match(service, /queryHabitCompletions/u);
  assert.match(service, /listHabitsWithStreaksForAthlete/u);
  assert.match(service, /listHabitsForCoach/u);
  assert.match(service, /listBodyMetricHistoryForAthlete/u);
  assert.match(service, /listBodyMetricHistoryForCoach/u);
  assert.match(service, /projectStrengthReferenceLifecycle/u);

  assert.match(athleteHistoryService, /export async function loadEnrichedAthleteSessions/u);
  assert.match(habitTrackingService, /export async function queryHabitCompletions/u);
});

test("a coach relationship must be accepted before a coach can read an athlete's progress insights", () => {
  assert.match(service, /relationship_state !== "accepted"/u);
  assert.match(service, /relationship\.coach_user_id !== coachUserId/u);
  assert.match(service, /relationship\.athlete_user_id !== athleteUserId/u);
});

test("this slice persists nothing new - every metric is computed on read from already-stored facts", () => {
  assert.doesNotMatch(service, /persistBetaProductRecord|INSERT INTO|UPDATE /u);
});

test("the rolling window is 30 days", () => {
  assert.match(service, /const WINDOW_DAYS = 30/u);
});

test("adherence, strength trend and body-metric trend all guard against fabricating a rate or delta from missing data", () => {
  assert.match(service, /has_sufficient_data: totalSessions > 0/u);
  assert.match(service, /has_prior_value: prior !== null/u);
});

test("habit completion rate is capped at 100% via a min() rather than allowed to exceed the expected units", () => {
  assert.match(service, /Math\.min\(windowCompletions, windowExpectedUnits\)/u);
});

test("no progress-insights file imports any engine-truth service", () => {
  for (const source of [service, routes]) {
    assert.doesNotMatch(source, forbiddenEngineImports);
  }
});

test("the progress-insights route file is tracked by the FULL-UI completion guard's route discovery", () => {
  assert.match(guard, /\["src\/api\/progress_insights\.routes\.ts", "\/progress-insights"\]/u);
});

test("the athlete and coach progress-insights panels exist as real controls", () => {
  assert.match(indexHtml, /id="athlete-self-progress-insights-root"/u);
  assert.match(indexHtml, /id="athlete-progress-insights-root"/u);

  assert.match(athleteSelfProgressInsightsPanel, /useProgressInsights/u);
  assert.match(athleteSelfProgressInsightsPanel, /session_adherence/u);
  assert.match(useProgressInsightsHook, /loadProgressInsights/u);
  assert.match(athleteProgressInsightsPanel, /useAthleteProgressInsights/u);
  assert.match(athleteProgressInsightsPanel, /session_adherence/u);
});

test("progress insights are refreshed alongside the other history and athlete-detail panels", () => {
  assert.match(useProgressInsightsHook, /kolosseum:history-changed/u);
  assert.match(coachWorkspaceClient, /progress-insights\/coach\//u);
});

test("the FULL-UI-36 manifest area declares all three functions as implemented with real routes and tests", () => {
  const area = manifest.product_areas.find((entry) => entry.area_id === "progress_insights");
  assert.ok(area, "expected a progress_insights product area");
  assert.equal(area.slice_id, "FULL-UI-36");
  assert.equal(area.state, "implemented");

  const functionIds = area.functions.map((fn) => fn.function_id);
  assert.deepEqual(
    functionIds.sort(),
    [
      "progress_insights_athlete_summary",
      "progress_insights_coach_roster",
      "progress_insights_coach_summary"
    ]
  );

  // NOTE: the two per-athlete functions' direct_test point at their
  // respective React component tests (see the DEV NOTEs above) -
  // renderProgressInsightsSummary is gone from app.js. Progress graphs
  // slice 3's roster-wide rollup is a distinct capability with its own
  // component and integration test, not a mirror of the per-athlete pair.
  const expected = {
    progress_insights_athlete_summary: {
      direct_test: "public/app-src/__tests__/AthleteSelfProgressInsightsPanel.test.tsx",
      integration_test: "test/full_ui_36_progress_insights_persistent.integration.test.mjs"
    },
    progress_insights_coach_summary: {
      direct_test: "public/app-src/__tests__/AthleteProgressInsightsPanel.test.tsx",
      integration_test: "test/full_ui_36_progress_insights_persistent.integration.test.mjs"
    },
    progress_insights_coach_roster: {
      direct_test: "public/app-src/__tests__/CoachProgressOverviewPanel.test.tsx",
      integration_test: "test/coach_progress_rollup_persistent.integration.test.mjs"
    }
  };

  for (const fn of area.functions) {
    assert.equal(fn.state, "implemented");
    assert.equal(fn.integration_test, expected[fn.function_id].integration_test);
    assert.equal(fn.direct_test, expected[fn.function_id].direct_test);
    assert.notEqual(fn.persistence, "localStorage_only");
  }

  assert.ok(manifest.delivery_slices.some((slice) => slice.slice_id === "FULL-UI-36" && slice.state === "implemented"));
});

test("both functions reuse an existing route_id rather than declaring a new page", () => {
  const area = manifest.product_areas.find((entry) => entry.area_id === "progress_insights");
  const athleteFn = area.functions.find((fn) => fn.function_id === "progress_insights_athlete_summary");
  const coachFn = area.functions.find((fn) => fn.function_id === "progress_insights_coach_summary");
  assert.equal(athleteFn.route_id, "athlete_history");
  assert.equal(coachFn.route_id, "coach_athlete_detail");
});
