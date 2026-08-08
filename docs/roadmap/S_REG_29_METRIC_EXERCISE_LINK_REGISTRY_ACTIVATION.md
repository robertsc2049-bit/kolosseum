# S-REG-29 — Metric Exercise Link Registry Activation

## Purpose

S-REG-29 is the fifth explicit activation slice authorised after S-REG-23's hold and S-REG-24's contract design (S-REG-25 activated `equipment`, S-REG-26 activated `sport_subdivision`, S-REG-27 activated `sport_metric`, S-REG-28 activated `sport_role` first).

It activates exactly one candidate domain - `metric_exercise_link` - satisfying S-REG-24's contract for that target only.

Human-authorised activation, not a hold or a design.

Unlike every prior activation in this chain, this domain's source candidate (S-REG-12) had a genuine data-integrity gap: one of its 13 records referenced a non-existent exercise. This is documented honestly below rather than silently worked around.

## Boundary

S-REG-29 includes:

- Metric exercise link registry activation record.
- S-REG-23 hold reference and supersession record.
- S-REG-24 contract reference and supersession record.
- The active `registries/metric_exercise_link/metric_exercise_link.registry.json` file - **12 of the 13** entries in the candidate content produced by S-REG-12 (`ci/registry/candidates/metric_exercise_link_registry_1c_a/metric_exercise_link_registry_1c_a.candidate.registry.json`), converted to active shape by dropping candidate-only bookkeeping fields (`context_scope`, `source_slice_id`, `candidate_status`, `runtime_status`, `activation_ready`).
- **Excluded**: `rugby_union__body_mass_kg__front_plank`, whose `exercise_id: "front_plank"` does not exist in the live 19-entry active `exercise` registry (`front_plank` only exists in the still-inactive `exercise_registry_3a` candidate, whose content was never migrated into the live exercise registry - see S-REG-04's bridge doc). No generic guard checks this cross-registry reference; `s_v1_24_registry_load_order_fk_closure_guard.mjs`'s hardcoded edge list does not mention `metric_exercise_link` at all. The repository owner was shown this finding directly and explicitly chose to activate only the 12 records with verified-valid `exercise_id` and `sport_metric_id` references, rather than ship the dangling one or hold the entire domain over a single bad record.
- The `ci/schemas/metric_exercise_link.registry.schema.json` file, required by `registry_schema_presence_guard.mjs`.
- `registries/registry_index.json` order extended with `metric_exercise_link`, appended after `sport_role`.
- `registries/registry_bundle.json` regenerated to include the metric_exercise_link domain.
- `registries/registry_surface_classification.json` extended with the metric_exercise_link registry, classified `launch_critical` like every sibling active domain.
- A full seal `pre_seal` → `sealed` round-trip across all four seal evidence files, re-pinning the metric_exercise_link registry hash.
- This slice's own module (`ci/registry/s_reg_29_metric_exercise_link_registry_activation.mjs`) additionally validates, for real, that every activated record's `exercise_id` exists in the live exercise registry and every `sport_metric_id` exists in the live sport_metric registry - a stronger check than any prior activation slice needed, added specifically because no generic guard covers this domain's cross-registry references.
- Test and guard proof, including running all of S-REG-24's required proof commands for real.
- A preemptive fix to `test/s_reg_25_equipment_registry_activation.test.mjs`, `test/s_reg_26_sport_subdivision_registry_activation.test.mjs`, `test/s_reg_27_sport_metric_registry_activation.test.mjs`, and `test/s_reg_28_sport_role_registry_activation.test.mjs`, all of which still asserted "metric_exercise_link was not activated" - removed before it broke, the same class of fix already applied reactively/preemptively for `sport_metric` and `sport_role`.
- Documentation.
- Package proof script.
- Generated indexes and checksums through existing generators.

## Non-scope

S-REG-29 must not touch:

- Any other candidate domain - `metric_exercise_link` only. `threshold_marker_registry` (depends on this newly-active domain) remains held for a future slice.
- `engine/`, `src/`, `server/`, `app/`, `web/`, or `supabase/` source.
- The live `registries/exercise/exercise.registry.json` or `registries/sport_metric/sport_metric.registry.json` files - read-only references, never mutated by this slice.
- `shared/v1-registry/v1RegistryDomainScaffold.mjs`'s frozen exact-membership domain list - unrelated to this activation, does not include `metric_exercise_link`.
- `ci/guards/registry_law_guard.mjs`, `scripts/bundle_writer.cjs`, `ci/guards/s_v1_24_registry_load_order_fk_closure_guard.mjs`, or any other existing CI script - all are already generic over `registry_index.json`'s `order[]` and require no edit for a new domain. `s_v1_24`'s FK-closure guard has a hardcoded, closed `registryDependencyEdges` list that does not mention `metric_exercise_link`, so it no-ops harmlessly for this domain - which is precisely why this slice's own module adds its own real cross-registry validation instead of relying on a generic check that does not exist.
- Marker evaluator behaviour, real value comparison, advice, outcome inference.
- Programme assignment, substitution runtime, UI behaviour, coach interpretation.
- Deterministic engine output - proven unchanged by the runtime parity proof below, since nothing yet consumes the metric_exercise_link registry.

No engine consumption, no marker evaluator behaviour, no real comparison, no advice, no outcome inference.

## Activation identity

- `slice_id`: `S-REG-29`
- `activation_id`: `metric_exercise_link_registry_activation`
- `decision_type`: `activation`
- `source_hold_slice_id`: `S-REG-23`
- `source_contract_slice_id`: `S-REG-24`
- `source_candidate_slice_id`: `S-REG-12`
- `runtime_status`: `non_runtime`
- `activation_decision`: `authorised`
- `activation_target`: `metric_exercise_link_registry`
- `activated_registry_id`: `metric_exercise_link`

## Human authorisation

Activation was explicitly named by the repository owner in chat, continuing the S-REG chain immediately after S-REG-28's merge. Before building, research surfaced the `front_plank` dangling reference described above; the repository owner was shown this finding and three explicit options (activate the 12 valid records only, activate all 13 including the dangling one, or hold the domain entirely) and chose to activate only the 12 records with verified-valid references.

This is a human-authorised activation decision, recorded once and never silently repeated for a different target without a fresh, equally explicit decision.

## Covered S-REG-23 requirements

S-REG-29 satisfies, for the metric_exercise_link target only, every category S-REG-23 required before activation:

- `explicit_activation_slice` - this slice.
- `active_registry_mutation_contract` - S-REG-24's design, satisfied here.
- `registry_index_update_contract` - `registry_index.json` order extended, generic loader, no script edit.
- `registry_bundle_promotion_plan` - `npm run registry:bundle`, fully generic.
- `registry_loader_contract` - `engine/src/registries/loadRegistries.ts` already iterates `order[]` generically; unaffected.
- `active_registry_schema_plan` - `ci/schemas/metric_exercise_link.registry.schema.json`.
- `fk_closure_replay_against_active_bundle` - `registry_law_guard.mjs` re-runs and passes; `s_v1_24_registry_load_order_fk_closure_guard.mjs` no-ops harmlessly since `metric_exercise_link` is not in its hardcoded edge list, but this slice's own module independently validates every record's `exercise_id`/`sport_metric_id` against the live registries for real, which is how the dangling `front_plank` reference was caught and excluded in the first place.
- `registry_seal_freeze_and_gate_plan` - the full `pre_seal` → `sealed` round-trip below.
- `engine_consumption_boundary_decision` - deliberately none: nothing consumes the metric_exercise_link registry yet, `runtime_status` stays `non_runtime`.
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

## Seal cycle

`ci/evidence/registry_seal_lifecycle.v1.json`'s `current_state` was set to `pre_seal` (a direct, permitted data edit - not a script-driven transition attempt, so it was never legality-checked against `allowed_transitions`), the new metric_exercise_link file's path (and, for the snapshot, its real sha256) was appended to `registry_seal_manifest.v1.json`, `registry_seal_live_surface.v1.json`, and `registry_seal_snapshot.v1.json`, then `node ci/scripts/run_registry_seal_freeze.mjs` flipped `current_state` back to `sealed` via the one pre-existing lawful transition (`pre_seal` → `sealed`) and self-verified via the gate. `node ci/scripts/run_registry_seal_gate.mjs` and `node ci/scripts/run_registry_seal_drift_diff_reporter.mjs` were both run independently afterward and reported zero drift.

## Rollback plan

Primary: `git revert <this-slice-commit>` reverses every data file atomically back to the pre-activation sealed state in one step.

Fallback if a clean revert is not possible: remove `metric_exercise_link` from `registries/registry_index.json`'s `order[]`, delete `registries/metric_exercise_link/metric_exercise_link.registry.json` and `ci/schemas/metric_exercise_link.registry.schema.json`, remove the metric_exercise_link entries from `registries/registry_surface_classification.json` and the three seal evidence files (manifest, live surface, snapshot), regenerate the bundle via `npm run registry:bundle`, then re-run the freeze/gate cycle to confirm the tree returns to a clean sealed state matching the pre-activation snapshot recorded in `active_registry_hashes_before`.

## Runtime parity proof

`npm run e2e:golden`'s 13 fixtures were captured before this activation and re-captured after every mutation in this slice. 11 of 13 were byte-identical. The remaining 2 - `phase3_precedence_banned_over_available` and `phase3_sovereign_constraints_envelope`, the only fixtures that exercise PHASE_3's constraints-resolution output - changed in exactly one place: the factual "which registry files were loaded" list correctly gained `metric_exercise_link` (already containing `sport_role` from S-REG-28), since PHASE_3 builds that list generically from `registry_index.json`'s `order[]`, the same mechanism every other registry already goes through. No decision, content, exercise, template, or compile-output field changed in either fixture. The two golden snapshots were re-pinned via `UPDATE_GOLDEN=1 npm run e2e:golden` and re-verified by `node ci/guards/golden_manifest_guard.mjs` and `node ci/guards/golden_outputs_guard.mjs`. This is recorded honestly rather than claimed as a bare byte-identical pass - the activation record's `runtime_parity_proof.identical: true` refers to engine decision output, not to the byte-level snapshot, which was not identical for these 2 of 13 fixtures for the reason given. This activation also required the same BETA replay-corpus re-pin cascade already established for S-REG-25/26/27/28 (`replay/suite/beta_phase1_7`'s vectors/bindings/expected-outputs and the chain of dependent manifests through BETA-22/23/24/26/29).

## Proof

Expected proof:

- `node --test test/s_reg_29_metric_exercise_link_registry_activation.test.mjs`
- `node ci/guards/s_reg_29_metric_exercise_link_registry_activation_guard.mjs`
- `npm.cmd run proof:s-reg-29`
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
- S-REG-25/26/27/28 guards (must remain green - unaffected by this slice).
- `npm.cmd run lint:fast`

## Final boundary

S-REG-29 activates the `metric_exercise_link` registry domain only, with 12 of the source candidate's 13 records - the dangling `rugby_union__body_mass_kg__front_plank` record was explicitly excluded, documented honestly rather than shipped or silently dropped.

It does not activate any other candidate domain, create marker evaluator behaviour, compare real values, emit advice, infer outcomes, alter programme assignment, alter substitution runtime, create UI behaviour, or alter deterministic engine output.
