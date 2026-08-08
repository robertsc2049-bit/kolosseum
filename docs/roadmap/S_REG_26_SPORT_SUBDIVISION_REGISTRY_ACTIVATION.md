# S-REG-26 — Sport Subdivision Registry Activation

## Purpose

S-REG-26 is the second explicit activation slice authorised after S-REG-23's hold and S-REG-24's contract design (S-REG-25 activated `equipment` first).

It activates exactly one candidate domain - `sport_subdivision` - satisfying S-REG-24's contract for that target only.

Human-authorised activation, not a hold or a design.

Unlike equipment, no separate, pre-existing, stricter launch-readiness contract (in the style of S-V1-22) blocks this target. This was confirmed by an explicit, independent grep sweep of every guard file for `sport_subdivision`/`existsSync` patterns before this slice began, not assumed from equipment's precedent. This slice's scope is therefore the plain 4-record activation only.

## Boundary

S-REG-26 includes:

- Sport subdivision registry activation record.
- S-REG-23 hold reference and supersession record.
- S-REG-24 contract reference and supersession record.
- The active `registries/sport_subdivision/sport_subdivision.registry.json` file - all 4 entries, sourced from the candidate content produced by S-REG-10 (`ci/registry/candidates/sport_subdivision_registry_1a/sport_subdivision_registry_1a.candidate.registry.json`), converted to active shape by dropping candidate-only bookkeeping fields (`candidate_status`, `runtime_status`, `activation_ready`, `source_slice_id`, `context_scope`).
- The `ci/schemas/sport_subdivision.registry.schema.json` file, required by `registry_schema_presence_guard.mjs`.
- `registries/registry_index.json` order extended with `sport_subdivision`, appended after `equipment`.
- `registries/registry_bundle.json` regenerated to include the sport_subdivision domain.
- `registries/registry_surface_classification.json` extended with the sport_subdivision registry, classified `launch_critical` like every sibling active domain.
- A full seal `pre_seal` → `sealed` round-trip across all four seal evidence files, re-pinning the sport_subdivision registry hash.
- Test and guard proof, including running all of S-REG-24's required proof commands for real.
- Documentation.
- Package proof script.
- Generated indexes and checksums through existing generators.

## Non-scope

S-REG-26 must not touch:

- Any other candidate domain (`sport_role_registry_2`, `sport_metric_registry_1c`, `exercise_activity_applicability_registry`, `exercise_token_registry_3b`, etc.) - `sport_subdivision` only. `sport_role_registry_2` shares its source candidate slice (S-REG-10) with this target but stays untouched, mirroring how S-REG-25 left `sport_metric_registry_1c` alone.
- `engine/`, `src/`, `server/`, `app/`, `web/`, or `supabase/` source.
- `shared/v1-registry/v1RegistryDomainScaffold.mjs`'s frozen exact-membership domain list - a separate, unrelated future-productionization tracker that does not include `sport_subdivision`.
- `ci/guards/registry_law_guard.mjs`, `scripts/bundle_writer.cjs`, `ci/guards/s_v1_24_registry_load_order_fk_closure_guard.mjs`, or any other existing CI script not named in this slice's boundary above - all are already generic over `registry_index.json`'s `order[]` and require no edit for a new domain. `sport_subdivision` has no FK relationship to any other active registry, so S-V1-24's FK-closure guard no-ops harmlessly for this domain, confirmed by direct run.
- Marker evaluator behaviour, real value comparison, advice, outcome inference.
- Programme assignment, substitution runtime, UI behaviour, coach interpretation.
- Deterministic engine output - proven unchanged by the runtime parity proof below, since nothing yet consumes the sport_subdivision registry.

No engine consumption, no marker evaluator behaviour, no real comparison, no advice, no outcome inference.

## Activation identity

- `slice_id`: `S-REG-26`
- `activation_id`: `sport_subdivision_registry_activation`
- `decision_type`: `activation`
- `source_hold_slice_id`: `S-REG-23`
- `source_contract_slice_id`: `S-REG-24`
- `source_candidate_slice_id`: `S-REG-10`
- `runtime_status`: `non_runtime`
- `activation_decision`: `authorised`
- `activation_target`: `sport_subdivision_registry`
- `activated_registry_id`: `sport_subdivision`

## Human authorisation

Activation was explicitly named by the repository owner in chat, after being shown a comparison table of the remaining candidate registries (`sport_subdivision_registry_1a`, `exercise_token_registry_3b`, `exercise_activity_applicability_registry`, and their dependents) covering readiness, hidden launch-readiness blockers, and dependency ordering. `sport_subdivision_registry_1a` was chosen specifically because it has zero unmet candidate dependencies, no hidden S-V1-style launch-readiness blocker, and is the root of the `sport_*` candidate chain (`sport_metric_registry_1c` and `sport_role_registry_2` both depend on it and remain held).

This is a human-authorised activation decision, recorded once and never silently repeated for a different target without a fresh, equally explicit decision.

## Covered S-REG-23 requirements

S-REG-26 satisfies, for the sport_subdivision target only, every category S-REG-23 required before activation:

