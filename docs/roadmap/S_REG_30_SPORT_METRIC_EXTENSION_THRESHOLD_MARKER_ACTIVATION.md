# S-REG-30 — Sport Metric Extension + Threshold Marker Registry Activation

## Purpose

S-REG-30 is the sixth explicit activation slice authorised after S-REG-23's hold and S-REG-24's contract design (S-REG-25 activated `equipment`, S-REG-26 activated `sport_subdivision`, S-REG-27 activated `sport_metric`, S-REG-28 activated `sport_role`, S-REG-29 activated `metric_exercise_link` first).

Unlike every prior activation in this chain, this is the first slice that mutates the **content** of an already-active, previously-merged registry (`sport_metric`) rather than only ever adding new files. It also activates a brand-new domain, `threshold_marker`.

Human-authorised, not a hold or a design.

Research before building surfaced that `threshold_marker_registry` has no dedicated `ci/registry/candidates/` directory - its content lives at `ci/registry/s_reg_21_threshold_marker_candidate_records.json` (5 records). Cross-checking every record's `sport_metric_id` against the live 6-entry `sport_metric` registry showed all 5 reference metrics that did not exist: `powerlifting__attempt_count`, `general_strength__set_count`, `general_strength__duration_seconds`. Root cause: `ci/registry/s_reg_19_sport_metric_candidate_expansion.json` contains a second, never-activated batch of 6 sport_metric candidates - S-REG-27 only ever activated the original S-REG-11 seed batch of 6. Of that second batch, only the 3 records above are actually needed by threshold_marker; the other 3 (`powerlifting__body_mass_kg`, `rugby_union__jump_height_cm`, `rugby_union__sprint_distance_m`) are unreferenced by anything and were deliberately left inactive.

This is documented honestly below rather than silently worked around.

## Boundary

S-REG-30 includes:

- Extension of the already-active `registries/sport_metric/sport_metric.registry.json` with exactly 3 new entries (`powerlifting__attempt_count`, `general_strength__set_count`, `general_strength__duration_seconds`), sourced from S-REG-19's expansion batch, converted to active shape by dropping candidate-only bookkeeping fields (`context_scope`, `source_slice_id`, `candidate_status`, `runtime_status`, `activation_ready`). The registry's entry count grows from 6 to 9; the original 6 entries are unchanged.
- Activation record for the sport_metric extension + threshold_marker activation, plus S-REG-23 hold reference and S-REG-24 contract reference and supersession records.
- The active `registries/threshold_marker/threshold_marker.registry.json` file - all 5 entries in the candidate content produced by S-REG-21 (`ci/registry/s_reg_21_threshold_marker_candidate_records.json`), converted to active shape by dropping candidate-only bookkeeping fields (`source_slice_id`, `candidate_status`, `runtime_status`, `activation_ready`). Unlike S-REG-29, no records needed to be excluded - once the sport_metric extension above lands, all 5 records' `sport_metric_id` and `activity_id` references are valid.
- The `ci/schemas/threshold_marker.registry.schema.json` file, required by `registry_schema_presence_guard.mjs`.
- `registries/registry_index.json` order extended with `threshold_marker`, appended after `metric_exercise_link` (10th domain).
- `registries/registry_bundle.json` regenerated to include the threshold_marker domain.
- `registries/registry_surface_classification.json` extended with the threshold_marker registry, classified `launch_critical` like every sibling active domain.
- A full seal `pre_seal` → `sealed` round-trip across all four seal evidence files. This is the first slice in the chain where the snapshot's sha256 for an already-sealed file (`sport_metric.registry.json`) had to be **recomputed**, not just appended-to, since its content changed - the drift-diff reporter confirmed zero drift afterward with the recomputed hash in place.
- This slice's own module (`ci/registry/s_reg_30_sport_metric_extension_threshold_marker_activation.mjs`) validates, for real, that the 3 extended sport_metric records are present, and that every activated threshold_marker record's `sport_metric_id` exists in the live (post-extension) sport_metric registry and `activity_id` exists in the live activity registry - the same cross-registry validation pattern S-REG-29 introduced, since no generic guard covers threshold_marker's references.
- A newly-discovered fix to **S-REG-27's own module and test** (`ci/registry/s_reg_27_sport_metric_registry_activation.mjs`, `test/s_reg_27_sport_metric_registry_activation.test.mjs`): both hardcoded an exact match between the live `sport_metric` entry count and S-REG-27's own frozen `activated_record_count` (6). This slice's sport_metric extension (6 → 9 entries) broke that exact match. The check was relaxed to a membership check (`S_REG_27_ORIGINALLY_ACTIVATED_SPORT_METRIC_IDS`: the live registry must still contain the 6 sport_metric_ids S-REG-27 itself activated) - S-REG-27's own frozen `activated_record_count: 6` is unchanged, since it is a historical fact of what that slice activated, not a live-surface check. This is a new, third bug class in this chain (live registry CONTENT/entry-count drift), distinct from the previously-fixed live-order-array and stale-existsSync classes.
- A preemptive fix to `test/s_reg_25_equipment_registry_activation.test.mjs`, `test/s_reg_26_sport_subdivision_registry_activation.test.mjs`, `test/s_reg_28_sport_role_registry_activation.test.mjs`, and `test/s_reg_29_metric_exercise_link_registry_activation.test.mjs`, all of which still asserted "threshold_marker was not activated" - removed before it broke, the same class of fix already applied reactively/preemptively for `sport_metric`, `sport_role`, and `metric_exercise_link`.
- A second, previously-latent bug discovered during this sweep: `test/s_reg_29_metric_exercise_link_registry_activation.test.mjs` still exact-matched the live registry order/bundle keys instead of using the prefix-match pattern its own module already used from authoring - the same copy-paste class already fixed for S-REG-28 during S-REG-29's own development, now fixed here since it surfaced when threshold_marker legitimately extended the live order past 9 domains.
- Test and guard proof, including running all of S-REG-24's required proof commands for real.
- Documentation.
- Package proof script.
- Generated indexes and checksums through existing generators.

