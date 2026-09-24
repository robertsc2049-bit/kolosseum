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

At the time this slice was written, the active registry index was compact:

- activity
- movement
- exercise
- program

The active registry bundle was compact:

- activity
- movement
- exercise
- program

Controlled-launch registry workability remains the active proof status.

This baseline is a historical observation of the state at write-time, not a
permanent ceiling on the active registry surface - see the supersession log
below.

## Supersession log (append-only)

S-REG-25 later extended the active registry index and bundle with a fifth
domain, `equipment`, appended after this bridge's 4 mapped legacy ids. That
extension was a separate, explicitly human-authorised activation decision and
does not touch this bridge's compact-source boundary - the 4 legacy ids this
bridge maps remain the leading, unreordered prefix of the active order. This
guard's live-file checks were relaxed from an exact-length match to a prefix
match to reflect that later, separately-authorised extensions are expected and
do not constitute drift in this bridge.

REG-FULL-00 later established the authoritative final registry surface and
resolved the programme vocabulary that S-REG-04 could not yet settle. Under
that later authority, `sport_program_profile_registry_5d` has no current
compact runtime alias, while the compact `program` registry is the predecessor
of `sport_program_template_registry_5f`. REG-FULL-01 therefore updates the
executable bridge target for `program` to 5F without changing S-REG-04's
historical bridge-only boundary or claiming that the compact rows constitute a
fully migrated/completed 5F registry.

- superseded_by_slice_ids: S-REG-25, REG-FULL-00, REG-FULL-01

## Bridge mapping

The current executable S-REG-04 bridge mapping, after the later authoritative
programme-vocabulary supersession recorded above, is:

- activity -> activity_registry_1
- movement -> movement_registry_3
- exercise -> exercise_registry_3a
- program -> sport_program_template_registry_5f

Historically S-REG-04 described `program` as a read-only 5D profile alias.
REG-FULL-00 superseded that interpretation: the compact rows carry template
selection semantics (`activity_id`, `template_id`, and
`exercise_eligibility`) and are therefore a predecessor projection of 5F, not
5D.

The program alias remains read-only and must not claim completed programme
template structure or canonical registry completion.

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
- explicit false values for completion, content migration, and completed template structure claims

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