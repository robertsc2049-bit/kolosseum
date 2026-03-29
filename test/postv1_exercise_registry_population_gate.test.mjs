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
  const scriptPath = path.resolve(process.cwd(), "ci/scripts/run_postv1_exercise_registry_population_gate_verifier.mjs");
  const result = spawnSync(process.execPath, [scriptPath, declarationPath], {
    cwd,
    encoding: "utf8",
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
    report,
  };
}

function createFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "p60-exercise-registry-population-gate-"));

  writeText(
    path.join(root, "ci", "scripts", "run_postv1_exercise_registry_population_gate_verifier.mjs"),
    "// fixture\n"
  );

  const declarationPath = path.join(root, "docs", "releases", "V1_EXERCISE_REGISTRY_POPULATION_MAP.json");
  writeJson(declarationPath, {
    population_map_id: "v1_exercise_registry_population_map",
    required_surfaces: [
      "ci/scripts/run_postv1_exercise_registry_population_gate_verifier.mjs",
      "docs/releases/V1_EXERCISE_REGISTRY_POPULATION_MAP.json"
    ],
    mvp_required_population: [
      {
        movement_class: "squat",
        movement_pattern: "bilateral_knee_dominant",
        minimum_exercise_count: 1
      },
      {
        movement_class: "hinge",
        movement_pattern: "bilateral_hip_dominant",
        minimum_exercise_count: 1
      }
    ],
    declared_population: [
      {
        movement_class: "squat",
        movement_pattern: "bilateral_knee_dominant",
        exercise_ids: ["ex_barbell_back_squat"]
      },
      {
        movement_class: "hinge",
        movement_pattern: "bilateral_hip_dominant",
        exercise_ids: ["ex_barbell_deadlift"]
      }
    ]
  });

  return { root, declarationPath };
}

test("P60: exercise registry population gate passes when every MVP lane has required exercises", () => {
  const fixture = createFixture();
  const { status, report } = runVerifier(fixture.declarationPath, fixture.root);

  assert.equal(status, 0);
  assert.equal(report.ok, true);
  assert.equal(report.verified_population_lanes.length, 2);
});

test("P60: exercise registry population gate fails when an MVP lane exists but has no declared exercises", () => {
  const fixture = createFixture();

  writeJson(fixture.declarationPath, {
    population_map_id: "v1_exercise_registry_population_map",
    required_surfaces: [
      "ci/scripts/run_postv1_exercise_registry_population_gate_verifier.mjs",
      "docs/releases/V1_EXERCISE_REGISTRY_POPULATION_MAP.json"
    ],
    mvp_required_population: [
      {
        movement_class: "squat",
        movement_pattern: "bilateral_knee_dominant",
        minimum_exercise_count: 1
      },
      {
        movement_class: "hinge",
        movement_pattern: "bilateral_hip_dominant",
        minimum_exercise_count: 1
      }
    ],
    declared_population: [
      {
        movement_class: "squat",
        movement_pattern: "bilateral_knee_dominant",
        exercise_ids: ["ex_barbell_back_squat"]
      },
      {
        movement_class: "hinge",
        movement_pattern: "bilateral_hip_dominant",
        exercise_ids: []
      }
    ]
  });

  const { status, report } = runVerifier(fixture.declarationPath, fixture.root);

  assert.equal(status, 1);
  assert.equal(report.ok, false);
  assert.ok(
    report.failures.some((failure) => failure.token === "population_below_minimum"),
    `expected population_below_minimum, got ${JSON.stringify(report, null, 2)}`
  );
});