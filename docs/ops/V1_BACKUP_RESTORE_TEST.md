# V1 Backup Restore Test

Slice: S-V1-O-03
Status: Controlled-launch operational contract
Surface: docs/ops
Owner: Operations boundary

## Purpose

This document defines the controlled-launch backup and restore dry-run evidence surface for Kolosseum v1.

The surface records whether a fixture-only backup and restore dry run has been completed against an ephemeral target. It is operational evidence only.

## Boundary

This surface may document:

- fixture-only backup artefact creation
- fixture-only restore execution
- restore integrity comparison
- secret-value exposure check
- production-connection exclusion
- live-data exclusion
- engine-mutation exclusion

This surface must not:

- read production data
- read live secret values
- connect to a production database
- mutate engine output
- mutate declaration records
- mutate runtime events
- create user-facing training claims
- create product outcome claims
- create evidence-envelope authority

## Controlled-launch rule

A controlled-launch operator may record a dry-run result only when all of the following are true:

- Data source is fixture_only.
- Target environment is ci_ephemeral.
- Backup artefact kind is logical_dump_fixture.
- Restore target kind is throwaway_database.
- Production connection used is false.
- Live data used is false.
- Secret value accessed is false.
- Engine mutation is false.
- Restore integrity comparison is true.

If any item is not true, the dry-run record is rejected.

## Required dry-run steps

The dry run must record these exact step identifiers:

- backup_plan_declared
- fixture_backup_created
- fixture_restore_performed
- restore_integrity_compared
- secret_exposure_checked
- engine_boundary_checked

No additional step identifiers are accepted for this slice.

## Secret exposure boundary

The dry run may record that a secret-value check happened. It must not store secret values.

The following must never be stored in the dry-run record:

- database connection strings
- token values
- password values
- private key material
- third-party service credentials

The record may store boolean facts only.

## Engine boundary

Backup and restore testing belongs to the operations boundary.

The dry-run contract must not import engine modules, call engine execution entrypoints, call runtime reducers, alter registry payloads, or affect deterministic output.

## Result interpretation

A passing dry-run record means only this:

The controlled-launch backup and restore dry-run contract accepted the declared fixture-only operational record.

It does not mean:

- production backup has run
- production restore has run
- evidence sealing has happened
- export authority has changed
- engine truth has changed
- user outcomes have been assessed

## Guard wording lock

This document provides fixture-only backup and restore dry-run evidence for controlled launch operation.
