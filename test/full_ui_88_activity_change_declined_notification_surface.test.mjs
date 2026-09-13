// DEV NOTE: FULL-UI-88 activity/position-change-declined notification
// static surface contract.
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
const activityChangeService = read("src/api/athlete_activity_change_service.ts");
const manifest = JSON.parse(read("product/ui/function_manifest.json"));

test("activity_change_declined is a recognised notification type", () => {
  assert.match(service, /"activity_change_declined"/u);
});

test("an activity-change-declined notification is derived from the same athlete_activity_change_request record respondToActivityChangeProposal already writes, never a new write path", () => {
  assert.match(service, /async function deriveActivityChangeDeclinedNotifications/u);
  assert.match(service, /record_type = 'athlete_activity_change_request'/u);
  assert.match(service, /record_payload->>'request_state' = 'declined'/u);
  assert.match(service, /await deriveActivityChangeDeclinedNotifications\(client, recipientUserId\);/u);
  assert.match(activityChangeService, /requestState: "declined"/u);
});

test("the proposing coach is resolved by following supersedes_request_id back to the proposed record it declines, not from the declined record's own actor_user_id", () => {
  // On the declined row, both subject_user_id and actor_user_id are the
  // athlete (it's their write) - the coach is only recoverable via the
  // superseded "proposed" row's own actor_user_id.
  const fn = service.slice(
    service.indexOf("async function deriveActivityChangeDeclinedNotifications"),
    service.indexOf("async function deriveAthletePositionOverrideNotifications")
  );
  assert.match(fn, /JOIN beta_product_records proposed/u);
  assert.match(fn, /proposed\.record_payload->>'request_id' = declined\.record_payload->>'supersedes_request_id'/u);
  assert.match(fn, /proposed\.actor_user_id = \$1/u);
  assert.match(activityChangeService, /actorUserId: athleteUserId,\s*\n\s*requestedBy: "coach", changeKind, newValue, requestState: "declined"/u);
});

test("both activity and position changes share this one notification type, matching activity_change_proposed/applied's own precedent", () => {
  assert.match(service, /change_kind: cleanString\(row\.record_payload\?\.change_kind\) \|\| "activity"/u);
  assert.match(service, /new_activity_id: cleanString\(row\.record_payload\?\.new_activity_id\)/u);
  assert.match(service, /new_position: cleanString\(row\.record_payload\?\.new_position\)/u);
});

test("the notification deep-links to the coach's own detail view of that athlete, with target availability keyed off the live relationship", () => {
  assert.match(service, /coachAthleteDetail: "coach_athlete_detail"/u);
  assert.match(service, /deriveActivityChangeDeclinedNotifications[\s\S]*?deepLinkRouteId: DEEP_LINK_ROUTE_IDS\.coachAthleteDetail/u);
  assert.match(service, /deriveActivityChangeDeclinedNotifications[\s\S]*?deepLinkParams: \{ athlete_id: athleteUserId \}/u);
  assert.match(routeBootstrap, /route_id: "coach_athlete_detail"/u);
});

test("the notification_type check constraint is widened by an explicit migration, since CREATE TABLE IF NOT EXISTS never re-runs against an existing table", () => {
  assert.match(schemaSql, /product_notifications_full_ui_88_type_migration/u);
  assert.match(schemaSql, /DROP CONSTRAINT IF EXISTS product_notifications_notification_type_check/u);
  assert.match(schemaSql, /'activity_change_declined'/u);
});

test("the coach-facing UI displays a real label for this notification type", () => {
  assert.match(notificationClient, /activity_change_declined: "Athlete declined a proposed change"/u);
});

test("the FULL-UI-88 manifest function is declared as implemented with real tests inside the existing notifications area", () => {
  const area = manifest.product_areas.find((entry) => entry.area_id === "notifications");
  assert.ok(area, "expected the existing notifications product area");

  const fn = area.functions.find((entry) => entry.function_id === "notification_activity_change_declined");
  assert.ok(fn, "expected a notification_activity_change_declined function");
  assert.equal(fn.state, "implemented");
  assert.equal(fn.direct_test, "test/full_ui_88_activity_change_declined_notification_surface.test.mjs");
  assert.equal(fn.integration_test, "test/full_ui_88c_activity_change_declined_notification_persistent.integration.test.mjs");
  assert.notEqual(fn.persistence, "localStorage_only");
  assert.deepEqual(fn.actors, ["coach"]);

  assert.ok(manifest.delivery_slices.some((slice) => slice.slice_id === "FULL-UI-88" && slice.state === "implemented"));
});
