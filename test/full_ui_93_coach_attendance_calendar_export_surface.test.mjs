// DEV NOTE: FULL-UI-93 coach individual attendance-events calendar export
// static surface contract.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const attendanceRoutes = read("src/api/attendance_event.routes.ts");
const attendanceService = read("src/api/attendance_event_service.ts");
const detailPanel = read("public/app-src/screens/coach/AttendanceEventDetailPanel.tsx");
const detailPanelTest = read("public/app-src/__tests__/AttendanceEventDetailPanel.test.tsx");
const manifest = JSON.parse(read("product/ui/function_manifest.json"));

test("the coach calendar.ics route reuses FULL-UI-92's buildAttendanceEventsCalendar builder, not a duplicate", () => {
  assert.match(
    attendanceRoutes,
    /import \{\s*AttendanceEventError,\s*buildAttendanceEventsCalendar,[\s\S]*?loadAttendanceOccurrenceRecords,/u
  );
  assert.match(attendanceService, /export function buildAttendanceEventsCalendar\(/u);
});

test("the calendar.ics route is registered before the /:event_id route, or 'calendar.ics' would be swallowed as an event_id", () => {
  const calendarIndex = attendanceRoutes.indexOf('"/calendar.ics"');
  const eventIdIndex = attendanceRoutes.indexOf('"/:event_id"');
  assert.ok(calendarIndex >= 0, "expected the calendar.ics route to exist");
  assert.ok(eventIdIndex >= 0, "expected the :event_id route to exist");
  assert.ok(calendarIndex < eventIdIndex, "expected calendar.ics to be registered before :event_id");
});

test("the calendar.ics route is rate-limited (CodeQL's js/missing-rate-limiting flags newly-added authorising routes), resolves identity from authenticatedCoach only, filters to active events, and sets the correct download headers", () => {
  const fn = attendanceRoutes.slice(
    attendanceRoutes.indexOf("const coachAttendanceCalendarExportRateLimit"),
    attendanceRoutes.indexOf('"/:event_id"')
  );
  assert.match(fn, /coachAttendanceCalendarExportRateLimit = rateLimit\(/u);
  assert.match(fn, /coachAttendanceCalendarExportRateLimit,\s*\n\s*asyncHandler/u);
  assert.match(fn, /authenticatedCoach\(request, false\)/u);
  assert.doesNotMatch(fn, /request\.body\.user_id|request\.query\.user_id/u);
  assert.match(fn, /listAttendanceEventsForCoach/u);
  assert.match(fn, /event\.status === "active"/u);
  assert.match(fn, /loadAttendanceOccurrenceRecords/u);
  assert.match(fn, /buildAttendanceEventsCalendar/u);
  assert.match(fn, /Content-Type", "text\/calendar; charset=utf-8"/u);
  assert.match(fn, /Content-Disposition", 'attachment; filename="kolosseum-coach-events\.ics"'/u);
});

test("the coach export filename differs from the athlete/coach beta19 events export and the org gym-wide export, so a coach downloading both never confuses the two files", () => {
  assert.match(attendanceRoutes, /kolosseum-coach-events\.ics/u);
  const orgOwnerRoutes = read("src/api/org_owner.routes.ts");
  const productAccountRoutes = read("src/api/product_account.routes.ts");
  assert.doesNotMatch(attendanceRoutes, /kolosseum-gym-events\.ics/u);
  assert.doesNotMatch(attendanceRoutes, /"kolosseum-events\.ics"/u);
  assert.match(orgOwnerRoutes, /kolosseum-gym-events\.ics/u);
  assert.match(productAccountRoutes, /kolosseum-events\.ics/u);
});

test("the export link is a plain <a href> in the panel-header of the event LIST view, not a fetch/blob flow, matching the org/athlete/coach precedent - and is hidden while a single event's detail is open", () => {
  assert.match(detailPanel, /<a className="button secondary small-button" href="\/attendance-events\/calendar\.ics">Export calendar \(\.ics\)<\/a>/u);
  assert.match(detailPanel, /\{!selectedEventId \? \(\s*<a className="button secondary small-button" href="\/attendance-events\/calendar\.ics">/u);
  assert.match(detailPanelTest, /the calendar export link is a plain download href in the list view/u);
});

test("the FULL-UI-93 manifest function is declared as implemented in the attendance_events area, with real tests", () => {
  const area = manifest.product_areas.find((entry) => entry.area_id === "attendance_events");
  assert.ok(area, "expected the existing attendance_events product area");

  const fn = area.functions.find((entry) => entry.function_id === "attendance_event_calendar_export");
  assert.ok(fn, "expected an attendance_event_calendar_export function");
  assert.equal(fn.state, "implemented");
  assert.equal(fn.direct_test, "test/full_ui_93_coach_attendance_calendar_export_surface.test.mjs");
  assert.equal(fn.integration_test, "test/full_ui_93c_coach_attendance_calendar_export_persistent.integration.test.mjs");
  assert.notEqual(fn.persistence, "localStorage_only");
  assert.deepEqual(fn.actors, ["coach"]);

  assert.ok(manifest.delivery_slices.some((slice) => slice.slice_id === "FULL-UI-93" && slice.state === "implemented"));
});
