// DEV NOTE: FULL-UI-87 attendance-rsvp-declined notification static
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

test("attendance_rsvp_declined is a recognised notification type", () => {
  assert.match(service, /"attendance_rsvp_declined"/u);
});

test("an attendance-rsvp-declined notification is derived from the same attendance_event_rsvp record submitAttendanceRsvp already writes, never a new write path", () => {
  assert.match(service, /async function deriveAttendanceRsvpDeclinedNotifications/u);
  assert.match(service, /record_type = 'attendance_event_rsvp'/u);
  assert.match(service, /actor_user_id = \$1/u);
  assert.match(service, /record_payload->>'rsvp_state' = 'not_attending'/u);
  assert.match(service, /await deriveAttendanceRsvpDeclinedNotifications\(client, recipientUserId\);/u);
});

test("only a not_attending RSVP notifies - attending/maybe are routine, not actionable, and stay silent", () => {
  const fn = service.slice(
    service.indexOf("async function deriveAttendanceRsvpDeclinedNotifications"),
    service.indexOf("async function deriveNotificationsForRecipient")
  );
  assert.doesNotMatch(fn, /'attending'/u);
  assert.doesNotMatch(fn, /'maybe'/u);
});

test("the notification deep-links to the organizing coach's own attendance view, an existing registered route - never inventing one", () => {
  assert.match(service, /coachAttendanceEvents: "coach_attendance_events"/u);
  assert.match(service, /deriveAttendanceRsvpDeclinedNotifications[\s\S]*?deepLinkRouteId: DEEP_LINK_ROUTE_IDS\.coachAttendanceEvents/u);
  assert.match(routeBootstrap, /route_id: "coach_attendance_events"/u);
});

test("the notification carries the declining athlete and the event/occurrence identity as factual payload, never an inferred summary", () => {
  assert.match(service, /athlete_user_id: cleanString\(row\.record_payload\?\.athlete_user_id\)/u);
  assert.match(service, /event_id: cleanString\(row\.record_payload\?\.event_id\)/u);
  assert.match(service, /occurrence_id: cleanString\(row\.record_payload\?\.occurrence_id\)/u);
});

test("the notification_type check constraint is widened by an explicit migration, since CREATE TABLE IF NOT EXISTS never re-runs against an existing table", () => {
  assert.match(schemaSql, /product_notifications_full_ui_87_type_migration/u);
  assert.match(schemaSql, /DROP CONSTRAINT IF EXISTS product_notifications_notification_type_check/u);
  assert.match(schemaSql, /'attendance_rsvp_declined'/u);
});

test("the coach-facing UI displays a real label for this notification type", () => {
  assert.match(notificationClient, /attendance_rsvp_declined: "Athlete declined an event"/u);
});

test("the FULL-UI-87 manifest function is declared as implemented with real tests inside the existing notifications area", () => {
  const area = manifest.product_areas.find((entry) => entry.area_id === "notifications");
  assert.ok(area, "expected the existing notifications product area");

  const fn = area.functions.find((entry) => entry.function_id === "notification_attendance_rsvp_declined");
  assert.ok(fn, "expected a notification_attendance_rsvp_declined function");
  assert.equal(fn.state, "implemented");
  assert.equal(fn.direct_test, "test/full_ui_87_attendance_rsvp_declined_notification_surface.test.mjs");
  assert.equal(fn.integration_test, "test/full_ui_87c_attendance_rsvp_declined_notification_persistent.integration.test.mjs");
  assert.notEqual(fn.persistence, "localStorage_only");
  assert.deepEqual(fn.actors, ["coach"]);

  assert.ok(manifest.delivery_slices.some((slice) => slice.slice_id === "FULL-UI-87" && slice.state === "implemented"));
});
