import test from "node:test";
import assert from "node:assert/strict";

// Render contract test only.
// IMPORTANT: Do NOT import the CLI module here. The CLI reads stdin and fails when stdin is empty.
test("CLI rendered session text uses ASCII separator", async () => {
  const { renderSessionText } = await import("../dist/engine/src/render/session_text.js");

  const session = {
    session_id: "S1",
    status: "ready",
    exercises: [
      { exercise_id: "bp", sets: 3, reps: 5 },
      { exercise_id: "dl", sets: 1, reps: 5 }
    ]
  };

  const r = renderSessionText(session);

  assert.equal(Array.isArray(r.lines), true);
  assert.deepEqual(r.lines, [
    "1) bp - 3x5",
    "2) dl - 1x5"
  ]);
});
