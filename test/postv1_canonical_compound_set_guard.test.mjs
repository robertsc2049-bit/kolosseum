import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, "utf8");
}

function runVerifier(declarationPath, cwd) {
  const scriptPath = path.resolve(process.cwd(), "ci/scripts/run_postv1_canonical_compound_set_guard_verifier.mjs");
  const result = spawnSync(process.execPath, [scriptPath, declarationPath], {
    cwd,
    encoding: "utf8"
  });

  const stdout = result.stdout.trim();
  assert.notEqual(stdout, "", "verifier should emit JSON report to stdout");

  let report;
  try {
    report = JSON.parse(stdout);
  } catch (error) {
    assert.fail(`verifier stdout was not valid JSON.\nstdout:\n${stdout}\nerror: ${error}`);
  }

  return {
    status: result.status,
    report
  };
}

function createFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "p62-canonical-compound-set-"));

  writeText(
    path.join(root, "ci", "scripts", "run_postv1_canonical_compound_set_guard_verifier.mjs"),
    "// fixture\n"
  );

  writeJson(
    path.join(root, "registries", "exercise", "exercise.registry.json"),
    {
      registry_id: "exercise",
      version: "1.0.0",
      entries: {
        bench_press: {
          exercise_id: "bench_press",
          pattern: "horizontal_push",
          stimulus_intent: "strength",
          rom: "full",
          stability: "stable",
          equipment: ["barbell", "bench", "rack"],
          equipment_tier: "TIER_1",
          joint_stress_tags: ["shoulder_high"]
        },
        overhead_press: {
          exercise_id: "overhead_press",
          pattern: "vertical_push",
          stimulus_intent: "strength",
          rom: "full",
          stability: "stable",
          equipment: ["barbell"],
          equipment_tier: "TIER_2",
          joint_stress_tags: ["shoulder_high"]
        },
        back_squat: {
          exercise_id: "back_squat",
          pattern: "squat",
          stimulus_intent: "strength",
          rom: "full",
          stability: "stable",
          equipment: ["barbell", "rack"],
          equipment_tier: "TIER_1",
          joint_stress_tags: ["knee_medium", "hip_medium"]
        },
        front_squat: {
          exercise_id: "front_squat",
          pattern: "squat",
          stimulus_intent: "strength",
          rom: "full",
          stability: "stable",
          equipment: ["barbell", "rack"],
          equipment_tier: "TIER_1",
          joint_stress_tags: ["knee_medium", "hip_medium"]
        },
        deadlift: {
          exercise_id: "deadlift",
          pattern: "hinge",
          stimulus_intent: "strength",
          rom: "full",
          stability: "stable",
          equipment: ["barbell"],
          equipment_tier: "TIER_1",
          joint_stress_tags: ["back_medium", "hip_medium"]
        },
        romanian_deadlift: {
          exercise_id: "romanian_deadlift",
          pattern: "hinge",
          stimulus_intent: "strength",
          rom: "full",
          stability: "stable",
          equipment: ["barbell"],
          equipment_tier: "TIER_1",
          joint_stress_tags: ["back_medium", "hip_medium"]
        }
      }
    }
  );

  const declarationPath = path.join(root, "docs", "releases", "V1_CANONICAL_COMPOUND_SET.json");
  writeJson(
    declarationPath,
    {
      canonical_compound_set_id: "v1_canonical_compound_set",
      required_surfaces: [
        "ci/scripts/run_postv1_canonical_compound_set_guard_verifier.mjs",
        "docs/releases/V1_CANONICAL_COMPOUND_SET.json",
        "registries/exercise/exercise.registry.json"
      ],
      locked_compounds: [
        {
          movement_class: "squat",
          exercise_ids: ["back_squat", "front_squat"]
        },
        {
          movement_class: "hinge",
          exercise_ids: ["deadlift", "romanian_deadlift"]
        },
        {
          movement_class: "horizontal_push",
          exercise_ids: ["bench_press"]
        },
        {
          movement_class: "vertical_push",
          exercise_ids: ["overhead_press"]
        }
      ]
    }
  );

  return { root, declarationPath };
}

test("P62: canonical compound set guard passes when all locked compounds exist", () => {
  const fixture = createFixture();
  const { status, report } = runVerifier(fixture.declarationPath, fixture.root);

  assert.equal(status, 0);
  assert.equal(report.ok, true);
  assert.equal(report.verified_locked_compounds.length, 6);
});

test("P62: canonical compound set guard fails when a locked compound is removed", () => {
  const fixture = createFixture();

  writeJson(
    path.join(fixture.root, "registries", "exercise", "exercise.registry.json"),
    {
      registry_id: "exercise",
      version: "1.0.0",
      entries: {
        bench_press: {
          exercise_id: "bench_press",
          pattern: "horizontal_push",
          stimulus_intent: "strength",
          rom: "full",
          stability: "stable",
          equipment: ["barbell", "bench", "rack"],
          equipment_tier: "TIER_1",
          joint_stress_tags: ["shoulder_high"]
        },
        overhead_press: {
          exercise_id: "overhead_press",
          pattern: "vertical_push",
          stimulus_intent: "strength",
          rom: "full",
          stability: "stable",
          equipment: ["barbell"],
          equipment_tier: "TIER_2",
          joint_stress_tags: ["shoulder_high"]
        },
        back_squat: {
          exercise_id: "back_squat",
          pattern: "squat",
          stimulus_intent: "strength",
          rom: "full",
          stability: "stable",
          equipment: ["barbell", "rack"],
          equipment_tier: "TIER_1",
          joint_stress_tags: ["knee_medium", "hip_medium"]
        },
        deadlift: {
          exercise_id: "deadlift",
          pattern: "hinge",
          stimulus_intent: "strength",
          rom: "full",
          stability: "stable",
          equipment: ["barbell"],
          equipment_tier: "TIER_1",
          joint_stress_tags: ["back_medium", "hip_medium"]
        },
        romanian_deadlift: {
          exercise_id: "romanian_deadlift",
          pattern: "hinge",
          stimulus_intent: "strength",
          rom: "full",
          stability: "stable",
          equipment: ["barbell"],
          equipment_tier: "TIER_1",
          joint_stress_tags: ["back_medium", "hip_medium"]
        }
      }
    }
  );

  const { status, report } = runVerifier(fixture.declarationPath, fixture.root);

  assert.equal(status, 1);
  assert.equal(report.ok, false);
  assert.ok(
    report.failures.some(
      (failure) =>
        failure.token === "canonical_compound_exercise_missing" &&
        failure.compound_key === "squat::front_squat"
    ),
    `expected canonical_compound_exercise_missing for squat::front_squat, got ${JSON.stringify(report, null, 2)}`
  );
});