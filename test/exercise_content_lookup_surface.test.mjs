// DEV NOTE: FULL-UI-35 exercise coaching-content static surface contract.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const service = read("src/api/exercise_content_service.ts");
const routes = read("src/api/exercise_content.routes.ts");
const serverTs = read("src/server.ts");
const schema = read("ci/schemas/exercise.registry.schema.json");
const manifest = JSON.parse(read("product/ui/function_manifest.json"));

const forbiddenEngineImports = /session_state_write_service\.js|session_state_query_service\.js|block_compile_write_service\.js|engine_runner_service\.js|@kolosseum\/engine|engine\/src\//u;

test("exercise content is mounted at its own /exercises prefix with a single read-only route", () => {
  assert.match(serverTs, /app\.use\("\/exercises", exerciseContentRouter\)/u);
  assert.ok(routes.includes('"/:exercise_id/content"'), "expected the content route");
});

test("identity is resolved from the session cookie only, never a client-supplied user_id, and either actor type may read it", () => {
  assert.doesNotMatch(routes, /request\.body\.(?:coach_|athlete_)?user_id|request\.query\.(?:coach_|athlete_)?user_id/u);
  assert.match(routes, /async function authenticatedAthleteOrCoach/u);
  assert.match(routes, /actor_type !== "athlete" && session\.account_row\.actor_type !== "coach"/u);
});

test("the route file has no POST/PUT/DELETE anywhere - this surface is entirely read-only", () => {
  assert.doesNotMatch(routes, /exerciseContentRouter\.(post|put|delete|patch)\(/u);
});

test("the service reads the exercise registry file directly and never imports any engine-truth service", () => {
  assert.match(service, /registries.*exercise.*exercise\.registry\.json|exercise\.registry\.json/u);
  for (const source of [service, routes]) {
    assert.doesNotMatch(source, forbiddenEngineImports);
    assert.doesNotMatch(source, /from ["']\.\.\/\.\.\/engine\/src/u);
  }
});

test("coaching_cues and common_faults are declared optional (not required) in the exercise registry schema", () => {
  assert.ok(schema.includes('"coaching_cues"'), "expected a coaching_cues property in the exercise schema");
  assert.ok(schema.includes('"common_faults"'), "expected a common_faults property in the exercise schema");

  const requiredBlockMatch = schema.match(/"required":\s*\[[^\]]*\]/gu) ?? [];
  const entryRequiredBlock = requiredBlockMatch.find((block) => block.includes("exercise_id"));
  assert.ok(entryRequiredBlock, "expected to find the exercise entry's required array");
  assert.doesNotMatch(entryRequiredBlock, /"coaching_cues"/u);
  assert.doesNotMatch(entryRequiredBlock, /"common_faults"/u);
});

test("every live exercise entry has real, non-empty written instructions, coaching cues and common faults", () => {
  const exerciseRegistry = JSON.parse(read("registries/exercise/exercise.registry.json"));
  const entries = Object.values(exerciseRegistry.entries);
  assert.ok(entries.length > 0, "expected at least one exercise entry");

  for (const exercise of entries) {
    assert.ok(
      Array.isArray(exercise.instruction?.detailed) && exercise.instruction.detailed.length > 0,
      `${exercise.exercise_id}: expected non-empty instruction.detailed`
    );
    assert.ok(
      Array.isArray(exercise.coaching_cues) && exercise.coaching_cues.length > 0,
      `${exercise.exercise_id}: expected non-empty coaching_cues`
    );
    assert.ok(
      Array.isArray(exercise.common_faults) && exercise.common_faults.length > 0,
      `${exercise.exercise_id}: expected non-empty common_faults`
    );
  }
});

test("the FULL-UI-35 manifest area declares the lookup function as implemented with a real route and tests", () => {
  const area = manifest.product_areas.find((entry) => entry.area_id === "exercise_content");
  assert.ok(area, "expected an exercise_content product area");
  assert.equal(area.slice_id, "FULL-UI-35");
  assert.equal(area.state, "implemented");

  const functionIds = area.functions.map((fn) => fn.function_id);
  assert.deepEqual(functionIds, ["exercise_content_lookup"]);

  for (const fn of area.functions) {
    assert.equal(fn.state, "implemented");
    assert.equal(fn.integration_test, "test/exercise_content_lookup_persistent.integration.test.mjs");
    assert.ok(fn.direct_test);
    assert.deepEqual(fn.actors.slice().sort(), ["athlete", "coach"]);
  }

  assert.ok(manifest.delivery_slices.some((slice) => slice.slice_id === "FULL-UI-35" && slice.state === "implemented"));
});

test("the builder and session-execution areas declare exercise-info lookup functions backed by the same route", () => {
  const builderArea = manifest.product_areas.find((entry) => entry.area_id === "programme_builder");
  const builderFn = builderArea?.functions.find((fn) => fn.function_id === "builder_exercise_info");
  assert.ok(builderFn, "expected a builder_exercise_info function in programme_builder");
  assert.deepEqual(builderFn.api_routes, ["/exercises/:exercise_id/content"]);

  const sessionArea = manifest.product_areas.find((entry) => entry.area_id === "session_execution");
  const sessionFn = sessionArea?.functions.find((fn) => fn.function_id === "session_exercise_howto");
  assert.ok(sessionFn, "expected a session_exercise_howto function in session_execution");
  assert.deepEqual(sessionFn.api_routes, ["/exercises/:exercise_id/content"]);
});

test("app.js wires an exercise-content cache, a shared render helper and both surfaces' toggle handlers", () => {
  const appJs = read("public/app/app.js");
  assert.match(appJs, /const exerciseContentCache = new Map\(\)/u);
  assert.match(appJs, /function renderExerciseHowto\(/u);
  assert.match(appJs, /function loadExerciseHowto\(/u);
  assert.match(appJs, /class="exercise-howto"/u);
  assert.match(appJs, /elements\.currentExercise\.addEventListener\("toggle"/u);
  assert.match(appJs, /class="template-work-item-info"/u);
  assert.match(appJs, /function toggleTemplateWorkItemInfo\(/u);
});