## Non-scope

S-REG-30 must not touch:

- Any other candidate domain - `sport_metric` (extension only) and `threshold_marker` only. The other 3 records in S-REG-19's expansion batch (`powerlifting__body_mass_kg`, `rugby_union__jump_height_cm`, `rugby_union__sprint_distance_m`) remain inactive by deliberate choice, since nothing references them.
- `engine/`, `src/`, `server/`, `app/`, `web/`, or `supabase/` source.
- The live `registries/activity/activity.registry.json` file - read-only reference, never mutated by this slice.
- `shared/v1-registry/v1RegistryDomainScaffold.mjs`'s frozen exact-membership domain list - unrelated to this activation.
- `ci/guards/registry_law_guard.mjs`, `scripts/bundle_writer.cjs`, `ci/guards/s_v1_24_registry_load_order_fk_closure_guard.mjs`, or any other existing CI script - all are already generic over `registry_index.json`'s `order[]` and require no edit for a new domain or an existing domain's content growth.
- Marker evaluator behaviour, real value comparison, advice, outcome inference.
- Programme assignment, substitution runtime, UI behaviour, coach interpretation.
- Deterministic engine output - proven unchanged by the runtime parity proof below, since nothing yet consumes the threshold_marker registry, and sport_metric's entry-count growth is not reflected in any engine decision output.

No engine consumption, no marker evaluator behaviour, no real comparison, no advice, no outcome inference.

## Activation identity

- `slice_id`: `S-REG-30`
- `activation_id`: `sport_metric_extension_threshold_marker_activation`
- `decision_type`: `activation`
- `source_hold_slice_id`: `S-REG-23`
- `source_contract_slice_id`: `S-REG-24`
- `source_candidate_slice_id_extension`: `S-REG-19`
- `source_candidate_slice_id_activation`: `S-REG-21`
- `runtime_status`: `non_runtime`
- `activation_decision`: `authorised`
- `activation_target`: `threshold_marker_registry`
- `activated_registry_id`: `threshold_marker`
- `extended_registry_id`: `sport_metric`

## Human authorisation

Activation was explicitly named by the repository owner in chat ("activate threshold_marker_registry next"), continuing the S-REG chain immediately after S-REG-29's merge. Before building, research surfaced that all 5 threshold_marker candidate records referenced sport_metric_ids absent from the live registry, traced to S-REG-19's never-activated expansion batch. The repository owner was shown this finding via `AskUserQuestion` with two options (extend sport_metric with the needed records then activate threshold_marker, or hold the domain) and chose the former.

This is a human-authorised activation decision, recorded once and never silently repeated for a different target without a fresh, equally explicit decision.

## Covered S-REG-23 requirements

S-REG-30 satisfies, for the threshold_marker target and the sport_metric extension, every category S-REG-23 required before activation:

- `explicit_activation_slice` - this slice.
- `active_registry_mutation_contract` - S-REG-24's design, satisfied here, extended for the first time to cover mutating an already-active domain's content.
- `registry_index_update_contract` - `registry_index.json` order extended, generic loader, no script edit.
- `registry_bundle_promotion_plan` - `npm run registry:bundle`, fully generic.
- `registry_loader_contract` - `engine/src/registries/loadRegistries.ts` already iterates `order[]` generically; unaffected.
- `active_registry_schema_plan` - `ci/schemas/threshold_marker.registry.schema.json`.
- `fk_closure_replay_against_active_bundle` - `registry_law_guard.mjs` re-runs and passes; `s_v1_24_registry_load_order_fk_closure_guard.mjs` no-ops harmlessly since neither domain is in its hardcoded edge list, but this slice's own module independently validates every threshold_marker record's `sport_metric_id`/`activity_id` against the live registries for real.
- `registry_seal_freeze_and_gate_plan` - the full `pre_seal` → `sealed` round-trip below, including the first-ever recomputed hash for an already-sealed file's changed content.
- `engine_consumption_boundary_decision` - deliberately none: nothing consumes the threshold_marker registry yet, `runtime_status` stays `non_runtime`.
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

