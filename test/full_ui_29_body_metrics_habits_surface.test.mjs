// DEV NOTE: FULL-UI-29 body-metric and habit/streak static surface contract.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const lifecycle = read("shared/body-metrics/bodyMetricsAndHabitsLifecycle.mjs");
const bodyMetricsService = read("src/api/body_metrics_service.ts");
const bodyMetricsRoutes = read("src/api/body_metrics.routes.ts");
const habitService = read("src/api/habit_tracking_service.ts");
const habitRoutes = read("src/api/habit_tracking.routes.ts");
const serverTs = read("src/server.ts");
const schema = read("schema.sql");
const recordStore = read("src/api/beta_product_record_store.ts");
const appJs = read("public/app/app.js");
const indexHtml = read("public/app/index.html");
const manifest = JSON.parse(read("product/ui/function_manifest.json"));

const forbiddenEngineImports = /session_state_write_service\.js|session_state_query_service\.js|block_compile_write_service\.js|engine_runner_service\.js|@kolosseum\/engine|engine\/src\//u;

test("body-metrics and habits are mounted at their own prefixes with the expected routes", () => {
  assert.match(serverTs, /app\.use\("\/body-metrics", bodyMetricsRouter\)/u);
  assert.match(serverTs, /app\.use\("\/habits", habitTrackingRouter\)/u);

  for (const path_ of ['"/"', '"/coach/:athlete_user_id"']) {
    assert.ok(bodyMetricsRoutes.includes(path_), `expected body-metrics route ${path_}`);
  }
  for (const path_ of ['"/"', '"/:habit_id/archive"', '"/:habit_id/completions"', '"/coach/:athlete_user_id"']) {
    assert.ok(habitRoutes.includes(path_), `expected habit route ${path_}`);
  }
});

test("identity is resolved from the session cookie only, never a client-supplied user_id", () => {
  for (const routes of [bodyMetricsRoutes, habitRoutes]) {
    assert.doesNotMatch(routes, /request\.body\.(?:coach_|athlete_)?user_id|request\.query\.(?:coach_|athlete_)?user_id/u);
    assert.match(routes, /authenticatedAthlete\(request, true\)/u);
    assert.match(routes, /authenticatedAthlete\(request, false\)/u);
    assert.match(routes, /async function authenticatedAthlete/u);
  }
});

