import assert from "node:assert/strict";
import test from "node:test";

import {
  Beta19CoachEventError,
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
