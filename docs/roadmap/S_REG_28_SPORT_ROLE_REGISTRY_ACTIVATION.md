# S-REG-28 — Sport Role Registry Activation

## Purpose

S-REG-28 is the fourth explicit activation slice authorised after S-REG-23's hold and S-REG-24's contract design (S-REG-25 activated `equipment`, S-REG-26 activated `sport_subdivision`, S-REG-27 activated `sport_metric` first).

It activates exactly one candidate domain - `sport_role` - satisfying S-REG-24's contract for that target only.

Human-authorised activation, not a hold or a design.

Unlike equipment, no separate, pre-existing, stricter launch-readiness contract (in the style of S-V1-22 or S-V1-23) blocks this target. This was confirmed by an independent grep sweep of every guard file for `sport_role`/`existsSync` patterns before this slice began. This slice's scope is therefore the plain 3-record activation only.

## Boundary

S-REG-28 includes:

- Sport role registry activation record.
- S-REG-23 hold reference and supersession record.
- S-REG-24 contract reference and supersession record.
- The active `registries/sport_role/sport_role.registry.json` file - all 3 entries, sourced from the candidate content produced by S-REG-10 (`ci/registry/candidates/sport_role_registry_2/sport_role_registry_2.candidate.registry.json`, the same source slice as `sport_subdivision`), converted to active shape by dropping candidate-only bookkeeping fields (`context_scope`, `source_slice_id`, `candidate_status`, `runtime_status`, `activation_ready`).
- The `ci/schemas/sport_role.registry.schema.json` file, required by `registry_schema_presence_guard.mjs`.
- `registries/registry_index.json` order extended with `sport_role`, appended after `sport_metric`.
- `registries/registry_bundle.json` regenerated to include the sport_role domain.
- `registries/registry_surface_classification.json` extended with the sport_role registry, classified `launch_critical` like every sibling active domain.
- A full seal `pre_seal` → `sealed` round-trip across all four seal evidence files, re-pinning the sport_role registry hash.
- Test and guard proof, including running all of S-REG-24's required proof commands for real.
- A preemptive fix to `test/s_reg_26_sport_subdivision_registry_activation.test.mjs` and `test/s_reg_27_sport_metric_registry_activation.test.mjs`, both of which still asserted `fs.existsSync("registries/sport_role/sport_role.registry.json") === false` - removed before it broke, the same class of fix already applied reactively for `sport_metric` during S-REG-27. S-REG-27's test also still exact-matched the live registry order (a bug introduced when it was written, not caught until this slice) - relaxed to prefix-match here.
- Documentation.
- Package proof script.
- Generated indexes and checksums through existing generators.

## Non-scope

S-REG-28 must not touch:

- Any other candidate domain - `sport_role` only. `metric_exercise_link_registry_1c_a` (depends on `sport_metric`, already active) and `threshold_marker_registry` (depends on `metric_exercise_link_registry_1c_a`, still unmet) remain held for future slices.
- `engine/`, `src/`, `server/`, `app/`, `web/`, or `supabase/` source.
- `shared/v1-registry/v1RegistryDomainScaffold.mjs`'s frozen exact-membership domain list - unrelated to this activation, does not include `sport_role`.
- `ci/guards/registry_law_guard.mjs`, `scripts/bundle_writer.cjs`, `ci/guards/s_v1_24_registry_load_order_fk_closure_guard.mjs`, or any other existing CI script not named in this slice's boundary above - all are already generic over `registry_index.json`'s `order[]` and require no edit for a new domain. `s_v1_24`'s FK-closure guard has a hardcoded, closed `registryDependencyEdges` list that does not mention `sport_role`, `sport_metric`, or `sport_subdivision`, so it no-ops harmlessly for this domain. `sport_role`'s `activity_id`/`sport_subdivision_id` fields are carried as factual references without independent cross-registry FK verification by any generic mechanism, matching how `sport_subdivision` and `sport_metric` were handled.
- Marker evaluator behaviour, real value comparison, advice, outcome inference.
- Programme assignment, substitution runtime, UI behaviour, coach interpretation.
- Deterministic engine output - proven unchanged by the runtime parity proof below, since nothing yet consumes the sport_role registry.

No engine consumption, no marker evaluator behaviour, no real comparison, no advice, no outcome inference.

## Activation identity

- `slice_id`: `S-REG-28`
- `activation_id`: `sport_role_registry_activation`
- `decision_type`: `activation`
- `source_hold_slice_id`: `S-REG-23`
- `source_contract_slice_id`: `S-REG-24`
- `source_candidate_slice_id`: `S-REG-10`
- `runtime_status`: `non_runtime`
- `activation_decision`: `authorised`
- `activation_target`: `sport_role_registry`
- `activated_registry_id`: `sport_role`

## Human authorisation

Activation was explicitly named by the repository owner in chat, immediately after S-REG-27's merge, continuing the S-REG chain. `sport_role_registry_2`'s dependencies (the legacy-aliased `activity` domain and the now-active `sport_subdivision` domain) were confirmed resolved, and an independent guard-file sweep found no hidden launch-readiness blocker for this domain, mirroring the same verification method used for every prior activation in this chain.

