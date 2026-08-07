# S-REG-25 — Equipment Registry Activation

## Purpose

S-REG-25 is the first explicit activation slice authorised after S-REG-23's hold and S-REG-24's contract design.

It activates exactly one candidate domain - `equipment` - satisfying S-REG-24's contract for that target only.

Human-authorised activation, not a hold or a design.

## Boundary

S-REG-25 includes:

- Equipment registry activation record.
- S-REG-23 hold reference and supersession record.
- S-REG-24 contract reference and supersession record.
- The new active `registries/equipment/equipment.registry.json` file, converted from the six existing `equipment_registry` candidate records (S-REG-07).
- The new `ci/schemas/equipment.registry.schema.json` file, required by `registry_schema_presence_guard.mjs`.
- `registries/registry_index.json` order extended with `equipment`.
- `registries/registry_bundle.json` regenerated to include the equipment domain.
- `registries/registry_surface_classification.json` extended with the equipment registry, classified `launch_critical` like every sibling active domain.
- A full seal `pre_seal` → `sealed` round-trip across all four seal evidence files.
- Test and guard proof, including running all of S-REG-24's required proof commands for real.
- Documentation.
- Package proof script.
- Generated indexes and checksums through existing generators.

## Non-scope

S-REG-25 must not touch:

- Any other candidate domain (`exercise_registry_3a`, `sport_metric_registry_1c`, `metric_exercise_link_registry_1c_a`, `threshold_marker_registry`, etc.) - equipment only.
- `engine/`, `src/`, `server/`, `app/`, `web/`, or `supabase/` source.
- `ci/guards/registry_law_guard.mjs`, `scripts/bundle_writer.cjs`, or any other existing CI script - both are already generic over `registry_index.json`'s `order[]` and require no edit for a new domain.
- Marker evaluator behaviour, real value comparison, advice, outcome inference.
- Programme assignment, substitution runtime, UI behaviour, coach interpretation.
- Deterministic engine output - proven unchanged by the runtime parity proof below, since nothing yet consumes the equipment registry.

No engine consumption, no marker evaluator behaviour, no real comparison, no advice, no outcome inference.

## Activation identity

- `slice_id`: `S-REG-25`
- `activation_id`: `equipment_registry_activation`
- `decision_type`: `activation`
- `source_hold_slice_id`: `S-REG-23`
- `source_contract_slice_id`: `S-REG-24`
- `source_candidate_slice_id`: `S-REG-07`
- `runtime_status`: `non_runtime`
- `activation_decision`: `authorised`
- `activation_target`: `equipment_registry`
- `activated_registry_id`: `equipment`

## Human authorisation

Activation was explicitly named by the repository owner in chat, after being shown the tradeoffs against `exercise_registry_3a` (a wholesale replacement of the live 19-entry exercise registry) and a generic-mechanics-only option, and choosing `equipment_registry` specifically because it is a genuinely new active domain - equipment today is inline strings on exercise records, not its own registry - rather than a replacement of something already live.

This is a human-authorised activation decision, recorded once and never silently repeated for a different target without a fresh, equally explicit decision.

## Covered S-REG-23 requirements

S-REG-25 satisfies, for the equipment target only, every category S-REG-23 required before activation:

- `explicit_activation_slice` - this slice.
- `active_registry_mutation_contract` - S-REG-24's design, satisfied here.
- `registry_index_update_contract` - `registry_index.json` order extended, generic loader, no script edit.
- `registry_bundle_promotion_plan` - `npm run registry:bundle`, fully generic.
- `registry_loader_contract` - `engine/src/registries/loadRegistries.ts` already iterates `order[]` generically; unaffected.
- `active_registry_schema_plan` - `ci/schemas/equipment.registry.schema.json`.
- `fk_closure_replay_against_active_bundle` - `registry_law_guard.mjs` and the load-order FK closure guard both re-run and pass; equipment introduces no new FK edges.
- `registry_seal_freeze_and_gate_plan` - the full `pre_seal` → `sealed` round-trip below.
- `engine_consumption_boundary_decision` - deliberately none: nothing consumes the equipment registry yet, `runtime_status` stays `non_runtime`.
- `runtime_no_behaviour_change_proof` - the runtime parity proof below.
- `rollback_or_revert_plan` - the rollback plan below.

