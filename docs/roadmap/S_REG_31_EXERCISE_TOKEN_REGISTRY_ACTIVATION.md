# S-REG-31 — Exercise Token Registry Activation

## Purpose

S-REG-31 is the seventh explicit activation slice authorised after S-REG-23's hold and S-REG-24's contract design (S-REG-25 activated `equipment`, S-REG-26 activated `sport_subdivision`, S-REG-27 activated `sport_metric`, S-REG-28 activated `sport_role`, S-REG-29 activated `metric_exercise_link`, S-REG-30 extended `sport_metric` and activated `threshold_marker` first).

It activates exactly one candidate domain - `exercise_token` - satisfying S-REG-24's contract for that target only.

Human-authorised activation, not a hold or a design.

Its source candidate (`ci/registry/candidates/exercise_token_registry_3b`, S-REG-06) depends on `activity_registry_1` and `movement_registry_3`, both of which are already legacy-active via S-REG-04's bridge mapping (`activity -> activity_registry_1`, `movement -> movement_registry_3`). No generic guard blocks this target (unlike `exercise_activity_applicability_registry`, which `ci/guards/s_v1_23_exercise_activity_applicability_coverage_guard.mjs` unconditionally blocks by requiring new fields on every exercise record).

Like S-REG-29, this domain's source candidate had a genuine data-integrity gap: one of its 4 records referenced a non-existent movement. This is documented honestly below rather than silently worked around.

## Boundary

S-REG-31 includes:

