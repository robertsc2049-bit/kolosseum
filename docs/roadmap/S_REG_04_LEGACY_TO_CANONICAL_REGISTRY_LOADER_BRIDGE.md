<!-- DEV NOTE: S-REG-04 registry repair bridge record. This document records a bridge-only implementation. It does not create active canonical registry files, add registry content, or widen launch scope. -->

# S-REG-04 - Legacy-to-Canonical Registry Loader Bridge

## Status

Implemented as a bridge-only slice.

## Purpose

S-REG-04 creates a read-only bridge from the current compact registry bundle to selected future canonical registry IDs.

This is a bridge-only slice.

It does not activate canonical registry IDs in registry_index.json.

It does not add registry content.

It does not claim full canonical v1 registry completion.

It does not migrate compact registry records into canonical registry files.

It does not alter deterministic engine runtime behaviour.

## Inspection baseline

The active registry index remains compact:

- activity
- movement
- exercise
- program

The active registry bundle remains compact:

- activity
- movement
- exercise
- program

Controlled-launch registry workability remains the active proof status.

## Bridge mapping

The accepted S-REG-04 bridge mapping is:

- activity -> activity_registry_1
- movement -> movement_registry_3
- exercise -> exercise_registry_3a
- program -> sport_program_profile_registry_5d

The program alias is a read-only profile alias only.

The program alias must not invent programme template structure.

## Implementation boundary

S-REG-04 adds a CI/proof bridge module:

- ci/registry/s_reg_04_legacy_to_canonical_registry_bridge.mjs

The bridge accepts a registry bundle or registry map and resolves only the explicit canonical IDs listed above.

The bridge returns:

- canonical registry ID
- legacy source registry ID
- bridge status
- alias scope
- source collection key
- source entry count
- cloned and frozen registry document
- explicit false values for completion, content migration, and template structure claims

Unknown canonical IDs fail closed with:

- CI_S_REG_04_LEGACY_CANONICAL_REGISTRY_BRIDGE

## Non-scope

S-REG-04 does not touch:

- registries/registry_index.json
- registries/registry_bundle.json
- registries/*/*.registry.json
- ci/guards/registry_law_guard.mjs
- ci/guards/registry_bundle_guard.mjs
- ci/guards/registry_schema_presence_guard.mjs
- ci/guards/s_v1_24_registry_load_order_fk_closure_guard.mjs
- deterministic engine runtime files
- UI
- database migrations
- launch decision records

## Proof

Required focused proof:

- node --test test/s_reg_04_legacy_to_canonical_registry_loader_bridge.test.mjs
- node ci/guards/s_reg_04_legacy_to_canonical_registry_loader_bridge_guard.mjs
- node ci/guards/registry_bundle_guard.mjs
- node ci/guards/registry_law_guard.mjs
- node ci/guards/registry_schema_presence_guard.mjs
- node ci/guards/s_v1_24_registry_load_order_fk_closure_guard.mjs
- node ci/scripts/run_s_v1_g_02_registry_workability_audit_launch_hold.mjs --check

Required generated-file proof:

- node ci/scripts/run_failure_token_index_guard.mjs --write
- npm.cmd run guard:index
- npm.cmd run hash:write

Final local proof:

- npm.cmd run lint:fast

## Next slice boundary

S-REG-05 may use this bridge to begin controlled canonical registry foundation work, but must still avoid high-volume content expansion until the canonical source-of-truth path is explicitly accepted.