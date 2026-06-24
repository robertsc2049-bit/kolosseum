<!-- DEV NOTE: S-REG-08 candidate FK closure surface. This document records inert exercise-equipment candidate references only. It does not create active canonical registry files, alter active registry law, add active bundle content, or alter deterministic engine runtime behaviour. -->

# S-REG-08 - Exercise Equipment FK Closure Candidate Update

## Status

Implemented as candidate FK closure only.

## Purpose

S-REG-08 updates the inert exercise candidate records so the S-REG-06 exercise seed set references S-REG-07 equipment candidate records.

The updated exercise candidate file is:

- ci/registry/candidates/exercise_registry_3a/exercise_registry_3a.candidate.registry.json

The equipment candidate source remains:

- ci/registry/candidates/equipment_registry/equipment_registry.candidate.registry.json

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

S-REG-08 does not modify those active files.

## Candidate status

S-REG-08 changes the inert exercise candidate equipment status from:

- deferred_to_s_reg_07

to:

- candidate_equipment_fk_closed

Exercise candidate records remain:

- candidate_content_draft
- non_runtime
- active_registry_mutation: false
- active_bundle_mutation: false
- registry_law_mutation: false
- engine_runtime_mutation: false
- activation_ready: false
- complete_registry_claim: false

## Candidate FK closure map

S-REG-08 declares the small seed map:

- back_squat: barbell, rack, plate
- deadlift: barbell, plate
- bench_press: barbell, bench, rack, plate
- front_plank: bodyweight, open_floor_space

Each equipment ID must exist in the S-REG-07 equipment candidate file.

Each equipment record must declare the movement and activity IDs used by the exercise candidate record.

## Non-scope

Do not activate canonical registries.

Do not migrate compact registry law.

Do not add complete exercise coverage.

Do not add complete equipment coverage.

Do not update active exercise records.

Do not add programme template content.

Do not add substitution content.

Do not change engine output.

Do not modify launch GO or NO-GO records.

Do not create marketplace, team, organisation, unit, federation, licensing, or runtime behaviour.

## Proof

Required focused proof:

- node --test test/s_reg_08_exercise_equipment_fk_closure_candidate_update.test.mjs
- node ci/guards/s_reg_08_exercise_equipment_fk_closure_candidate_update_guard.mjs
- node --test test/s_reg_07_canonical_equipment_candidate_seeds.test.mjs
- node ci/guards/s_reg_07_canonical_equipment_candidate_seeds_guard.mjs
- node --test test/s_reg_06_canonical_activity_movement_exercise_candidate_seeds.test.mjs
- node ci/guards/s_reg_06_canonical_activity_movement_exercise_candidate_seeds_guard.mjs
- node ci/guards/s_reg_05_canonical_registry_contract_candidate_surface_guard.mjs
- node ci/guards/s_reg_04_legacy_to_canonical_registry_loader_bridge_guard.mjs
- node ci/guards/registry_bundle_guard.mjs
- node ci/guards/registry_law_guard.mjs
- node ci/guards/registry_schema_presence_guard.mjs
- node ci/guards/s_v1_22_equipment_registry_coverage_contract_guard.mjs
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

S-REG-09 may create candidate seeds for:

- exercise_activity_applicability_registry

S-REG-09 must keep candidate applicability records outside active registry law.