## Seal cycle

`ci/evidence/registry_seal_lifecycle.v1.json`'s `current_state` was set to `pre_seal` (a direct, permitted data edit - not a script-driven transition attempt, so it was never legality-checked against `allowed_transitions`). The new threshold_marker file's path and real sha256 were appended to `registry_seal_manifest.v1.json`, `registry_seal_live_surface.v1.json`, and `registry_seal_snapshot.v1.json`. Additionally - a new mechanic not needed by any prior slice - `sport_metric.registry.json`'s existing sha256 entry in `registry_seal_snapshot.v1.json` was **recomputed** to reflect its extended content, since this is the first slice to mutate an already-sealed file's content rather than only add new files. `node ci/scripts/run_registry_seal_freeze.mjs` then flipped `current_state` back to `sealed` via the one pre-existing lawful transition (`pre_seal` → `sealed`) and self-verified via the gate. `node ci/scripts/run_registry_seal_gate.mjs` and `node ci/scripts/run_registry_seal_drift_diff_reporter.mjs` were both run independently afterward and reported zero drift, confirming the recomputed hash was correct.

## Rollback plan

Primary: `git revert <this-slice-commit>` reverses every data file atomically back to the pre-extension, pre-activation sealed state in one step.

Fallback if a clean revert is not possible: remove the 3 extended entries from `registries/sport_metric/sport_metric.registry.json`, remove `threshold_marker` from `registries/registry_index.json`'s `order[]`, delete `registries/threshold_marker/threshold_marker.registry.json` and `ci/schemas/threshold_marker.registry.schema.json`, remove the threshold_marker entries from `registries/registry_surface_classification.json` and the three seal evidence files (also reverting the snapshot's sport_metric hash entry to its pre-extension value), regenerate the bundle via `npm run registry:bundle`, then re-run the freeze/gate cycle to confirm the tree returns to a clean sealed state matching the pre-extension snapshot recorded in `active_registry_hashes_before`.

## Runtime parity proof

`npm run e2e:golden`'s 13 fixtures were captured before this slice and re-captured after every mutation in this slice. 11 of 13 were byte-identical. The remaining 2 - `phase3_precedence_banned_over_available` and `phase3_sovereign_constraints_envelope`, the only fixtures that exercise PHASE_3's constraints-resolution output - changed in exactly one place: the factual "which registry files were loaded" list correctly gained `threshold_marker` after `metric_exercise_link`, since PHASE_3 builds that list generically from `registry_index.json`'s `order[]`, the same mechanism every other registry already goes through. sport_metric's growth from 6 to 9 entries is not reflected in this list, since it only lists domain names, not entry counts. No decision, content, exercise, template, or compile-output field changed in either fixture. The two golden snapshots were re-pinned via `UPDATE_GOLDEN=1 npm run e2e:golden` and re-verified by `node ci/guards/golden_manifest_guard.mjs` and `node ci/guards/golden_outputs_guard.mjs`. This is recorded honestly rather than claimed as a bare byte-identical pass - the activation record's `runtime_parity_proof.identical: true` refers to engine decision output, not to the byte-level snapshot, which was not identical for these 2 of 13 fixtures for the reason given. This slice also required the same BETA replay-corpus re-pin cascade already established for S-REG-25/26/27/28/29 (`replay/suite/beta_phase1_7`'s vectors/bindings/expected-outputs and the chain of dependent manifests through BETA-22/23/24/26/29).

## Proof

Expected proof:

- `node --test test/s_reg_30_sport_metric_extension_threshold_marker_activation.test.mjs`
- `node ci/guards/s_reg_30_sport_metric_extension_threshold_marker_activation_guard.mjs`
- `npm.cmd run proof:s-reg-30`
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
- S-REG-25/26/27/28/29 guards (must remain green - S-REG-27's own logic was updated to tolerate sport_metric's growth, per its own supersession log; the others are unaffected).
- `npm.cmd run lint:fast`

## Final boundary

S-REG-30 extends the `sport_metric` registry domain with 3 records and activates the `threshold_marker` registry domain with all 5 of its candidate records.

It does not activate any other candidate domain, create marker evaluator behaviour, compare real values, emit advice, infer outcomes, alter programme assignment, alter substitution runtime, create UI behaviour, or alter deterministic engine output.
