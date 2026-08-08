# S-REG-24 — Registry Activation Contract Design

## Purpose

S-REG-24 defines the contract a later explicit activation slice must satisfy.

S-REG-24 follows S-REG-23, where the activation decision was HOLD.

Contract design only.

## Boundary

S-REG-24 includes:

- Registry activation contract design record.
- S-REG-23 source hold reference.
- Active registry compactness confirmation.
- Future active registry mutation checklist.
- Future registry index update contract.
- Future registry bundle promotion plan.
- Future registry loader contract.
- Future active registry schema plan.
- Future FK closure replay requirements.
- Future registry seal freeze and gate requirements.
- Future engine consumption boundary decision requirements.
- Future runtime no-behaviour-change proof requirements.
- Future rollback or revert requirements.
- Test and guard proof.
- Documentation.
- Package proof script.
- Generated indexes and checksums through existing generators.

## Non-scope

S-REG-24 must not touch:

- Active registry activation.
- `registries/registry_index.json`.
- `registries/registry_bundle.json`.
- Active registry law.
- Registry seal evidence.
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

No registry index mutation.

No registry bundle mutation.

No marker evaluator behaviour.

No real comparison.

No advice.

No outcome inference.

## Contract identity

- `slice_id`: `S-REG-24`
- `contract_id`: `registry_activation_contract_design`
- `contract_type`: `design_only`
- `source_hold_slice_id`: `S-REG-23`
- `source_hold_decision_id`: `registry_activation_hold_decision`
- `source_hold_decision`: `hold`
- `runtime_status`: `non_runtime`
- `contract_design_status`: `defined_for_future_explicit_activation_slice_only`

## Current decision

S-REG-24 does not authorise activation.

Current flags remain:

- `activation_authorised`: `false`
- `activation_ready`: `false`
- `active_registry_activation`: `false`
- `active_registry_mutation`: `false`
- `active_bundle_mutation`: `false`
- `registry_law_mutation`: `false`
- `registry_index_mutation`: `false`
- `registry_bundle_mutation`: `false`
- `registry_seal_mutation`: `false`
- `engine_runtime_mutation`: `false`
- `phase1_runtime_schema_mutation`: `false`
- `marker_evaluator_mutation`: `false`
- `comparison_result_mutation`: `false`
- `recorded_value_input_mutation`: `false`
- `advice_mutation`: `false`
- `outcome_inference_mutation`: `false`
- `programme_assignment_mutation`: `false`
- `substitution_runtime_mutation`: `false`
- `ui_behaviour_mutation`: `false`
- `coach_interpretation_mutation`: `false`

## Covered S-REG-23 requirements

S-REG-24 defines the contract categories requested by S-REG-23:

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

## Future activation contract

A future activation slice must prove:

- Separate explicit activation slice exists.
- Human-authorised activation decision exists.
- Main is clean after S-REG-24.
- No open PR collision exists.
- Registry seal state is accounted for.
- Candidate chain replay is complete.
- Active registry hashes are recorded before and after.
- Rollback packet exists before merge.
- Runtime output parity proof exists.

## Future allowed activation mutations

A future activation slice may only mutate these categories if the slice explicitly proves them:

- `registries/registry_index.json`
- `registries/registry_bundle.json`
- `registries/<registry_id>/<registry_id>.registry.json`
- `ci/evidence/registry_seal_manifest.v1.json`
- `ci/evidence/registry_seal_live_surface.v1.json`
- `ci/evidence/registry_seal.v1.json`
- `ci/evidence/registry_seal_snapshot.v1.json`
- `ci/evidence/registry_seal_lifecycle.v1.json`
- Future activation slice docs.
- Future activation slice tests.
- Future activation slice guard.
- `package.json`
- Generated indexes and checksums.

S-REG-24 itself mutates none of those active or seal files.

## Future forbidden activation shortcuts

A future slice must not:

