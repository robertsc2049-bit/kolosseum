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
  const scriptPath = path.resolve(process.cwd(), "ci/scripts/run_postv1_exercise_id_canonicalization_map_verifier.mjs");
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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "p63a-exercise-id-map-"));

  writeJson(
    path.join(root, "registries", "exercise", "exercise.registry.json"),
    {
      registry_id: "exercise",
      version: "1.0.0",
      entries: {
        back_squat: {
          exercise_id: "back_squat",
          pattern: "squat",
          equipment: ["barbell", "rack"]
        },
        front_squat: {
          exercise_id: "front_squat",
          pattern: "squat",
          equipment: ["barbell", "rack"]
        },
        bench_press: {
          exercise_id: "bench_press",
          pattern: "horizontal_push",
          equipment: ["barbell", "bench", "rack"]
        }
      }
    }
  );

  const declarationPath = path.join(root, "docs", "releases", "V1_EXERCISE_ID_CANONICALIZATION_MAP.json");
  writeJson(
    declarationPath,
    {
      exercise_id_canonicalization_map_id: "v1_exercise_id_canonicalization_map",
      source_registry_path: "registries/exercise/exercise.registry.json",
      canonical_pattern: "ex_<equipment>_<movement>_<variant?>",
      entries: [
        {
          current_exercise_id: "back_squat",
          canonical_exercise_id: "ex_barbell_back_squat",
          status: "pending_migration"
        },
        {
          current_exercise_id: "front_squat",
          canonical_exercise_id: "ex_barbell_front_squat",
          status: "pending_migration"
        },
        {
          current_exercise_id: "bench_press",
          canonical_exercise_id: "ex_barbell_bench_press",
          status: "pending_migration"
        }
      ]
    }
  );

  writeText(path.join(root, "placeholder.txt"), "fixture\n");
  return { root, declarationPath };
}

test("P63a: exercise ID canonicalization map passes when all live exercise IDs are covered", () => {
  const fixture = createFixture();
  const { status, report } = runVerifier(fixture.declarationPath, fixture.root);

  assert.equal(status, 0);
  assert.equal(report.ok, true);
  assert.equal(report.registry_count, 3);
  assert.equal(report.mapped_count, 3);
});

test("P63a: exercise ID canonicalization map fails when a live exercise ID is missing", () => {
  const fixture = createFixture();

  writeJson(
    fixture.declarationPath,
    {
      exercise_id_canonicalization_map_id: "v1_exercise_id_canonicalization_map",
      source_registry_path: "registries/exercise/exercise.registry.json",
      canonical_pattern: "ex_<equipment>_<movement>_<variant?>",
      entries: [
        {
          current_exercise_id: "back_squat",
          canonical_exercise_id: "ex_barbell_back_squat",
          status: "pending_migration"
        },
        {
          current_exercise_id: "bench_press",
          canonical_exercise_id: "ex_barbell_bench_press",
          status: "pending_migration"
        }
      ]
    }
  );

  const { status, report } = runVerifier(fixture.declarationPath, fixture.root);

  assert.equal(status, 1);
  assert.equal(report.ok, false);
  assert.ok(
    report.failures.some(
      (failure) =>
        failure.token === "exercise_id_canonicalization_missing_mapping" &&
        failure.current_exercise_id === "front_squat"
    ),
    `expected exercise_id_canonicalization_missing_mapping for front_squat, got ${JSON.stringify(report, null, 2)}`
  );
});

test("P63a: exercise ID canonicalization map fails on malformed canonical IDs", () => {
  const fixture = createFixture();

  writeJson(
    fixture.declarationPath,
    {
      exercise_id_canonicalization_map_id: "v1_exercise_id_canonicalization_map",
      source_registry_path: "registries/exercise/exercise.registry.json",
      canonical_pattern: "ex_<equipment>_<movement>_<variant?>",
      entries: [
        {
          current_exercise_id: "back_squat",
          canonical_exercise_id: "barbell_back_squat",
          status: "pending_migration"
        },
        {
          current_exercise_id: "front_squat",
          canonical_exercise_id: "ex_barbell_front_squat",
          status: "pending_migration"
        },
        {
          current_exercise_id: "bench_press",
          canonical_exercise_id: "ex_barbell_bench_press",
          status: "pending_migration"
        }
      ]
    }
  );

  const { status, report } = runVerifier(fixture.declarationPath, fixture.root);

  assert.equal(status, 1);
  assert.equal(report.ok, false);
  assert.ok(
    report.failures.some(
      (failure) =>
        failure.token === "exercise_id_canonicalization_invalid_canonical_id" &&
        failure.current_exercise_id === "back_squat"
    ),
    `expected exercise_id_canonicalization_invalid_canonical_id for back_squat, got ${JSON.stringify(report, null, 2)}`
  );
});