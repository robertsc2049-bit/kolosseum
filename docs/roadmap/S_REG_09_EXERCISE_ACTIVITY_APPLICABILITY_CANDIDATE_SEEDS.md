<!-- DEV NOTE: S-REG-09 candidate applicability surface. This document records inert exercise-activity applicability candidate records only. It does not create active canonical registry files, alter active registry law, add active bundle content, or alter deterministic engine runtime behaviour. -->

# S-REG-09 - Exercise Activity Applicability Candidate Seeds

## Status

Implemented as candidate seed records only.

## Purpose

S-REG-09 creates inert candidate records for:

- exercise_activity_applicability_registry

The candidate file is:

- ci/registry/candidates/exercise_activity_applicability_registry/exercise_activity_applicability_registry.candidate.registry.json

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

S-REG-09 does not modify those active files.

## Candidate status

S-REG-09 candidate records remain:

- candidate_content_draft
- candidate_fk_ready
- non_runtime
- active_registry_mutation: false
- active_bundle_mutation: false
- registry_law_mutation: false
- engine_runtime_mutation: false
- activation_ready: false
- complete_registry_claim: false

## Candidate seed scope

S-REG-09 declares one training-context candidate applicability record for each S-REG-06 exercise and locked v1 activity pair.

Exercise seed set:

- back_squat
- deadlift
- bench_press
- front_plank

Activity seed set:

- powerlifting
- general_strength
- rugby_union

Candidate context:

- training

Candidate record count:

- 12

This is not complete exercise activity applicability coverage.

This is not canonical registry activation.

## FK rule

Each candidate applicability record must reference:

- an activity_id from activity_registry_1 candidate records
- an exercise_id from exercise_registry_3a candidate records

Each activity_id must also be declared on the referenced exercise candidate record.

## Non-scope

Do not activate canonical registries.

Do not migrate compact registry law.

Do not add complete exercise coverage.

Do not add complete equipment coverage.

Do not add programme template content.

Do not add substitution content.

Do not change engine output.

Do not modify launch GO or NO-GO records.

Do not create marketplace, team, organisation, unit, federation, licensing, or runtime behaviour.

## Proof

Required focused proof:

- node --test test/s_reg_09_exercise_activity_applicability_candidate_seeds.test.mjs
- node ci/guards/s_reg_09_exercise_activity_applicability_candidate_seeds_guard.mjs
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
- node ci/guards/s_v1_23_exercise_activity_applicability_coverage_guard.mjs
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

S-REG-10 may create candidate seeds for sport context surfaces, starting with:

- sport_subdivision_registry_1a
- sport_role_registry_2

S-REG-10 must keep sport context candidates outside active registry law.