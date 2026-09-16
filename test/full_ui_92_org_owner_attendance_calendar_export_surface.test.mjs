// DEV NOTE: FULL-UI-92 org-owner attendance-events calendar export static
// surface contract.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const attendanceService = read("src/api/attendance_event_service.ts");
const beta19Service = read("src/api/beta19_coach_event_service.ts");
const orgOwnerRoutes = read("src/api/org_owner.routes.ts");
const orgJs = read("public/org/org.js");
const indexHtml = read("public/org/index.html");
const manifest = JSON.parse(read("product/ui/function_manifest.json"));

test("the 4 ICS helpers are exported from beta19_coach_event_service.ts for reuse, not duplicated", () => {
  assert.match(beta19Service, /export function icsEscapeText\(/u);
  assert.match(beta19Service, /export function icsDateOnly\(/u);
  assert.match(beta19Service, /export function icsDateOnlyPlusOneDay\(/u);
  assert.match(beta19Service, /export function icsTimestamp\(/u);

  assert.match(
    attendanceService,
    /import \{\s*icsDateOnly,\s*icsDateOnlyPlusOneDay,\s*icsEscapeText,\s*icsTimestamp\s*\} from "\.\/beta19_coach_event_service\.js";/u
  );
});

test("buildAttendanceEventsCalendar is its own standalone function", () => {
  assert.match(attendanceService, /export function buildAttendanceEventsCalendar\(/u);
});

test("cancelled events (status !== active) are skipped entirely, matching buildCoachEventsCalendar's own precedent", () => {
  const fn = attendanceService.slice(attendanceService.indexOf("export function buildAttendanceEventsCalendar"));
  assert.match(fn, /if \(event\.status !== "active"\) continue;/u);
});

test("skipped occurrences are omitted entirely (never STATUS:CANCELLED) - this is a one-time snapshot, not a live subscription", () => {
  const fn = attendanceService.slice(attendanceService.indexOf("export function buildAttendanceEventsCalendar"));
  assert.match(fn, /if \(occurrence\.status === "skipped"\) continue;/u);
  assert.doesNotMatch(fn, /STATUS:CANCELLED/u);
});

test("rescheduled occurrences use the rescheduled_to_* slot, never the original occurrence_date/start_time/end_time", () => {
  const fn = attendanceService.slice(attendanceService.indexOf("export function buildAttendanceEventsCalendar"));
  assert.match(fn, /occurrence\.status === "rescheduled"/u);
  assert.match(fn, /rescheduled_to_date/u);
  assert.match(fn, /rescheduled_to_start_time/u);
  assert.match(fn, /rescheduled_to_end_time/u);
});

test("occurrences with a real start/end time use a bare TZID reference (no embedded VTIMEZONE), and fall back to an all-day VEVENT when times are absent", () => {
  const fn = attendanceService.slice(attendanceService.indexOf("export function buildAttendanceEventsCalendar"));
  assert.match(fn, /DTSTART;TZID=\$\{timezone\}/u);
  assert.match(fn, /DTEND;TZID=\$\{timezone\}/u);
  assert.doesNotMatch(fn, /VTIMEZONE/u);
  assert.match(fn, /DTSTART;VALUE=DATE:/u);
  assert.match(fn, /DTEND;VALUE=DATE:/u);
});

test("each VEVENT's UID is keyed by the occurrence, not the event, since one event can produce many VEVENTs", () => {
  const fn = attendanceService.slice(attendanceService.indexOf("export function buildAttendanceEventsCalendar"));
  assert.match(fn, /UID:\$\{cleanString\(occurrence\.occurrence_id\)\}@kolosseum\.app/u);
});

test("the calendar.ics route is registered before the :event_id route, or 'calendar.ics' would be swallowed as an event_id", () => {
  const calendarIndex = orgOwnerRoutes.indexOf('"/organisations/:org_id/attendance-events/calendar.ics"');
  const eventIdIndex = orgOwnerRoutes.indexOf('"/organisations/:org_id/attendance-events/:event_id"');
  assert.ok(calendarIndex >= 0, "expected the calendar.ics route to exist");
  assert.ok(eventIdIndex >= 0, "expected the :event_id route to exist");
  assert.ok(calendarIndex < eventIdIndex, "expected calendar.ics to be registered before :event_id");
});

test("the calendar.ics route is rate-limited (CodeQL's js/missing-rate-limiting flags newly-added authorising routes), resolves identity from authenticatedOrgOwner only, and sets the correct download headers", () => {
  const fn = orgOwnerRoutes.slice(
    orgOwnerRoutes.indexOf("const orgOwnerAttendanceCalendarExportRateLimit"),
    orgOwnerRoutes.indexOf('"/organisations/:org_id/attendance-events/:event_id"')
  );
  assert.match(fn, /orgOwnerAttendanceCalendarExportRateLimit = rateLimit\(/u);
  assert.match(fn, /orgOwnerAttendanceCalendarExportRateLimit,\s*\n\s*asyncHandler/u);
  assert.match(fn, /authenticatedOrgOwner\(request, false\)/u);
  assert.doesNotMatch(fn, /request\.body\.user_id|request\.query\.user_id/u);
  assert.match(fn, /listGymWideAttendanceEventsForOwner/u);
  assert.match(fn, /event\.status === "active"/u);
  assert.match(fn, /loadAttendanceOccurrenceRecords/u);
  assert.match(fn, /buildAttendanceEventsCalendar/u);
  assert.match(fn, /Content-Type", "text\/calendar; charset=utf-8"/u);
  assert.match(fn, /Content-Disposition", 'attachment; filename="kolosseum-gym-events\.ics"'/u);
});

test("the export link is a plain <a href> in the persistent attendance-section header, not a fetch/blob flow, matching the coach/athlete precedent", () => {
  assert.match(indexHtml, /<a id="orgAttendanceCalendarExportLink" class="button secondary" href="#">Export calendar \(\.ics\)<\/a>/u);
  assert.match(orgJs, /el\("orgAttendanceCalendarExportLink"\)\.href = `\/org\/organisations\/\$\{encodeURIComponent\(orgId\)\}\/attendance-events\/calendar\.ics`;/u);
});

test("the FULL-UI-92 manifest function is declared as implemented in the organisation_billing area, with real tests", () => {
  const area = manifest.product_areas.find((entry) => entry.area_id === "organisation_billing");
  assert.ok(area, "expected the existing organisation_billing product area");

  const fn = area.functions.find((entry) => entry.function_id === "org_owner_attendance_calendar_export");
  assert.ok(fn, "expected an org_owner_attendance_calendar_export function");
  assert.equal(fn.state, "implemented");
  assert.equal(fn.direct_test, "test/full_ui_92_org_owner_attendance_calendar_export_surface.test.mjs");
  assert.equal(fn.integration_test, "test/full_ui_92c_org_owner_attendance_calendar_export_persistent.integration.test.mjs");
  assert.notEqual(fn.persistence, "localStorage_only");
  assert.deepEqual(fn.actors, ["org_owner"]);

  assert.ok(manifest.delivery_slices.some((slice) => slice.slice_id === "FULL-UI-92" && slice.state === "implemented"));
});
