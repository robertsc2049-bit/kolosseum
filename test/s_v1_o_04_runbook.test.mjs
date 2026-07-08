import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  createControlledLaunchRunbookRecord,
  getControlledLaunchRunbookContract,
  runbookEngineTruthProbe
} from "../src/v1ControlledLaunchRunbook.mjs";

const validRecord = Object.freeze({
  record_id: "runbook_record_001",
  recorded_at: "2026-06-17T18:30:00.000Z",
  operator_id: "operator_001",
  launch_window_id: "controlled_launch_window_001",
  sections_confirmed: [
    "operator_scope",
    "daily_start",
    "status_surface_check",
    "error_reporting_check",
    "backup_restore_reference",
    "incident_recording",
    "pause_conditions",
    "handover_record",
    "daily_close"
  ],
  status_surface_checked: true,
  error_reporting_checked: true,
  backup_restore_reference_checked: true,
  open_incident_count: 0,
  engine_mutation: false,
  production_secret_value_accessed: false,
  live_data_exported: false,
  operator_notes: "No open incident recorded."
});

test("S-V1-O-04 exposes the controlled-launch runbook contract", () => {
  const contract = getControlledLaunchRunbookContract();

  assert.equal(contract.runbook_id, "v1_controlled_launch_runbook");
  assert.equal(contract.runbook_version, "1.0.0");
  assert.deepEqual(contract.required_section_ids, validRecord.sections_confirmed);
  assert.deepEqual(contract.linked_surfaces, [
    "docs/v1/V1_STATUS_PAGE.md",
    "docs/v1/V1_ERROR_REPORTING_INITIALISATION.md",
    "docs/ops/V1_BACKUP_RESTORE_TEST.md"
  ]);
});

test("S-V1-O-04 accepts a complete factual runbook record", () => {
  const record = createControlledLaunchRunbookRecord(validRecord);

  assert.equal(record.runbook_id, "v1_controlled_launch_runbook");
  assert.equal(record.status_surface_checked, true);
  assert.equal(record.error_reporting_checked, true);
  assert.equal(record.backup_restore_reference_checked, true);
  assert.equal(record.engine_mutation, false);
  assert.equal(record.production_secret_value_accessed, false);
  assert.equal(record.live_data_exported, false);
  assert.equal(Object.isFrozen(record), true);
});

test("S-V1-O-04 rejects missing or duplicate section confirmation", () => {
  assert.throws(
    () => createControlledLaunchRunbookRecord({
      ...validRecord,
      sections_confirmed: validRecord.sections_confirmed.filter((sectionId) => sectionId !== "daily_close")
    }),
    /sections_confirmed/
  );

  assert.throws(
    () => createControlledLaunchRunbookRecord({
      ...validRecord,
      sections_confirmed: [...validRecord.sections_confirmed, "daily_close"]
    }),
    /sections_confirmed/
  );
});

test("S-V1-O-04 rejects forbidden operational effects", () => {
  assert.throws(
    () => createControlledLaunchRunbookRecord({ ...validRecord, engine_mutation: true }),
    /engine_mutation/
  );

  assert.throws(
    () => createControlledLaunchRunbookRecord({ ...validRecord, production_secret_value_accessed: true }),
    /production_secret_value_accessed/
  );

  assert.throws(
    () => createControlledLaunchRunbookRecord({ ...validRecord, live_data_exported: true }),
    /live_data_exported/
  );
});

test("S-V1-O-04 rejects unknown fields and invalid counts", () => {
  assert.throws(
    () => createControlledLaunchRunbookRecord({ ...validRecord, extra_field: "not_allowed" }),
    /closed S-V1-O-04 field set/
  );

  assert.throws(
    () => createControlledLaunchRunbookRecord({ ...validRecord, open_incident_count: -1 }),
    /open_incident_count/
  );

  assert.throws(
    () => createControlledLaunchRunbookRecord({ ...validRecord, open_incident_count: 1.5 }),
    /open_incident_count/
  );
});

test("S-V1-O-04 cannot mutate deterministic surfaces", () => {
  assert.deepEqual(runbookEngineTruthProbe(), {
    engine_output_mutated: false,
    declaration_records_mutated: false,
    runtime_events_mutated: false,
    registry_bundle_mutated: false
  });
});

test("S-V1-O-04 documentation links the existing controlled-launch surfaces", () => {
  const doc = fs.readFileSync("docs/ops/V1_RUNBOOK.md", "utf8");

  assert.match(doc, /Slice: S-V1-O-04/);
  assert.match(doc, /docs\/v1\/V1_STATUS_PAGE\.md/);
  assert.match(doc, /docs\/v1\/V1_ERROR_REPORTING_INITIALISATION\.md/);
  assert.match(doc, /docs\/ops\/V1_BACKUP_RESTORE_TEST\.md/);
  assert.match(doc, /This runbook is operational process only/);
  assert.match(doc, /It does not alter engine output/);
});