import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { verifyExerciseEquipmentTagLayer } from "../ci/scripts/run_exercise_equipment_tag_layer_verifier.mjs";

function makeTempRegistry(entries) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "p64-equipment-tags-"));
  const file = path.join(dir, "exercise.registry.json");
  fs.writeFileSync(
    file,
    JSON.stringify(
      {
        registry_id: "exercise",
        version: "test",
        entries,
      },
      null,
      2
    )
  );
  return file;
}

test("P64: verifier passes when every exercise declares lawful equipment tags", () => {
  const registryPath = makeTempRegistry({
    back_squat: {
      exercise_id: "back_squat",
      equipment_tags: ["barbell"],
    },
    dumbbell_bench_press: {
      exercise_id: "dumbbell_bench_press",
      equipment_tags: ["dumbbell"],
    },
    push_up: {
      exercise_id: "push_up",
      equipment_tags: ["bodyweight"],
    },
    leg_press_machine: {
      exercise_id: "leg_press_machine",
      equipment_tags: ["machine"],
    },
    atlas_stone_load: {
      exercise_id: "atlas_stone_load",
      equipment_tags: ["strongman"],
    },
    kettlebell_deadlift: {
      exercise_id: "kettlebell_deadlift",
      equipment_tags: ["kettlebell"],
    }
  });

  const result = verifyExerciseEquipmentTagLayer({ registryPath });

  assert.equal(result.ok, true);
  assert.equal(result.entry_count, 6);
});

test("P64: verifier fails when an exercise is missing equipment_tags", () => {
  const registryPath = makeTempRegistry({
    back_squat: {
      exercise_id: "back_squat"
    }
  });

  assert.throws(
    () => verifyExerciseEquipmentTagLayer({ registryPath }),
    /missing required field 'equipment_tags'/i
  );
});

test("P64: verifier fails on empty equipment_tags", () => {
  const registryPath = makeTempRegistry({
    back_squat: {
      exercise_id: "back_squat",
      equipment_tags: []
    }
  });

  assert.throws(
    () => verifyExerciseEquipmentTagLayer({ registryPath }),
    /must declare at least one equipment tag/i
  );
});

test("P64: verifier fails on illegal equipment tag", () => {
  const registryPath = makeTempRegistry({
    belt_squat: {
      exercise_id: "belt_squat",
      equipment_tags: ["cable"]
    }
  });

  assert.throws(
    () => verifyExerciseEquipmentTagLayer({ registryPath }),
    /illegal equipment tag 'cable'/i
  );
});

test("P64: verifier fails on duplicate equipment tag", () => {
  const registryPath = makeTempRegistry({
    back_squat: {
      exercise_id: "back_squat",
      equipment_tags: ["barbell", "barbell"]
    }
  });

  assert.throws(
    () => verifyExerciseEquipmentTagLayer({ registryPath }),
    /duplicate equipment tag 'barbell'/i
  );
});