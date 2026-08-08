# S-REG-27 — Sport Metric Registry Activation

## Purpose

S-REG-27 is the third explicit activation slice authorised after S-REG-23's hold and S-REG-24's contract design (S-REG-25 activated `equipment`, S-REG-26 activated `sport_subdivision` first).

It activates exactly one candidate domain - `sport_metric` - satisfying S-REG-24's contract for that target only.

Human-authorised activation, not a hold or a design.

Unlike equipment, no separate, pre-existing, stricter launch-readiness contract (in the style of S-V1-22 or S-V1-23) blocks this target. This was confirmed by an independent grep sweep of every guard file for `sport_metric`/`existsSync` patterns before this slice began. This slice's scope is therefore the plain 6-record activation only.

## Boundary

S-REG-27 includes:

- Sport metric registry activation record.
- S-REG-23 hold reference and supersession record.
- S-REG-24 contract reference and supersession record.
- The active `registries/sport_metric/sport_metric.registry.json` file - all 6 entries, sourced from the candidate content produced by S-REG-11 (`ci/registry/candidates/sport_metric_registry_1c/sport_metric_registry_1c.candidate.registry.json`), converted to active shape by dropping candidate-only bookkeeping fields (`context_scope`, `source_slice_id`, `candidate_status`, `runtime_status`, `activation_ready`).
- The `ci/schemas/sport_metric.registry.schema.json` file, required by `registry_schema_presence_guard.mjs`.
- `registries/registry_index.json` order extended with `sport_metric`, appended after `sport_subdivision`.
- `registries/registry_bundle.json` regenerated to include the sport_metric domain.
- `registries/registry_surface_classification.json` extended with the sport_metric registry, classified `launch_critical` like every sibling active domain.
- A full seal `pre_seal` → `sealed` round-trip across all four seal evidence files, re-pinning the sport_metric registry hash.
- Test and guard proof, including running all of S-REG-24's required proof commands for real.
- A fix to `test/s_reg_25_equipment_registry_activation.test.mjs` and `test/s_reg_26_sport_subdivision_registry_activation.test.mjs`, both of which hardcoded exact-match live-registry-order checks and a permanent "sport_metric was not activated" `existsSync(false)` assertion that broke the moment this slice's activation made that assertion false. Relaxed to prefix-match / removed the stale check, per each file's own appended supersession note.
- Documentation.
- Package proof script.
- Generated indexes and checksums through existing generators.

## Non-scope

S-REG-27 must not touch:

- Any other candidate domain - `sport_metric` only. `sport_role_registry_2` has the identical dependency profile (both `activity` and `sport_subdivision` resolved, no hidden blocker) but is deliberately left inactive, mirroring how S-REG-25 left `sport_metric_registry_1c` alone and S-REG-26 left `sport_role_registry_2` alone. `metric_exercise_link_registry_1c_a` now depends on this newly-active domain and stays held for a future slice.
- `engine/`, `src/`, `server/`, `app/`, `web/`, or `supabase/` source.
- `shared/v1-registry/v1RegistryDomainScaffold.mjs`'s frozen exact-membership domain list - unrelated to this activation, does not include `sport_metric`.
- `ci/guards/registry_law_guard.mjs`, `scripts/bundle_writer.cjs`, `ci/guards/s_v1_24_registry_load_order_fk_closure_guard.mjs`, or any other existing CI script not named in this slice's boundary above - all are already generic over `registry_index.json`'s `order[]` and require no edit for a new domain. `s_v1_24`'s FK-closure guard has a hardcoded, closed `registryDependencyEdges` list that does not mention `sport_metric` or `sport_subdivision`, so it no-ops harmlessly for this domain (the same treatment `sport_subdivision` itself received). `sport_metric`'s `activity_id`/`sport_subdivision_id` fields are carried as factual references without independent cross-registry FK verification by any generic mechanism, matching how `sport_subdivision`'s own `activity_id` field was handled.
- Marker evaluator behaviour, real value comparison, advice, outcome inference.
- Programme assignment, substitution runtime, UI behaviour, coach interpretation.
- Deterministic engine output - proven unchanged by the runtime parity proof below, since nothing yet consumes the sport_metric registry.

No engine consumption, no marker evaluator behaviour, no real comparison, no advice, no outcome inference.

## Activation identity

- `slice_id`: `S-REG-27`
- `activation_id`: `sport_metric_registry_activation`
- `decision_type`: `activation`
- `source_hold_slice_id`: `S-REG-23`
- `source_contract_slice_id`: `S-REG-24`
- `source_candidate_slice_id`: `S-REG-11`
- `runtime_status`: `non_runtime`
- `activation_decision`: `authorised`
- `activation_target`: `sport_metric_registry`
- `activated_registry_id`: `sport_metric`

## Human authorisation

Activation was explicitly named by the repository owner in chat, after being shown a comparison of the remaining candidate registries (`sport_metric_registry_1c`, `sport_role_registry_2`, `exercise_token_registry_3b`) covering dependency resolution, hidden launch-readiness blockers, and downstream unlock value. `sport_metric_registry_1c` was chosen specifically because both of its former dependencies - the legacy-aliased `activity` domain and the now-active `sport_subdivision` domain - are resolved, no hidden blocker exists, and it is the root of a chain: `metric_exercise_link_registry_1c_a` depends on it and remains held for a future slice, whereas `sport_role_registry_2` is a safe but leaf-only alternative.

