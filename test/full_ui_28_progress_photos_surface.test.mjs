// DEV NOTE: FULL-UI-28 athlete progress photos static surface contract.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const storage = read("src/api/progress_photo_storage.ts");
const service = read("src/api/progress_photo_service.ts");
const routes = read("src/api/progress_photos.routes.ts");
const serverTs = read("src/server.ts");
const schema = read("schema.sql");
const recordStore = read("src/api/beta_product_record_store.ts");
const appJs = read("public/app/app.js");
const indexHtml = read("public/app/index.html");
const manifest = JSON.parse(read("product/ui/function_manifest.json"));

const forbiddenEngineImports = /session_state_write_service\.js|session_state_query_service\.js|block_compile_write_service\.js|engine_runner_service\.js|@kolosseum\/engine|engine\/src\//u;

test("progress photos are mounted at their own /progress-photos prefix with the expected athlete and coach routes", () => {
  assert.match(serverTs, /app\.use\("\/progress-photos", progressPhotosRouter\)/u);

  for (const path_ of [
    '"/"', '"/:photo_id/file"', '"/coach/:athlete_user_id"', '"/coach/:athlete_user_id/:photo_id/file"'
  ]) {
    assert.ok(routes.includes(path_), `expected progress photo route ${path_}`);
  }
});

test("identity is resolved from the session cookie only, never a client-supplied user_id", () => {
  assert.doesNotMatch(routes, /request\.body\.(?:coach_|athlete_)?user_id|request\.query\.(?:coach_|athlete_)?user_id/u);
  assert.match(routes, /authenticatedAthlete\(request, true\)/u);
  assert.match(routes, /authenticatedAthlete\(request, false\)/u);
  assert.match(routes, /authenticatedCoach\(request, false\)/u);

  // Local duplicate mirroring messaging.routes.ts's identical pattern, not
  // an import of a shared athlete-scoped business file.
  assert.match(routes, /async function authenticatedAthlete/u);
});

