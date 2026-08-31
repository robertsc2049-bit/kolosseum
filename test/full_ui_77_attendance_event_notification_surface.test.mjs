// DEV NOTE: FULL-UI-77 attendance-event notification static surface
// contract.
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

test("attendance_event_invited, attendance_event_cancelled and attendance_event_occurrence_changed are recognised notification types", () => {
  assert.match(service, /"attendance_event_invited"/u);
  assert.match(service, /"attendance_event_cancelled"/u);
  assert.match(service, /"attendance_event_occurrence_changed"/u);
});

test("an invited-athlete notification is derived from the exact same attendance_event_invite record the invite flow already writes, never a new write path, and resolves the latest version per invite defensively (DISTINCT ON + application-level state filter, not a SQL WHERE filter)", () => {
  assert.match(service, /async function deriveAttendanceEventInvitedNotifications/u);
  assert.match(service, /record_type = 'attendance_event_invite' AND subject_user_id = \$1/u);
  assert.match(service, /SELECT DISTINCT ON \(record_id\) record_id, effective_at, record_payload/u);
  assert.match(service, /cleanString\(row\.record_payload\?\.invite_state\) !== "invited"/u);
  assert.match(service, /await deriveAttendanceEventInvitedNotifications\(client, recipientUserId\);/u);
});

test("a cancelled-event notification joins the athlete's own invited events against the attendance_event record's current status, mirroring deriveEventCancelledNotifications's latest-state-per-event shape", () => {
  assert.match(service, /async function deriveAttendanceEventCancelledNotifications/u);
  assert.match(service, /record_type = 'attendance_event'\s*\n\s*AND e\.record_id = i\.record_payload->>'event_id'\s*\n\s*AND e\.record_payload->>'status' = 'cancelled'/u);
  assert.match(service, /await deriveAttendanceEventCancelledNotifications\(client, recipientUserId\);/u);
});

test("an occurrence-changed notification fires only for a skipped or rescheduled occurrence on a NON-cancelled event the athlete is still invited to - a cancelled event's untouched occurrence never also fires its own redundant notification", () => {
  assert.match(service, /async function deriveAttendanceEventOccurrenceChangedNotifications/u);
  assert.match(service, /ev\.record_payload->>'status' != 'cancelled'/u);
  assert.match(service, /status !== "skipped" && status !== "rescheduled"/u);
  assert.match(service, /await deriveAttendanceEventOccurrenceChangedNotifications\(client, recipientUserId\);/u);
});

test("every attendance-event notification deep-links to the athlete's own attendance view, an existing registered route - never inventing one", () => {
  assert.match(service, /athleteAttendanceEvents: "athlete_attendance_events"/u);
  const invitedFn = service.slice(
    service.indexOf("async function deriveAttendanceEventInvitedNotifications"),
    service.indexOf("async function deriveAttendanceEventCancelledNotifications")
  );
  assert.match(invitedFn, /deepLinkRouteId: DEEP_LINK_ROUTE_IDS\.athleteAttendanceEvents/u);
  assert.match(routeBootstrap, /route_id: "athlete_attendance_events"/u);
});

test("the notification carries factual event/occurrence identity as payload, never an inferred summary", () => {
  assert.match(service, /organizer_user_id: cleanString\(row\.record_payload\?\.organizer_user_id\)/u);
  assert.match(service, /title: cleanString\(isRecord\(row\.event_payload\) \? row\.event_payload\.title : null\)/u);
  assert.match(service, /occurrence_id: cleanString\(row\.occurrence_record_id\),\s*\n\s*status/u);
});

test("the notification_type check constraint is widened by an explicit migration, since CREATE TABLE IF NOT EXISTS never re-runs against an existing table", () => {
  assert.match(schemaSql, /product_notifications_attendance_events_slice_5_type_migration/u);
  assert.match(schemaSql, /DROP CONSTRAINT IF EXISTS product_notifications_notification_type_check/u);
  assert.match(schemaSql, /'attendance_event_invited'/u);
  assert.match(schemaSql, /'attendance_event_cancelled'/u);
  assert.match(schemaSql, /'attendance_event_occurrence_changed'/u);
});

test("none of the three attendance-event notification types are ever marked stale by withTargetAvailability - they always target the athlete's own always-available attendance view, same as athleteToday-linked notifications", () => {
  assert.doesNotMatch(
    service.slice(
      service.indexOf("async function withTargetAvailability"),
      service.indexOf("async function withTargetAvailability") + 800
    ),
    /athleteAttendanceEvents/u
  );
});

test("the coach/athlete workspace displays a real label for all three attendance-event notification types", () => {
  assert.match(notificationClient, /attendance_event_invited: "Invited to an event"/u);
  assert.match(notificationClient, /attendance_event_cancelled: "Event cancelled"/u);
  assert.match(notificationClient, /attendance_event_occurrence_changed: "Event occurrence changed"/u);
});

test("the FULL-UI-77 manifest function is declared as implemented with real tests inside the existing notifications area", () => {
  const area = manifest.product_areas.find((entry) => entry.area_id === "notifications");
  assert.ok(area, "expected the existing notifications product area");

  const fn = area.functions.find((entry) => entry.function_id === "notification_attendance_event");
  assert.ok(fn, "expected a notification_attendance_event function");
  assert.equal(fn.state, "implemented");
  assert.equal(fn.direct_test, "test/full_ui_77_attendance_event_notification_surface.test.mjs");
  assert.equal(fn.integration_test, "test/attendance_events_notifications_persistent.integration.test.mjs");
  assert.notEqual(fn.persistence, "localStorage_only");
  assert.deepEqual(fn.actors, ["athlete"]);

  assert.ok(manifest.delivery_slices.some((slice) => slice.slice_id === "FULL-UI-77" && slice.state === "implemented"));
});
