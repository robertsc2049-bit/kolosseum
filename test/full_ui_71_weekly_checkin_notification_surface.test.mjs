// DEV NOTE: FULL-UI-71 weekly-checkin notification static surface contract.
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

test("weekly_checkin_submitted is a recognised notification type", () => {
  assert.match(service, /"weekly_checkin_submitted"/u);
});

test("a weekly-checkin notification is derived from the same weekly_checkin_entry record the check-in flow writes, never a new write path", () => {
  assert.match(service, /async function deriveWeeklyCheckinNotifications/u);
  assert.match(service, /record_type = 'weekly_checkin_entry'/u);
  assert.match(service, /await deriveWeeklyCheckinNotifications\(client, recipientUserId\);/u);
});

test("the notification only fires for the athlete's currently accepted coach, scoped to that coach's own relationship records", () => {
  assert.match(service, /record_type = 'beta17_coach_relationship'\s*\n\s*AND actor_user_id = \$1/u);
  assert.match(service, /latest_relationship\.relationship_state = 'accepted'/u);
});

test("the notification deep-links to the athlete's existing profile detail, an existing registered route - never inventing one", () => {
  assert.match(service, /deepLinkRouteId: DEEP_LINK_ROUTE_IDS\.coachAthleteDetail/u);
  assert.match(routeBootstrap, /route_id: "coach_athlete_detail"/u);
});

test("the notification carries the athlete identity and week_start_date as factual payload, never an inferred summary", () => {
  assert.match(service, /athlete_user_id: athleteUserId,\s*\n\s*week_start_date: cleanString\(row\.record_payload\?\.week_start_date\)/u);
});

test("the notification_type check constraint is widened by an explicit migration, since CREATE TABLE IF NOT EXISTS never re-runs against an existing table", () => {
  assert.match(schemaSql, /product_notifications_full_ui_71_type_migration/u);
  assert.match(schemaSql, /DROP CONSTRAINT IF EXISTS product_notifications_notification_type_check/u);
  assert.match(schemaSql, /'weekly_checkin_submitted'/u);
});

test("a stale target (revoked relationship) is already handled generically by withTargetAvailability for coach_athlete_detail deep links", () => {
  assert.match(service, /routeId === DEEP_LINK_ROUTE_IDS\.coachAthleteDetail/u);
});

test("the coach workspace displays a real label for this notification type", () => {
  assert.match(notificationClient, /weekly_checkin_submitted: "Weekly check-in submitted"/u);
});

test("the FULL-UI-71 manifest function is declared as implemented with real tests inside the existing notifications area", () => {
  const area = manifest.product_areas.find((entry) => entry.area_id === "notifications");
  assert.ok(area, "expected the existing notifications product area");

  const fn = area.functions.find((entry) => entry.function_id === "notification_weekly_checkin");
  assert.ok(fn, "expected a notification_weekly_checkin function");
  assert.equal(fn.state, "implemented");
  assert.equal(fn.direct_test, "test/full_ui_71_weekly_checkin_notification_surface.test.mjs");
  assert.equal(fn.integration_test, "test/full_ui_71c_weekly_checkin_notification_persistent.integration.test.mjs");
  assert.notEqual(fn.persistence, "localStorage_only");
  assert.deepEqual(fn.actors, ["coach"]);

  assert.ok(manifest.delivery_slices.some((slice) => slice.slice_id === "FULL-UI-71" && slice.state === "implemented"));
});
