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

function runVerifier(declarationPath, cwd) {
  const scriptPath = path.resolve(process.cwd(), "ci/scripts/run_postv1_exercise_id_canonical_target_normalization_verifier.mjs");
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

function createFixture(entries) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "p63b-exercise-id-normalization-"));
  const declarationPath = path.join(root, "docs", "releases", "V1_EXERCISE_ID_CANONICALIZATION_MAP.json");

  writeJson(
    declarationPath,
    {
      exercise_id_canonicalization_map_id: "v1_exercise_id_canonicalization_map",
      source_registry_path: "registries/exercise/exercise.registry.json",
      canonical_pattern: "ex_<equipment>_<movement>_<variant?>",
      entries
    }
  );

  return { root, declarationPath };
}

test("P63b: normalization verifier passes on clean normalized IDs", () => {
  const fixture = createFixture([
    {
      current_exercise_id: "back_squat",
      canonical_exercise_id: "ex_barbell_back_squat",
      status: "pending_migration"
    },
    {
      current_exercise_id: "bench_press",
      canonical_exercise_id: "ex_barbell_bench_press",
      status: "pending_migration"
    },
    {
      current_exercise_id: "dumbbell_bench_press",
      canonical_exercise_id: "ex_dumbbell_bench_press",
      status: "pending_migration"
    }
  ]);

  const { status, report } = runVerifier(fixture.declarationPath, fixture.root);
  assert.equal(status, 0);
  assert.equal(report.ok, true);
  assert.equal(report.verified_count, 3);
  assert.equal(report.collapse_candidate_count, 0);
});

test("P63b: normalization verifier reports collapse candidates without failing when targets converge cleanly", () => {
  const fixture = createFixture([
    {
      current_exercise_id: "incline_barbell_bench_press",
      canonical_exercise_id: "ex_barbell_incline_bench_press",
      status: "pending_migration"
    },
    {
      current_exercise_id: "incline_bench_press",
      canonical_exercise_id: "ex_barbell_incline_bench_press",
      status: "pending_migration"
    }
  ]);

  const { status, report } = runVerifier(fixture.declarationPath, fixture.root);
  assert.equal(status, 0);
  assert.equal(report.ok, true);
  assert.equal(report.collapse_candidate_count, 1);
  assert.deepEqual(report.collapse_candidates[0].converged_current_exercise_ids, [
    "incline_barbell_bench_press",
    "incline_bench_press"
  ]);
});

test("P63b: normalization verifier fails on duplicated equipment terms", () => {
  const fixture = createFixture([
    {
      current_exercise_id: "dumbbell_bench_press",
      canonical_exercise_id: "ex_dumbbell_dumbbell_bench_press",
      status: "pending_migration"
    }
  ]);

  const { status, report } = runVerifier(fixture.declarationPath, fixture.root);
  assert.equal(status, 1);
  assert.equal(report.ok, false);
  assert.ok(
    report.failures.some(
      (failure) => failure.token === "exercise_id_canonical_target_duplicated_equipment_term"
    ),
    `expected duplicated equipment term failure, got ${JSON.stringify(report, null, 2)}`
  );
});

test("P63b: normalization verifier fails on plural drift", () => {
  const fixture = createFixture([
    {
      current_exercise_id: "goblet_squat",
      canonical_exercise_id: "ex_dumbbells_goblet_squat",
      status: "pending_migration"
    }
  ]);

  const { status, report } = runVerifier(fixture.declarationPath, fixture.root);
  assert.equal(status, 1);
  assert.equal(report.ok, false);
  assert.ok(
    report.failures.some(
      (failure) => failure.token === "exercise_id_canonical_target_plural_drift"
    ),
    `expected plural drift failure, got ${JSON.stringify(report, null, 2)}`
  );
});

test("P63b: normalization verifier fails on malformed targets", () => {
  const fixture = createFixture([
    {
      current_exercise_id: "push_up",
      canonical_exercise_id: "bodyweight_push_up",
      status: "pending_migration"
    }
  ]);

  const { status, report } = runVerifier(fixture.declarationPath, fixture.root);
  assert.equal(status, 1);
  assert.equal(report.ok, false);
  assert.ok(
    report.failures.some(
      (failure) => failure.token === "exercise_id_canonical_target_malformed"
    ),
    `expected malformed target failure, got ${JSON.stringify(report, null, 2)}`
  );
});