// DEV NOTE: FULL-UI-30 exercise reference-media static surface contract.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const service = read("src/api/exercise_reference_media_service.ts");
const routes = read("src/api/exercise_reference_media.routes.ts");
const serverTs = read("src/server.ts");
const schema = read("ci/schemas/exercise.registry.schema.json");
const manifest = JSON.parse(read("product/ui/function_manifest.json"));
const appJs = read("public/app/app.js");
const stylesCss = read("public/app/styles.css");

const forbiddenEngineImports = /session_state_write_service\.js|session_state_query_service\.js|block_compile_write_service\.js|engine_runner_service\.js|@kolosseum\/engine|engine\/src\//u;

test("exercise reference media is mounted at its own /exercises prefix with a single read-only route", () => {
  assert.match(serverTs, /app\.use\("\/exercises", exerciseReferenceMediaRouter\)/u);
  assert.ok(routes.includes('"/:exercise_id/reference-media"'), "expected the reference-media route");
});

test("identity is resolved from the session cookie only, never a client-supplied user_id, and either actor type may read it", () => {
  assert.doesNotMatch(routes, /request\.body\.(?:coach_|athlete_)?user_id|request\.query\.(?:coach_|athlete_)?user_id/u);
  assert.match(routes, /async function authenticatedAthleteOrCoach/u);
  assert.match(routes, /actor_type !== "athlete" && session\.account_row\.actor_type !== "coach"/u);
});

test("the route file has no POST/PUT/DELETE anywhere - this surface is entirely read-only", () => {
  assert.doesNotMatch(routes, /exerciseReferenceMediaRouter\.(post|put|delete|patch)\(/u);
});

test("the service reads the exercise registry file directly and never imports any engine-truth service", () => {
  assert.match(service, /registries.*exercise.*exercise\.registry\.json|exercise\.registry\.json/u);
  for (const source of [service, routes]) {
    assert.doesNotMatch(source, forbiddenEngineImports);
    assert.doesNotMatch(source, /from ["']\.\.\/\.\.\/engine\/src/u);
  }
});

test("the service returns reference_media: null for every exercise until real content exists", () => {
  assert.match(service, /reference_media:\s*entry\.reference_media\s*\?\?\s*null/u);
});

test("reference_media is declared optional (not required) in the exercise registry schema", () => {
  const entrySchema = JSON.parse(schema.match(/"additionalProperties":\s*\{[\s\S]*\}\s*\}\s*\}\s*\}$/u)?.[0] ?? "{}");
  assert.ok(schema.includes('"reference_media"'), "expected a reference_media property in the exercise schema");

  const requiredBlockMatch = schema.match(/"required":\s*\[[^\]]*\]/gu) ?? [];
  const entryRequiredBlock = requiredBlockMatch.find((block) => block.includes("exercise_id"));
  assert.ok(entryRequiredBlock, "expected to find the exercise entry's required array");
  assert.doesNotMatch(entryRequiredBlock, /"reference_media"/u);
});

test("no live exercise entry has a reference_media value yet (content-free infrastructure slice)", () => {
  const exerciseRegistry = JSON.parse(read("registries/exercise/exercise.registry.json"));
  for (const exercise of Object.values(exerciseRegistry.entries)) {
    assert.equal("reference_media" in exercise, false, `${exercise.exercise_id}: expected no reference_media value yet`);
  }
});

// The manifest marks exercise_reference_media_lookup implemented for BOTH
// athlete and coach actors, but until this test, nothing anywhere fetched
// or rendered the route's response - the athlete's session focus panel and
// the coach's template builder work-item-info panel (both driven by
// loadExerciseHowto/renderExerciseHowto, the shared insertion point) never
// called it, so a coach or admin could populate reference_media on a
// registry entry and no user would ever see it.
test("loadExerciseHowto fetches the reference-media route alongside exercise content, and renderExerciseHowto shows it to both the athlete and coach call sites it already serves", () => {
  assert.match(appJs, /reference-media/u);
  assert.match(appJs, /function renderExerciseHowto\(container, content, referenceMedia\)/u);
  assert.match(appJs, /referenceMedia(?:Result)?\?\.reference_media/u);
  assert.match(appJs, /referenceMedia\?\.video_url/u);

  // Both existing call sites already route through loadExerciseHowto, so no
  // additional call site needs to be added for this fix to reach the
  // athlete's session focus panel and the coach's builder info panel.
  assert.match(appJs, /loadExerciseHowto\(exerciseId, panel\)/u);
  assert.match(appJs, /loadExerciseHowto\(details\.dataset\.exerciseId, details\.querySelector\(".exercise-howto-body"\)\)/u);
});

test("the reference-video link and thumbnail are escaped before being inserted into innerHTML, and have their own styling", () => {
  assert.match(appJs, /escapeHtml\(referenceMedia\.video_url\)/u);
  assert.match(appJs, /escapeHtml\(referenceMedia\.thumbnail_url\)/u);
  assert.match(stylesCss, /\.exercise-reference-media-link/u);
  assert.match(stylesCss, /\.exercise-reference-media-thumbnail/u);
});

test("the FULL-UI-30 manifest area declares the lookup function as implemented with a real route and tests", () => {
  const area = manifest.product_areas.find((entry) => entry.area_id === "exercise_reference_media");
  assert.ok(area, "expected an exercise_reference_media product area");
  assert.equal(area.slice_id, "FULL-UI-30");
  assert.equal(area.state, "implemented");

  const functionIds = area.functions.map((fn) => fn.function_id);
  assert.deepEqual(functionIds, ["exercise_reference_media_lookup"]);

  for (const fn of area.functions) {
    assert.equal(fn.state, "implemented");
    assert.equal(fn.integration_test, "test/full_ui_30c_exercise_reference_media_persistent.integration.test.mjs");
    assert.ok(fn.direct_test);
    assert.deepEqual(fn.actors.slice().sort(), ["athlete", "coach"]);
  }

  assert.ok(manifest.delivery_slices.some((slice) => slice.slice_id === "FULL-UI-30" && slice.state === "implemented"));
});
