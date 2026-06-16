<!-- DEV NOTE: S-V1-33 registry-closure documentation. This document records substitution registry closure proof only. It must not add unsupported activities, active registry rows, UI authority, hidden fallback, or a new substitution-selection algorithm. -->

# S-V1-33 - Substitution Registry Closure

## Status

Accepted as a v1 substitution registry closure slice.

## Purpose

S-V1-33 proves that substitutions have complete registry support for the locked v1 supported activities.

All substitutions resolve through registry law.

No ad hoc substitutions are permitted.

No UI-only substitution authority is permitted.

## Boundary

This slice may add:

- docs/v1/V1_SUBSTITUTION_REGISTRY_CLOSURE.md
- ci/fixtures/v1_substitution_registry_closure/s_v1_33_substitution_registry_closure_cases.json
- ci/fixtures/v1_substitution_registry_closure_negative/s_v1_33_substitution_registry_closure_negative.json
- test/s_v1_33_substitution_registry_closure.test.mjs
- ci/guards/s_v1_33_substitution_registry_closure_guard.mjs
- package.json lint:fast wiring
- generated guard index
- generated failure-token index
- checksum records

This slice must not add:

- unsupported activities
- active registry content rows
- active substitution-selection implementation
- UI substitution authority
- hidden fallback behaviour
- route implementation
- database persistence
- Phase 5 rewrite
- Phase 6 rewrite
- billing
- coach notes
- marketplace behaviour
- release tags
- package version changes

## Locked supported activities

The substitution registry closure fixture is limited to:

- general_strength
- powerlifting
- rugby_union

Any substitution closure row, candidate, edge, or contract case outside those activities must fail.

## Closure rule

A substitution edge is closed only when all of the following resolve:

- edge id exists in the declared substitution edge registry fixture
- source exercise exists in the declared exercise fixture
- target exercise exists in the declared exercise fixture
- source exercise activity matches the substitution edge activity
- target exercise activity matches the substitution edge activity
- movement id exists in the declared movement fixture
- equipment ids exist in the declared equipment fixture
- source exercise has explicit substitution applicability for the activity
- target exercise has explicit substitution applicability for the activity
- the same edge is accepted by the S-V1-32 substitution engine contract

## Registry authority

Substitution authority may come only from registry law and declared substitution edges.

The execution UI may display substitution state later, but the UI must not create substitution authority.

No UI-only substitution authority is permitted.

No ad hoc substitutions are permitted.

No substitution may be selected only because it is present in a UI list, coach note, account field, relationship field, billing field, dashboard field, or client-side state.

## Relationship to S-V1-32

S-V1-32 defines the v1 substitution engine contract.

S-V1-33 proves registry closure around that contract.

S-V1-33 does not rewrite the S-V1-32 contract.

S-V1-33 does not replace the deterministic substitution contract.

S-V1-33 does not add new active registry content.

## Relationship to registry slices

This slice depends on:

- S-V1-21 exercise registry contract
- S-V1-22 equipment registry coverage contract
- S-V1-23 exercise activity applicability coverage
- S-V1-24 registry load order and FK closure
- S-V1-25 registry content production system
- S-V1-26 programme template contract
- S-V1-32 substitution engine contract

## Negative fixture

The negative fixture must prove refusal when:

- an unsupported activity appears
- an edge references a missing source or target exercise
- an edge lacks explicit applicability
- the declared edge is missing from the S-V1-32 input
- the registry edge link is missing from the S-V1-32 input
- UI-only substitution authority appears
- ad hoc substitution data appears
- the supported activity set is widened

## Failure token

Stable guard token:

- CI_V1_SUBSTITUTION_REGISTRY_CLOSURE

## Proof

Executable proof:

- node --test test/s_v1_33_substitution_registry_closure.test.mjs
- node ci/guards/s_v1_33_substitution_registry_closure_guard.mjs
- node ci/guards/s_v1_09_failure_token_closure_guard.mjs
- node ci/guards/s_v1_10_release_boundary_file_closure_guard.mjs
- node ci/scripts/run_failure_token_index_guard.mjs
- node ci/guards/guards_index_guard.mjs
- npm run lint:fast
- npm run test:full

## Final rule

If any substitution can resolve outside declared registry law, outside a declared substitution edge, outside the locked supported activity set, outside exercise/equipment/movement/applicability closure, or from UI-only state, this slice is invalid.
