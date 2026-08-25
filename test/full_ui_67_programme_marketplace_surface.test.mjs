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
const marketplaceClient = read("public/app-src/api/marketplaceClient.ts");
const marketplaceHook = read("public/app-src/screens/coach/useCoachMarketplace.ts");
const marketplacePanel = read("public/app-src/screens/coach/CoachMarketplacePanel.tsx");

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

// listCoachProgrammeTemplates rejects (via requireActiveCoach) the moment
// a sharing coach's own account is no longer active - a normal account
// lifecycle event (suspended/closed), not a marketplace error. Promise.all
// would let one such rejection take the whole browse listing down for
// every other coach; Promise.allSettled lets that one seller's templates
// be quietly left out instead, matching this file's own established
// "re-verify live, never trust a stale flag" posture from the test above.
test("one sharing coach going inactive never breaks the marketplace browse listing for everyone else", () => {
  assert.match(service, /Promise\.allSettled\(\s*\n\s*coachUserIds\.map\(\(coachUserId\) => listCoachProgrammeTemplates\(coachUserId\)\)/u);
  assert.doesNotMatch(
    service.slice(service.indexOf("export async function listMarketplaceSharedTemplates"), service.indexOf("export async function listMarketplaceSharedTemplates") + 1500),
    /await Promise\.all\(/u
  );
  assert.match(service, /if \(result\.status === "fulfilled"\) \{/u);
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

test("the coach workspace has a real share toggle (legacy) and a real marketplace browse view (React), wired to the routes", () => {
  assert.match(indexHtml, /id="view-marketplace"/u);
  assert.match(indexHtml, /id="coach-marketplace-root"/u);
  assert.match(indexHtml, /id="templateDetailSharedCheckbox"/u);
  assert.match(indexHtml, /id="templateDetailSharingSection"/u);
  assert.match(indexHtml, /data-view="marketplace"/u);

  assert.match(appJs, /async function confirmSaveTemplateSharing/u);
  assert.match(appJs, /elements\.templateSharingForm\.addEventListener\("submit"/u);

  assert.match(marketplaceClient, /loadMarketplaceTemplates/u);
  assert.match(marketplaceClient, /"\/programme-marketplace\/templates"/u);
});

test("the marketplace card renders coach-supplied template name, description and tagline as React text, never raw HTML", () => {
  assert.doesNotMatch(marketplacePanel, /dangerouslySetInnerHTML/u);
  assert.match(marketplacePanel, /\{String\(template\.template_name \?\? ""\)\}/u);
  assert.match(marketplacePanel, /\{String\(template\.description\)\}/u);
  assert.match(marketplacePanel, /template\.coach_brand_tagline/u);
});

test("the sharing toggle is hidden for draft and archived templates, shown only for complete or active", () => {
  assert.match(appJs, /storedStatus === "complete" \|\| storedStatus === "active"/u);
  assert.match(appJs, /templateDetailSharingSection\.hidden = !shareable/u);
});

test("the marketplace browse view has real search, activity-filter and sort controls, wired to a client-side filter", () => {
  assert.match(indexHtml, /id="coach-marketplace-root"/u);

  assert.match(marketplacePanel, /function marketplaceSearchText/u);
  assert.match(marketplacePanel, /function sortTemplates/u);
  assert.match(marketplacePanel, /type="search"/u);
  assert.match(marketplacePanel, /onChange=\{\(event\) => setSearch\(event\.target\.value\)\}/u);
  assert.match(marketplacePanel, /onChange=\{\(event\) => setActivityFilter\(event\.target\.value\)\}/u);
  assert.match(marketplacePanel, /onChange=\{\(event\) => setSortMode\(event\.target\.value as SortMode\)\}/u);
});

test("the marketplace filter matches on name, description, activity and coach identity - never a server round-trip per keystroke", () => {
  const fn = marketplacePanel.slice(
    marketplacePanel.indexOf("function marketplaceSearchText"),
    marketplacePanel.indexOf("type SortMode")
  );
  assert.match(fn, /template\.template_name/u);
  assert.match(fn, /template\.description/u);
  assert.match(fn, /template\.activity_id/u);
  assert.match(fn, /template\.coach_display_name/u);

  // the fetch hook has no knowledge of search/filter/sort state at all, so a
  // keystroke structurally cannot trigger a request - it only ever re-runs
  // the client-side useMemo filter in the panel component.
  assert.doesNotMatch(marketplaceHook, /search|activityFilter|sortMode/iu);
});

test("the marketplace has a distinct empty state for zero matches versus zero shared templates at all", () => {
  assert.match(marketplacePanel, /No shared programmes yet/u);
  assert.match(marketplacePanel, /No programmes match/u);
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

  const directTestByFunction = {
    programme_marketplace_share: "test/full_ui_67_programme_marketplace_surface.test.mjs",
    programme_marketplace_browse: "public/app-src/__tests__/CoachMarketplacePanel.test.tsx"
  };

  for (const functionId of ["programme_marketplace_browse", "programme_marketplace_share"]) {
    const fn = area.functions.find((entry) => entry.function_id === functionId);
    assert.equal(fn.state, "implemented");
    assert.equal(fn.integration_test, "test/full_ui_67c_programme_marketplace_persistent.integration.test.mjs");
    assert.equal(fn.direct_test, directTestByFunction[functionId]);
    assert.notEqual(fn.persistence, "localStorage_only");
    assert.deepEqual(fn.actors, ["coach"]);
  }

  assert.ok(manifest.delivery_slices.some((slice) => slice.slice_id === "FULL-UI-67" && slice.state === "implemented"));
});
