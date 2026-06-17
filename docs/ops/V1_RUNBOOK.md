<!-- DEV NOTE: Operations documentation surface for S-V1-O-04. This document records controlled-launch operating checks only. It does not create engine, registry, product-outcome, billing, legal, or commercial authority. -->

# V1 Controlled Launch Runbook

Slice: S-V1-O-04
Status: Controlled-launch operations runbook
Surface: docs/ops
Owner: Operations boundary

## Purpose

This runbook defines the factual operating sequence for a controlled Kolosseum v1 launch window.

This runbook is operational process only. It records operator checks and handover facts. It does not alter engine output. It does not alter declaration records. It does not alter runtime events. It does not alter registry content.

## Linked controlled-launch surfaces

This runbook links these existing controlled-launch surfaces:

- `docs/v1/V1_STATUS_PAGE.md`
- `docs/v1/V1_ERROR_REPORTING_INITIALISATION.md`
- `docs/ops/V1_BACKUP_RESTORE_TEST.md`

If this runbook and a linked surface disagree, the linked surface governs its own boundary.

## Operator scope

The operator may record:

- launch window identifier
- operator identifier
- section confirmation
- status-surface check result
- error-reporting check result
- backup and restore reference check result
- open incident count
- handover notes

The operator must not record:

- production secret values
- live data exports
- engine input overrides
- engine output changes
- declaration record changes
- runtime event changes
- registry content changes
- coaching judgement
- product-outcome claim language

## Required section identifiers

A complete runbook record must confirm these exact section identifiers:

- operator_scope
- daily_start
- status_surface_check
- error_reporting_check
- backup_restore_reference
- incident_recording
- pause_conditions
- handover_record
- daily_close

No additional section identifiers are accepted for this slice.

## Daily start

At the start of a controlled-launch operating window, record:

- record_id
- recorded_at
- operator_id
- launch_window_id
- sections_confirmed

The operator confirms that the runbook is being used for a controlled-launch window only.

## Status surface check

The operator checks the factual public status surface.

The runbook record must state:

- status_surface_checked is true

The status surface check records component and incident facts only.

## Error-reporting check

The operator checks the factual error-reporting surface.

The runbook record must state:

- error_reporting_checked is true

The error-reporting check records product/runtime error observations only.

## Backup and restore reference check

The operator checks that the controlled-launch backup and restore dry-run reference exists.

The runbook record must state:

- backup_restore_reference_checked is true

This section references `docs/ops/V1_BACKUP_RESTORE_TEST.md`. It does not perform a backup. It does not perform a restore. It does not read production data.

## Incident recording

The operator records:

- open_incident_count

The count must be a non-negative integer.

Incident records are operational facts. They do not change engine output.

## Pause conditions

A controlled-launch operating window must be paused for operator review if any of the following are true:

- engine_mutation is true
- production_secret_value_accessed is true
- live_data_exported is true
- required section confirmation is incomplete
- status_surface_checked is not true
- error_reporting_checked is not true
- backup_restore_reference_checked is not true

Pause records are operational facts. They do not create training, product-outcome, or commercial authority.

## Handover record

The operator may record operator_notes as a string or null.

Operator notes must remain factual. They must not create coaching judgement, product-outcome claims, or engine authority.

## Daily close

At close of the operating window, the operator confirms:

- all required sections have been recorded
- open_incident_count has been recorded
- forbidden-effect fields are false
- handover notes are factual or null

## Closed field set

A runbook record must use only these fields:

- record_id
- recorded_at
- operator_id
- launch_window_id
- sections_confirmed
- status_surface_checked
- error_reporting_checked
- backup_restore_reference_checked
- open_incident_count
- engine_mutation
- production_secret_value_accessed
- live_data_exported
- operator_notes

Unknown fields are rejected.

## Non-scope

S-V1-O-04 does not add:

- engine execution behaviour
- engine input authority
- declaration mutation
- runtime event mutation
- registry mutation
- live production data access
- production secret access
- backup execution
- restore execution
- customer messaging
- legal document changes
- payment behaviour
- organisation, team, unit, gym, or federation capability
- live coach intervention
- product-outcome claim language

## Proof

S-V1-O-04 is proved by:

- `test/s_v1_o_04_runbook.test.mjs`
- `ci/guards/s_v1_o_04_runbook_guard.mjs`
- `npm run proof:s-v1-o-04`
- standard generated-index and checksum gates
- `npm run lint:fast`