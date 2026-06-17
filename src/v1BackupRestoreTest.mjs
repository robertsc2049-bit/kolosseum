const CONTRACT_VERSION = "kolosseum.controlled_launch.backup_restore_test.v1.0.0";
const SLICE_ID = "S-V1-O-03";

const REQUIRED_DRY_RUN_STEPS = Object.freeze([
  "backup_plan_declared",
  "fixture_backup_created",
  "fixture_restore_performed",
  "restore_integrity_compared",
  "secret_exposure_checked",
  "engine_boundary_checked"
]);

const INPUT_KEYS = Object.freeze([
  "backup_artifact_kind",
  "contract_version",
  "data_source",
  "dry_run_steps",
  "engine_mutation",
  "live_data_used",
  "operator_record_id",
  "production_connection_used",
  "restore_integrity_compared",
  "restore_target_kind",
  "secret_value_accessed",
  "slice_id",
  "target_environment"
]);

const OUTPUT_KEYS = Object.freeze([
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

const SECRET_VALUE_PATTERNS = Object.freeze([
  /(postgres|mysql|mongodb|redis):\/\/[^/\s:@]+:[^@\s]+@/i,
  /-----BEGIN [A-Z ]+PRIVATE KEY-----/i,
  /\b[A-Za-z0-9_]*(DATABASE_URL|SECRET|TOKEN|PASSWORD|PRIVATE_KEY|API_KEY)[A-Za-z0-9_]*\s*=\s*[^\s]+/i
]);

function fail(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  throw error;
}

function assertPlainObject(value, code, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(code, `${label} must be a plain object.`);
  }
}

function assertExactKeys(value, expectedKeys, code, label) {
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();

  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(code, `${label} key set mismatch.`, { actual, expected });
  }
}

function assertString(value, code, label) {
  if (typeof value !== "string" || value.length === 0) {
    fail(code, `${label} must be a non-empty string.`);
  }
}

function assertBoolean(value, code, label) {
  if (typeof value !== "boolean") {
    fail(code, `${label} must be boolean.`);
  }
}

function assertFalse(value, code, label) {
  assertBoolean(value, code, label);

  if (value !== false) {
    fail(code, `${label} must be false.`);
  }
}

function assertTrue(value, code, label) {
  assertBoolean(value, code, label);

  if (value !== true) {
    fail(code, `${label} must be true.`);
  }
}

function assertLiteral(value, expected, code, label) {
  if (value !== expected) {
    fail(code, `${label} must equal ${expected}.`, { actual: value, expected });
  }
}

function assertExactStepList(value) {
  if (!Array.isArray(value)) {
    fail("backup_restore_steps_invalid", "dry_run_steps must be an array.");
  }

  if (value.some((item) => typeof item !== "string" || item.length === 0)) {
    fail("backup_restore_steps_invalid", "dry_run_steps must contain non-empty strings only.");
  }

  const actual = [...value].sort();
  const expected = [...REQUIRED_DRY_RUN_STEPS].sort();

  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail("backup_restore_steps_invalid", "dry_run_steps must match the S-V1-O-03 step set exactly.", { actual, expected });
  }
}

function walkStringValues(value, visit) {
  if (typeof value === "string") {
    visit(value);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      walkStringValues(item, visit);
    }
    return;
  }

  if (value && typeof value === "object") {
    for (const nestedValue of Object.values(value)) {
      walkStringValues(nestedValue, visit);
    }
  }
}

function assertNoSecretValues(input) {
  walkStringValues(input, (text) => {
    for (const pattern of SECRET_VALUE_PATTERNS) {
      if (pattern.test(text)) {
        fail("backup_restore_secret_value_exposed", "Dry-run record contains a secret-like value.");
      }
    }
  });
}

