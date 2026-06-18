const RUNBOOK_ID = "v1_controlled_launch_runbook";
const RUNBOOK_VERSION = "1.0.0";

const REQUIRED_SECTION_IDS = Object.freeze([
  "operator_scope",
  "daily_start",
  "status_surface_check",
  "error_reporting_check",
  "backup_restore_reference",
  "incident_recording",
  "pause_conditions",
  "handover_record",
  "daily_close"
]);

const REQUIRED_RECORD_FIELDS = Object.freeze([
  "record_id",
  "recorded_at",
  "operator_id",
  "launch_window_id",
  "sections_confirmed",
  "status_surface_checked",
  "error_reporting_checked",
  "backup_restore_reference_checked",
  "open_incident_count",
  "engine_mutation",
  "production_secret_value_accessed",
  "live_data_exported",
  "operator_notes"
]);

const BOOLEAN_FALSE_FIELDS = Object.freeze([
  "engine_mutation",
  "production_secret_value_accessed",
  "live_data_exported"
]);

const BOOLEAN_TRUE_FIELDS = Object.freeze([
  "status_surface_checked",
  "error_reporting_checked",
  "backup_restore_reference_checked"
]);

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);

    for (const nested of Object.values(value)) {
      deepFreeze(nested);
    }
  }

  return value;
}

function assertPlainObject(candidate, label) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    throw new TypeError(label + " must be a plain object.");
  }
}

function assertExactKeys(candidate, expectedKeys, label) {
  const actual = Object.keys(candidate).sort();
  const expected = [...expectedKeys].sort();

  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error(label + " must use the closed S-V1-O-04 field set.");
  }
}

function assertNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(label + " must be a non-empty string.");
  }
}

function assertBoolean(value, label) {
  if (typeof value !== "boolean") {
    throw new Error(label + " must be boolean.");
  }
}

function assertSectionClosure(sectionsConfirmed) {
  if (!Array.isArray(sectionsConfirmed)) {
    throw new Error("sections_confirmed must be an array.");
  }

  const expected = [...REQUIRED_SECTION_IDS].sort();
  const actual = [...sectionsConfirmed].sort();

  if (actual.length !== expected.length || actual.some((sectionId, index) => sectionId !== expected[index])) {
    throw new Error("sections_confirmed must contain every S-V1-O-04 section exactly once.");
  }

  if (new Set(sectionsConfirmed).size !== sectionsConfirmed.length) {
    throw new Error("sections_confirmed must not contain duplicate section ids.");
  }
}

function assertIntegerCount(value, label) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(label + " must be a non-negative integer.");
  }
}

function normaliseNotes(value) {
  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error("operator_notes must be null or a string.");
  }

  return value.trim();
}

// DEV NOTE: This module is an operations contract only. It validates that a
// controlled-launch operator recorded the declared runbook checks. It does not
// call engine code, alter registry content, inspect live data, or create
// product-outcome authority.
export function createControlledLaunchRunbookRecord(candidate) {
  assertPlainObject(candidate, "runbook record");
  assertExactKeys(candidate, REQUIRED_RECORD_FIELDS, "runbook record");

  assertNonEmptyString(candidate.record_id, "record_id");
  assertNonEmptyString(candidate.recorded_at, "recorded_at");
  assertNonEmptyString(candidate.operator_id, "operator_id");
  assertNonEmptyString(candidate.launch_window_id, "launch_window_id");

  assertSectionClosure(candidate.sections_confirmed);

  for (const fieldName of BOOLEAN_TRUE_FIELDS) {
    assertBoolean(candidate[fieldName], fieldName);

    if (candidate[fieldName] !== true) {
      throw new Error(fieldName + " must be true for a controlled-launch runbook record.");
    }
  }

  for (const fieldName of BOOLEAN_FALSE_FIELDS) {
    assertBoolean(candidate[fieldName], fieldName);

    if (candidate[fieldName] !== false) {
      throw new Error(fieldName + " must be false for a controlled-launch runbook record.");
    }
  }

  assertIntegerCount(candidate.open_incident_count, "open_incident_count");

  return deepFreeze({
    runbook_id: RUNBOOK_ID,
    runbook_version: RUNBOOK_VERSION,
    record_id: candidate.record_id.trim(),
    recorded_at: candidate.recorded_at.trim(),
    operator_id: candidate.operator_id.trim(),
    launch_window_id: candidate.launch_window_id.trim(),
    sections_confirmed: Object.freeze([...candidate.sections_confirmed]),
    status_surface_checked: candidate.status_surface_checked,
    error_reporting_checked: candidate.error_reporting_checked,
    backup_restore_reference_checked: candidate.backup_restore_reference_checked,
    open_incident_count: candidate.open_incident_count,
    engine_mutation: candidate.engine_mutation,
    production_secret_value_accessed: candidate.production_secret_value_accessed,
    live_data_exported: candidate.live_data_exported,
    operator_notes: normaliseNotes(candidate.operator_notes)
  });
}

export function getControlledLaunchRunbookContract() {
  return deepFreeze({
    runbook_id: RUNBOOK_ID,
    runbook_version: RUNBOOK_VERSION,
    required_section_ids: [...REQUIRED_SECTION_IDS],
    required_record_fields: [...REQUIRED_RECORD_FIELDS],
    linked_surfaces: [
      "docs/v1/V1_STATUS_PAGE.md",
      "docs/v1/V1_ERROR_REPORTING_INITIALISATION.md",
      "docs/ops/V1_BACKUP_RESTORE_TEST.md"
    ],
    forbidden_effects: [
      "engine_mutation",
      "production_secret_value_access",
      "live_data_export"
    ]
  });
}

export function runbookEngineTruthProbe() {
  return deepFreeze({
    engine_output_mutated: false,
    declaration_records_mutated: false,
    runtime_events_mutated: false,
    registry_bundle_mutated: false
  });
}