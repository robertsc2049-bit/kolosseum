
// DEV NOTE: Human-maintained repo surface. Keep this file aligned with canonical contracts,
// deterministic checks, and developer handover standards. Do not introduce hidden defaults,
// broad discovery, or unreviewed boundary changes.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { verifyExerciseInstructionPresence } from "../ci/scripts/run_exercise_instruction_presence_verifier.mjs";

function writeJsonFixture(payload) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "p76-instruction-"));
  const filePath = path.join(tempDir, "exercise.registry.json");
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
  return filePath;
}

test("P76: passes when every exercise has instruction_short_text and optional detailed cues", () => {
  const fixturePath = writeJsonFixture({
    bench_press: {
      exercise_id: "bench_press",
      movement_pattern_id: "horizontal_push",
      instruction_short_text: "Lower bar to chest, press to full extension",
      instruction_detail_text: [
        "Grip bar evenly",
        "Retract shoulders before descent",
        "Drive bar vertically"
      ]
    },
    deadlift: {
      exercise_id: "deadlift",
      movement_pattern_id: "hinge",
      instruction_short_text: "Pull bar from floor to lockout",
      instruction_detail_text: ["Pull bar from floor to lockout"]
    }
  });

  const result = verifyExerciseInstructionPresence(fixturePath);

  assert.equal(result.ok, true);
  assert.equal(result.checked_exercise_count, 2);
  assert.deepEqual(result.failures, []);
});

test("P76: fails when instruction fields are missing", () => {
  const fixturePath = writeJsonFixture({
    bench_press: {
      exercise_id: "bench_press",
      movement_pattern_id: "horizontal_push"
    }
  });

  const result = verifyExerciseInstructionPresence(fixturePath);

  assert.equal(result.ok, false);
  assert.equal(result.checked_exercise_count, 1);
  assert.equal(result.failures.length, 2);
  assert.equal(result.failures[0].code, "instruction_short_missing");
  assert.equal(result.failures[1].code, "instruction_detail_missing");
  assert.match(result.failures[0].path, /bench_press\.instruction_short_text$/);
});

test("P76: fails when instruction_short_text is blank", () => {
  const fixturePath = writeJsonFixture({
    squat: {
      exercise_id: "squat",
      movement_pattern_id: "squat",
      instruction_short_text: "   ",
      instruction_detail_text: ["Squat with control"]
    }
  });

  const result = verifyExerciseInstructionPresence(fixturePath);

  assert.equal(result.ok, false);
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].code, "instruction_short_empty");
});

test("P76: fails when detailed cue is blank", () => {
  const fixturePath = writeJsonFixture({
    overhead_press: {
      exercise_id: "overhead_press",
      pattern: "vertical_push",
      instruction_short_text: "Press bar overhead to lockout",
      instruction_detail_text: ["Brace trunk", "   "]
    }
  });

  const result = verifyExerciseInstructionPresence(fixturePath);

  assert.equal(result.ok, false);
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].code, "instruction_detail_item_invalid");
  assert.match(result.failures[0].path, /instruction_detail_text\[1\]$/);
});

test("P76: fails when legacy instruction object is not part of canonical verifier", () => {
  const fixturePath = writeJsonFixture({
    row: {
      exercise_id: "row",
      movement_pattern_id: "horizontal_pull",
      instruction: {
        short: "Pull handle to torso",
        warning: "Do not round your back"
      }
    }
  });

  const result = verifyExerciseInstructionPresence(fixturePath);

  assert.equal(result.ok, false);
  assert.equal(result.failures.length, 2);
  assert.equal(result.failures[0].code, "instruction_short_missing");
  assert.equal(result.failures[1].code, "instruction_detail_missing");
});
