// DEV NOTE: FULL-UI-82 crossfit activation + complex/AMRAP/EMOM/for-time
// group-workout static surface contract.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const activityRegistry = read("shared/v1-boundary/v1ActivityRegistry.mjs");
const draft = read("public/app-src/screens/coach/programmeDraft.ts");
const templateService = read("src/api/beta18_programme_template_service.ts");
const readModel = read("src/api/session_state_read_model.ts");
const writeService = read("src/api/session_state_write_service.ts");
const phase6 = read("engine/src/phases/phase6.ts");
const builderTree = read("public/app-src/screens/coach/CoachProgrammeBuilderTree.tsx");
const executionHook = read("public/app-src/screens/athlete/useAthleteSessionExecution.ts");
const executionPanel = read("public/app-src/screens/athlete/AthleteSessionExecutionPanel.tsx");
const manifest = JSON.parse(read("product/ui/function_manifest.json"));

const forbiddenEngineSrcImportsInApi = /from ["']\.\.\/\.\.\/engine\/src\/|from ["']\.\/engine\/src\/|@kolosseum\/engine\/src\//u;

test("crossfit is unlocked as v1's sixth locked activity", () => {
  assert.match(activityRegistry, /activity_id:\s*"crossfit"/u);
  assert.match(activityRegistry, /display_label:\s*"CrossFit"/u);
});

test("group_type widens to include complex/amrap/emom/for_time on both the client draft and server template service", () => {
  assert.match(draft, /GROUP_TYPES = Object\.freeze\(\["straight", "superset", "circuit", "complex", "amrap", "emom", "for_time"\]/u);
  assert.match(templateService, /workItemGroupTypes/u);
  for (const groupType of ["complex", "amrap", "emom", "for_time"]) {
    assert.match(templateService, new RegExp(`"${groupType}"`, "u"));
  }
});

test("the three new group-timing fields are validated server-side within documented bounds and rejected outside them", () => {
  assert.match(templateService, /work_item_group_time_cap_invalid/u);
  assert.match(templateService, /work_item_group_round_seconds_invalid/u);
  assert.match(templateService, /work_item_group_total_rounds_invalid/u);
});

test("validateWorkItemGrouping enforces a complex's same-weight invariant and amrap/for_time/emom's shared timing invariant, both client and server", () => {
  for (const source of [draft, templateService]) {
    assert.match(source, /work_item_group_complex_requires_fixed_weight/u);
    assert.match(source, /work_item_group_complex_weight_mismatch/u);
    assert.match(source, /work_item_group_time_cap_invalid/u);
    assert.match(source, /work_item_group_emom_params_invalid/u);
  }
});

test("four new client-facing runtime event types exist, each validated by its own shape-check function", () => {
  assert.match(writeService, /function ensureCompleteGroupShapeValid/u);
  assert.match(writeService, /function ensureAmrapResultReportShapeValid/u);
  assert.match(writeService, /function ensureEmomResultReportShapeValid/u);
  assert.match(writeService, /function ensureForTimeResultReportShapeValid/u);
  assert.match(writeService, /COMPLETE_GROUP_ALLOWED_KEYS = new Set\(\["type", "group_id", "client_request_id"\]\)/u);
  assert.match(writeService, /AMRAP_RESULT_REPORT_ALLOWED_KEYS = new Set\(\["type", "group_id", "rounds_completed", "extra_reps", "client_request_id"\]\)/u);
  assert.match(writeService, /EMOM_RESULT_REPORT_ALLOWED_KEYS = new Set\(\["type", "group_id", "rounds_completed", "rounds_missed", "client_request_id"\]\)/u);
  assert.match(writeService, /FOR_TIME_RESULT_REPORT_ALLOWED_KEYS = new Set\(\["type", "group_id", "elapsed_seconds", "hit_time_cap", "client_request_id"\]\)/u);
});

test("all four group-result validators are wired into appendRuntimeEventMutation's own validator chain", () => {
  assert.match(writeService, /ensureCompleteGroupShapeValid\(event, planned, workingSummary\);/u);
  assert.match(writeService, /ensureAmrapResultReportShapeValid\(event, planned, workingSummary\);/u);
  assert.match(writeService, /ensureEmomResultReportShapeValid\(event, planned, workingSummary\);/u);
  assert.match(writeService, /ensureForTimeResultReportShapeValid\(event, planned, workingSummary\);/u);
});

test("group completion folds every still-remaining group member through the existing single-exercise COMPLETE_EXERCISE path - no new engine reducer case, export, or package-boundary change", () => {
  assert.match(writeService, /GROUP_COMPLETION_EVENT_TYPES = new Set\(\["COMPLETE_GROUP", "AMRAP_RESULT_REPORT", "EMOM_RESULT_REPORT", "FOR_TIME_RESULT_REPORT"\]\)/u);
  assert.match(writeService, /isGroupCompletionEventType\(rawEventType\(event\)\)/u);
  assert.match(writeService, /applyWireEvent\(folded, \{ type: "COMPLETE_EXERCISE", exercise_id: memberId \} as any, planned as any\)/u);
  assert.doesNotMatch(writeService, forbiddenEngineSrcImportsInApi);
});

test("exactly one runtime_events row is inserted per group result report - the member-folding loop never inserts its own row per member", () => {
  const foldStart = writeService.indexOf("if (isGroupCompletionEventType(rawEventType(event))) {");
  assert.ok(foldStart >= 0, "expected the group-completion fold branch");
  const foldEnd = writeService.indexOf("nextSummary = preserveSplitLifecycle(workingSummary, nextSummary);", foldStart);
  assert.ok(foldEnd > foldStart, "expected the fold branch to end before the shared post-processing step");
  const foldBranch = writeService.slice(foldStart, foldEnd);
  assert.doesNotMatch(foldBranch, /INSERT INTO/u, "the fold loop must reuse the single row already inserted for the reported event, not insert one per member");
});

test("the session-state read model bundles a group's still-remaining members into one GROUP_WORKOUT step instead of surfacing them one exercise at a time", () => {
  assert.match(readModel, /GROUP_WORKOUT_TYPES = new Set\(\["complex", "amrap", "emom", "for_time"\]\)/u);
  assert.match(readModel, /function deriveCurrentStepFromRemaining/u);
  assert.match(readModel, /type: "GROUP_WORKOUT"/u);
});

test("phase6 passes group timing fields through additively and no longer mislabels every non-circuit group as a superset", () => {
  assert.match(phase6, /GROUP_TYPE_VALUES = new Set\(\["superset", "circuit", "complex", "amrap", "emom", "for_time"\]\)/u);
  assert.match(phase6, /GROUP_TYPE_VALUES\.has\(it\.group_type as string\)/u);
});

test("the coach builder offers all four new group_type options and renders their matching param inputs", () => {
  assert.match(builderTree, /<option value="complex">Complex<\/option>/u);
  assert.match(builderTree, /<option value="amrap">AMRAP<\/option>/u);
  assert.match(builderTree, /<option value="emom">EMOM<\/option>/u);
  assert.match(builderTree, /<option value="for_time">For time<\/option>/u);
  assert.match(builderTree, /groupTypeHint === "amrap" \|\| groupTypeHint === "for_time"/u);
  assert.match(builderTree, /groupTypeHint === "emom"/u);
  assert.match(builderTree, /groupTypeHint === "complex"/u);
});

test("the athlete execution hook exposes a callback and result-field setters for each of the four group result types", () => {
  assert.match(executionHook, /export function currentStepGroup/u);
  assert.match(executionHook, /const confirmCompleteGroup = useCallback/u);
  assert.match(executionHook, /const confirmAmrapResult = useCallback/u);
  assert.match(executionHook, /const confirmEmomResult = useCallback/u);
  assert.match(executionHook, /const confirmForTimeResult = useCallback/u);
});

test("the athlete execution panel renders a GROUP_WORKOUT step through a dedicated focus/actions pair instead of the single-exercise view", () => {
  assert.match(executionPanel, /function GroupWorkoutFocus/u);
  assert.match(executionPanel, /function GroupWorkoutActions/u);
  assert.match(executionPanel, /step\.type === "GROUP_WORKOUT"/u);
});

test("the FULL-UI-82 manifest functions are declared as implemented with real tests in the existing programme_builder and session_execution areas", () => {
  const builderArea = manifest.product_areas.find((entry) => entry.area_id === "programme_builder");
  const executionArea = manifest.product_areas.find((entry) => entry.area_id === "session_execution");
  assert.ok(builderArea, "expected the existing programme_builder product area");
  assert.ok(executionArea, "expected the existing session_execution product area");

  const builderFn = builderArea.functions.find((entry) => entry.function_id === "builder_group_workout");
  assert.ok(builderFn, "expected a builder_group_workout function");
  assert.equal(builderFn.state, "implemented");
  assert.equal(builderFn.direct_test, "test/full_ui_82_crossfit_group_workouts_surface.test.mjs");
  assert.equal(builderFn.integration_test, "test/full_ui_82c_crossfit_group_workouts_persistent.integration.test.mjs");
  assert.notEqual(builderFn.persistence, "localStorage_only");
  assert.deepEqual(builderFn.actors, ["coach"]);

  const executionFn = executionArea.functions.find((entry) => entry.function_id === "session_group_workout");
  assert.ok(executionFn, "expected a session_group_workout function");
  assert.equal(executionFn.state, "implemented");
  assert.equal(executionFn.direct_test, "test/full_ui_82_crossfit_group_workouts_surface.test.mjs");
  assert.equal(executionFn.integration_test, "test/full_ui_82c_crossfit_group_workouts_persistent.integration.test.mjs");
  assert.notEqual(executionFn.persistence, "localStorage_only");
  assert.deepEqual(executionFn.actors, ["athlete"]);

  assert.ok(manifest.delivery_slices.some((slice) => slice.slice_id === "FULL-UI-82" && slice.state === "implemented"));
});
