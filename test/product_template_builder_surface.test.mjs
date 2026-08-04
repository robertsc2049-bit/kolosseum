// DEV NOTE: Product coach programme builder static contract.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const server = read("src/server.ts");
const templateRoutes = read("src/api/templates.routes.ts");
const templateHandlers = read("src/api/templates.handlers.ts");
const templateService = read("src/api/beta18_programme_template_service.ts");
const workspaceRoutes = read("src/api/coach_workspace.routes.ts");
const workspaceHandlers = read("src/api/coach_workspace.handlers.ts");
const workspaceService = read("src/api/beta19_coach_workspace_service.ts");
const store = read("src/api/beta_product_record_store.ts");
const schema = read("schema.sql");
const html = read("public/app/index.html");
const css = read("public/app/styles.css");
const js = read("public/app/app.js");
const blocks = read("src/api/blocks.handlers.ts");
const journey = read("src/api/beta_product_journey_service.ts");
const phase4Types = read("engine/src/phases/phase4/types.ts");
const phase6 = read("engine/src/phases/phase6.ts");

test("programme and athlete-reference routes are mounted", () => {
  assert.match(server, /import \{ templatesRouter \} from "\.\/api\/templates\.routes\.js";/u);
  assert.match(server, /app\.use\("\/templates", templatesRouter\);/u);
  assert.match(server, /import \{ coachWorkspaceRouter \} from "\.\/api\/coach_workspace\.routes\.js";/u);
  assert.match(server, /app\.use\("\/coach-workspace", coachWorkspaceRouter\);/u);
  assert.match(templateRoutes, /\/:template_id\/activate/u);
  assert.match(templateRoutes, /\/:template_id\/duplicate/u);
  assert.match(templateRoutes, /\/:template_id\/archive/u);
  assert.match(templateHandlers, /saveCoachProgrammeTemplate/u);
  assert.match(workspaceRoutes, /\/athlete-strength-profile/u);
  assert.match(workspaceRoutes, /\/athletes/u);
  assert.match(workspaceRoutes, /\/assignments/u);
  assert.match(workspaceHandlers, /saveAthleteStrengthProfile/u);
  assert.match(workspaceHandlers, /getConnectedCoachAthletes/u);
  assert.match(workspaceHandlers, /getCoachAssignments/u);
});

test("programme and athlete strength records are immutable persisted state", () => {
  assert.match(store, /beta18_programme_template/u);
  assert.match(store, /beta19_athlete_strength_profile/u);
  assert.match(schema, /'beta18_programme_template'/u);
  assert.match(schema, /'beta19_athlete_strength_profile'/u);
  assert.match(templateService, /persistBetaProductRecord/u);
  assert.match(workspaceService, /persistBetaProductRecord/u);
  assert.match(templateService, /active_or_archived_template_is_immutable/u);
  assert.match(templateService, /only_draft_can_activate/u);
});

test("programme authoring contains explicit ordered training blocks", () => {
  assert.match(templateService, /const trainingBlockTypes/u);
  assert.match(templateService, /"general",\s*"volume",\s*"strength",\s*"peak",\s*"deload",\s*"custom"/u);
  assert.match(templateService, /templateInputBlocks/u);
  assert.match(templateService, /block_order_not_contiguous/u);
  assert.match(templateService, /week_count_per_block_invalid/u);
  assert.match(templateService, /total_week_count_invalid/u);
  assert.match(templateService, /block_count:/u);
  assert.match(templateService, /week_count:/u);
  assert.match(templateService, /template_block_name/u);
  assert.match(templateService, /template_block_type/u);
});

