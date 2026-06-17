import assert from "node:assert/strict";
import test from "node:test";

import {
  assertBackupRestoreDryRunInput,
  buildBackupRestoreDryRunEvidence,
  getBackupRestoreDryRunContract
} from "../src/v1BackupRestoreTest.mjs";

function fixtureInput(overrides = {}) {
  return {
    backup_artifact_kind: "logical_dump_fixture",
    contract_version: "kolosseum.controlled_launch.backup_restore_test.v1.0.0",
    data_source: "fixture_only",
    dry_run_steps: [
      "backup_plan_declared",
      "fixture_backup_created",
      "fixture_restore_performed",
      "restore_integrity_compared",
      "secret_exposure_checked",
      "engine_boundary_checked"
    ],
    engine_mutation: false,
    live_data_used: false,
    operator_record_id: "s-v1-o-03-local-dry-run",
    production_connection_used: false,
    restore_integrity_compared: true,
    restore_target_kind: "throwaway_database",
    secret_value_accessed: false,
    slice_id: "S-V1-O-03",
    target_environment: "ci_ephemeral",
    ...overrides
  };
}

test("S-V1-O-03 accepts fixture-only backup restore dry-run evidence", () => {
  const input = fixtureInput();

  assert.equal(assertBackupRestoreDryRunInput(input), true);

  const evidence = buildBackupRestoreDryRunEvidence(input);

  assert.deepEqual(Object.keys(evidence).sort(), [
    "backup_artifact_kind",
    "contract_version",
    "data_source",
    "dry_run_steps",
    "engine_mutation",
    "evidence_class",
    "invariants",
    "live_data_used",
    "operator_record_id",
    "production_connection_used",
    "restore_integrity_compared",
    "restore_target_kind",
    "secret_value_accessed",
    "slice_id",
    "target_environment",
    "verdict"
  ]);

  assert.equal(evidence.verdict, "accepted");
  assert.equal(evidence.evidence_class, "controlled_launch_operational_dry_run");
  assert.equal(evidence.invariants.fixture_only, true);
  assert.equal(evidence.invariants.no_engine_mutation, true);
  assert.equal(evidence.invariants.no_live_data, true);
  assert.equal(evidence.invariants.no_production_connection, true);
  assert.equal(evidence.invariants.no_secret_value_access, true);
  assert.equal(evidence.invariants.restore_integrity_compared, true);
});

test("S-V1-O-03 contract exposes the exact required dry-run steps", () => {
  const contract = getBackupRestoreDryRunContract();

  assert.equal(contract.slice_id, "S-V1-O-03");
  assert.equal(contract.contract_version, "kolosseum.controlled_launch.backup_restore_test.v1.0.0");
  assert.deepEqual(contract.required_dry_run_steps, [
    "backup_plan_declared",
    "fixture_backup_created",
    "fixture_restore_performed",
    "restore_integrity_compared",
    "secret_exposure_checked",
    "engine_boundary_checked"
  ]);
});

test("S-V1-O-03 rejects production connections, live data, secret access, and engine mutation", () => {
  const cases = [
    ["production_connection_used", true, "backup_restore_production_connection_forbidden"],
    ["live_data_used", true, "backup_restore_live_data_forbidden"],
    ["secret_value_accessed", true, "backup_restore_secret_value_forbidden"],
    ["engine_mutation", true, "backup_restore_engine_mutation_forbidden"]
  ];

  for (const [key, value, code] of cases) {
    assert.throws(
      () => buildBackupRestoreDryRunEvidence(fixtureInput({ [key]: value })),
      (error) => error.code === code
    );
  }
});

test("S-V1-O-03 rejects non-fixture data and non-ephemeral targets", () => {
  assert.throws(
    () => buildBackupRestoreDryRunEvidence(fixtureInput({ data_source: "live" })),
    (error) => error.code === "backup_restore_data_source_invalid"
  );

  assert.throws(
    () => buildBackupRestoreDryRunEvidence(fixtureInput({ target_environment: "production" })),
    (error) => error.code === "backup_restore_environment_invalid"
  );
});

test("S-V1-O-03 rejects secret-like values in string fields", () => {
  assert.throws(
    () => buildBackupRestoreDryRunEvidence(fixtureInput({ operator_record_id: "DATABASE_URL=redacted-value" })),
    (error) => error.code === "backup_restore_secret_value_exposed"
  );
});

test("S-V1-O-03 rejects undeclared fields and altered dry-run steps", () => {
  assert.throws(
    () => buildBackupRestoreDryRunEvidence({ ...fixtureInput(), extra_field: true }),
    (error) => error.code === "backup_restore_input_invalid"
  );

  assert.throws(
    () => buildBackupRestoreDryRunEvidence(fixtureInput({ dry_run_steps: ["backup_plan_declared"] })),
    (error) => error.code === "backup_restore_steps_invalid"
  );
});
