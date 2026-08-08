# S-REG-23 — Registry Activation HOLD Decision

## Purpose

S-REG-23 records the activation decision after S-REG-22.

The decision is HOLD.

Hold decision only.

## Boundary

S-REG-23 includes:

- Registry activation hold decision record.
- S-REG-22 source review reference.
- Active registry compactness confirmation.
- Activation block reasons.
- Required pre-activation requirements.
- Test and guard proof.
- Documentation.
- Package proof script.
- Generated indexes and checksums through existing generators.

## Non-scope

S-REG-23 must not touch:

- Active registry activation.
- `registries/registry_index.json`.
- `registries/registry_bundle.json`.
- Active registry law.
- Registry seal lifecycle.
- Deterministic engine output.
- Phase 1 runtime schema.
- Runtime metric input.
- Recorded value input.
- Real value comparison.
- Marker evaluator behaviour.
- Programme assignment.
- Substitution runtime.
- UI behaviour.
- Coach interpretation.
- Advice.
- Outcome inference.
- Marketplace, licensing, compliance, facility, organisation, team, unit, federation, tactical runtime, or enterprise analytics.

No active registry activation.

No registry bundle mutation.

No marker evaluator behaviour.

No real comparison.

No advice.

No outcome inference.

## Decision identity

- `slice_id`: `S-REG-23`
- `decision_id`: `registry_activation_hold_decision`
- `decision_type`: `hold`
- `source_review_slice_id`: `S-REG-22`
- `source_review_id`: `candidate_registry_review_and_activation_gate`
- `source_review_status`: `candidate_reviewed_fk_closed_pending_activation_decision`
- `runtime_status`: `non_runtime`
- `activation_decision`: `hold`
- `activation_authorised`: `false`
- `activation_ready`: `false`
- `active_registry_activation`: `false`

## Source review

S-REG-22 closed the candidate registry build review, but it did not authorise active registry activation.

S-REG-22 recorded:

- `activation_decision`: `not_authorised_pending_later_explicit_activation_slice`
- `later_activation_requirement`: `separate_explicit_activation_slice_required`

S-REG-23 accepts that review and records a hold decision.

## Hold reason codes

S-REG-23 holds activation because:

- `activation_contract_not_defined`
- `active_registry_mutation_contract_not_defined`
- `registry_bundle_promotion_plan_not_defined`
- `registry_loader_consumption_contract_not_defined`
- `registry_seal_lifecycle_enforced`
- `runtime_consumption_contract_not_defined`
- `rollback_plan_not_defined`

## Required before activation

A later explicit activation slice must define and prove:

- `explicit_activation_slice`
- `active_registry_mutation_contract`
- `registry_index_update_contract`
- `registry_bundle_promotion_plan`
- `registry_loader_contract`
- `active_registry_schema_plan`
- `fk_closure_replay_against_active_bundle`
- `registry_seal_freeze_and_gate_plan`
- `engine_consumption_boundary_decision`
- `runtime_no_behaviour_change_proof`
- `rollback_or_revert_plan`

## Candidate chain reviewed

The candidate chain remains reviewed but inactive:

- S-REG-15
- S-REG-16
- S-REG-17
- S-REG-18
- S-REG-19
- S-REG-20
- S-REG-21
- S-REG-22

## Active registry surface

The active registry surface remains compact:

- `activity`
- `movement`
- `exercise`
- `program`

S-REG-23 does not add `sport_metric_registry_1c`, `metric_exercise_link_registry_1c_a`, or `threshold_marker_registry` to the active registry surface.

## Proof

Expected proof:

- `node --test test/s_reg_23_registry_activation_hold_decision.test.mjs`
- `node ci/guards/s_reg_23_registry_activation_hold_decision_guard.mjs`
- `npm.cmd run proof:s-reg-23`
- S-REG-22 guard.
- Registry bundle guard.
- Registry law guard.
- Registry schema presence guard.
- Registry seal gate.
- Guards entrypoint coverage guard.
- Failure token index check.
- Guards index guard.
- `npm.cmd run lint:fast`

## Final boundary

S-REG-23 is a hold decision only.

It does not activate canonical registries, create marker evaluator behaviour, compare real values, emit advice, infer outcomes, or alter deterministic engine output.

## Supersession log (append-only)

This decision record is never rewritten once a later slice acts on it. `superseded_by_slice_ids` names every explicitly-authorised activation slice that has since acted on part of this hold, in the order they occurred:

- S-REG-25 (`equipment_registry` activation) - authorised by explicit human decision. Activated the `equipment` domain only. The other 10 hold reasons and 10 remaining candidate domains named in this record remain held.
- S-REG-26 (`sport_subdivision_registry` activation) - authorised by explicit human decision. Activated the `sport_subdivision` domain only, appended after `equipment`. The remaining candidate domains named in this record remain held.
- S-REG-27 (`sport_metric_registry` activation) - authorised by explicit human decision. Activated the `sport_metric` domain only, appended after `sport_subdivision`. `sport_role_registry_2` (same dependency profile) and `metric_exercise_link_registry_1c_a` (now depends on this newly-active domain) remain held.