This is a human-authorised activation decision, recorded once and never silently repeated for a different target without a fresh, equally explicit decision.

## Covered S-REG-23 requirements

S-REG-28 satisfies, for the sport_role target only, every category S-REG-23 required before activation:

- `explicit_activation_slice` - this slice.
- `active_registry_mutation_contract` - S-REG-24's design, satisfied here.
- `registry_index_update_contract` - `registry_index.json` order extended, generic loader, no script edit.
- `registry_bundle_promotion_plan` - `npm run registry:bundle`, fully generic.
- `registry_loader_contract` - `engine/src/registries/loadRegistries.ts` already iterates `order[]` generically; unaffected.
- `active_registry_schema_plan` - `ci/schemas/sport_role.registry.schema.json`.
- `fk_closure_replay_against_active_bundle` - `registry_law_guard.mjs` re-runs and passes; `s_v1_24_registry_load_order_fk_closure_guard.mjs` no-ops harmlessly since `sport_role` is not in its hardcoded edge list.
- `registry_seal_freeze_and_gate_plan` - the full `pre_seal` → `sealed` round-trip below.
- `engine_consumption_boundary_decision` - deliberately none: nothing consumes the sport_role registry yet, `runtime_status` stays `non_runtime`.
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
- `sport_role`

## Seal cycle

`ci/evidence/registry_seal_lifecycle.v1.json`'s `current_state` was set to `pre_seal` (a direct, permitted data edit - not a script-driven transition attempt, so it was never legality-checked against `allowed_transitions`), the new sport_role file's path (and, for the snapshot, its real sha256) was appended to `registry_seal_manifest.v1.json`, `registry_seal_live_surface.v1.json`, and `registry_seal_snapshot.v1.json`, then `node ci/scripts/run_registry_seal_freeze.mjs` flipped `current_state` back to `sealed` via the one pre-existing lawful transition (`pre_seal` → `sealed`) and self-verified via the gate. `node ci/scripts/run_registry_seal_gate.mjs` and `node ci/scripts/run_registry_seal_drift_diff_reporter.mjs` were both run independently afterward and reported zero drift.

## Rollback plan

Primary: `git revert <this-slice-commit>` reverses every data file atomically back to the pre-activation sealed state in one step.

Fallback if a clean revert is not possible: remove `sport_role` from `registries/registry_index.json`'s `order[]`, delete `registries/sport_role/sport_role.registry.json` and `ci/schemas/sport_role.registry.schema.json`, remove the sport_role entries from `registries/registry_surface_classification.json` and the three seal evidence files (manifest, live surface, snapshot), regenerate the bundle via `npm run registry:bundle`, then re-run the freeze/gate cycle to confirm the tree returns to a clean sealed state matching the pre-activation snapshot recorded in `active_registry_hashes_before`.

## Runtime parity proof

`npm run e2e:golden`'s 13 fixtures were captured before this activation and re-captured after every mutation in this slice. 11 of 13 were byte-identical. The remaining 2 - `phase3_precedence_banned_over_available` and `phase3_sovereign_constraints_envelope`, the only fixtures that exercise PHASE_3's constraints-resolution output - changed in exactly one place: the factual "which registry files were loaded" list correctly gained `sport_role` (already containing `sport_metric` from S-REG-27), since PHASE_3 builds that list generically from `registry_index.json`'s `order[]`, the same mechanism every other registry already goes through. No decision, content, exercise, template, or compile-output field changed in either fixture. The two golden snapshots were re-pinned via `UPDATE_GOLDEN=1 npm run e2e:golden` and re-verified by `node ci/guards/golden_manifest_guard.mjs` and `node ci/guards/golden_outputs_guard.mjs`. This is recorded honestly rather than claimed as a bare byte-identical pass - the activation record's `runtime_parity_proof.identical: true` refers to engine decision output, not to the byte-level snapshot, which was not identical for these 2 of 13 fixtures for the reason given. This activation also required the same BETA replay-corpus re-pin cascade already established for S-REG-25/26/27 (`replay/suite/beta_phase1_7`'s vectors/bindings/expected-outputs and the chain of dependent manifests through BETA-22/23/24/26/29).

## Proof

Expected proof:

- `node --test test/s_reg_28_sport_role_registry_activation.test.mjs`
- `node ci/guards/s_reg_28_sport_role_registry_activation_guard.mjs`
- `npm.cmd run proof:s-reg-28`
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
- S-REG-25/26/27 guards (must remain green - unaffected by this slice).
- `npm.cmd run lint:fast`

## Final boundary

S-REG-28 activates the `sport_role` registry domain only.

It does not activate any other candidate domain, create marker evaluator behaviour, compare real values, emit advice, infer outcomes, alter programme assignment, alter substitution runtime, create UI behaviour, or alter deterministic engine output.

## Supersession log (append-only)

- superseded_by_slice_ids: S-REG-29, S-REG-30

S-REG-30 later activated `threshold_marker` as the tenth active domain, appended after `metric_exercise_link`. This slice's own test still asserted `fs.existsSync("registries/threshold_marker/threshold_marker.registry.json") === false` - the same stale-negative-existence pattern already fixed for `metric_exercise_link` in this slice's own test during S-REG-29's development - and was removed preemptively as part of S-REG-30's build.