test("a coach may log a body-metric entry but has no write path anywhere in the habit routes", () => {
  assert.match(bodyMetricsRoutes, /bodyMetricsRouter\.post\(\s*"\/coach\/:athlete_user_id"/u);
  assert.match(bodyMetricsRoutes, /authenticatedCoach\(request, true\)/u);

  assert.doesNotMatch(habitRoutes, /habitTrackingRouter\.(post|put|delete)\(\s*["'`]\/coach\//u);
  assert.doesNotMatch(habitRoutes, /authenticatedCoach\(request, true\)/u);
});

test("habit_tracking_service.ts has no coach-facing write function", () => {
  assert.doesNotMatch(habitService, /export async function \w*Coach\w*(?:Create|Log|Archive|Complete)/iu);
});

test("computeHabitStreak's source never references readiness, adherence, risk, score, recommendation or fatigue framing", () => {
  const forbiddenTerms = ["readiness", "adherence", "risk", "score", "recommend", "optimal", "fatigue"];
  for (const term of forbiddenTerms) {
    assert.doesNotMatch(lifecycle, new RegExp(term, "iu"), `lifecycle module must not contain forbidden term: ${term}`);
  }
});

test("computeHabitStreak returns exactly current_streak_length, longest_streak_length and total_completions - no score or grade key", () => {
  const returnBlockMatch = lifecycle.match(/return Object\.freeze\(\{\s*current_streak_length:\s*currentStreakLength,[\s\S]*?\}\);/u);
  assert.ok(returnBlockMatch, "expected computeHabitStreak's final return statement");
  const returnBlock = returnBlockMatch[0];

  assert.match(returnBlock, /current_streak_length:\s*currentStreakLength/u);
  assert.match(returnBlock, /longest_streak_length:\s*longestStreakLength/u);
  assert.match(returnBlock, /total_completions:\s*totalCompletions/u);
  assert.doesNotMatch(returnBlock, /\bscore\b|\bgrade\b|\bpercentage\b/iu);
});

test("habit completion is idempotent on (habit_id, completion_date), checked at the application level before persisting", () => {
  assert.match(habitService, /completionId = `habit_completion_\$\{sha256\(\{ habitId, completionDate \}\)/u);
  assert.match(habitService, /SELECT record_payload[\s\S]*record_type = 'habit_completion'[\s\S]*record_id = \$1/u);
});

test("every stored body-metric and habit record is a factual, immutable, engine-invisible fact - never scored or inferred", () => {
  for (const source of [bodyMetricsService, habitService]) {
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
      assert.ok(source.includes(field), `expected record to declare ${field}`);
    }
  }
});

test("body_metric_entry, habit_definition and habit_completion are wired into the shared record store's supported-type surface", () => {
  for (const recordType of ["body_metric_entry", "habit_definition", "habit_completion"]) {
    assert.match(recordStore, new RegExp(`"${recordType}"`, "u"));
    assert.match(recordStore, new RegExp(`case "${recordType}":`, "u"));
  }
  assert.match(schema, /beta_product_records_full_ui_29_type_migration/u);
  for (const recordType of ["body_metric_entry", "habit_definition", "habit_completion"]) {
    assert.match(schema, new RegExp(`'${recordType}'`, "u"));
  }
});

test("no body-metric or habit file imports any engine-truth service", () => {
  for (const source of [lifecycle, bodyMetricsService, bodyMetricsRoutes, habitService, habitRoutes]) {
    assert.doesNotMatch(source, forbiddenEngineImports);
  }
});

test("the athlete forms and coach read-only panels exist as real controls, and streak/caption text is escaped before rendering", () => {
  assert.match(indexHtml, /id="bodyMetricLogForm"/u);
  assert.match(indexHtml, /id="bodyMetricHistory"/u);
  assert.match(indexHtml, /id="habitCreateForm"/u);
  assert.match(indexHtml, /id="habitList"/u);
  assert.match(indexHtml, /id="athleteDetailBodyMetricHistory"/u);
  assert.match(indexHtml, /id="athleteDetailHabitList"/u);

  assert.match(appJs, /escapeHtml\(habit\.habit_label\)/u);
  assert.match(appJs, /escapeHtml\(entry\.note\)|escapeHtml\(label\)/u);
  assert.match(appJs, /async function refreshBodyMetrics/u);
  assert.match(appJs, /async function logBodyMetricEntry/u);
  assert.match(appJs, /async function refreshCoachAthleteBodyMetrics/u);
  assert.match(appJs, /async function createHabit/u);
  assert.match(appJs, /async function logHabitCompletionToday/u);
  assert.match(appJs, /async function refreshCoachAthleteHabits/u);
});

test("habit streak counts are rendered as plain integers with factual copy, never a percentage or graded label", () => {
  assert.match(appJs, /\$\{habit\.current_streak_length\} day\$\{habit\.current_streak_length === 1/u);

  const habitCardMatch = appJs.match(/function renderHabitCard\(habit, options = \{\}\) \{([\s\S]*?)\n\}/u);
  assert.ok(habitCardMatch, "expected renderHabitCard function body");
  // Scoped to the habit-card renderer itself, not the whole file - the
  // separate progress_insights feature (FULL-UI-36) legitimately renders
  // "adherence" text elsewhere in app.js for session completion rates,
  // an unrelated, already-accepted surface.
  assert.doesNotMatch(habitCardMatch[1], /current_streak_length\}%|longest_streak_length\}%|adherence|readiness_/iu);
});

test("nutrition reuses the body-metric type registry rather than a parallel record type or route", () => {
  assert.match(lifecycle, /calories_kcal/u);
  assert.match(lifecycle, /protein_g/u);
  assert.match(lifecycle, /carbs_g/u);
  assert.match(lifecycle, /fat_g/u);
  // No new record_type, schema migration or route file for nutrition -
  // it is exactly a body_metric_entry with a different metric_type.
  assert.doesNotMatch(recordStore, /nutrition_entry|"nutrition_log"/u);
});

test("nutrition entries are excluded from the general body-measurements list and shown in their own dedicated panel", () => {
  assert.match(appJs, /NUTRITION_METRIC_TYPES = \[/u);
  assert.match(appJs, /filter\(\(entry\) => !NUTRITION_METRIC_TYPES\.includes\(entry\.metric_type\)\)/u);
  assert.match(appJs, /function groupNutritionEntriesByDate/u);
  assert.match(appJs, /function renderNutritionSummary/u);
  assert.match(appJs, /async function logNutritionEntry/u);

  assert.match(indexHtml, /id="nutritionForm"/u);
  assert.match(indexHtml, /id="nutritionDateInput"/u);
  assert.match(indexHtml, /id="nutritionCaloriesInput"/u);
  assert.match(indexHtml, /id="nutritionProteinInput"/u);
  assert.match(indexHtml, /id="nutritionCarbsInput"/u);
  assert.match(indexHtml, /id="nutritionFatInput"/u);
  assert.match(indexHtml, /id="nutritionSummary"/u);
  assert.match(indexHtml, /id="athleteDetailNutritionSummary"/u);
});

test("every real METRIC_TYPES key has a display label - a device-synced body_weight_kg reading never renders as a raw field name", () => {
  const sourceOfTruth = lifecycle.match(/const METRIC_TYPES =\s*\n?\s*new Map\(\[([\s\S]*?)\]\);/u);
  assert.ok(sourceOfTruth, "expected METRIC_TYPES Map in bodyMetricsAndHabitsLifecycle.mjs");
  const metricTypes = [...sourceOfTruth[1].matchAll(/\[\s*"([a-z_]+)"/gu)].map((match) => match[1]);
  assert.ok(metricTypes.length > 0, "expected to parse at least one metric type");

  const labelsBlock = appJs.match(/const BODY_METRIC_TYPE_LABELS = \{([\s\S]*?)\};/u);
  assert.ok(labelsBlock, "expected BODY_METRIC_TYPE_LABELS object in app.js");

  for (const metricType of metricTypes) {
    assert.ok(
      labelsBlock[1].includes(`${metricType}:`),
      `expected BODY_METRIC_TYPE_LABELS to declare a label for ${metricType}`
    );
  }
});

test("every real METRIC_SOURCES value resolves to its own badge - device_synced never falls through to the athlete/coach badge", () => {
  const sourceOfTruth = lifecycle.match(/const METRIC_SOURCES =\s*\n?\s*new Set\(\[([\s\S]*?)\]\);/u);
  assert.ok(sourceOfTruth, "expected METRIC_SOURCES Set in bodyMetricsAndHabitsLifecycle.mjs");
  const metricSources = [...sourceOfTruth[1].matchAll(/"([a-z_]+)"/gu)].map((match) => match[1]);
  assert.ok(metricSources.length > 0, "expected to parse at least one metric source");

  const badgeFn = appJs.match(/function bodyMetricSourceBadge\(entry, options = \{\}\) \{([\s\S]*?)\n\}/u);
  assert.ok(badgeFn, "expected a bodyMetricSourceBadge helper in app.js");

  for (const source of metricSources) {
    if (source === "athlete_entered") continue;
    assert.ok(
      badgeFn[1].includes(`"${source}"`),
      `expected bodyMetricSourceBadge to branch explicitly on ${source}`
    );
  }

  assert.match(appJs, /entry\.source === "device_synced"\) return "Device"/u);
  assert.match(appJs, /const sourceBadge = bodyMetricSourceBadge\(entry, options\)/u);
});

test("the FULL-UI-29 manifest area declares all ten functions as implemented with real tests", () => {
  const area = manifest.product_areas.find((entry) => entry.area_id === "body_metrics_habits");
  assert.ok(area, "expected a body_metrics_habits product area");
  assert.equal(area.slice_id, "FULL-UI-29");
  assert.equal(area.state, "implemented");

  const functionIds = area.functions.map((fn) => fn.function_id);
  assert.deepEqual(
    functionIds.sort(),
    [
      "body_metric_history_athlete",
      "body_metric_history_coach",
      "body_metric_log",
      "habit_create",
      "habit_history_list",
      "habit_log_completion",
      "habit_streak_display",
      "nutrition_history_athlete",
      "nutrition_history_coach",
      "nutrition_log"
    ]
  );

  for (const fn of area.functions) {
    assert.equal(fn.state, "implemented");
    assert.equal(fn.integration_test, "test/full_ui_29c_body_metrics_habits_persistent.integration.test.mjs");
    assert.ok(fn.direct_test);
  }

  assert.ok(manifest.delivery_slices.some((slice) => slice.slice_id === "FULL-UI-29" && slice.state === "implemented"));
});