This is a human-authorised activation decision, recorded once and never silently repeated for a different target without a fresh, equally explicit decision.

## Covered S-REG-23 requirements

S-REG-27 satisfies, for the sport_metric target only, every category S-REG-23 required before activation:

- `explicit_activation_slice` - this slice.
- `active_registry_mutation_contract` - S-REG-24's design, satisfied here.
- `registry_index_update_contract` - `registry_index.json` order extended, generic loader, no script edit.
- `registry_bundle_promotion_plan` - `npm run registry:bundle`, fully generic.
- `registry_loader_contract` - `engine/src/registries/loadRegistries.ts` already iterates `order[]` generically; unaffected.
- `active_registry_schema_plan` - `ci/schemas/sport_metric.registry.schema.json`.
- `fk_closure_replay_against_active_bundle` - `registry_law_guard.mjs` re-runs and passes; `s_v1_24_registry_load_order_fk_closure_guard.mjs` no-ops harmlessly since `sport_metric` is not in its hardcoded edge list.
- `registry_seal_freeze_and_gate_plan` - the full `pre_seal` → `sealed` round-trip below.
- `engine_consumption_boundary_decision` - deliberately none: nothing consumes the sport_metric registry yet, `runtime_status` stays `non_runtime`.
- `runtime_no_behaviour_change_proof` - the runtime parity proof below.
- `rollback_or_revert_plan` - the rollback plan below.

## Active registry surface after

The active registry surface is extended, never reordered:

- `activity`
- `movement`
- `exercise`
- `program`
- `equipment`
- `sport_subdivision`
- `sport_metric`

## Seal cycle

`ci/evidence/registry_seal_lifecycle.v1.json`'s `current_state` was set to `pre_seal` (a direct, permitted data edit - not a script-driven transition attempt, so it was never legality-checked against `allowed_transitions`), the new sport_metric file's path (and, for the snapshot, its real sha256) was appended to `registry_seal_manifest.v1.json`, `registry_seal_live_surface.v1.json`, and `registry_seal_snapshot.v1.json`, then `node ci/scripts/run_registry_seal_freeze.mjs` flipped `current_state` back to `sealed` via the one pre-existing lawful transition (`pre_seal` → `sealed`) and self-verified via the gate. `node ci/scripts/run_registry_seal_gate.mjs` and `node ci/scripts/run_registry_seal_drift_diff_reporter.mjs` were both run independently afterward and reported zero drift.

## Rollback plan

Primary: `git revert <this-slice-commit>` reverses every data file atomically back to the pre-activation sealed state in one step.

Fallback if a clean revert is not possible: remove `sport_metric` from `registries/registry_index.json`'s `order[]`, delete `registries/sport_metric/sport_metric.registry.json` and `ci/schemas/sport_metric.registry.schema.json`, remove the sport_metric entries from `registries/registry_surface_classification.json` and the three seal evidence files (manifest, live surface, snapshot), regenerate the bundle via `npm run registry:bundle`, then re-run the freeze/gate cycle to confirm the tree returns to a clean sealed state matching the pre-activation snapshot recorded in `active_registry_hashes_before`.

## Runtime parity proof

`npm run e2e:golden`'s 13 fixtures were captured before this activation and re-captured after every mutation in this slice. 11 of 13 were byte-identical. The remaining 2 - `phase3_precedence_banned_over_available` and `phase3_sovereign_constraints_envelope`, the only fixtures that exercise PHASE_3's constraints-resolution output - changed in exactly one place: the factual "which registry files were loaded" list correctly gained `sport_metric` (already containing `sport_subdivision` from S-REG-26), since PHASE_3 builds that list generically from `registry_index.json`'s `order[]`, the same mechanism every other registry already goes through. No decision, content, exercise, template, or compile-output field changed in either fixture. The two golden snapshots were re-pinned via `UPDATE_GOLDEN=1 npm run e2e:golden` and re-verified by `node ci/guards/golden_manifest_guard.mjs` and `node ci/guards/golden_outputs_guard.mjs`. This is recorded honestly rather than claimed as a bare byte-identical pass - the activation record's `runtime_parity_proof.identical: true` refers to engine decision output, not to the byte-level snapshot, which was not identical for these 2 of 13 fixtures for the reason given. This activation also required the same BETA replay-corpus re-pin cascade already established for S-REG-25/26 (`replay/suite/beta_phase1_7`'s vectors/bindings/expected-outputs and the chain of dependent manifests through BETA-22/23/24/26/29).

## Proof

Expected proof:

- `node --test test/s_reg_27_sport_metric_registry_activation.test.mjs`
- `node ci/guards/s_reg_27_sport_metric_registry_activation_guard.mjs`
- `npm.cmd run proof:s-reg-27`
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
- S-REG-25/26 guards (must remain green - unaffected by this slice).
- `npm.cmd run lint:fast`

## Final boundary

S-REG-27 activates the `sport_metric` registry domain only.

It does not activate any other candidate domain, create marker evaluator behaviour, compare real values, emit advice, infer outcomes, alter programme assignment, alter substitution runtime, create UI behaviour, or alter deterministic engine output.
