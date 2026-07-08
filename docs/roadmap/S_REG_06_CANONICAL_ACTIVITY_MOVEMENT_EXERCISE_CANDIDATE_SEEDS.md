<!-- DEV NOTE: S-REG-06 candidate seed planning surface. This document records inert candidate seed records only. It does not create active canonical registry files, alter active registry law, add active bundle content, or alter deterministic engine runtime behaviour. -->

# S-REG-06 - Canonical Activity Movement Exercise Candidate Seeds

## Status

Implemented as candidate seed records only.

## Purpose

S-REG-06 creates the first small canonical candidate seed set for:

- activity_registry_1
- movement_registry_3
- exercise_token_registry_3b
- exercise_registry_3a

The files live only under the S-REG-05 candidate surface:

- ci/registry/candidates/<registry_id>/<registry_id>.candidate.registry.json

## Active registry baseline

The active controlled-launch registry surface remains compact:

- activity
- movement
- exercise
- program

The active registry index remains:

- registries/registry_index.json

The active generated bundle remains:

- registries/registry_bundle.json

S-REG-06 does not modify those active files.

## Candidate files

S-REG-06 adds:

- ci/registry/candidates/activity_registry_1/activity_registry_1.candidate.registry.json
- ci/registry/candidates/movement_registry_3/movement_registry_3.candidate.registry.json
- ci/registry/candidates/exercise_token_registry_3b/exercise_token_registry_3b.candidate.registry.json
- ci/registry/candidates/exercise_registry_3a/exercise_registry_3a.candidate.registry.json

Each candidate file declares:

- candidate_content_draft
- non_runtime
- active_registry_mutation: false
- active_bundle_mutation: false
- registry_law_mutation: false
- engine_runtime_mutation: false
- high_volume_content_added: false
- activation_ready: false
- complete_registry_claim: false

## Seed size

S-REG-06 is deliberately small:

- activity_registry_1: 3 records
- movement_registry_3: 4 records
- exercise_token_registry_3b: 4 records
- exercise_registry_3a: 4 records

This is not full registry coverage.

This is not canonical registry activation.

## FK rule

The candidate seed FK chain is:

1. movement_registry_3 records reference activity_registry_1 records.
2. exercise_token_registry_3b records reference activity_registry_1 and movement_registry_3 records.
3. exercise_registry_3a records reference activity_registry_1, movement_registry_3, and exercise_token_registry_3b records.

The exercise registry contract also depends on equipment_registry.

S-REG-06 does not create equipment records.

S-REG-06 records the equipment dependency as:

- deferred_to_s_reg_07

Exercise records originally had empty equipment_ids and activation_ready false until S-REG-07 created equipment candidate seeds.

S-REG-08 later updated the exercise candidate equipment references to candidate_equipment_fk_closed while keeping them non_runtime and activation_ready false.

## Files added

- ci/registry/candidates/activity_registry_1/activity_registry_1.candidate.registry.json
- ci/registry/candidates/movement_registry_3/movement_registry_3.candidate.registry.json
- ci/registry/candidates/exercise_token_registry_3b/exercise_token_registry_3b.candidate.registry.json
- ci/registry/candidates/exercise_registry_3a/exercise_registry_3a.candidate.registry.json
- ci/registry/s_reg_06_candidate_seed_records.mjs
- ci/registry/s_reg_06_candidate_seed_manifest.json
- test/s_reg_06_canonical_activity_movement_exercise_candidate_seeds.test.mjs
- ci/guards/s_reg_06_canonical_activity_movement_exercise_candidate_seeds_guard.mjs
- docs/roadmap/S_REG_06_CANONICAL_ACTIVITY_MOVEMENT_EXERCISE_CANDIDATE_SEEDS.md

## Non-scope

Do not activate canonical registries.

Do not migrate compact registry law.

Do not add full activity, movement, exercise token, or exercise coverage.

Do not add equipment registry content.

Do not add programme template content.

Do not add substitution content.

Do not change engine output.

Do not modify launch GO or NO-GO records.

Do not create marketplace, team, organisation, unit, federation, licensing, or runtime behaviour.

## Proof

Required focused proof:

- node --test test/s_reg_06_canonical_activity_movement_exercise_candidate_seeds.test.mjs
- node ci/guards/s_reg_06_canonical_activity_movement_exercise_candidate_seeds_guard.mjs
- node ci/guards/s_reg_05_canonical_registry_contract_candidate_surface_guard.mjs
- node ci/guards/s_reg_04_legacy_to_canonical_registry_loader_bridge_guard.mjs
- node ci/guards/registry_bundle_guard.mjs
- node ci/guards/registry_law_guard.mjs
- node ci/guards/registry_schema_presence_guard.mjs
- node ci/guards/s_v1_24_registry_load_order_fk_closure_guard.mjs
- node ci/scripts/run_s_v1_g_02_registry_workability_audit_launch_hold.mjs --check
- node ci/guards/guards_entrypoint_coverage_guard.mjs

Required generated-file proof:

- node ci/scripts/run_failure_token_index_guard.mjs --write
- npm.cmd run guard:index
- npm.cmd run hash:write

Final local proof:

- npm.cmd run test:unit
- npm.cmd run lint:fast

## Next slice boundary

S-REG-07 may add equipment candidate seeds under:

- ci/registry/candidates/equipment_registry/equipment_registry.candidate.registry.json

S-REG-07 must keep equipment candidate records inert and outside active registry law.