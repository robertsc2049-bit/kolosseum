<!-- DEV NOTE: S-REG-12 candidate metric-exercise link surface. This document records inert metric-exercise relationship candidate records only. It does not create active canonical registry files, alter active registry law, add active bundle content, add threshold-marker behaviour, add marker evaluator behaviour, or alter deterministic engine runtime behaviour. -->

# S-REG-12 - Metric Exercise Link Candidate Seeds

## Status

Implemented as candidate seed records only.

## Purpose

S-REG-12 creates inert candidate records for:

- metric_exercise_link_registry_1c_a

The candidate file is:

- ci/registry/candidates/metric_exercise_link_registry_1c_a/metric_exercise_link_registry_1c_a.candidate.registry.json

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

S-REG-12 does not modify those active files.

## Candidate status

S-REG-12 candidate records remain:

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

S-REG-12 creates a small metric-exercise link seed set.

Metric-exercise link records:

- powerlifting__load_kg__back_squat
- powerlifting__load_kg__deadlift
- powerlifting__load_kg__bench_press
- powerlifting__repetition_count__back_squat
- powerlifting__repetition_count__deadlift
- powerlifting__repetition_count__bench_press
- general_strength__load_kg__back_squat
- general_strength__load_kg__deadlift
- general_strength__load_kg__bench_press
- general_strength__repetition_count__back_squat
- general_strength__repetition_count__deadlift
- general_strength__repetition_count__bench_press
- rugby_union__body_mass_kg__front_plank

S-REG-12 does not link rugby_union__sprint_time_seconds because S-REG-06 does not yet include a factual sprint exercise candidate.

This is not complete metric-exercise coverage.

This is not canonical registry activation.

## FK rule

Each metric-exercise link candidate must reference:

- an activity_id from activity_registry_1 candidate records
- a sport_metric_id from S-REG-11 sport_metric_registry_1c candidate records
- an exercise_id from S-REG-06 exercise_registry_3a candidate records

Each link activity_id must match the referenced sport metric activity_id.

Each link activity_id must be declared on the referenced exercise candidate.

Each link must have a matching S-REG-09 exercise-activity applicability candidate record.

## Excluded surfaces

S-REG-12 does not add candidate records for:

- threshold_marker_registry
- marker evaluator behaviour
- programme templates
- substitution registry

## Non-scope

Do not activate canonical registries.

Do not migrate compact registry law.

Do not add threshold markers.

Do not add marker evaluator behaviour.

Do not add readiness, safety, suitability, tactical, return-to-play, recommendation, optimisation, ranking, capability, or outcome semantics.

Do not add complete metric-exercise coverage.

Do not add complete metric coverage.

Do not add complete sport context coverage.

Do not add complete exercise coverage.

Do not add programme template content.

Do not add substitution content.

Do not change engine output.

Do not modify launch GO or NO-GO records.

Do not create marketplace, team, organisation, unit, federation, licensing, tactical runtime, or enterprise behaviour.

## Proof

Required focused proof:

- node --test test/s_reg_12_metric_exercise_link_candidate_seeds.test.mjs
- node ci/guards/s_reg_12_metric_exercise_link_candidate_seeds_guard.mjs
- node --test test/s_reg_11_sport_metric_candidate_seeds.test.mjs
- node ci/guards/s_reg_11_sport_metric_candidate_seeds_guard.mjs
- node --test test/s_reg_10_sport_context_candidate_seeds.test.mjs
- node ci/guards/s_reg_10_sport_context_candidate_seeds_guard.mjs
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
- node ci/guards/s_v1_20_supported_activity_set_lock_guard.mjs
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

S-REG-13 may create a threshold marker contract or defer threshold marker surface.

S-REG-13 must not create marker evaluator behaviour and must not activate canonical registries.