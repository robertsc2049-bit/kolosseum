// DEV NOTE: FULL-UI-68 programme template marketplace release static
// surface contract.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const service = read("src/api/programme_template_sharing_service.ts");
const routes = read("src/api/programme_template_sharing.routes.ts");
const lifecycle = read("shared/programme-marketplace/programmeTemplateSharingLifecycle.mjs");
const recordStore = read("src/api/beta_product_record_store.ts");
const schemaSql = read("schema.sql");
const templateService = read("src/api/beta18_programme_template_service.ts");
const manifest = JSON.parse(read("product/ui/function_manifest.json"));
const marketplacePanel = read("public/app-src/screens/coach/CoachMarketplacePanel.tsx");
// DEV NOTE: the coach's own price/payment-methods/release controls moved
// to React - see CoachProgrammeMarketplaceSharingPanel.tsx/
// useCoachProgrammeMarketplaceSharing.ts, mounted at
// #programme-marketplace-sharing-root (see full_ui_67_programme_
// marketplace_surface.test.mjs's matching DEV NOTE for the sharing half).
const sharingHook = read("public/app-src/screens/coach/useCoachProgrammeMarketplaceSharing.ts");
const sharingPanel = read("public/app-src/screens/coach/CoachProgrammeMarketplaceSharingPanel.tsx");
const marketplaceClient = read("public/app-src/api/marketplaceClient.ts");

const forbiddenEngineImports = /session_state_write_service\.js|session_state_query_service\.js|block_compile_write_service\.js|engine_runner_service\.js|@kolosseum\/engine|engine\/src\//u;
const forbiddenPaymentProcessing = /stripe|Stripe|payment_intent|checkout\.sessions|charge\.create/u;

test("the release and release-history routes are mounted, coach-only and correctly gated", () => {
  assert.match(routes, /programmeTemplateSharingRouter\.post\(\s*\n?\s*"\/templates\/:template_id\/release"/u);
  assert.match(routes, /programmeTemplateSharingRouter\.get\(\s*\n?\s*"\/templates\/:template_id\/releases"/u);
  assert.match(routes, /releaseProgrammeTemplateToCoach/u);
  assert.match(routes, /listProgrammeTemplateReleases/u);
});

test("a release re-verifies the seller owns a still-shareable template before anything else happens", () => {
  assert.match(service, /export async function releaseProgrammeTemplateToCoach/u);
  assert.match(service, /const template = await requireOwnedShareableTemplate\(sellerCoachUserId, templateId\)/u);
});

test("a release validates the buyer is a real, active coach account - never trusting an arbitrary client-supplied id without a check", () => {
  assert.match(service, /await requireActiveCoach\(buyerCoachUserId\)/u);
  assert.match(service, /buyer_cannot_be_seller/u);
});

test("a release clones the template via the same reusable duplication building blocks the coach's own duplicate action uses, not a hand-rolled copy", () => {
  assert.match(service, /templateRecordInput\(template as JsonRecord\)/u);
  assert.match(service, /saveCoachProgrammeTemplate\(cloneInput\)/u);
  assert.match(service, /cloneInput\.template_id = "";/u);
  assert.match(service, /cloneInput\.template_family_id = "";/u);
  assert.match(service, /cloneInput\.event_plan = null;/u);
});

test("this application never processes, holds, or transmits any payment - no payment-processor code anywhere in the marketplace release path", () => {
  for (const source of [service, routes, lifecycle]) {
    assert.doesNotMatch(source, forbiddenPaymentProcessing);
  }
});

test("price label and payment-methods note are optional, length-capped, plain display text - never parsed as currency or acted on", () => {
  assert.match(lifecycle, /MAX_PRICE_LABEL_LENGTH = 40/u);
  assert.match(lifecycle, /MAX_PAYMENT_METHODS_NOTE_LENGTH = 200/u);
  assert.match(lifecycle, /"price_label"/u);
  assert.match(lifecycle, /"payment_methods_note"/u);
  assert.doesNotMatch(lifecycle, /parseFloat|parseInt|Number\(.*price/iu);
});

test("the programme_template_release record type is registered in the record store and schema check constraint", () => {
  assert.match(recordStore, /"programme_template_release"/u);
  assert.match(recordStore, /case "programme_template_release":/u);
  assert.match(schemaSql, /'programme_template_release'/u);
});

test("every release record is a factual, immutable, engine-invisible fact - never scored or inferred", () => {
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
    assert.ok(
      service.includes(field),
      `expected release record to declare ${field}`
    );
  }
});

test("requireActiveCoach and templateRecordInput are exported from the template service for reuse, not duplicated", () => {
  assert.match(templateService, /export async function requireActiveCoach/u);
  assert.match(templateService, /export function templateRecordInput/u);
});

test("no marketplace release file imports any engine-truth service", () => {
  for (const source of [service, routes, lifecycle]) {
    assert.doesNotMatch(source, forbiddenEngineImports);
  }
});

test("the coach workspace has real price/payment-methods inputs and a real release control, wired to the routes", () => {
  assert.match(sharingPanel, /placeholder="e.g. £49"/u);
  assert.match(sharingPanel, /placeholder="e.g. Venmo @handle, PayPal"/u);
  assert.match(sharingPanel, /placeholder="coach_\.\.\."/u);
  assert.match(sharingPanel, /ReleaseHistoryList/u);

  assert.match(sharingHook, /const saveSharing = useCallback/u);
  assert.match(sharingHook, /const release = useCallback/u);
  assert.match(sharingHook, /loadTemplateReleaseHistory/u);
  assert.match(marketplaceClient, /`\/programme-marketplace\/templates\/\$\{encodeURIComponent\(templateId\)\}\/release`/u);
});

test("the marketplace browse card renders the coach-supplied price label and payment-methods note as React text, never raw HTML", () => {
  assert.doesNotMatch(marketplacePanel, /dangerouslySetInnerHTML/u);
  assert.match(marketplacePanel, /template\.price_label/u);
  assert.match(marketplacePanel, /template\.payment_methods_note/u);
});

test("the release history renders the buyer account code as React text, never raw HTML", () => {
  assert.doesNotMatch(sharingPanel, /dangerouslySetInnerHTML/u);
  assert.match(sharingPanel, /\{String\(release\.buyer_coach_user_id \?\? ""\)\}/u);
});

test("the FULL-UI-68 manifest functions are declared as implemented with real tests inside the existing programme_marketplace area", () => {
  const area = manifest.product_areas.find((entry) => entry.area_id === "programme_marketplace");
  assert.ok(area, "expected the existing programme_marketplace product area");

  const releaseFn = area.functions.find((entry) => entry.function_id === "programme_marketplace_release");
  const historyFn = area.functions.find((entry) => entry.function_id === "programme_marketplace_release_history");
  assert.ok(releaseFn, "expected a programme_marketplace_release function");
  assert.ok(historyFn, "expected a programme_marketplace_release_history function");

  for (const fn of [releaseFn, historyFn]) {
    assert.equal(fn.state, "implemented");
    assert.equal(fn.direct_test, "test/full_ui_68_programme_marketplace_release_surface.test.mjs");
    assert.equal(fn.integration_test, "test/full_ui_68c_programme_marketplace_release_persistent.integration.test.mjs");
    assert.notEqual(fn.persistence, "localStorage_only");
    assert.deepEqual(fn.actors, ["coach"]);
  }

  assert.ok(manifest.delivery_slices.some((slice) => slice.slice_id === "FULL-UI-68" && slice.state === "implemented"));
});
