import assert from "node:assert/strict";
import test from "node:test";

import {
  Beta19CoachEventError,
  buildCoachEventsCalendar,
  compileStandaloneCoachEvent
} from "../dist/src/api/beta19_coach_event_service.js";

test("standalone coach event compiles an exact twelve-week calendar", () => {
  const compiled = compileStandaloneCoachEvent({
    event_id: "coach_event_test_001",
    event_name: "Test Championships",
    activity_id: "powerlifting",
    event_type: "powerlifting_meet",
    programme_start_date: "2026-08-03",
    event_date: "2026-10-26",
    location: "Mansfield",
    timezone: "Europe/London",
    notes: "Factual test event"
  });

  assert.equal(compiled.event_id, "coach_event_test_001");
  assert.equal(compiled.event_plan.event_name, "Test Championships");
  assert.equal(compiled.event_compile_summary.training_day_count, 84);
  assert.equal(compiled.event_compile_summary.required_week_count, 12);
  assert.equal(compiled.event_compile_summary.final_training_date, "2026-10-25");
  assert.equal(compiled.event_compile_summary.weeks.length, 12);
});

test("standalone coach event remains activity-bound and fail-closed", () => {
  assert.throws(
    () => compileStandaloneCoachEvent({
      event_id: "coach_event_test_002",
      event_name: "Wrong event type",
      activity_id: "rugby_union",
      event_type: "powerlifting_meet",
      programme_start_date: "2026-08-03",
      event_date: "2026-10-26",
      location: "",
      timezone: "Europe/London",
      notes: ""
    }),
    (error) =>
      error instanceof Beta19CoachEventError &&
      error.reason === "event_type_invalid_for_activity"
  );
});

test("buildCoachEventsCalendar renders a valid RFC 5545 all-day VEVENT for an active event", () => {
  const ics = buildCoachEventsCalendar([
    {
      event_id: "coach_event_cal_001",
      event_status: "active",
      event_plan: {
        event_name: "Test Championships",
        event_date: "2026-10-26",
        location: "Mansfield",
        notes: "Factual test event"
      }
    }
  ]);

  assert.match(ics, /^BEGIN:VCALENDAR\r\nVERSION:2\.0\r\n/u);
  assert.match(ics, /UID:coach_event_cal_001@kolosseum\.app\r\n/u);
  assert.match(ics, /DTSTART;VALUE=DATE:20261026\r\n/u);
  // All-day DTEND is exclusive per RFC 5545 - one day after DTSTART.
  assert.match(ics, /DTEND;VALUE=DATE:20261027\r\n/u);
  assert.match(ics, /SUMMARY:Test Championships\r\n/u);
  assert.match(ics, /LOCATION:Mansfield\r\n/u);
  assert.match(ics, /DESCRIPTION:Factual test event\r\n/u);
  assert.match(ics, /END:VEVENT\r\n/u);
  assert.match(ics, /END:VCALENDAR\r\n$/u);
});

test("buildCoachEventsCalendar skips cancelled/archived events and events with no event_date", () => {
  const ics = buildCoachEventsCalendar([
    { event_id: "cancelled_1", event_status: "cancelled", event_plan: { event_name: "Cancelled", event_date: "2026-10-26" } },
    { event_id: "archived_1", event_status: "archived", event_plan: { event_name: "Archived", event_date: "2026-10-26" } },
    { event_id: "no_date_1", event_status: "active", event_plan: { event_name: "No date" } }
  ]);

  assert.doesNotMatch(ics, /BEGIN:VEVENT/u);
  assert.match(ics, /^BEGIN:VCALENDAR[\s\S]*END:VCALENDAR\r\n$/u);
});

test("buildCoachEventsCalendar escapes commas, semicolons, backslashes and newlines in free text", () => {
  const ics = buildCoachEventsCalendar([
    {
      event_id: "coach_event_cal_002",
      event_status: "active",
      event_plan: {
        event_name: "Meet, Round; Two \\ Finals",
        event_date: "2026-10-26",
        notes: "Line one\nLine two"
      }
    }
  ]);

  assert.match(ics, /SUMMARY:Meet\\, Round\\; Two \\\\ Finals\r\n/u);
  assert.match(ics, /DESCRIPTION:Line one\\nLine two\r\n/u);
});
