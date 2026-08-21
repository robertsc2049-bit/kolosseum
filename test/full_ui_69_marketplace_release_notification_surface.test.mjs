// DEV NOTE: FULL-UI-69 marketplace-release notification static surface
// contract.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const service = read("src/api/product_notification_service.ts");
const schemaSql = read("schema.sql");
const appJs = read("public/app/app.js");
const routeBootstrap = read("public/app/route_bootstrap.js");
const manifest = JSON.parse(read("product/ui/function_manifest.json"));

test("marketplace_template_released is a recognised notification type", () => {
  assert.match(service, /"marketplace_template_released"/u);
});

test("a marketplace release notification is derived from the same programme_template_release record the release flow writes, never a new write path", () => {
  assert.match(service, /async function deriveMarketplaceReleaseNotifications/u);
  assert.match(service, /record_type = 'programme_template_release'/u);
  assert.match(service, /AND subject_user_id = \$1/u);
  assert.match(service, /await deriveMarketplaceReleaseNotifications\(client, recipientUserId\);/u);
});

test("the notification deep-links to the buyer's own new template detail, an existing registered route - never inventing one", () => {
  assert.match(service, /coachProgrammeDetail: "coach_programme_detail"/u);
  assert.match(service, /deepLinkRouteId: DEEP_LINK_ROUTE_IDS\.coachProgrammeDetail/u);
  assert.match(service, /deepLinkParams: \{ template_id: clonedTemplateId \}/u);
  assert.match(routeBootstrap, /route_id: "coach_programme_detail"/u);
});

test("the notification_type check constraint is widened by an explicit migration, since CREATE TABLE IF NOT EXISTS never re-runs against an existing table", () => {
  assert.match(schemaSql, /product_notifications_full_ui_68_type_migration/u);
  assert.match(schemaSql, /DROP CONSTRAINT IF EXISTS product_notifications_notification_type_check/u);
  assert.match(schemaSql, /'marketplace_template_released'/u);
});

test("the notification carries the seller's identity and the original shared template_id as factual payload, never an inferred summary", () => {
  assert.match(service, /seller_coach_user_id: cleanString\(row\.seller_coach_user_id\)/u);
  assert.match(service, /source_template_id: cleanString\(row\.record_payload\?\.template_id\)/u);
});

test("the notification is never marked stale for a relationship that could be revoked - it always targets the recipient's own owned template", () => {
  assert.doesNotMatch(
    service.slice(
      service.indexOf("async function withTargetAvailability"),
      service.indexOf("async function withTargetAvailability") + 800
    ),
    /coachProgrammeDetail/u
  );
});

test("the coach workspace displays a real label for this notification type", () => {
  assert.match(appJs, /marketplace_template_released: "Template released"/u);
});

test("the FULL-UI-69 manifest function is declared as implemented with real tests inside the existing notifications area", () => {
  const area = manifest.product_areas.find((entry) => entry.area_id === "notifications");
  assert.ok(area, "expected the existing notifications product area");

  const fn = area.functions.find((entry) => entry.function_id === "notification_marketplace_release");
  assert.ok(fn, "expected a notification_marketplace_release function");
  assert.equal(fn.state, "implemented");
  assert.equal(fn.direct_test, "test/full_ui_69_marketplace_release_notification_surface.test.mjs");
  assert.equal(fn.integration_test, "test/full_ui_69c_marketplace_release_notification_persistent.integration.test.mjs");
  assert.notEqual(fn.persistence, "localStorage_only");
  assert.deepEqual(fn.actors, ["coach"]);

  assert.ok(manifest.delivery_slices.some((slice) => slice.slice_id === "FULL-UI-69" && slice.state === "implemented"));
});
