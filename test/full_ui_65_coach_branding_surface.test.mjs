// DEV NOTE: FULL-UI-65 coach branding preference static surface contract.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const service = read("src/api/coach_branding_service.ts");
const routes = read("src/api/coach_branding.routes.ts");
const serverTs = read("src/server.ts");
const lifecycle = read("shared/coach-branding/coachBrandingLifecycle.mjs");
const recordStore = read("src/api/beta_product_record_store.ts");
const schemaSql = read("schema.sql");
const relationshipService = read("src/api/relationship_invitation_service.ts");
const appJs = read("public/app/app.js");
const accountUi = read("public/app/account_ui.js");
const brandingUi = read("public/app/coach_branding_ui.js");
const indexHtml = read("public/app/index.html");
const guard = read("ci/guards/full_ui_completion_guard.mjs");
const manifest = JSON.parse(read("product/ui/function_manifest.json"));

const forbiddenEngineImports = /session_state_write_service\.js|session_state_query_service\.js|block_compile_write_service\.js|engine_runner_service\.js|@kolosseum\/engine|engine\/src\//u;

test("coach branding is mounted at /coach-branding with a coach-only read/write route", () => {
  assert.match(serverTs, /app\.use\("\/coach-branding", coachBrandingRouter\)/u);
  assert.match(routes, /coachBrandingRouter\.post\(\s*\n?\s*"\/"/u);
  assert.match(routes, /coachBrandingRouter\.get\(\s*\n?\s*"\/"/u);
  assert.match(routes, /authenticatedCoach\(request, true\)/u);
  assert.match(routes, /authenticatedCoach\(request, false\)/u);
});

test("there is no athlete or other-coach write path - a brand preference is the coach's own declared choice", () => {
  assert.doesNotMatch(routes, /coachBrandingRouter\.(post|put|delete)\(\s*\n?\s*"\/coach|"\/athlete/u);
  assert.doesNotMatch(service, /export async function .*Athlete.*(save|update)/iu);
});

test("this record is additive to, and never mutates, beta17_coach_profile's own fixed field shape", () => {
  // beta17_coach_profile is created via a strict exact-key contract
  // (createBeta17CoachProfileRecord) used directly by dozens of test
  // fixtures across the suite - a brand preference is a separate,
  // superseded-on-save record type instead of a new field on that
  // record, so none of those fixtures had to change.
  assert.doesNotMatch(service, /beta17_coach_profile/u);
  assert.match(service, /"coach_brand_preference"/u);
});

test("a brand colour is a strict 6-digit hex value and a tagline is capped at 120 characters", () => {
  assert.match(lifecycle, /\^#\[0-9a-f\]\{6\}\$/u);
  assert.match(lifecycle, /MAX_TAGLINE_LENGTH = 120/u);
  assert.match(lifecycle, /exactKeys\(/u);
});

test("the lifecycle module makes no claim about qualifications, results or service quality", () => {
  assert.doesNotMatch(lifecycle, /qualif|result|guarantee|best|expert|certified/iu);
});

test("the coach_brand_preference record type is registered in the record store and schema check constraint", () => {
  assert.match(recordStore, /"coach_brand_preference"/u);
  assert.match(recordStore, /case "coach_brand_preference":/u);
  assert.match(schemaSql, /'coach_brand_preference'/u);
});

test("every stored brand-preference record is a factual, immutable, engine-invisible fact - never scored or inferred", () => {
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
    assert.ok(service.includes(field), `expected coach brand preference record to declare ${field}`);
  }
});

test("no coach-branding file imports any engine-truth service", () => {
  for (const source of [service, routes, lifecycle]) {
    assert.doesNotMatch(source, forbiddenEngineImports);
  }
});

test("the coach-branding route file is tracked by the FULL-UI completion guard's route discovery", () => {
  assert.match(guard, /\["src\/api\/coach_branding\.routes\.ts", "\/coach-branding"\]/u);
});

test("an athlete reads their coach's brand preference through the existing relationship endpoint, not a new athlete-facing route", () => {
  assert.match(relationshipService, /"coach_brand_preference"/u);
  assert.match(relationshipService, /coach_brand_color:/u);
  assert.match(relationshipService, /coach_brand_tagline:/u);
});

test("the coach settings panel and athlete-facing card exist as real controls, and the tagline is escaped before rendering", () => {
  assert.match(indexHtml, /id="accountBrandingPanel"/u);
  assert.match(indexHtml, /id="coachBrandingForm"/u);
  assert.match(indexHtml, /id="coachBrandColorInput"/u);
  assert.match(indexHtml, /id="coachBrandTaglineInput"/u);
  assert.match(indexHtml, /coach_branding_ui\.js/u);

  assert.match(accountUi, /export function loadCoachBrandPreference/u);
  assert.match(accountUi, /export function saveCoachBrandPreference/u);
  assert.match(brandingUi, /async function refreshBranding/u);
  assert.match(brandingUi, /async function saveBranding/u);

  assert.match(appJs, /entry\.coach_brand_tagline \? `<p class="muted small">\$\{escapeHtml\(entry\.coach_brand_tagline\)\}/u);
  assert.match(appJs, /escapeHtml\(entry\.coach_brand_color\)/u);
});

test("the athlete-facing panel is gated to coach accounts only, never shown unconditionally", () => {
  assert.match(indexHtml, /id="accountBrandingPanel" class="panel" aria-labelledby="brandingHeading" hidden/u);
  assert.match(brandingUi, /const isCoach = readRole\(\) === "coach";/u);
  assert.match(brandingUi, /elements\.panel\.hidden = !isCoach;/u);
});

test("the FULL-UI-65 manifest area declares all three functions as implemented with real tests", () => {
  const area = manifest.product_areas.find((entry) => entry.area_id === "coach_branding");
  assert.ok(area, "expected a coach_branding product area");
  assert.equal(area.slice_id, "FULL-UI-65");
  assert.equal(area.state, "implemented");

  const functionIds = area.functions.map((fn) => fn.function_id);
  assert.deepEqual(
    functionIds.sort(),
    ["coach_branding_athlete_view", "coach_branding_load_own", "coach_branding_save"]
  );

  for (const fn of area.functions) {
    assert.equal(fn.state, "implemented");
    assert.equal(fn.integration_test, "test/full_ui_65c_coach_branding_persistent.integration.test.mjs");
    assert.equal(fn.direct_test, "test/full_ui_65_coach_branding_surface.test.mjs");
    assert.notEqual(fn.persistence, "localStorage_only");
  }

  assert.ok(manifest.delivery_slices.some((slice) => slice.slice_id === "FULL-UI-65" && slice.state === "implemented"));
});
