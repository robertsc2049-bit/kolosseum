import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";

import { WorkoutScoreCard } from "../components/WorkoutScoreCard";

test.afterEach(() => cleanup());

test("a coach reading an athlete's AMRAP history sees each score marked Rx or Scaled, with separate bests", () => {
  const scaled = { session_id: "s1", date: "2026-09-01", scaled: true, rounds_completed: 14, extra_reps: 3, label: "14 rounds + 3 reps" };
  const rx = { session_id: "s2", date: "2026-09-08", scaled: false, rounds_completed: 12, extra_reps: 10, label: "12 rounds + 10 reps" };
  render(<WorkoutScoreCard
    exercises={[{ exercise_id: "pull_up", display_name: "Pull-up" }]}
    workout={{
      workout_key: "k", group_type: "amrap", time_cap_seconds: 1200, round_seconds: 0, total_rounds: 0,
      exercises: [{ exercise_id: "pull_up", reps: 5 }, { exercise_id: "air_squat", reps: 15 }],
      results: [rx, scaled], best_rx: rx, best_scaled: scaled
    }}
  />);
  assert.ok(screen.getByText("AMRAP 20 min"));
  assert.ok(screen.getByText("5 Pull-up, 15 Air Squat"));
  assert.ok(screen.getByText("Best Rx: 12 rounds + 10 reps"));
  assert.ok(screen.getByText("Best scaled: 14 rounds + 3 reps"));
  assert.equal(screen.getAllByText("Rx").length, 1);
  assert.equal(screen.getAllByText("Scaled").length, 1);
});
