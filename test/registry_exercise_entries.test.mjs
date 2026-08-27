
// DEV NOTE: Human-maintained repo surface. Keep this file aligned with canonical contracts,
// deterministic checks, and developer handover standards. Do not introduce hidden defaults,
// broad discovery, or unreviewed boundary changes.

import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

// IMPORTANT: tests run in Node (JS), so import the compiled output from dist.
import { loadExerciseEntriesFromPath } from "../dist/engine/src/registries/loadExerciseEntries.js";

test("exercise registry loads into entries map with required IDs", () => {
  const p = path.join(process.cwd(), "registries", "exercise", "exercise.registry.json");
  const entries = loadExerciseEntriesFromPath(p);

  assert.ok(entries && typeof entries === "object");

  const required = [
    "bench_press",
    "back_squat",
    "deadlift",
    "overhead_press",
    "incline_bench_press",
    "push_up"
  ];

  for (const id of required) {
    assert.ok(entries[id], `missing exercise_id in registry: ${id}`);
    assert.equal(entries[id].exercise_id, id, `entry.exercise_id mismatch for ${id}`);
  }

  // REG-FULL-01 keeps registry rows canonical while the substitution engine
  // consumes its established internal ExerciseSignature vocabulary. The loader
  // must project canonical fields exactly once at this boundary.
  assert.equal(entries.bench_press.pattern, "horizontal_push");
  assert.equal(entries.bench_press.stimulus, "strength");
  assert.deepEqual(entries.bench_press.equipment_ids, ["barbell", "bench", "rack"]);
});
