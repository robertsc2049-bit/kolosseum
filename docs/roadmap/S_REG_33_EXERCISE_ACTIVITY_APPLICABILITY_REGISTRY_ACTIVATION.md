# S-REG-33 — Exercise Activity Applicability Registry Activation

## Purpose

S-REG-33 is the eighth explicit activation slice authorised after S-REG-23's hold and S-REG-24's contract design (S-REG-25 activated `equipment`, S-REG-26 activated `sport_subdivision`, S-REG-27 activated `sport_metric`, S-REG-28 activated `sport_role`, S-REG-29 activated `metric_exercise_link`, S-REG-30 extended `sport_metric` and activated `threshold_marker`, S-REG-31 activated `exercise_token` first). It is built directly on top of S-REG-32, which extended the `exercise` registry with `primary_activity_applicability`/`secondary_activity_applicability` fields on all 19 live entries.

Human-authorised activation, not a hold or a design.

Unlike every prior activation in this chain, this domain's source candidate (`ci/registry/candidates/exercise_activity_applicability_registry`, S-REG-09) was far from a complete dataset: it had only 12 records covering 4 of 19 exercises, only the `training` context, and one of those 4 exercises (`front_plank`) does not exist in the live exercise registry at all. Activating this domain for real required authoring a genuinely complete closure - **this is the first slice in the chain to author new record content rather than convert existing candidate content almost as-is**, and that is stated plainly here rather than glossed over.

## Boundary

S-REG-33 includes:

