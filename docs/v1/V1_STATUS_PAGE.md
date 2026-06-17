# S-V1-O-01 Status Page

## Purpose

S-V1-O-01 implements a factual public status surface for controlled launch.

The status page renders service-state facts and an uptime indicator from explicit input.

## Boundary

Included:

- status route view model.
- factual service-state field.
- uptime indicator.
- component-state rows.
- incident rows.
- API adapter.
- factual copy IDs.
- tests and CI guard.

Not included:

- deterministic engine behaviour.
- training flow behaviour.
- declaration truth changes.
- user safety claims.
- user readiness claims.
- training effectiveness claims.
- service readiness claims.
- service reliability guarantees.
- provider calls.
- external monitoring calls.

## Invariants

- Status page reports service state only.
- No claims about user safety, readiness, or training effectiveness.
- No engine mutation.
- Status data does not change compile output.
- Status data does not change training flow.
- Status data does not change declaration truth.

## Service states

Supported service states:

- nominal.
- degraded.
- maintenance.
- interruption.
- unknown.

## Uptime indicator

The uptime indicator is a factual service-state summary.

It may include:

- observed window in minutes.
- service state.
- component count.
- component-state counts.
- open incident count.

It must not claim product readiness, user safety, training value, or reliability guarantee.

## Engine boundary

The implementation does not import engine code.

The deterministic probe is hashed only to prove pass-through invariance.

The surface returns:

- service_state_only: true.
- engine_visible: false.
- engine_truth_changed: false.
- compile_output_changed: false.
- training_flow_changed: false.
- declaration_truth_changed: false.
- user_safety_claim: false.
- user_readiness_claim: false.
- training_effectiveness_claim: false.
- service_readiness_claim: false.
- service_reliability_guarantee: false.

## UI/API boundary

GET renders the public status view model.

No request mutates deterministic engine truth, training flow, declaration truth, or Phase 1 declaration records.

## CI token

- CI_V1_STATUS_PAGE

## Standard proof sequence

Target proof:

- node --test test/s_v1_o_01_status_page.test.mjs
- node ci/guards/s_v1_o_01_status_page_guard.mjs

Generated-file proof:

- node ci/scripts/run_failure_token_index_guard.mjs
- node ci/guards/guards_index_guard.mjs
- node ci/scripts/sha256_guard.mjs

Full proof:

- GitHub PR checks run lint:fast and full suites.