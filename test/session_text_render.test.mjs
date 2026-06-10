import assert from "node:assert/strict";
import test from "node:test";
import { renderSessionText } from "../dist/engine/src/render/session_text.js";

test("renderSessionText renders deterministic lines with prescription + substitution", () => {
  const session = {
    session_id: "S1",
    exercises: [
      {
        exercise_id: "squat",
        sets: 5,
        reps: 3,
        intensity: { type: "percent_1rm", value: 80 },
        rest_seconds: 180
      },
      {
        exercise_id: "db_bench",
        sets: 3,
        reps: 10,
        intensity: { type: "rpe", value: 8 },
        substituted_from: "bench_press"
      }
    ]
  };

  const out = renderSessionText(session);

  assert.equal(out.title, "Session S1");
  assert.deepEqual(out.warnings, []);
  assert.deepEqual(out.lines, [
    "1) squat — 5x3 @ 80% rest 180s",
    "2) db_bench — 3x10 @ RPE 8 (sub for bench_press)"
  ]);
});

test("renderSessionText handles empty session deterministically", () => {
  const out = renderSessionText({ session_id: "EMPTY", exercises: [] });

  assert.equal(out.title, "Session EMPTY");
  assert.deepEqual(out.warnings, []);
  // Current renderer contract: empty => no lines
  assert.deepEqual(out.lines, []);
});
