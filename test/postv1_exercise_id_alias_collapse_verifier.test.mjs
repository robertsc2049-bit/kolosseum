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
  const scriptPath = path.resolve(process.cwd(), "ci/scripts/run_postv1_exercise_id_alias_collapse_verifier.mjs");
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

function createFixture({ mapEntries, collapseEntries }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "p63c-exercise-id-alias-collapse-"));

  writeJson(
    path.join(root, "docs", "releases", "V1_EXERCISE_ID_CANONICALIZATION_MAP.json"),
    {
      exercise_id_canonicalization_map_id: "v1_exercise_id_canonicalization_map",
      source_registry_path: "registries/exercise/exercise.registry.json",
      canonical_pattern: "ex_<equipment>_<movement>_<variant?>",
      entries: mapEntries
    }
  );

  const declarationPath = path.join(root, "docs", "releases", "V1_EXERCISE_ID_ALIAS_COLLAPSE.json");
  writeJson(
    declarationPath,
    {
      exercise_id_alias_collapse_id: "v1_exercise_id_alias_collapse",
      source_map_path: "docs/releases/V1_EXERCISE_ID_CANONICALIZATION_MAP.json",
      collapse_strategy_enum: ["retire_aliases_to_primary"],
      entries: collapseEntries
    }
  );

  return { root, declarationPath };
}

test("P63c: alias collapse verifier passes when converged legacy IDs are declared explicitly", () => {
  const fixture = createFixture({
    mapEntries: [
      {
        current_exercise_id: "incline_barbell_bench_press",
        canonical_exercise_id: "ex_barbell_incline_bench_press",
        status: "pending_migration"
      },
      {
        current_exercise_id: "incline_bench_press",
        canonical_exercise_id: "ex_barbell_incline_bench_press",
        status: "pending_migration"
      },
      {
        current_exercise_id: "back_squat",
        canonical_exercise_id: "ex_barbell_back_squat",
        status: "pending_migration"
      }
    ],
    collapseEntries: [
      {
        collapse_id: "collapse__ex_barbell_incline_bench_press",
        canonical_exercise_id: "ex_barbell_incline_bench_press",
        primary_current_exercise_id: "incline_barbell_bench_press",
        alias_current_exercise_ids: ["incline_bench_press"],
        collapse_strategy: "retire_aliases_to_primary"
      }
    ]
  });

  const { status, report } = runVerifier(fixture.declarationPath, fixture.root);
  assert.equal(status, 0);
  assert.equal(report.ok, true);
  assert.equal(report.required_collapse_count, 1);
  assert.equal(report.collapse_count, 1);
});

test("P63c: alias collapse verifier fails when converged legacy IDs have no declaration", () => {
  const fixture = createFixture({
    mapEntries: [
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
    ],
    collapseEntries: []
  });

  const { status, report } = runVerifier(fixture.declarationPath, fixture.root);
  assert.equal(status, 1);
  assert.equal(report.ok, false);
  assert.ok(
    report.failures.some(
      (failure) => failure.token === "exercise_id_alias_collapse_missing_declaration"
    ),
    `expected missing declaration failure, got ${JSON.stringify(report, null, 2)}`
  );
});

test("P63c: alias collapse verifier fails when alias set is incomplete", () => {
  const fixture = createFixture({
    mapEntries: [
      {
        current_exercise_id: "incline_barbell_bench_press",
        canonical_exercise_id: "ex_barbell_incline_bench_press",
        status: "pending_migration"
      },
      {
        current_exercise_id: "incline_bench_press",
        canonical_exercise_id: "ex_barbell_incline_bench_press",
        status: "pending_migration"
      },
      {
        current_exercise_id: "incline_press_legacy",
        canonical_exercise_id: "ex_barbell_incline_bench_press",
        status: "pending_migration"
      }
    ],
    collapseEntries: [
      {
        collapse_id: "collapse__ex_barbell_incline_bench_press",
        canonical_exercise_id: "ex_barbell_incline_bench_press",
        primary_current_exercise_id: "incline_barbell_bench_press",
        alias_current_exercise_ids: ["incline_bench_press"],
        collapse_strategy: "retire_aliases_to_primary"
      }
    ]
  });

  const { status, report } = runVerifier(fixture.declarationPath, fixture.root);
  assert.equal(status, 1);
  assert.equal(report.ok, false);
  assert.ok(
    report.failures.some(
      (failure) => failure.token === "exercise_id_alias_collapse_alias_set_mismatch"
    ),
    `expected alias set mismatch failure, got ${JSON.stringify(report, null, 2)}`
  );
});