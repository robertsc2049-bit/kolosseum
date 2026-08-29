// DEV NOTE: FULL-UI-75 marketplace-template-sold notification static
// surface contract.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const service = read("src/api/product_notification_service.ts");
const schemaSql = read("schema.sql");
const notificationClient = read("public/app-src/api/notificationsClient.ts");
const routeBootstrap = read("public/app/route_bootstrap.js");
const manifest = JSON.parse(read("product/ui/function_manifest.json"));

test("marketplace_template_sold is a recognised notification type", () => {
  assert.match(service, /"marketplace_template_sold"/u);
});

test("a marketplace-sold notification is derived from the exact same programme_template_release record the release flow already writes, never a new write path", () => {
  assert.match(service, /async function deriveMarketplaceTemplateSoldNotifications/u);
  assert.match(service, /record_type = 'programme_template_release'\s*\n\s*AND actor_user_id = \$1/u);
  assert.match(service, /await deriveMarketplaceTemplateSoldNotifications\(client, recipientUserId\);/u);
});

test("this is the seller-facing counterpart of the existing buyer-facing release notification - same record, opposite ownership column", () => {
  assert.match(service, /AND subject_user_id = \$1/u);
  assert.match(service, /AND actor_user_id = \$1/u);
});

test("the notification deep-links to the seller's own original template detail, an existing registered route - never inventing one", () => {
  assert.match(service, /deepLinkRouteId: DEEP_LINK_ROUTE_IDS\.coachProgrammeDetail,\s*\n\s*deepLinkParams: \{ template_id: templateId \},\s*\n\s*notificationPayload: \{\s*\n\s*buyer_coach_user_id/u);
  assert.match(routeBootstrap, /route_id: "coach_programme_detail"/u);
});

test("the notification carries the buyer's identity and the sold template_id as factual payload, never an inferred summary", () => {
  assert.match(service, /buyer_coach_user_id: cleanString\(row\.buyer_coach_user_id\)/u);
  assert.match(service, /source_template_id: templateId/u);
});

test("the notification_type check constraint is widened by an explicit migration, since CREATE TABLE IF NOT EXISTS never re-runs against an existing table", () => {
  assert.match(schemaSql, /product_notifications_full_ui_75_type_migration/u);
  assert.match(schemaSql, /DROP CONSTRAINT IF EXISTS product_notifications_notification_type_check/u);
  assert.match(schemaSql, /'marketplace_template_sold'/u);
});

test("the notification is never marked stale - it always targets the recipient's own owned template, same as the existing release notification", () => {
  assert.doesNotMatch(
    service.slice(
      service.indexOf("async function withTargetAvailability"),
      service.indexOf("async function withTargetAvailability") + 800
    ),
    /coachProgrammeDetail/u
  );
});

test("the coach workspace displays a real label for this notification type", () => {
  assert.match(notificationClient, /marketplace_template_sold: "Template sold"/u);
});

test("the FULL-UI-75 manifest function is declared as implemented with real tests inside the existing notifications area", () => {
  const area = manifest.product_areas.find((entry) => entry.area_id === "notifications");
  assert.ok(area, "expected the existing notifications product area");

  const fn = area.functions.find((entry) => entry.function_id === "notification_marketplace_template_sold");
  assert.ok(fn, "expected a notification_marketplace_template_sold function");
  assert.equal(fn.state, "implemented");
  assert.equal(fn.direct_test, "test/full_ui_75_marketplace_template_sold_notification_surface.test.mjs");
  assert.equal(fn.integration_test, "test/full_ui_75c_marketplace_template_sold_notification_persistent.integration.test.mjs");
  assert.notEqual(fn.persistence, "localStorage_only");
  assert.deepEqual(fn.actors, ["coach"]);

  assert.ok(manifest.delivery_slices.some((slice) => slice.slice_id === "FULL-UI-75" && slice.state === "implemented"));
});
