// DEV NOTE: FULL-UI-67 programme template marketplace visibility static
// surface contract.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const service = read("src/api/programme_template_sharing_service.ts");
const routes = read("src/api/programme_template_sharing.routes.ts");
const serverTs = read("src/server.ts");
const lifecycle = read("shared/programme-marketplace/programmeTemplateSharingLifecycle.mjs");
const recordStore = read("src/api/beta_product_record_store.ts");
const schemaSql = read("schema.sql");
const appJs = read("public/app/app.js");
const indexHtml = read("public/app/index.html");
const guard = read("ci/guards/full_ui_completion_guard.mjs");
const manifest = JSON.parse(read("product/ui/function_manifest.json"));

const forbiddenEngineImports = /session_state_write_service\.js|session_state_query_service\.js|block_compile_write_service\.js|engine_runner_service\.js|@kolosseum\/engine|engine\/src\//u;

test("the marketplace is mounted at /programme-marketplace, coach-only for both browse and share", () => {
  assert.match(serverTs, /app\.use\("\/programme-marketplace", programmeTemplateSharingRouter\)/u);
  assert.match(routes, /programmeTemplateSharingRouter\.get\(\s*\n?\s*"\/templates"/u);
  assert.match(routes, /programmeTemplateSharingRouter\.post\(\s*\n?\s*"\/templates\/:template_id\/sharing"/u);
  assert.match(routes, /authenticatedCoach\(request, true\)/u);
  assert.match(routes, /authenticatedCoach\(request, false\)/u);
});

test("only the owning coach can share their own template, and only a complete or active one", () => {
  assert.match(service, /requireOwnedShareableTemplate/u);
  assert.match(service, /listCoachProgrammeTemplates\(coachUserId\)/u);
  assert.match(service, /SHAREABLE_TEMPLATE_STATUSES/u);
  assert.match(service, /"complete", "active"/u);
});

test("sharing is additive to, and never mutates, beta18_programme_template's own field contract", () => {
  assert.doesNotMatch(service, /beta18_programme_template['"]\s*[:,]/u);
  assert.match(service, /"programme_template_sharing_preference"/u);
});

test("the marketplace browse list re-verifies template ownership and shareable status live, never trusting a stale sharing flag", () => {
  assert.match(service, /templatesByCoach\.get\(coachUserId\)/u);
  assert.match(service, /SHAREABLE_TEMPLATE_STATUSES\.has\(String\(template\.template_status\)\)/u);
});

test("the browse listing ties in the sharing coach's identity and branding, the same pattern already used for relationships", () => {
  assert.match(service, /loadLatestBetaProductRecord\("beta17_coach_profile"/u);
  assert.match(service, /loadLatestBetaProductRecord\("coach_brand_preference"/u);
  assert.match(service, /coach_display_name:/u);
  assert.match(service, /coach_brand_color:/u);
});

test("the sharing preference record type is registered in the record store and schema check constraint", () => {
  assert.match(recordStore, /"programme_template_sharing_preference"/u);
  assert.match(recordStore, /case "programme_template_sharing_preference":/u);
  assert.match(schemaSql, /'programme_template_sharing_preference'/u);
});

test("every stored sharing-preference record is a factual, immutable, engine-invisible fact - never scored or inferred", () => {
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
    assert.ok(service.includes(field), `expected sharing preference record to declare ${field}`);
  }
});

test("the sharing preference lifecycle validates a single boolean flag with an exact-key allowlist", () => {
  assert.match(lifecycle, /exactKeys\(/u);
  assert.match(lifecycle, /"shared_publicly"/u);
  assert.match(lifecycle, /typeof input\.shared_publicly !==\s*\n?\s*"boolean"/u);
});

test("no marketplace file imports any engine-truth service", () => {
  for (const source of [service, routes, lifecycle]) {
    assert.doesNotMatch(source, forbiddenEngineImports);
  }
});

test("the marketplace route file is tracked by the FULL-UI completion guard's route discovery", () => {
  assert.match(guard, /\["src\/api\/programme_template_sharing\.routes\.ts", "\/programme-marketplace"\]/u);
});

test("the coach workspace has a real share toggle and a real marketplace browse view, wired to the routes", () => {
  assert.match(indexHtml, /id="view-marketplace"/u);
  assert.match(indexHtml, /id="marketplaceList"/u);
  assert.match(indexHtml, /id="templateDetailSharedCheckbox"/u);
  assert.match(indexHtml, /id="templateDetailSharingSection"/u);
  assert.match(indexHtml, /data-view="marketplace"/u);

  assert.match(appJs, /async function refreshMarketplace/u);
  assert.match(appJs, /async function confirmSaveTemplateSharing/u);
  assert.match(appJs, /"\/programme-marketplace\/templates"/u);
  assert.match(appJs, /elements\.templateSharingForm\.addEventListener\("submit"/u);
});

test("the marketplace card escapes coach-supplied template name, description and tagline before rendering", () => {
  assert.match(appJs, /escapeHtml\(template\.template_name\)/u);
  assert.match(appJs, /escapeHtml\(template\.description\)/u);
  assert.match(appJs, /escapeHtml\(template\.coach_brand_tagline\)/u);
});

test("the sharing toggle is hidden for draft and archived templates, shown only for complete or active", () => {
  assert.match(appJs, /storedStatus === "complete" \|\| storedStatus === "active"/u);
  assert.match(appJs, /templateDetailSharingSection\.hidden = !shareable/u);
});

test("the marketplace browse view has real search, activity-filter and sort controls, wired to a client-side filter", () => {
  assert.match(indexHtml, /id="marketplaceSearch"/u);
  assert.match(indexHtml, /id="marketplaceActivityFilter"/u);
  assert.match(indexHtml, /id="marketplaceSort"/u);

  assert.match(appJs, /function filteredMarketplaceTemplates/u);
  assert.match(appJs, /function marketplaceSearchText/u);
  assert.match(appJs, /elements\.marketplaceSearch\?\.addEventListener\("input"/u);
  assert.match(appJs, /elements\.marketplaceActivityFilter\?\.addEventListener\("change"/u);
  assert.match(appJs, /elements\.marketplaceSort\?\.addEventListener\("change"/u);
});

test("the marketplace filter matches on name, description, activity and coach identity - never a server round-trip per keystroke", () => {
  const fn = appJs.slice(
    appJs.indexOf("function marketplaceSearchText"),
    appJs.indexOf("function filteredMarketplaceTemplates") + 900
  );
  assert.match(fn, /template\?\.template_name/u);
  assert.match(fn, /template\?\.description/u);
  assert.match(fn, /template\?\.activity_id/u);
  assert.match(fn, /template\?\.coach_display_name/u);
});

test("the marketplace has a distinct empty state for zero matches versus zero shared templates at all", () => {
  assert.match(appJs, /No shared programmes yet/u);
  assert.match(appJs, /No programmes match/u);
});

test("the FULL-UI-67 manifest area declares the original visibility and browse functions as implemented with real tests", () => {
  const area = manifest.product_areas.find((entry) => entry.area_id === "programme_marketplace");
  assert.ok(area, "expected a programme_marketplace product area");
  assert.equal(area.slice_id, "FULL-UI-67");
  assert.equal(area.state, "implemented");

  const functionIds = area.functions.map((fn) => fn.function_id);
  for (const expectedId of ["programme_marketplace_browse", "programme_marketplace_share"]) {
    assert.ok(functionIds.includes(expectedId), `expected ${expectedId} in the programme_marketplace area`);
  }

  for (const functionId of ["programme_marketplace_browse", "programme_marketplace_share"]) {
    const fn = area.functions.find((entry) => entry.function_id === functionId);
    assert.equal(fn.state, "implemented");
    assert.equal(fn.integration_test, "test/full_ui_67c_programme_marketplace_persistent.integration.test.mjs");
    assert.equal(fn.direct_test, "test/full_ui_67_programme_marketplace_surface.test.mjs");
    assert.notEqual(fn.persistence, "localStorage_only");
    assert.deepEqual(fn.actors, ["coach"]);
  }

  assert.ok(manifest.delivery_slices.some((slice) => slice.slice_id === "FULL-UI-67" && slice.state === "implemented"));
});
