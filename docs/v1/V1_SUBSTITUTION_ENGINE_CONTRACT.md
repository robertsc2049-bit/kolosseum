<!-- DEV NOTE: S-V1-32 substitution engine contract boundary. This document records deterministic substitution contract requirements and registry-link closure. It must not add recommendations, optimisation, safety claims, UI implementation, route implementation, persistence, registry content rows, or engine phase rewrites. -->

# S-V1-32 - Substitution Engine v1 Contract

## Status

Accepted as a v1 substitution contract slice.

## Purpose

S-V1-32 implements and hardens the v1 substitution engine contract.

Substitution is deterministic.

No undeclared fallback is allowed.

Missing registry links fail closed.

Substitution explains factual reason codes only.

## Boundary

This slice may add:

- docs/v1/V1_SUBSTITUTION_ENGINE_CONTRACT.md
- src/v1SubstitutionEngineContract.mjs
- ci/fixtures/v1_substitution_engine_contract/s_v1_32_substitution_cases.json
- ci/fixtures/v1_substitution_engine_contract_negative/s_v1_32_substitution_negative.json
- ci/fixtures/v1_substitution_engine_contract_reason_codes/s_v1_32_substitution_reason_codes.json
- test/s_v1_32_substitution_engine_contract.test.mjs
- ci/guards/s_v1_32_substitution_engine_contract_guard.mjs
- package.json lint:fast wiring
- generated guard index
- generated failure-token index
- checksum records

This slice may reference:

- S-V1-21 exercise registry contract
- S-V1-22 equipment registry coverage contract
- S-V1-23 exercise activity applicability coverage
- S-V1-24 registry load order and FK closure
- S-V1-30 compile input canonicalisation
- S-V1-31 compile output contract

This slice must not add:

- recommendations
- optimisation
- optimization
- safety claims
- medical claims
- readiness claims
- risk claims
- ranking
- scoring
- best or better labels
- hidden fallback
- undeclared candidate selection
- UI implementation
- route implementation
- database persistence
- registry content rows
- engine phase rewrites
- live session state mutation
- billing
- coach notes
- release tags
- package version changes

## Contract input

A v1 substitution input candidate must be closed-world and contain only:

- activity_id
- target_exercise_id
- unavailable_equipment_ids
- registry_links
- candidate_exercises
- substitution_edges

Unknown root fields fail closed.

Unknown nested fields fail closed.

Forbidden advisory, scoring, ranking, optimisation, recommendation, safety, medical, readiness, or risk fields fail closed.

## Registry links

The contract requires explicit registry links for:

- activity_ids
- exercise_ids
- equipment_ids
- movement_ids
- substitution_edge_ids
- applicability_records

Every candidate exercise must link to declared exercise, activity, movement, equipment, and substitution applicability records.

Every substitution edge must link to declared source exercise, target exercise, activity, and edge id records.

Missing registry links fail closed.

## No undeclared fallback

The contract never selects an arbitrary candidate.

The contract never selects the first available exercise unless there is an explicit substitution edge linking the source exercise to that target exercise.

If source exercise equipment is unavailable and no declared candidate can be applied, the contract fails closed.

The expected failure reason is:

- v1_substitution_declared_candidate_missing

## Determinism

Determinism is enforced by:

- exact closed input keys
- sorted unique string arrays
- deterministic edge ordering
- deterministic candidate ordering
- stable canonical JSON
- SHA256 hash metadata
- closed factual reason codes

Equivalent input object key orderings must produce identical canonical JSON and identical canonical hash.

## Factual reason codes

The allowed factual reason codes are:

- source_equipment_unavailable
- source_equipment_available
- declared_edge_matched
- candidate_equipment_available
- activity_link_verified
- registry_links_verified
- no_substitution_required

Reason codes must describe recorded contract facts only.

Reason codes must not recommend, optimise, rank, score, infer readiness, infer safety, infer risk, diagnose, or claim suitability.

## Output

The substitution output contains:

- activity_id
- candidate_count
- contract_version
- reason_codes
- registry_trace
- source_exercise_id
- substitution_edge_id
- substitution_status
- target_exercise_id
- unavailable_equipment_ids

Allowed statuses are:

- substitution_applied
- substitution_not_required
- substitution_refused

## Relationship to existing engine phases

This slice does not rewrite Phase 5.

This slice does not rewrite Phase 6.

This slice does not mutate /blocks/compile.

This slice defines the v1 substitution contract that future compile and execution surfaces must obey.

Existing engine substitution behaviour remains outside this slice unless explicitly wired by a later slice.

## Failure token

Stable guard token:

- CI_V1_SUBSTITUTION_ENGINE_CONTRACT

Stable failure code:

- v1_substitution_engine_contract_failure

Stable copy id:

- V1_SUBSTITUTION_ENGINE_CONTRACT_REJECTED

## Proof

Executable proof:

- node --test test/s_v1_32_substitution_engine_contract.test.mjs
- node ci/guards/s_v1_32_substitution_engine_contract_guard.mjs
- node ci/guards/s_v1_09_failure_token_closure_guard.mjs
- node ci/guards/s_v1_10_release_boundary_file_closure_guard.mjs
- node ci/scripts/run_failure_token_index_guard.mjs
- node ci/guards/guards_index_guard.mjs
- npm run lint:fast
- npm run test:full

## Final rule

If substitution output can be changed by undeclared fallback, missing registry links, hidden candidate ordering, recommendation language, optimisation language, safety language, medical language, readiness language, risk language, scoring, ranking, coach notes, billing, UI state, copy, relationship state, auth state, account state, marketplace state, commercial state, coach identity, or athlete identity, this slice is invalid.
