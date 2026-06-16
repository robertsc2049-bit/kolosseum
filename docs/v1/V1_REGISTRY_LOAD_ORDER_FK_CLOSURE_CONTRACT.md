<!-- DEV NOTE: Developer documentation surface. This document records the S-V1-24 registry load order and FK closure contract and points to executable proof. Canonical registry law remains in the active registry guards, registry bundle, registry index, and registry law documents. Keep this file aligned with the matching guard, test, and fixture. -->

# S-V1-24 - Registry Load Order and FK Closure

## Status

Accepted as a v1 registry hardening slice.

## Purpose

S-V1-24 hardens the registry load order and foreign-key closure boundary before further v1 registry content production.

The slice verifies that active registry loading is deterministic, bundle output follows registry_index order, and known registry references fail closed when missing or unknown.

No active registry content is added by this slice.

## Boundary

This slice may add or update:

- docs/v1/V1_REGISTRY_LOAD_ORDER_FK_CLOSURE_CONTRACT.md
- ci/fixtures/v1_registry_load_order_fk_closure_negative/s_v1_24_unknown_movement_fk_negative.json
- test/s_v1_24_registry_load_order_fk_closure.test.mjs
- ci/guards/s_v1_24_registry_load_order_fk_closure_guard.mjs
- package.json lint:fast wiring
- generated guard index
- generated failure-token index
- checksum records

This slice may inspect and bind to existing registry loader and guard surfaces:

- engine/src/registries/loadRegistries.ts
- ci/guards/registry_schema_presence_guard.mjs
- ci/guards/registry_bundle_guard.mjs
- ci/guards/registry_law_guard.mjs

This slice must not add:

- active registry content
- activity registry rows
- movement registry rows
- exercise registry rows
- equipment registry rows
- applicability registry rows
- substitution edges
- programme templates
- UI screens
- database migrations
- billing behaviour
- organisation, team, gym, unit, federation, marketplace, messaging, chat, EPOS, or gym access surfaces
- engine behaviour changes
- package version changes
- release tags

## Invariants

Load order is deterministic.

FK closure is enforced.

Missing/unknown references fail closed.

Registry bundle key order must match registry_index.order exactly.

Registry dependency order must be respected when both registries are present.

## Dependency order constraints

The S-V1-24 guard enforces dependency order when both upstream and downstream registries exist.

Known dependency pairs include:

- activity before movement
- movement before exercise
- activity before exercise
- exercise before program
- activity before program
- activity before equipment
- movement before equipment
- exercise before exercise_activity_applicability
- activity before exercise_activity_applicability
- exercise before exercise_equipment_compatibility
- equipment before exercise_equipment_compatibility
- exercise before substitution_edge
- exercise_activity_applicability before substitution_edge
- exercise before programme_template
- equipment before programme_template
- substitution_edge before programme_template

## FK closure scope

The S-V1-24 hardening guard checks explicit known FK fields when the relevant registries are present.

Exercise records:

- movement_pattern_id
- movement_id
- movement_family_id
- activity_id
- primary_activity_applicability
- secondary_activity_applicability
- activity_applicability
- equipment_requirements
- equipment_alternatives

Exercise activity applicability records:

- exercise_id
- activity_id

Exercise equipment compatibility records:

- exercise_id
- equipment_ids
- equipment_requirements
- equipment_alternatives

Substitution edge records:

- source_exercise_id
- target_exercise_id

Programme template or program records:

- activity_id
- exercise_id
- exercise_ids
- exercise_eligibility

Unknown references fail closed.

## Existing registry proof surfaces

S-V1-24 preserves the existing active registry proof surfaces.

Required registry guards:

- registry_schema_presence_guard
- registry_bundle_guard
- registry_law_guard

Required existing source anchors:

- engine/src/registries/loadRegistries.ts must retain registry index order loading
- registry_bundle_guard must retain generated bundle comparison
- registry_law_guard must retain active registry FK checks

## Negative FK fixture

The negative FK fixture is:

- ci/fixtures/v1_registry_load_order_fk_closure_negative/s_v1_24_unknown_movement_fk_negative.json

The fixture intentionally declares:

- activity: powerlifting
- movement: squat
- exercise: fixture_unknown_movement_exercise

The exercise intentionally references:

- movement_pattern_id: unregistered_movement_pattern

The expected failure code is:

- v1_registry_load_order_fk_closure_unknown_movement_reference

## Required proof

The required proof is:

- node --test test/s_v1_24_registry_load_order_fk_closure.test.mjs
- node ci/guards/s_v1_24_registry_load_order_fk_closure_guard.mjs
- node ci/guards/registry_schema_presence_guard.mjs
- node ci/guards/registry_bundle_guard.mjs
- node ci/guards/registry_law_guard.mjs
- node ci/guards/s_v1_09_failure_token_closure_guard.mjs
- node ci/guards/s_v1_10_release_boundary_file_closure_guard.mjs
- node ci/scripts/run_failure_token_index_guard.mjs
- node ci/guards/guards_index_guard.mjs
- node ci/guards/no_bom_guard.mjs
- node ci/guards/no_crlf_guard.mjs
- node ci/guards/no_mojibake_guard.mjs
- node ci/guards/ascii_only_ci_guards_guard.mjs
- npm.cmd run lint:fast

## Acceptance criteria

S-V1-24 is accepted when:

- the v1 doc exists
- the negative FK fixture exists
- the test exists and passes
- the guard exists and passes
- the guard emits CI_V1_REGISTRY_LOAD_ORDER_FK_CLOSURE
- the failure-token index includes CI_V1_REGISTRY_LOAD_ORDER_FK_CLOSURE
- package.json invokes the test and guard through lint:fast
- docs/GUARDS_INDEX.md is regenerated through the guard index generator
- docs/dev/FAILURE_TOKEN_INDEX.md is regenerated through the failure-token index generator
- docs/checksums.sha256 is regenerated through the checksum writer
- registry_schema_presence_guard passes
- registry_bundle_guard passes
- registry_law_guard passes
- active registry bundle order matches registry_index.order
- dependency order violations fail closed
- missing or unknown movement references fail closed
- missing or unknown activity references fail closed
- missing or unknown exercise references fail closed when checked fields are present
- missing or unknown equipment references fail closed when equipment registry is present
- no active registry content is added
- no package version is changed
- no release tag is created