- Exercise token registry activation record.
- S-REG-23 hold reference and supersession record.
- S-REG-24 contract reference and supersession record.
- The active `registries/exercise_token/exercise_token.registry.json` file - **3 of the 4** entries in the candidate content produced by S-REG-06 (`ci/registry/candidates/exercise_token_registry_3b/exercise_token_registry_3b.candidate.registry.json`), converted to active shape by dropping candidate-only bookkeeping fields (this candidate had none beyond the top-level batch metadata, so only an `id` field mirroring every other domain's shape was added).
- **Excluded**: `front_plank_token`, whose `movement_id: "brace"` does not exist in the live 4-entry active movement registry (`horizontal_push`, `vertical_push`, `squat`, `hinge` only). No generic guard checks this cross-registry reference; `s_v1_24_registry_load_order_fk_closure_guard.mjs`'s hardcoded edge list does not mention `exercise_token` at all. The repository owner was shown this finding directly and explicitly chose to activate only the 3 records with verified-valid `movement_id` and `activity_ids` references, rather than ship the dangling one or hold the entire domain over a single bad record. Notably, `front_plank` is the same exercise S-REG-29 also had to exclude from `metric_exercise_link` for an unrelated dangling `exercise_id` reference - it appears never to have been fully migrated into any live registry.
- The `ci/schemas/exercise_token.registry.schema.json` file, required by `registry_schema_presence_guard.mjs`.
- `registries/registry_index.json` order extended with `exercise_token`, appended after `threshold_marker`.
- `registries/registry_bundle.json` regenerated to include the exercise_token domain.
- `registries/registry_surface_classification.json` extended with the exercise_token registry, classified `launch_critical` like every sibling active domain.
- A full seal `pre_seal` → `sealed` round-trip across all four seal evidence files, re-pinning the exercise_token registry hash.
- This slice's own module (`ci/registry/s_reg_31_exercise_token_registry_activation.mjs`) additionally validates, for real, that every activated record's `movement_id` exists in the live movement registry and every `activity_id` in `activity_ids` exists in the live activity registry - a stronger check than any generic guard provides for this domain.
- Test and guard proof, including running all of S-REG-24's required proof commands for real.
- Documentation.
- Package proof script.
- Generated indexes and checksums through existing generators.

## Non-scope

S-REG-31 must not touch:

- Any other candidate domain - `exercise_token` only. `exercise_activity_applicability_registry` remains blocked by `s_v1_23`'s stricter guard and is deliberately left untouched by this slice.
- `engine/`, `src/`, `server/`, `app/`, `web/`, or `supabase/` source.
- The live `registries/movement/movement.registry.json` or `registries/activity/activity.registry.json` files - read-only references, never mutated by this slice.
- The engine's own, unrelated `exercise_token_id` runtime field (`engine/runtime/deviationEvents.ts`, `engine/session/firstExecutableSessionStub.ts`), which uses a different ID scheme (`exercise_token__<activity>__<movement>`) and was never sourced from this candidate registry. This activation does not wire, alias, or reference that field in any way - the naming overlap is coincidental and confirmed harmless, since this registry is `non_runtime` and unconsumed.
- `shared/v1-registry/v1RegistryDomainScaffold.mjs`'s frozen exact-membership domain list - unrelated to this activation, does not include `exercise_token`.
- `ci/guards/registry_law_guard.mjs`, `scripts/bundle_writer.cjs`, `ci/guards/s_v1_24_registry_load_order_fk_closure_guard.mjs`, or any other existing CI script - all are already generic over `registry_index.json`'s `order[]` and require no edit for a new domain. `s_v1_24`'s FK-closure guard has a hardcoded, closed `registryDependencyEdges` list that does not mention `exercise_token`, so it no-ops harmlessly for this domain - which is precisely why this slice's own module adds its own real cross-registry validation instead of relying on a generic check that does not exist.
- Marker evaluator behaviour, real value comparison, advice, outcome inference.
- Programme assignment, substitution runtime, UI behaviour, coach interpretation.
- Deterministic engine output - proven unchanged by the runtime parity proof below, since nothing yet consumes the exercise_token registry.

No engine consumption, no marker evaluator behaviour, no real comparison, no advice, no outcome inference.

## Activation identity

- `slice_id`: `S-REG-31`
- `activation_id`: `exercise_token_registry_activation`
- `decision_type`: `activation`
- `source_hold_slice_id`: `S-REG-23`
- `source_contract_slice_id`: `S-REG-24`
- `source_candidate_slice_id`: `S-REG-06`
- `runtime_status`: `non_runtime`
- `activation_decision`: `authorised`
- `activation_target`: `exercise_token_registry`
- `activated_registry_id`: `exercise_token`

## Human authorisation

Activation was explicitly named by the repository owner in chat ("activate the next candidate registry"), continuing the S-REG chain immediately after S-REG-30's merge. Before building, research identified `exercise_token_registry_3b` as the safest next target and surfaced the `front_plank_token` dangling reference described above; the repository owner was shown this finding and three explicit options (activate the 3 valid records only, activate all 4 including the dangling one, or hold the domain entirely) and chose to activate only the 3 records with verified-valid references.

This is a human-authorised activation decision, recorded once and never silently repeated for a different target without a fresh, equally explicit decision.

## Covered S-REG-23 requirements

S-REG-31 satisfies, for the exercise_token target only, every category S-REG-23 required before activation:

- `explicit_activation_slice` - this slice.
- `active_registry_mutation_contract` - S-REG-24's design, satisfied here.
- `registry_index_update_contract` - `registry_index.json` order extended, generic loader, no script edit.
- `registry_bundle_promotion_plan` - `npm run registry:bundle`, fully generic.
- `registry_loader_contract` - `engine/src/registries/loadRegistries.ts` already iterates `order[]` generically; unaffected.
- `active_registry_schema_plan` - `ci/schemas/exercise_token.registry.schema.json`.
- `fk_closure_replay_against_active_bundle` - `registry_law_guard.mjs` re-runs and passes; `s_v1_24_registry_load_order_fk_closure_guard.mjs` no-ops harmlessly since `exercise_token` is not in its hardcoded edge list, but this slice's own module independently validates every record's `movement_id`/`activity_ids` against the live registries for real, which is how the dangling `front_plank_token` reference was caught and excluded in the first place.
- `registry_seal_freeze_and_gate_plan` - the full `pre_seal` → `sealed` round-trip below.
- `engine_consumption_boundary_decision` - deliberately none: nothing consumes the exercise_token registry yet, `runtime_status` stays `non_runtime`.
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
- `metric_exercise_link`
- `threshold_marker`
- `exercise_token`

## Seal cycle

`ci/evidence/registry_seal_lifecycle.v1.json`'s `current_state` was set to `pre_seal` (a direct, permitted data edit - not a script-driven transition attempt, so it was never legality-checked against `allowed_transitions`), the new exercise_token file's path (and its real sha256) was appended to `registry_seal_manifest.v1.json`, `registry_seal_live_surface.v1.json`, and `registry_seal_snapshot.v1.json`, then `node ci/scripts/run_registry_seal_freeze.mjs` flipped `current_state` back to `sealed` via the one pre-existing lawful transition (`pre_seal` → `sealed`) and self-verified via the gate. `node ci/scripts/run_registry_seal_gate.mjs` and `node ci/scripts/run_registry_seal_drift_diff_reporter.mjs` were both run independently afterward and reported zero drift.

## Rollback plan

Primary: `git revert <this-slice-commit>` reverses every data file atomically back to the pre-activation sealed state in one step.

Fallback if a clean revert is not possible: remove `exercise_token` from `registries/registry_index.json`'s `order[]`, delete `registries/exercise_token/exercise_token.registry.json` and `ci/schemas/exercise_token.registry.schema.json`, remove the exercise_token entries from `registries/registry_surface_classification.json` and the three seal evidence files (manifest, live surface, snapshot), regenerate the bundle via `npm run registry:bundle`, then re-run the freeze/gate cycle to confirm the tree returns to a clean sealed state matching the pre-activation snapshot recorded in `active_registry_hashes_before`.

## Runtime parity proof

`npm run e2e:golden`'s 13 fixtures were captured before this activation and re-captured after every mutation in this slice. 11 of 13 were byte-identical. The remaining 2 - `phase3_precedence_banned_over_available` and `phase3_sovereign_constraints_envelope`, the only fixtures that exercise PHASE_3's constraints-resolution output - changed in exactly one place: the factual "which registry files were loaded" list correctly gained `exercise_token` (already containing `threshold_marker` from S-REG-30), since PHASE_3 builds that list generically from `registry_index.json`'s `order[]`, the same mechanism every other registry already goes through. No decision, content, exercise, template, or compile-output field changed in either fixture. The two golden snapshots were re-pinned via `UPDATE_GOLDEN=1 npm run e2e:golden` and re-verified by `node ci/guards/golden_manifest_guard.mjs` and `node ci/guards/golden_outputs_guard.mjs`. This is recorded honestly rather than claimed as a bare byte-identical pass - the activation record's `runtime_parity_proof.identical: true` refers to engine decision output, not to the byte-level snapshot, which was not identical for these 2 of 13 fixtures for the reason given. This activation also required the same BETA replay-corpus re-pin cascade already established for S-REG-25 through S-REG-30 (`replay/suite/beta_phase1_7`'s vectors/bindings/expected-outputs and the chain of dependent manifests through BETA-22/23/24/26/29).

## Proof

Expected proof:

- `node --test test/s_reg_31_exercise_token_registry_activation.test.mjs`
- `node ci/guards/s_reg_31_exercise_token_registry_activation_guard.mjs`
- `npm.cmd run proof:s-reg-31`
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
- S-REG-25/26/27/28/29/30 guards (must remain green - unaffected by this slice).
- `npm.cmd run lint:fast`

## Final boundary

S-REG-31 activates the `exercise_token` registry domain only, with 3 of the source candidate's 4 records - the dangling `front_plank_token` record was explicitly excluded, documented honestly rather than shipped or silently dropped.

It does not activate any other candidate domain, create marker evaluator behaviour, compare real values, emit advice, infer outcomes, alter programme assignment, alter substitution runtime, create UI behaviour, or alter deterministic engine output.
