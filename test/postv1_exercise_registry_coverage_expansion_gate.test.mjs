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
  const scriptPath = path.resolve(process.cwd(), "ci/scripts/run_postv1_exercise_registry_coverage_expansion_gate_verifier.mjs");
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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "p59-exercise-registry-coverage-expansion-gate-"));

  writeText(
    path.join(root, "ci", "scripts", "run_postv1_exercise_registry_coverage_expansion_gate_verifier.mjs"),
    "// fixture\n"
  );

  const declarationPath = path.join(root, "docs", "releases", "V1_EXERCISE_REGISTRY_COVERAGE_MAP.json");
  writeJson(declarationPath, {
    coverage_map_id: "v1_exercise_registry_coverage_map",
    required_surfaces: [
      "ci/scripts/run_postv1_exercise_registry_coverage_expansion_gate_verifier.mjs",
      "docs/releases/V1_EXERCISE_REGISTRY_COVERAGE_MAP.json"
    ],
    mvp_required_coverage: [
      { movement_class: "squat", movement_pattern: "bilateral_knee_dominant" },
      { movement_class: "hinge", movement_pattern: "bilateral_hip_dominant" },
      { movement_class: "horizontal_push", movement_pattern: "bilateral_upper_push_horizontal" }
    ],
    declared_mvp_coverage: [
      { movement_class: "squat", movement_pattern: "bilateral_knee_dominant" },
      { movement_class: "hinge", movement_pattern: "bilateral_hip_dominant" },
      { movement_class: "horizontal_push", movement_pattern: "bilateral_upper_push_horizontal" }
    ]
  });

  return { root, declarationPath };
}

test("P59: exercise registry coverage expansion gate passes when all MVP coverage entries are declared", () => {
  const fixture = createFixture();
  const { status, report } = runVerifier(fixture.declarationPath, fixture.root);

  assert.equal(status, 0);
  assert.equal(report.ok, true);
  assert.equal(report.verified_required_coverage.length, 3);
});

test("P59: exercise registry coverage expansion gate fails when an MVP movement class pattern pair is missing", () => {
  const fixture = createFixture();

  writeJson(fixture.declarationPath, {
    coverage_map_id: "v1_exercise_registry_coverage_map",
    required_surfaces: [
      "ci/scripts/run_postv1_exercise_registry_coverage_expansion_gate_verifier.mjs",
      "docs/releases/V1_EXERCISE_REGISTRY_COVERAGE_MAP.json"
    ],
    mvp_required_coverage: [
      { movement_class: "squat", movement_pattern: "bilateral_knee_dominant" },
      { movement_class: "hinge", movement_pattern: "bilateral_hip_dominant" },
      { movement_class: "horizontal_push", movement_pattern: "bilateral_upper_push_horizontal" }
    ],
    declared_mvp_coverage: [
      { movement_class: "squat", movement_pattern: "bilateral_knee_dominant" },
      { movement_class: "hinge", movement_pattern: "bilateral_hip_dominant" }
    ]
  });

  const { status, report } = runVerifier(fixture.declarationPath, fixture.root);

  assert.equal(status, 1);
  assert.equal(report.ok, false);
  assert.ok(
    report.failures.some((failure) => failure.token === "coverage_missing_mvp_entry"),
    `expected coverage_missing_mvp_entry, got ${JSON.stringify(report, null, 2)}`
  );
});