test("builder is registry-bound and supports complete explicit prescriptions", () => {
  assert.match(templateService, /registries",\s*"exercise",\s*"exercise\.registry\.json"/u);
  assert.match(templateService, /session_requires_exactly_four_work_items/u);
  assert.match(templateService, /duplicate_exercise_in_session/u);
  assert.match(templateService, /const repModes/u);
  assert.match(templateService, /"fixed",\s*"range"/u);
  assert.match(templateService, /const loadModes/u);
  assert.match(templateService, /"percent_1rm",\s*"fixed_weight",\s*"bodyweight",\s*"rpe"/u);
  assert.match(templateService, /rep_range_order_invalid/u);
  assert.match(templateService, /weight_unit_invalid/u);
  assert.match(templateService, /rpe_value_invalid/u);
});

test("athlete profile supports factual 1RM, estimated 1RM and training max records", () => {
  assert.match(workspaceService, /"tested_1rm",\s*"estimated_1rm",\s*"training_max"/u);
  assert.match(workspaceService, /preferred_weight_unit/u);
  assert.match(workspaceService, /load_rounding_increment/u);
  assert.match(workspaceService, /benchmark_effective_date_invalid/u);
  assert.match(workspaceService, /currentBenchmarkForExercise/u);
  assert.match(workspaceService, /sourceOneRepMax/u);
  assert.match(workspaceService, /calculationOneRepMax/u);
  assert.match(workspaceService, /2\.2046226218/u);
  assert.match(workspaceService, /resolvePercentageLoad/u);
  assert.match(workspaceService, /listConnectedCoachAthletes/u);
  assert.match(workspaceService, /listCoachAssignments/u);
  assert.match(workspaceService, /inference_applied: false/u);
  assert.match(workspaceService, /recommendation_semantics: false/u);
});

test("percentage programmes fail closed without an athlete strength reference", () => {
  assert.match(templateService, /loadAthleteStrengthProfile/u);
  assert.match(templateService, /resolvePercentageLoad/u);
  assert.match(templateService, /athlete_one_rep_max_missing/u);
  assert.match(templateService, /athlete_profile_record_sha256/u);
  assert.match(blocks, /athlete_profile_record_sha256/u);
  assert.match(blocks, /athlete_user_id:/u);
});

test("engine output preserves ranges, literal loading and resolved loads", () => {
  assert.match(phase4Types, /rep_range\?: PlannedItemRepRange/u);
  assert.match(phase4Types, /type: "bodyweight"/u);
  assert.match(phase4Types, /unit\?: "kg" \| "lb"/u);
  assert.match(phase6, /repRangeFromItem/u);
  assert.match(phase6, /rep_range: repRange/u);
  assert.match(phase6, /resolved_load/u);
  assert.match(phase6, /intensity: it\.intensity/u);
});

test("assignment requires an active owned programme and the required factual references", () => {
  assert.match(journey, /loadActiveCoachTemplateById/u);
  assert.match(journey, /stored_template_not_active/u);
  assert.match(journey, /stored_template_activity_mismatch/u);
  assert.match(js, /requiredOneRmExerciseIds/u);
  assert.match(js, /renderAssignmentRequirements/u);
  assert.match(js, /Complete the athlete strength references required by this programme/u);
});

test("assigned programme materialises the next deterministic session across blocks", () => {
  assert.match(blocks, /materialiseNextCoachTemplateProgram/u);
  assert.match(blocks, /programForSession/u);
  assert.match(templateService, /orderedTemplateSessions/u);
  assert.match(templateService, /assigned_template_sessions_exhausted/u);
  assert.match(templateService, /template_record_sha256/u);
  assert.match(templateService, /explicit_order_index_only/u);
  assert.match(templateService, /planned_items/u);
  assert.match(blocks, /template_compile_binding_missing/u);
  assert.match(blocks, /phase2_canonical_hash/u);
});

test("coach UI exposes one coherent athlete, programme, assignment and review workflow", () => {
  assert.match(html, /data-view="templates"/u);
  assert.match(html, /id="view-athletes"/u);
  assert.match(html, /id="athleteProfilePanel"/u);
  assert.match(html, /id="athleteBenchmarkList"/u);
  assert.match(html, /id="templateBlocks"/u);
  assert.match(html, /id="addTemplateBlockButton"/u);
  assert.match(html, /id="assignmentRequirements"/u);
  assert.match(html, /id="view-review"/u);
  assert.match(js, /refreshCoachAthletes/u);
  assert.match(js, /refreshCoachAssignments/u);
  assert.match(js, /refreshCoachAthleteProfiles/u);
  assert.match(js, /openAthleteProfile/u);
  assert.match(js, /saveOpenAthleteProfile/u);
  assert.match(js, /addTemplateBlock/u);
  assert.match(js, /duplicateTemplateBlock/u);
  assert.match(js, /moveTemplateBlock/u);
  assert.match(js, /duplicateTemplateWeek/u);
  assert.match(js, /duplicateTemplateSession/u);
  assert.match(js, /renderTemplateRepControls/u);
  assert.match(js, /renderTemplateLoadControls/u);
  assert.match(css, /\.template-block/u);
  assert.match(css, /\.athlete-profile-panel/u);
  assert.match(css, /\.benchmark-row/u);
  assert.match(css, /\.assignment-requirements/u);
});

test("normal coach UI avoids prohibited inference and diagnostic surfaces", () => {
  assert.doesNotMatch(html, /Raw trace|Raw state|Console|phase1Input|beta17Output/u);
  assert.doesNotMatch(js, /\/ui\/v0-session-runner/u);
  assert.doesNotMatch(html, /readiness score|safety score|recommended load|capability score/iu);
  assert.doesNotMatch(js, /inferReadiness|inferSafety|recommendLoad|capabilityScore/u);
});
