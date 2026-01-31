import test from "node:test";
import assert from "node:assert/strict";

async function loadRenderer() {
  const candidates = [
    "../dist/src/render/session_text.js",
    "../dist/engine/src/render/session_text.js",
    "../dist/render/session_text.js",
    "../dist/engine/render/session_text.js"
  ];

  let lastErr;
  for (const p of candidates) {
    try {
      return await import(p);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("Unable to import session_text renderer from dist");
}

test("renderSessionText renders deterministic lines with prescription + substitution", async () => {
  const { renderSessionText } = await loadRenderer();

  const session = {
    session_id: "SESSION_V1",
    status: "ready",
    exercises: [
      {
        exercise_id: "squat",
        source: "program",
        sets: 5,
        reps: 3,
        intensity: { type: "percent_1rm", value: 80 },
        rest_seconds: 180
      },
      {
        exercise_id: "db_bench",
        source: "program",
        sets: 3,
        reps: 10,
        intensity: { type: "rpe", value: 8 },
        substituted_from: "bench_press"
      }
    ]
  };

  const out = renderSessionText(session);

  assert.equal(out.title, "Session SESSION_V1");
  assert.deepEqual(out.lines, [
    "1) squat — 5x3 @ 80%1RM (rest 180s)",
    "2) db_bench — 3x10 @ RPE 8 [sub for bench_press]"
  ]);
  assert.equal(Array.isArray(out.warnings), true);
});

test("renderSessionText handles empty session deterministically", async () => {
  const { renderSessionText } = await loadRenderer();

  const session = { session_id: "SESSION_STUB", status: "ready", exercises: [] };
  const out = renderSessionText(session);

  assert.equal(out.title, "Session SESSION_STUB");
  assert.deepEqual(out.lines, ["(no exercises)"]);
});
