import test from "node:test";
import assert from "node:assert/strict";

async function loadPhase6() {
  // Common dist layouts (try in order)
  const candidates = [
    "../dist/src/phases/phase6.js",
    "../dist/engine/src/phases/phase6.js",
    "../dist/phases/phase6.js",
    "../dist/engine/phases/phase6.js"
  ];

  let lastErr;
  for (const p of candidates) {
    try {
      return await import(p);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("Unable to import Phase6 from dist (no candidates matched)");
}

test("Phase6 planned_exercise_ids enriched from exercises[] metadata", async () => {
  const { phase6ProduceSessionOutput } = await loadPhase6();

  const program = {
    planned_exercise_ids: ["squat"],
    exercises: [
      {
        exercise_id: "squat",
        sets: 5,
        reps: 3,
        intensity: { type: "percent_1rm", value: 80 }
      }
    ]
  };

  const res = phase6ProduceSessionOutput(program, {});
  assert.equal(res.ok, true);

  const ex = res.session.exercises[0];
  assert.equal(ex.exercise_id, "squat");
  assert.equal(ex.sets, 5);
  assert.equal(ex.reps, 3);
  assert.deepEqual(ex.intensity, { type: "percent_1rm", value: 80 });
});
