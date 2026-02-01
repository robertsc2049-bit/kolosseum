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
});