test("the coach-facing surface is read-only - no POST/PUT/DELETE anywhere under /coach/, and never authenticated as a coach for mutation", () => {
  assert.doesNotMatch(routes, /progressPhotosRouter\.(post|put|delete)\(\s*["'`]\/coach\//u);
  assert.doesNotMatch(routes, /authenticatedCoach\(request, true\)/u);
});

test("the athlete upload route requires a real file and validates it via content-sniffing before persisting", () => {
  assert.match(routes, /progressPhotosRouter\.post\(\s*"\/",\s*progressPhotoUpload\.single\("photo"\)/u);
  assert.match(storage, /never trusted/u);
  assert.match(storage, /async function sniffFile/u);
  assert.match(storage, /validateStagedProgressPhotoUpload/u);
});

test("every stored progress photo record is a factual, immutable, engine-invisible fact - never a scored or inferred field", () => {
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
    assert.ok(service.includes(field), `expected progress photo record to declare ${field}`);
  }
});

test("beta_progress_photo is wired into the shared record store's supported-type surface", () => {
  assert.match(recordStore, /"beta_progress_photo"/u);
  assert.match(recordStore, /case "beta_progress_photo":/u);
  assert.match(schema, /beta_product_records_full_ui_28_type_migration/u);
  assert.match(schema, /'beta_progress_photo'/u);
});

test("no progress photo file imports any engine-truth service", () => {
  for (const source of [storage, service, routes]) {
    assert.doesNotMatch(source, forbiddenEngineImports);
  }
});

test("uploaded photos are never served through express.static, and storage keys are path-traversal-guarded", () => {
  assert.doesNotMatch(serverTs, /express\.static\([^)]*progress-photos/u);
  assert.match(storage, /function resolveProgressPhotoPath/u);
  assert.match(storage, /resolved !== STORAGE_ROOT && !resolved\.startsWith\(STORAGE_ROOT \+ path\.sep\)/u);
});

test("the athlete upload widget and coach read-only grid exist as real controls, and captions are escaped before rendering", () => {
  assert.match(indexHtml, /id="progressPhotoUploadForm"/u);
  assert.match(indexHtml, /id="progressPhotoFileInput"/u);
  assert.match(indexHtml, /id="progressPhotoGrid"/u);
  assert.match(indexHtml, /id="athleteDetailProgressPhotos"/u);

  assert.match(appJs, /escapeHtml\(photo\.caption\)/u);
  assert.match(appJs, /async function refreshProgressPhotos/u);
  assert.match(appJs, /async function uploadProgressPhoto/u);
  assert.match(appJs, /async function refreshCoachAthleteProgressPhotos/u);
});

test("a photo's byte_size, which progress_photo_service.ts already computes and returns to both the athlete and coach surfaces, is actually shown to the user as a human-readable file size", () => {
  // uploadProgressPhoto persists byte_size on every record and
  // serializePhotoForAthlete/serializePhotoForCoach pass it straight
  // through - but renderProgressPhotoCard never read it, so neither the
  // athlete's own grid nor the coach's read-only view ever showed how
  // large a progress photo was. Same phantom-field bug class as #884.
  assert.match(appJs, /function formatAttachmentSize/u);
  assert.match(appJs, /formatAttachmentSize\(photo\.byte_size\)/u);
});

test("both the athlete's own grid and the coach's read-only grid support selecting exactly two photos for a side-by-side comparison", () => {
  assert.match(indexHtml, /id="progressPhotoComparison"/u);
  assert.match(indexHtml, /id="athleteDetailProgressPhotoComparison"/u);

  assert.match(appJs, /function toggleProgressPhotoCompareSelection/u);
  assert.match(appJs, /function bindProgressPhotoCompareToggles/u);
  assert.match(appJs, /function renderProgressPhotoComparisonPanel/u);
  assert.match(appJs, /data-progress-photo-compare="\$\{escapeHtml\(photo\.photo_id\)\}"/u);

  assert.match(appJs, /bindProgressPhotoCompareToggles\(elements\.progressPhotoGrid, "progressPhotoCompareIds", renderProgressPhotos\)/u);
  assert.match(appJs, /bindProgressPhotoCompareToggles\(elements\.athleteDetailProgressPhotos, "coachAthleteProgressPhotoCompareIds", renderCoachAthleteProgressPhotos\)/u);
});

test("selecting a third photo drops the oldest selection rather than refusing the click, and the comparison panel only ever renders exactly two photos, oldest first", () => {
  assert.match(appJs, /if \(current\.length > 2\) current\.shift\(\);/u);
  assert.match(appJs, /if \(selectedIds\.length !== 2\)/u);
  assert.match(appJs, /\.sort\(\s*\n?\s*\(left, right\) => new Date\(left\.taken_at_iso8601\) - new Date\(right\.taken_at_iso8601\)\s*\n?\s*\)/u);
});

test("the FULL-UI-28 manifest area declares all three functions as implemented with real routes and tests", () => {
  const area = manifest.product_areas.find((entry) => entry.area_id === "progress_photos");
  assert.ok(area, "expected a progress_photos product area");
  assert.equal(area.slice_id, "FULL-UI-28");
  assert.equal(area.state, "implemented");

  const functionIds = area.functions.map((fn) => fn.function_id);
  assert.deepEqual(
    functionIds.sort(),
    ["progress_photo_athlete_history", "progress_photo_coach_view", "progress_photo_upload"]
  );

  for (const fn of area.functions) {
    assert.equal(fn.state, "implemented");
    assert.equal(fn.integration_test, "test/full_ui_28c_progress_photos_persistent.integration.test.mjs");
    assert.ok(fn.direct_test);
  }

  assert.ok(manifest.delivery_slices.some((slice) => slice.slice_id === "FULL-UI-28" && slice.state === "implemented"));
});
