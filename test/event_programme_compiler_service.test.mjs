// DEV NOTE: Event programme compiler deterministic arithmetic proof.
import assert from "node:assert/strict";
import test from "node:test";

import {
  EventProgrammeCompilerError,
  compileEventProgrammeCalendar,
  eventWeekCalendar
} from "../dist/src/api/event_programme_compiler_service.js";

function compile(overrides = {}) {
  return compileEventProgrammeCalendar({
    activity_id: "powerlifting",
    event_plan_id: "",
    event_name: "British Championships",
    event_type: "powerlifting_meet",
    event_date: "2026-10-01",
    programme_start_date: "2026-07-09",
    location: "Mansfield",
    timezone: "Europe/London",
    notes: "Factual event compiler proof.",
    blocks: [
      {
        block_id: "volume",
        order_index: 1,
        name: "Volume",
        block_type: "volume",
        week_count: 5
      },
      {
        block_id: "strength",
        order_index: 2,
        name: "Strength",
        block_type: "strength",
        week_count: 4
      },
      {
        block_id: "peak",
        order_index: 3,
        name: "Peak",
        block_type: "peak",
        week_count: 3
      }
    ],
    ...overrides
  });
}

test("event compiler produces an exact balanced twelve-week calendar", () => {
  const result = compile();

  assert.equal(result.training_day_count, 84);
  assert.equal(result.required_week_count, 12);
  assert.equal(result.allocated_week_count, 12);
  assert.equal(result.week_delta, 0);
  assert.equal(result.allocation_state, "balanced");
  assert.equal(result.partial_final_week_days, 7);
  assert.equal(result.final_training_date, "2026-09-30");
  assert.equal(result.blocks[0].start_date, "2026-07-09");
  assert.equal(result.blocks[0].end_date, "2026-08-12");
  assert.equal(result.blocks[2].start_date, "2026-09-10");
  assert.equal(result.blocks[2].end_date, "2026-09-30");
});

test("event compiler reports under- and over-allocation without selecting block content", () => {
  const under = compile({
    blocks: [
      {
        block_id: "one",
        order_index: 1,
        name: "One",
        block_type: "general",
        week_count: 10
      }
    ]
  });

  assert.equal(under.allocation_state, "under_allocated");
  assert.equal(under.week_delta, 2);

  const over = compile({
    blocks: [
      {
        block_id: "one",
        order_index: 1,
        name: "One",
        block_type: "general",
        week_count: 13
      }
    ]
  });

  assert.equal(over.allocation_state, "over_allocated");
  assert.equal(over.week_delta, -1);
});

test("event compiler records a partial final training week", () => {
  const result = compile({
    event_date: "2026-09-29",
    blocks: [
      {
        block_id: "one",
        order_index: 1,
        name: "One",
        block_type: "general",
        week_count: 12
      }
    ]
  });

  assert.equal(result.training_day_count, 82);
  assert.equal(result.required_week_count, 12);
  assert.equal(result.partial_final_week_days, 5);

  const weeks = eventWeekCalendar(result);
  assert.equal(weeks.length, 12);
  assert.equal(weeks[11].start_date, "2026-09-24");
  assert.equal(weeks[11].end_date, "2026-09-28");
  assert.equal(weeks[11].partial_week, true);
});

test("event compiler enforces activity-linked event types", () => {
  assert.throws(
    () => compileEventProgrammeCalendar({
      activity_id: "rugby_union",
      event_name: "League match",
      event_type: "powerlifting_meet",
      event_date: "2026-08-01",
      programme_start_date: "2026-07-01",
      blocks: [
        {
          order_index: 1,
          name: "Block",
          block_type: "general",
          week_count: 5
        }
      ]
    }),
    (error) =>
      error instanceof EventProgrammeCompilerError &&
      error.reason === "event_type_invalid_for_activity"
  );
});

test("event compiler rejects an event before the programme start", () => {
  assert.throws(
    () => compile({
      event_date: "2026-07-08",
      programme_start_date: "2026-07-09"
    }),
    (error) =>
      error instanceof EventProgrammeCompilerError &&
      error.reason === "event_must_follow_programme_start"
  );
});

test("event compiler rejects unknown fields and non-contiguous blocks", () => {
  assert.throws(
    () => compileEventProgrammeCalendar({
      activity_id: "general_strength",
      event_name: "Test day",
      event_type: "test_day",
      event_date: "2026-08-01",
      programme_start_date: "2026-07-01",
      hidden_recommendation: true,
      blocks: [
        {
          order_index: 1,
          name: "Block",
          block_type: "general",
          week_count: 5
        }
      ]
    }),
    (error) =>
      error instanceof EventProgrammeCompilerError &&
      error.reason === "event_plan_unknown_field"
  );

  assert.throws(
    () => compile({
      blocks: [
        {
          block_id: "two",
          order_index: 2,
          name: "Two",
          block_type: "general",
          week_count: 12
        }
      ]
    }),
    (error) =>
      error instanceof EventProgrammeCompilerError &&
      error.reason === "block_order_not_contiguous"
  );
});