/**
 * DEV NOTE:
 * Purpose: validates the controlled-launch backup/restore dry-run record.
 * Boundary: fixture-only operations evidence; no database connection, env read, engine import, or live data access.
 * Determinism: validation depends only on the supplied object and fixed literal sets.
 * Failure behaviour: any undeclared field, live-data flag, production-connection flag, secret-value flag, or engine-mutation flag throws a stable code.
 */
export function assertBackupRestoreDryRunInput(input) {
  assertPlainObject(input, "backup_restore_input_invalid", "input");
  assertExactKeys(input, INPUT_KEYS, "backup_restore_input_invalid", "input");
  assertNoSecretValues(input);

  assertLiteral(input.slice_id, SLICE_ID, "backup_restore_slice_invalid", "slice_id");
  assertLiteral(input.contract_version, CONTRACT_VERSION, "backup_restore_contract_version_invalid", "contract_version");

  assertString(input.operator_record_id, "backup_restore_operator_record_invalid", "operator_record_id");
  assertLiteral(input.target_environment, "ci_ephemeral", "backup_restore_environment_invalid", "target_environment");
  assertLiteral(input.data_source, "fixture_only", "backup_restore_data_source_invalid", "data_source");
  assertLiteral(input.backup_artifact_kind, "logical_dump_fixture", "backup_restore_artifact_kind_invalid", "backup_artifact_kind");
  assertLiteral(input.restore_target_kind, "throwaway_database", "backup_restore_target_kind_invalid", "restore_target_kind");

  assertFalse(input.production_connection_used, "backup_restore_production_connection_forbidden", "production_connection_used");
  assertFalse(input.live_data_used, "backup_restore_live_data_forbidden", "live_data_used");
  assertFalse(input.secret_value_accessed, "backup_restore_secret_value_forbidden", "secret_value_accessed");
  assertFalse(input.engine_mutation, "backup_restore_engine_mutation_forbidden", "engine_mutation");

  assertTrue(input.restore_integrity_compared, "backup_restore_integrity_comparison_required", "restore_integrity_compared");
  assertExactStepList(input.dry_run_steps);

  return true;
}

/**
 * DEV NOTE:
 * Purpose: materialises a deterministic operational evidence object for S-V1-O-03.
 * Boundary: emits operational dry-run facts only; it does not run backup tooling or restore tooling.
 * Determinism: output field set and ordering are fixed by constants and validated by tests.
 * Failure behaviour: invalid input prevents evidence object creation.
 */
export function buildBackupRestoreDryRunEvidence(input) {
  assertBackupRestoreDryRunInput(input);

  const output = {
    backup_artifact_kind: input.backup_artifact_kind,
    contract_version: input.contract_version,
    data_source: input.data_source,
    dry_run_steps: [...REQUIRED_DRY_RUN_STEPS],
    engine_mutation: input.engine_mutation,
    evidence_class: "controlled_launch_operational_dry_run",
    invariants: {
      fixture_only: input.data_source === "fixture_only",
      no_engine_mutation: input.engine_mutation === false,
      no_live_data: input.live_data_used === false,
      no_production_connection: input.production_connection_used === false,
      no_secret_value_access: input.secret_value_accessed === false,
      restore_integrity_compared: input.restore_integrity_compared === true
    },
    live_data_used: input.live_data_used,
    operator_record_id: input.operator_record_id,
    production_connection_used: input.production_connection_used,
    restore_integrity_compared: input.restore_integrity_compared,
    restore_target_kind: input.restore_target_kind,
    secret_value_accessed: input.secret_value_accessed,
    slice_id: input.slice_id,
    target_environment: input.target_environment,
    verdict: "accepted"
  };

  assertExactKeys(output, OUTPUT_KEYS, "backup_restore_output_invalid", "output");
  return Object.freeze(output);
}

export function getBackupRestoreDryRunContract() {
  return Object.freeze({
    contract_version: CONTRACT_VERSION,
    required_dry_run_steps: [...REQUIRED_DRY_RUN_STEPS],
    slice_id: SLICE_ID
  });
}