- `explicit_activation_slice` - this slice.
- `active_registry_mutation_contract` - S-REG-24's design, satisfied here.
- `registry_index_update_contract` - `registry_index.json` order extended, generic loader, no script edit.
- `registry_bundle_promotion_plan` - `npm run registry:bundle`, fully generic.
- `registry_loader_contract` - `engine/src/registries/loadRegistries.ts` already iterates `order[]` generically; unaffected.
- `active_registry_schema_plan` - `ci/schemas/sport_subdivision.registry.schema.json`.
- `fk_closure_replay_against_active_bundle` - `registry_law_guard.mjs` re-runs and passes; `s_v1_24_registry_load_order_fk_closure_guard.mjs` no-ops harmlessly since sport_subdivision has no FK relationship to any other active registry.
- `registry_seal_freeze_and_gate_plan` - the full `pre_seal` → `sealed` round-trip below.
- `engine_consumption_boundary_decision` - deliberately none: nothing consumes the sport_subdivision registry yet, `runtime_status` stays `non_runtime`.
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

## Seal cycle

`ci/evidence/registry_seal_lifecycle.v1.json`'s `current_state` was set to `pre_seal` (a direct, permitted data edit - not a script-driven transition attempt, so it was never legality-checked against `allowed_transitions`), the new sport_subdivision file's path (and, for the snapshot, its real sha256) was appended to `registry_seal_manifest.v1.json`, `registry_seal_live_surface.v1.json`, and `registry_seal_snapshot.v1.json`, then `node ci/scripts/run_registry_seal_freeze.mjs` flipped `current_state` back to `sealed` via the one pre-existing lawful transition (`pre_seal` → `sealed`) and self-verified via the gate. `node ci/scripts/run_registry_seal_gate.mjs` and `node ci/scripts/run_registry_seal_drift_diff_reporter.mjs` were both run independently afterward and reported zero drift.

## Rollback plan

Primary: `git revert <this-slice-commit>` reverses every data file atomically back to the pre-activation sealed state in one step.

Fallback if a clean revert is not possible: remove `sport_subdivision` from `registries/registry_index.json`'s `order[]`, delete `registries/sport_subdivision/sport_subdivision.registry.json` and `ci/schemas/sport_subdivision.registry.schema.json`, remove the sport_subdivision entries from `registries/registry_surface_classification.json` and the three seal evidence files (manifest, live surface, snapshot), regenerate the bundle via `npm run registry:bundle`, then re-run the freeze/gate cycle to confirm the tree returns to a clean sealed state matching the pre-activation snapshot recorded in `active_registry_hashes_before`.

## Runtime parity proof

`npm run e2e:golden`'s 13 fixtures were captured before this activation and re-captured after every mutation in this slice. 11 of 13 were byte-identical. The remaining 2 - `phase3_precedence_banned_over_available` and `phase3_sovereign_constraints_envelope`, the only fixtures that exercise PHASE_3's constraints-resolution output - changed in exactly one place: the factual "which registry files were loaded" list correctly gained `sport_subdivision` (already containing `equipment` from S-REG-25), since PHASE_3 builds that list generically from `registry_index.json`'s `order[]`, the same mechanism every other registry already goes through. No decision, content, exercise, template, or compile-output field changed in either fixture. The two golden snapshots were re-pinned via `UPDATE_GOLDEN=1 npm run e2e:golden` and re-verified by `node ci/guards/golden_manifest_guard.mjs` and `node ci/guards/golden_outputs_guard.mjs`. This is recorded honestly rather than claimed as a bare byte-identical pass - the activation record's `runtime_parity_proof.identical: true` refers to engine decision output, not to the byte-level snapshot, which was not identical for these 2 of 13 fixtures for the reason given. This activation also required the same BETA replay-corpus re-pin cascade already established for S-REG-25 (`replay/suite/beta_phase1_7`'s vectors/bindings/expected-outputs and the chain of dependent manifests through BETA-23/24/26).

## Proof

Expected proof:

- `node --test test/s_reg_26_sport_subdivision_registry_activation.test.mjs`
- `node ci/guards/s_reg_26_sport_subdivision_registry_activation_guard.mjs`
- `npm.cmd run proof:s-reg-26`
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
- S-REG-25 guard (must remain green - unaffected by this slice).
- `npm.cmd run lint:fast`

## Final boundary

S-REG-26 activates the `sport_subdivision` registry domain only.

It does not activate any other candidate domain, create marker evaluator behaviour, compare real values, emit advice, infer outcomes, alter programme assignment, alter substitution runtime, create UI behaviour, or alter deterministic engine output.

## Supersession log (append-only)

- superseded_by_slice_ids: S-REG-27, S-REG-30

S-REG-27 later extended the active registry index and bundle with a seventh domain, `sport_metric`, appended after `sport_subdivision`. That extension also exposed a latent issue in this slice's own **test** file (not its module, which already used prefix-match from the start per its own DEV NOTE): `test/s_reg_26_sport_subdivision_registry_activation.test.mjs` still exact-matched the live registry order/bundle keys and asserted `fs.existsSync("registries/sport_metric/sport_metric.registry.json") === false` - a check meaning "no other domain was activated alongside sport_subdivision in this slice," expressed as a permanent live-filesystem assertion, so it broke the moment `sport_metric` was legitimately activated by a later, separate slice. The order/bundle-key checks were relaxed to prefix-match (mirroring the module's own approach), and the stale `sport_metric` existence check was removed; the still-held `sport_role`/`threshold_marker` checks are untouched since they remain true.

S-REG-30 later activated `threshold_marker` as the tenth active domain, appended after `metric_exercise_link`. This slice's own test still asserted `fs.existsSync("registries/threshold_marker/threshold_marker.registry.json") === false` and was removed preemptively as part of S-REG-30's build, the same class of fix as above.
