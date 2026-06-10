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

test("P76: passes when every exercise has instruction.short and optional detailed cues", () => {
  const fixturePath = writeJsonFixture({
    bench_press: {
      exercise_id: "bench_press",
      pattern: "horizontal_push",
      instruction: {
        short: "Lower bar to chest, press to full extension",
        detailed: [
          "Grip bar evenly",
          "Retract shoulders before descent",
          "Drive bar vertically"
        ]
      }
    },
    deadlift: {
      exercise_id: "deadlift",
      pattern: "hinge",
      instruction: {
        short: "Pull bar from floor to lockout"
      }
    }
  });

  const result = verifyExerciseInstructionPresence(fixturePath);

  assert.equal(result.ok, true);
  assert.equal(result.checked_exercise_count, 2);
  assert.deepEqual(result.failures, []);
});

test("P76: fails when instruction object is missing", () => {
  const fixturePath = writeJsonFixture({
    bench_press: {
      exercise_id: "bench_press",
      pattern: "horizontal_push"
    }
  });

  const result = verifyExerciseInstructionPresence(fixturePath);

  assert.equal(result.ok, false);
  assert.equal(result.checked_exercise_count, 1);
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].code, "instruction_missing");
  assert.match(result.failures[0].path, /bench_press\.instruction$/);
});

test("P76: fails when instruction.short is blank", () => {
  const fixturePath = writeJsonFixture({
    squat: {
      exercise_id: "squat",
      pattern: "squat",
      instruction: {
        short: "   "
      }
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
      instruction: {
        short: "Press bar overhead to lockout",
        detailed: ["Brace trunk", "   "]
      }
    }
  });

  const result = verifyExerciseInstructionPresence(fixturePath);

  assert.equal(result.ok, false);
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].code, "instruction_detailed_item_empty");
  assert.match(result.failures[0].path, /instruction\.detailed\[1\]$/);
});

test("P76: fails when instruction contains forbidden extra keys", () => {
  const fixturePath = writeJsonFixture({
    row: {
      exercise_id: "row",
      pattern: "horizontal_pull",
      instruction: {
        short: "Pull handle to torso",
        warning: "Do not round your back"
      }
    }
  });

  const result = verifyExerciseInstructionPresence(fixturePath);

  assert.equal(result.ok, false);
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].code, "instruction_extra_key");
  assert.match(result.failures[0].message, /forbidden key 'warning'/);
});