- Exercise activity applicability registry activation record.
- S-REG-23 hold reference and supersession record.
- S-REG-24 contract reference and supersession record.
- The active `registries/exercise_activity_applicability/exercise_activity_applicability.registry.json` file - **159 records**, the full closure of every exercise-activity pair (53 pairs, derived from S-REG-32's `primary_activity_applicability`/`secondary_activity_applicability` fields) across all 3 required contexts (`training`, `testing`, `competition`). Every record uses the flat, uniform shape confirmed by the 9 valid records in the source candidate: `applicability_state: "allowed"`, `tier_cap: null`, `conditions: []`, `template_applicability: "eligible"`, `substitution_applicability: "eligible"`. The candidate's 3 `front_plank__*` records are not present - `front_plank` isn't a live exercise, the same class of exclusion S-REG-29 and S-REG-31 both applied for the same exercise.
- The `ci/schemas/exercise_activity_applicability.registry.schema.json` file, required by `registry_schema_presence_guard.mjs`.
- `registries/registry_index.json` order extended with `exercise_activity_applicability`, appended after `exercise_token` (12th domain).
- `registries/registry_bundle.json` regenerated to include the domain.
- `registries/registry_surface_classification.json` extended, classified `launch_critical` like every sibling active domain.
- A full seal `pre_seal` → `sealed` round-trip across all four seal evidence files.
- **`ci/guards/s_v1_23_exercise_activity_applicability_coverage_guard.mjs` evolved** from a "must not exist yet" guard into real coverage enforcement, mirroring exactly the evolution `S-V1-22` (equipment) already went through during S-REG-25: the `forbiddenPath` block no longer blocks the active registry file's mere existence (only the never-built implementation-scope module remains forbidden), and a new block re-runs the guard's own `validateExerciseActivityApplicabilityCoverage` function against the live exercise and applicability registries whenever the active file exists. The original negative-fixture proof is untouched and still passes exactly as before.
- A matching "Supersession log" section appended to `docs/v1/V1_EXERCISE_ACTIVITY_APPLICABILITY_COVERAGE_CONTRACT.md`, the same append-only pattern S-V1-22's own doc used.
- This slice's own module (`ci/registry/s_reg_33_exercise_activity_applicability_registry_activation.mjs`) additionally validates, for real, that every record's `exercise_id` exists in the live exercise registry and its `activity_id` is genuinely one of that exercise's applicable activities - mirroring S-REG-29's cross-registry validation pattern, since `s_v1_24`'s FK-closure guard has no hardcoded edge for this domain either.
- Test and guard proof, including running all of S-REG-24's required proof commands for real.
- Documentation.
- Package proof script.
- Generated indexes and checksums through existing generators.

## Non-scope

S-REG-33 must not touch:

- Any other candidate domain - `exercise_activity_applicability` only.
- `engine/`, `src/`, `server/`, `app/`, `web/`, or `supabase/` source.
- The live `registries/exercise/exercise.registry.json` file - read-only reference, never mutated by this slice (S-REG-32 already extended it).
- Marker evaluator behaviour, real value comparison, advice, outcome inference.
- Programme assignment, substitution runtime, UI behaviour, coach interpretation.
- Deterministic engine output - proven unchanged by the runtime parity proof below, since nothing yet consumes this registry.

No engine consumption, no marker evaluator behaviour, no real comparison, no advice, no outcome inference.

## Activation identity

- `slice_id`: `S-REG-33`
- `activation_id`: `exercise_activity_applicability_registry_activation`
- `decision_type`: `activation`
- `source_hold_slice_id`: `S-REG-23`
- `source_contract_slice_id`: `S-REG-24`
- `source_candidate_slice_id`: `S-REG-09`
- `runtime_status`: `non_runtime`
- `activation_decision`: `authorised`
- `activation_target`: `exercise_activity_applicability_registry`
- `activated_registry_id`: `exercise_activity_applicability`

## Human authorisation

Activation was explicitly requested via a two-step conversation: the repository owner first asked to "scope out the applicability registry work," and after research surfaced the size and shape of the gap (schema extension needed, full-closure content authoring needed, guard evolution needed), the repository owner confirmed two specific derivation rules by explicit decision - (1) the pattern → `allowed_movement_ids` applicability rule with `back_squat`/`deadlift`/`bench_press` as `primary_activity_applicability: "powerlifting"` and everything else `general_strength`, and (2) identical applicability values across all 3 required contexts. The work was then split into S-REG-32 (schema extension) and this slice (the actual activation, closure authoring, and guard evolution).

This is a human-authorised activation decision, recorded once and never silently repeated for a different target without a fresh, equally explicit decision.

## Covered S-REG-23 requirements

S-REG-33 satisfies, for the exercise_activity_applicability target only, every category S-REG-23 required before activation:

- `explicit_activation_slice` - this slice.
- `active_registry_mutation_contract` - S-REG-24's design, satisfied here.
- `registry_index_update_contract` - `registry_index.json` order extended, generic loader, no script edit.
- `registry_bundle_promotion_plan` - `npm run registry:bundle`, fully generic.
- `registry_loader_contract` - `engine/src/registries/loadRegistries.ts` already iterates `order[]` generically; unaffected.
- `active_registry_schema_plan` - `ci/schemas/exercise_activity_applicability.registry.schema.json`.
- `fk_closure_replay_against_active_bundle` - `registry_law_guard.mjs` re-runs and passes; `s_v1_24_registry_load_order_fk_closure_guard.mjs` no-ops harmlessly since this domain is not in its hardcoded edge list, but this slice's own module independently validates every record's `exercise_id`/`activity_id` against the live registries for real, and `s_v1_23`'s own evolved guard independently re-runs its full coverage validator against the real 159-record closure.
- `registry_seal_freeze_and_gate_plan` - the full `pre_seal` → `sealed` round-trip below.
- `engine_consumption_boundary_decision` - deliberately none: nothing consumes this registry yet, `runtime_status` stays `non_runtime`.
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
- `exercise_activity_applicability`

## Seal cycle

`ci/evidence/registry_seal_lifecycle.v1.json`'s `current_state` was set to `pre_seal` (a direct, permitted data edit - not a script-driven transition attempt, so it was never legality-checked against `allowed_transitions`), the new registry file's path (and its real sha256) was appended to `registry_seal_manifest.v1.json`, `registry_seal_live_surface.v1.json`, and `registry_seal_snapshot.v1.json`, then `node ci/scripts/run_registry_seal_freeze.mjs` flipped `current_state` back to `sealed` via the one pre-existing lawful transition (`pre_seal` → `sealed`) and self-verified via the gate. `node ci/scripts/run_registry_seal_gate.mjs` and `node ci/scripts/run_registry_seal_drift_diff_reporter.mjs` were both run independently afterward and reported zero drift.

## Rollback plan

Primary: `git revert <this-slice-commit>` reverses every data file atomically back to the pre-activation sealed state in one step, including the `S-V1-23` guard/doc evolution.

Fallback if a clean revert is not possible: remove `exercise_activity_applicability` from `registries/registry_index.json`'s `order[]`, delete `registries/exercise_activity_applicability/exercise_activity_applicability.registry.json` and `ci/schemas/exercise_activity_applicability.registry.schema.json`, restore the forbidden-path block in `ci/guards/s_v1_23_exercise_activity_applicability_coverage_guard.mjs`, remove the domain's entries from `registries/registry_surface_classification.json` and the three seal evidence files, regenerate the bundle via `npm run registry:bundle`, then re-run the freeze/gate cycle to confirm the tree returns to a clean sealed state matching the pre-activation snapshot recorded in `active_registry_hashes_before`.

## Runtime parity proof

`npm run e2e:golden`'s 13 fixtures were captured before this activation and re-captured after every mutation in this slice. 11 of 13 were byte-identical. The remaining 2 - `phase3_precedence_banned_over_available` and `phase3_sovereign_constraints_envelope`, the only fixtures that exercise PHASE_3's constraints-resolution output - changed in exactly one place: the factual "which registry files were loaded" list correctly gained `exercise_activity_applicability` after `exercise_token`, since PHASE_3 builds that list generically from `registry_index.json`'s `order[]`, the same mechanism every other registry already goes through. No decision, content, exercise, template, or compile-output field changed in either fixture. The two golden snapshots were re-pinned via `UPDATE_GOLDEN=1 npm run e2e:golden` and re-verified by `node ci/guards/golden_manifest_guard.mjs` and `node ci/guards/golden_outputs_guard.mjs`. This is recorded honestly rather than claimed as a bare byte-identical pass - the activation record's `runtime_parity_proof.identical: true` refers to engine decision output, not to the byte-level snapshot, which was not identical for these 2 of 13 fixtures for the reason given. This activation also required the same BETA replay-corpus re-pin cascade already established for S-REG-25 through S-REG-31 (`replay/suite/beta_phase1_7`'s vectors/bindings/expected-outputs and the chain of dependent manifests through BETA-22/23/24/26/29).

## Proof

Expected proof:

- `node --test test/s_reg_33_exercise_activity_applicability_registry_activation.test.mjs`
- `node ci/guards/s_reg_33_exercise_activity_applicability_registry_activation_guard.mjs`
- `npm.cmd run proof:s-reg-33`
- `node ci/guards/registry_bundle_guard.mjs`
- `node ci/guards/registry_law_guard.mjs`
- `node ci/guards/registry_schema_presence_guard.mjs`
- `node ci/guards/s_v1_24_registry_load_order_fk_closure_guard.mjs`
- `node ci/guards/s_v1_23_exercise_activity_applicability_coverage_guard.mjs` (must pass with the real 159-record closure loaded)
- `node ci/scripts/run_registry_seal_gate.mjs`
- `node ci/scripts/run_registry_seal_drift_diff_reporter.mjs`
- `node ci/scripts/run_failure_token_index_guard.mjs`
- `node ci/guards/guards_index_guard.mjs`
- `node ci/guards/guards_entrypoint_coverage_guard.mjs`
- S-REG-23 guard (must remain green - its historical record is unchanged, only its append-only supersession log grew).
- S-REG-24 guard (same).
- S-REG-25 through S-REG-32 guards (must remain green - unaffected by this slice).
- `npm.cmd run lint:fast`

## Final boundary

S-REG-33 activates the `exercise_activity_applicability` registry domain only, with a genuinely complete 159-record closure - the last remaining candidate in the S-REG chain.

It does not activate any other candidate domain, create marker evaluator behaviour, compare real values, emit advice, infer outcomes, alter programme assignment, alter substitution runtime, create UI behaviour, or alter deterministic engine output.
