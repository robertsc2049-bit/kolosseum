<!-- DEV NOTE: S-V1-31 compile output contract boundary. This document records the shape consumed by execution UI and history surfaces. It must not add UI implementation, routes, persistence, billing, coach notes, proof implementation, or engine phase mutation. -->

# S-V1-31 - Compile Output Contract

## Status

Accepted as a v1 compile-output contract slice.

## Purpose

S-V1-31 defines the v1 compile output contract consumed by execution UI and history.

Output is deterministic.

Output contains only permitted factual fields.

Output does not include advisory, judgement, scoring, ranking, safety, readiness, medical, outcome-quality, or claim fields.

## Boundary

This slice may add:

- docs/v1/V1_COMPILE_OUTPUT_CONTRACT.md
- src/v1CompileOutputContract.mjs
- ci/fixtures/v1_compile_output_contract/s_v1_31_compile_output_cases.json
- ci/fixtures/v1_compile_output_contract_negative/s_v1_31_forbidden_output_negative.json
- ci/fixtures/v1_compile_output_contract_golden/s_v1_31_compile_output_golden.json
- test/s_v1_31_compile_output_contract.test.mjs
- ci/guards/s_v1_31_compile_output_contract_guard.mjs
- package.json lint:fast wiring
- generated guard index
- generated failure-token index
- checksum records

This slice may reference:

- S-V1-18 declaration compile gate
- S-V1-30 v1 compile input canonicalisation
- Phase 6 planned_items output
- docs/roadmap/V1_ENGINE_UI_AUTH_BOUNDARY.md
- docs/roadmap/ACTIVE_RELEASE_BOUNDARY.md

This slice must not add:

- UI implementation
- route implementation
- database persistence
- billing
- payment
- coach notes
- copy as engine output
- live session state mutation
- history storage
- dashboard implementation
- proof implementation
- registry content
- real /blocks/compile mutation
- engine phase rewrite
- release tags
- package version changes

No UI implementation is added by this slice.

## Compile output rule

A v1 compile output candidate must be a closed object.

The accepted root keys are:

- activity_id
- compile_input_hash
- compile_input_version
- engine_version
- planned_session
- runtime_trace

Unknown root fields fail closed.

Unknown nested fields fail closed.

Forbidden advisory or claim fields fail closed.

## Canonical output fields

The canonical compile output contains:

- activity_id
- compile_input_hash
- compile_input_version
- compile_output_status
- compile_output_version
- engine_version
- execution_ui_contract
- factual_only
- history_projection
- planned_session
- runtime_trace

These fields are intended as contract shape only.

They do not create UI rendering, persistence, proof sealing, live session status, or history storage.

## Execution UI contract

The execution UI contract contains:

- activity_id
- planned_item_count
- session_id
- session_status
- work_items

Each work item contains:

- display_order
- exercise_id
- item_id
- load
- reps
- rest_seconds
- sets
- status
- work_item_id

The only initial work item status emitted by this contract is:

- not_started

## History projection

The history projection contains:

- activity_id
- compile_input_hash
- compile_output_hash
- planned_item_count
- session_id
- session_status

History projection is a factual reference shape.

It does not store history.

It does not interpret completion.

It does not infer cause.

It does not alter engine truth.

## Forbidden fields

The output contract rejects fields such as:

- advice
- advisory
- athlete_risk
- automatic_coaching_decision
- billing
- coach_notes
- diagnosis
- effectiveness
- fatigue
- fatigue_score
- injury_risk
- intervention
- medical_clearance
- optimisation
- optimization
- optimal
- payment
- programme_failed
- programme_worked
- rank
- ranking
- readiness
- readiness_score
- recommendation
- recommendation_score
- recommended_action
- risk
- risk_score
- safety
- score
- suitability

These fields may not appear at any depth inside the compile output candidate.

## Determinism rule

Equivalent object key orderings must produce:

- identical canonical_json
- identical canonical_hash

The canonical output uses:

- stable sorted object keys
- UTF-8 string hashing
- SHA256
- explicit closed fields only

Unsupported values fail closed.

Non-finite numbers fail closed.

## Golden output check

S-V1-31 includes a golden output fixture.

The golden fixture pins the public shape for:

- surface id
- contract version
- compile output status
- hash metadata
- canonical output identity fields
- execution UI count
- history count
- runtime trace

The golden check does not pin volatile implementation internals.

## Relationship to S-V1-30

S-V1-30 defines canonical compile input.

S-V1-31 consumes a compile_input_hash and compile_input_version.

S-V1-31 does not rebuild compile input.

S-V1-31 does not widen compile input authority.

## Failure token

Stable guard token:

- CI_V1_COMPILE_OUTPUT_CONTRACT

Stable failure code:

- v1_compile_output_contract_failure

Stable copy id:

- V1_COMPILE_OUTPUT_CONTRACT_REJECTED

## Proof

Executable proof:

- node --test test/s_v1_31_compile_output_contract.test.mjs
- node ci/guards/s_v1_31_compile_output_contract_guard.mjs
- node ci/guards/s_v1_09_failure_token_closure_guard.mjs
- node ci/guards/s_v1_10_release_boundary_file_closure_guard.mjs
- node ci/scripts/run_failure_token_index_guard.mjs
- node ci/guards/guards_index_guard.mjs
- npm run lint:fast
- npm run test:full

## Final rule

If two semantically identical v1 compile output candidates differ only by object key order, they must produce the same canonical JSON and hash.

If advisory fields, judgement fields, score fields, ranking fields, safety fields, readiness fields, medical fields, claim fields, billing fields, coach notes, UI state, copy, relationship state, auth state, account state, marketplace state, commercial state, coach identity, or athlete identity can alter canonical compile output or hash, this slice is invalid.
