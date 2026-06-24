<!-- DEV NOTE: S-REG-11 candidate sport metric surface. This document records inert sport metric candidate records only. It does not create active canonical registry files, alter active registry law, add active bundle content, add metric-exercise links, add threshold-marker behaviour, or alter deterministic engine runtime behaviour. -->

# S-REG-11 - Sport Metric Candidate Seeds

## Status

Implemented as candidate seed records only.

## Purpose

S-REG-11 creates inert candidate records for:

- sport_metric_registry_1c

The candidate file is:

- ci/registry/candidates/sport_metric_registry_1c/sport_metric_registry_1c.candidate.registry.json

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

S-REG-11 does not modify those active files.

## Candidate status

S-REG-11 candidate records remain:

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

S-REG-11 creates a small sport metric seed set.

Sport metric records:

- powerlifting__load_kg
- powerlifting__repetition_count
- general_strength__load_kg
- general_strength__repetition_count
- rugby_union__body_mass_kg
- rugby_union__sprint_time_seconds

This is not complete sport metric coverage.

This is not canonical registry activation.

## FK rule

Each sport metric candidate must reference:

- an activity_id from activity_registry_1 candidate records
- a sport_subdivision_id from S-REG-10 sport subdivision candidate records

Each metric activity_id must match the referenced subdivision activity_id.

## Excluded surfaces

S-REG-11 does not add candidate records for:

- metric_exercise_link_registry_1c_a
- threshold_marker_registry
- marker evaluator behaviour
- programme templates
- substitution registry

## Non-scope

Do not activate canonical registries.

Do not migrate compact registry law.

Do not add metric-exercise links.

Do not add threshold markers.

Do not add marker evaluator behaviour.

Do not add readiness, safety, suitability, tactical, return-to-play, recommendation, optimisation, ranking, capability, or outcome semantics.

Do not add complete metric coverage.

Do not add complete sport context coverage.

Do not add complete exercise coverage.

Do not add complete equipment coverage.

Do not add programme template content.

Do not add substitution content.

Do not change engine output.

Do not modify launch GO or NO-GO records.

Do not create marketplace, team, organisation, unit, federation, licensing, tactical runtime, or enterprise behaviour.

## Proof

Required focused proof:

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

S-REG-12 may create candidate seeds for:

- metric_exercise_link_registry_1c_a

S-REG-12 must keep metric-exercise-link candidates outside active registry law and must not create threshold-marker behaviour.