<!-- DEV NOTE: S-REG-05 registry contract planning surface. This document records an inert candidate-surface contract only. It does not create active canonical registry files, add registry content, change registry law, or alter deterministic engine runtime behaviour. -->

# S-REG-05 - Canonical Registry Contract and Candidate Surface Plan

## Status

Implemented as a contract and candidate-surface plan.

## Purpose

S-REG-05 defines the canonical registry contract required before Kolosseum registry completion work continues.

This slice creates:

- a canonical registry contract module
- a candidate registry surface manifest
- a dependency and FK-order manifest
- an executable guard
- an executable test

This slice keeps the current controlled-launch registry proof intact.

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

This slice does not modify either active file.

## Canonical registry IDs

S-REG-05 plans exactly these canonical registry IDs:

1. activity_registry_1
2. sport_subdivision_registry_1a
3. sport_metric_registry_1c
4. metric_exercise_link_registry_1c_a
5. sport_role_registry_2
6. movement_registry_3
7. exercise_token_registry_3b
8. exercise_registry_3a
9. equipment_registry
10. exercise_activity_applicability_registry
11. sport_program_profile_registry_5d
12. sport_event_model_registry_5e
13. sport_program_template_registry_5f
14. substitution_registry

## Candidate surface

Candidate content must use this inert, non_runtime surface until a later activation slice is accepted:

- ci/registry/candidates/<registry_id>/<registry_id>.candidate.registry.json

The future active path convention remains:

- registries/<registry_id>/<registry_id>.registry.json

The future active path is documented only.

S-REG-05 does not create active canonical registry directories.

S-REG-05 does not create candidate content records.

S-REG-05 does not activate canonical registries.

## Dependency order

The S-REG-05 dependency order is:

1. activity_registry_1
2. sport_subdivision_registry_1a
3. sport_metric_registry_1c
4. sport_role_registry_2
5. movement_registry_3
6. equipment_registry
7. exercise_token_registry_3b
8. exercise_registry_3a
9. metric_exercise_link_registry_1c_a
10. exercise_activity_applicability_registry
11. sport_program_profile_registry_5d
12. sport_event_model_registry_5e
13. sport_program_template_registry_5f
14. substitution_registry

This order is candidate planning law only.

It is not active registry law.

It is not deterministic engine runtime law.

## Candidate status

Allowed candidate statuses are:

- candidate_contract_only
- candidate_content_draft
- candidate_fk_ready
- candidate_activation_ready

S-REG-05 itself remains:

- candidate_contract_only
- non_runtime

## Explicit false mutation declarations

The S-REG-05 candidate surface declares:

- active_registry_mutation: false
- active_bundle_mutation: false
- registry_law_mutation: false
- engine_runtime_mutation: false
- high_volume_content_added: false

## FK closure rule

Every registry dependency in depends_on must reference another declared canonical registry ID.

A dependent registry cannot become candidate_activation_ready until every dependency is at least candidate_fk_ready.

Candidate FK readiness is not active registry law.

Candidate FK readiness must not update registry_index.json.

Candidate FK readiness must not update registry_bundle.json.

## Bridge relationship

S-REG-04 remains the only read-only legacy-to-canonical bridge.

S-REG-05 does not widen the S-REG-04 bridge.

S-REG-05 does not add equipment_registry to the S-REG-04 bridge.

S-REG-05 does not claim registry completion.

S-REG-05 does not claim content migration.

## Files added

- ci/registry/s_reg_05_canonical_registry_contract.mjs
- ci/registry/s_reg_05_canonical_registry_contract_manifest.json
- ci/registry/s_reg_05_canonical_registry_dependency_manifest.json
- test/s_reg_05_canonical_registry_contract_candidate_surface.test.mjs
- ci/guards/s_reg_05_canonical_registry_contract_candidate_surface_guard.mjs
- docs/roadmap/S_REG_05_CANONICAL_REGISTRY_CONTRACT_CANDIDATE_SURFACE_PLAN.md

## Non-scope

Do not add full registry content.

Do not activate canonical registries.

Do not migrate compact registry law.

Do not change engine output.

Do not modify launch GO/NO-GO records.

Do not create marketplace, team, organisation, unit, federation, or licensing runtime behaviour.

Do not add template formulas.

Do not add programme progression internals.

Do not expose protected formulas.

## Proof

Required focused proof:

- node --test test/s_reg_05_canonical_registry_contract_candidate_surface.test.mjs
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

- npm.cmd run lint:fast

## Next slice boundary

S-REG-06 may create the first candidate seed records only inside the candidate surface and only if the records remain inert, non_runtime, FK-declared, source-controlled, and outside active registry law.

S-REG-06 must not add high-volume registry content.