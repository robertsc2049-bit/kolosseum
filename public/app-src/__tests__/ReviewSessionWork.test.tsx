// The coach's review of a session (ReviewSessionWork.tsx): where it hurt and
// on what, which exercise was skipped and why, and the athlete's own rating
// of the whole session (walkthrough 10).
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";

import { ReviewSessionWork } from "../screens/coach/ReviewSessionWork";

const names = new Map([["bulgarian_split_squat", "Bulgarian split squat"], ["trap_bar_deadlift", "Trap-bar deadlift"]]);

test.afterEach(() => cleanup());

test("pain and skips sit on the exercise they happened on, with the session rating at the top", () => {
  render(<ReviewSessionWork athleteName="Alex Rowe" exerciseNames={names} work={{ status: "ready", session: {
    exercise_ids: ["trap_bar_deadlift", "bulgarian_split_squat"],
    set_logs: [{ exercise_id: "trap_bar_deadlift", set_index: 1, reps: 6, load_value: 112.5, load_unit: "kg", seq: 1 }],
    pain_reported: true,
    skip_reasons: ["pain_or_discomfort"],
    skips: [{ exercise_id: "bulgarian_split_squat", reason_code: "pain_or_discomfort" }],
    pain_reports: [{ exercise_id: "bulgarian_split_squat", pain_area: "knee" }],
    session_load: { srpe: 7, minutes: 55 }
  } }} />);

  assert.ok(screen.getByText("Alex rated the session 7 out of 10 (very hard) · 55 min"));
  const split = screen.getByText("Bulgarian split squat").closest("li") as HTMLElement;
  assert.match(split.textContent ?? "", /Pain reported on this exercise - knee/u);
  assert.match(split.textContent ?? "", /Skipped - pain or discomfort/u);
  const deadlift = screen.getByText("Trap-bar deadlift").closest("li") as HTMLElement;
  assert.doesNotMatch(deadlift.textContent ?? "", /Pain|Skipped/u);
  // Not repeated as a vague line at the bottom.
  assert.equal(screen.queryByText("Pain was reported during this session."), null);
});

test("an older record without per-exercise detail still says a skip or pain happened", () => {
  render(<ReviewSessionWork athleteName="Alex Rowe" exerciseNames={names} work={{ status: "ready", session: {
    exercise_ids: ["bulgarian_split_squat"],
    pain_reported: true,
    skip_reasons: ["equipment_unavailable"]
  } }} />);
  assert.ok(screen.getByText("Pain was reported during this session."));
  assert.ok(screen.getByText("Skipped: equipment unavailable"));
});