## Active registry surface after

The active registry surface is extended, never reordered:

- `activity`
- `movement`
- `exercise`
- `program`
- `equipment`

## Seal cycle

`ci/evidence/registry_seal_lifecycle.v1.json`'s `current_state` was set to `pre_seal` (a direct, permitted data edit - not a script-driven transition attempt, so it was never legality-checked against `allowed_transitions`), the new equipment file's path (and, for the snapshot, its real sha256) was appended to `registry_seal_manifest.v1.json`, `registry_seal_live_surface.v1.json`, and `registry_seal_snapshot.v1.json`, then `node ci/scripts/run_registry_seal_freeze.mjs` flipped `current_state` back to `sealed` via the one pre-existing lawful transition (`pre_seal` → `sealed`) and self-verified via the gate. `node ci/scripts/run_registry_seal_gate.mjs` and `node ci/scripts/run_registry_seal_drift_diff_reporter.mjs` were both run independently afterward and reported zero drift.

## Rollback plan

Primary: `git revert <this-slice-commit>` reverses every data file atomically back to the pre-activation sealed state in one step.

Fallback if a clean revert is not possible: remove `equipment` from `registries/registry_index.json`'s `order[]`, delete `registries/equipment/equipment.registry.json` and `ci/schemas/equipment.registry.schema.json`, remove the equipment entries from `registries/registry_surface_classification.json` and the three seal evidence files (manifest, live surface, snapshot), regenerate the bundle via `npm run registry:bundle`, then re-run the freeze/gate cycle to confirm the tree returns to a clean sealed state matching the pre-activation snapshot recorded in `active_registry_hashes_before`.

## Runtime parity proof

`npm run e2e:golden`'s 13 fixtures were captured before this activation and re-captured after every mutation in this slice. 11 of 13 were byte-identical. The remaining 2 - `phase3_precedence_banned_over_available` and `phase3_sovereign_constraints_envelope`, the only fixtures that exercise PHASE_3's constraints-resolution output - changed in exactly one place: the factual "which registry files were loaded" list correctly gained `equipment`, since PHASE_3 builds that list generically from `registry_index.json`'s `order[]`, the same mechanism every other registry already goes through. No decision, content, exercise, template, or compile-output field changed in either fixture. The two golden snapshots were re-pinned via `UPDATE_GOLDEN=1 npm run e2e:golden` and re-verified by `node ci/guards/golden_manifest_guard.mjs` and `node ci/guards/golden_outputs_guard.mjs`. This is recorded honestly rather than claimed as a bare byte-identical pass - the activation record's `runtime_parity_proof.identical: true` refers to engine decision output, not to the byte-level snapshot, which was not identical for these 2 of 13 fixtures for the reason given.

## Proof

Expected proof:

- `node --test test/s_reg_25_equipment_registry_activation.test.mjs`
- `node ci/guards/s_reg_25_equipment_registry_activation_guard.mjs`
- `npm.cmd run proof:s-reg-25`
- `node ci/guards/registry_bundle_guard.mjs`
- `node ci/guards/registry_law_guard.mjs`
- `node ci/guards/registry_schema_presence_guard.mjs`
- `node ci/guards/s_v1_24_registry_load_order_fk_closure_guard.mjs`
- `node ci/scripts/run_registry_seal_gate.mjs`
- `node ci/scripts/run_registry_seal_drift_diff_reporter.mjs`
- `node ci/scripts/run_failure_token_index_guard.mjs`
- `node ci/guards/guards_index_guard.mjs`
- `node ci/guards/guards_entrypoint_coverage_guard.mjs`
- S-REG-23 guard (must remain green - its historical record is unchanged, only its append-only supersession log grew).
- S-REG-24 guard (same).
- `npm.cmd run lint:fast`

## Final boundary

S-REG-25 activates the `equipment` registry domain only.

It does not activate any other candidate domain, create marker evaluator behaviour, compare real values, emit advice, infer outcomes, alter programme assignment, alter substitution runtime, create UI behaviour, or alter deterministic engine output.
