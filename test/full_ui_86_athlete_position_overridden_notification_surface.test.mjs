// DEV NOTE: FULL-UI-86 athlete-position-overridden notification static
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
const manifest = JSON.parse(read("product/ui/function_manifest.json"));

test("athlete_position_overridden is a recognised notification type", () => {
  assert.match(service, /"athlete_position_overridden"/u);
});

test("an athlete-position-overridden notification is derived from the same audit record the override services already write, never a new write path", () => {
  assert.match(service, /async function deriveAthletePositionOverrideNotifications/u);
  assert.match(service, /FROM product_org_audit_records/u);
  assert.match(service, /action_type = 'athlete_position_overridden'/u);
  assert.match(service, /after_state->>'athlete_user_id' = \$1/u);
  assert.match(service, /await deriveAthletePositionOverrideNotifications\(client, recipientUserId\);/u);
});

test("the notification deep-links to the athlete's own Today view, an existing registered deep link target - never inventing one", () => {
  assert.match(service, /deriveAthletePositionOverrideNotifications[\s\S]*?deepLinkRouteId: DEEP_LINK_ROUTE_IDS\.athleteToday/u);
});

test("the notification carries which role performed the override and the new position as factual payload, never an inferred summary", () => {
  assert.match(service, /overridden_by_role: cleanString\(row\.actor_role\)/u);
  assert.match(service, /new_position: cleanString\(row\.after_state\?\.position\)/u);
});

test("the notification_type check constraint is widened by an explicit migration, since CREATE TABLE IF NOT EXISTS never re-runs against an existing table", () => {
  assert.match(schemaSql, /product_notifications_full_ui_86_type_migration/u);
  assert.match(schemaSql, /DROP CONSTRAINT IF EXISTS product_notifications_notification_type_check/u);
  assert.match(schemaSql, /'athlete_position_overridden'/u);
});

test("the athlete-facing UI displays a real label for this notification type", () => {
  assert.match(notificationClient, /athlete_position_overridden: "Position updated"/u);
});

test("the FULL-UI-86 manifest function is declared as implemented with real tests inside the existing notifications area", () => {
  const area = manifest.product_areas.find((entry) => entry.area_id === "notifications");
  assert.ok(area, "expected the existing notifications product area");

  const fn = area.functions.find((entry) => entry.function_id === "notification_athlete_position_overridden");
  assert.ok(fn, "expected a notification_athlete_position_overridden function");
  assert.equal(fn.state, "implemented");
  assert.equal(fn.direct_test, "test/full_ui_86_athlete_position_overridden_notification_surface.test.mjs");
  assert.equal(fn.integration_test, "test/full_ui_86c_athlete_position_overridden_notification_persistent.integration.test.mjs");
  assert.notEqual(fn.persistence, "localStorage_only");
  assert.deepEqual(fn.actors, ["athlete"]);

  assert.ok(manifest.delivery_slices.some((slice) => slice.slice_id === "FULL-UI-86" && slice.state === "implemented"));
});