- Activate without a separate slice.
- Mutate registry index without bundle regeneration.
- Mutate registry bundle without registry source files.
- Mutate registry files without schema plan.
- Consume candidate records directly at runtime.
- Add marker evaluator runtime.
- Compare recorded values.
- Emit advice or outcome inference.
- Alter programme assignment.
- Alter substitution runtime.
- Expose candidate records in UI.
- Skip registry seal gate.
- Skip rollback or revert plan.

## Future load-order edges

A future activation slice must define and prove registry order using explicit edges including:

- `activity` before `exercise`.
- `movement` before `exercise`.
- `equipment` before `exercise_equipment_compatibility`.
- `exercise` before `exercise_equipment_compatibility`.
- `activity` before `exercise_activity_applicability`.
- `exercise` before `exercise_activity_applicability`.
- `sport_metric` before `metric_exercise_link`.
- `exercise` before `metric_exercise_link`.
- `sport_metric` before `threshold_marker`.
- `metric_exercise_link` before `threshold_marker`.

## Future proof commands

A future activation slice must run at minimum:

- `node ci/guards/registry_bundle_guard.mjs`
- `node ci/guards/registry_law_guard.mjs`
- `node ci/guards/registry_schema_presence_guard.mjs`
- `node ci/guards/s_v1_24_registry_load_order_fk_closure_guard.mjs`
- `node ci/scripts/run_registry_seal_gate.mjs`
- `node ci/scripts/run_failure_token_index_guard.mjs`
- `node ci/guards/guards_index_guard.mjs`
- `node ci/guards/guards_entrypoint_coverage_guard.mjs`
- `npm.cmd run lint:fast`

## Next valid categories

After S-REG-24, valid next categories are:

- Activation candidate schema design.
- Activation loader contract review.
- Activation dry-run plan.
- Candidate content expansion.

## Final boundary

S-REG-24 is contract design only.

It does not activate canonical registries, create marker evaluator behaviour, compare real values, emit advice, infer outcomes, or alter deterministic engine output.

## Exact guard markers

- Required exact contract marker: separate explicit activation slice.

## Supersession log (append-only)

This contract record is never rewritten once a later slice acts on it. `superseded_by_slice_ids` names every explicitly-authorised activation slice that has since satisfied this contract for a specific target, in the order they occurred:

- S-REG-25 (`equipment_registry` activation) - satisfied this contract's requirements for the `equipment` domain only: a separate explicit slice, a human-authorised decision, active registry hashes recorded before/after, a rollback packet, and a runtime output parity proof. `ci/schemas/<registry_id>.registry.schema.json` was also created as a necessary companion to the new registry file, required by `registry_schema_presence_guard.mjs` (one of this contract's own required proof commands) though not itself named in "Future allowed activation mutations" above - a gap in this design's literal enumeration, not a forbidden shortcut.
- S-REG-26 (`sport_subdivision_registry` activation) - satisfied this contract's requirements for the `sport_subdivision` domain only, the same way S-REG-25 did for `equipment`. Unlike equipment, no separate stricter launch-readiness contract blocked this target - confirmed by an explicit, independent grep sweep of every guard file before starting.
- S-REG-27 (`sport_metric_registry` activation) - satisfied this contract's requirements for the `sport_metric` domain only, the same way S-REG-25/26 did for their targets. Both of this target's former dependencies (the legacy-aliased `activity` domain and the now-active `sport_subdivision` domain) were confirmed resolved before starting, and the same independent guard-file sweep found no hidden launch-readiness contract blocking it.
- S-REG-28 (`sport_role_registry` activation) - satisfied this contract's requirements for the `sport_role` domain only, the same way S-REG-25/26/27 did for their targets. Both of this target's dependencies (the legacy-aliased `activity` domain and the now-active `sport_subdivision` domain) were confirmed resolved before starting, and the same independent guard-file sweep found no hidden launch-readiness contract blocking it.
