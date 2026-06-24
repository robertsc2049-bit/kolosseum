<!-- DEV NOTE: S-REG-07 candidate equipment planning surface. This document records inert equipment candidate seed records only. It does not create active canonical registry files, alter active registry law, add active bundle content, alter S-REG-06 exercise candidates, or alter deterministic engine runtime behaviour. -->

# S-REG-07 - Canonical Equipment Candidate Seeds

## Status

Implemented as candidate seed records only.

## Purpose

S-REG-07 creates the first small canonical candidate seed set for:

- equipment_registry

The file lives only under the S-REG-05 candidate surface:

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

S-REG-07 does not modify those active files.

## Candidate file

S-REG-07 adds:

- ci/registry/candidates/equipment_registry/equipment_registry.candidate.registry.json

The candidate file declares:

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

S-REG-07 is deliberately small:

- equipment_registry: 6 records

This is not complete equipment coverage.

This is not canonical registry activation.

## FK rule

The candidate equipment seed FK chain is:

1. equipment_registry records reference activity_registry_1 records through activity_applicability.
2. equipment_registry records reference movement_registry_3 records through movement_pattern_applicability.

S-REG-07 reads the S-REG-06 candidate activity and movement files for FK validation.

S-REG-07 does not update S-REG-06 exercise candidate equipment_ids.

S-REG-07 keeps S-REG-06 exercise records at:

- equipment_ids: []
- equipment_dependency_status: deferred_to_s_reg_07
- activation_ready: false

## Files added

- ci/registry/candidates/equipment_registry/equipment_registry.candidate.registry.json
- ci/registry/s_reg_07_equipment_candidate_seed_records.mjs
- ci/registry/s_reg_07_equipment_candidate_seed_manifest.json
- test/s_reg_07_canonical_equipment_candidate_seeds.test.mjs
- ci/guards/s_reg_07_canonical_equipment_candidate_seeds_guard.mjs
- docs/roadmap/S_REG_07_CANONICAL_EQUIPMENT_CANDIDATE_SEEDS.md

## Non-scope

Do not activate canonical registries.

Do not migrate compact registry law.

Do not add complete equipment coverage.

Do not update active exercise records.

Do not update S-REG-06 exercise candidate equipment_ids.

Do not add programme template content.

Do not add substitution content.

Do not change engine output.

Do not modify launch GO or NO-GO records.

Do not create marketplace, team, organisation, unit, federation, licensing, or runtime behaviour.

## Proof

Required focused proof:

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

S-REG-08 may update the exercise candidate records under:

- ci/registry/candidates/exercise_registry_3a/exercise_registry_3a.candidate.registry.json

S-REG-08 should connect S-REG-06 exercise candidates to S-REG-07 equipment candidates and prove exercise-equipment FK closure.

S-REG-08 dependency marker: exercise_equipment_fk_closure.

S-REG-08 must still keep canonical registries outside active registry law.