# S-REG-25 — Equipment Registry Activation

## Purpose

S-REG-25 is the first explicit activation slice authorised after S-REG-23's hold and S-REG-24's contract design.

It activates exactly one candidate domain - `equipment` - satisfying S-REG-24's contract for that target only.

Human-authorised activation, not a hold or a design.

Full CI on this slice's initial 6-record activation surfaced a separate,
pre-existing, stricter contract - S-V1-22, `ci/guards/s_v1_22_equipment_registry_coverage_contract_guard.mjs`
- that unconditionally blocked any active equipment registry file until 17
equipment ids exist and every active exercise record carries explicit
`equipment_requirements`/`equipment_alternatives` FK-closing arrays. The
repository owner explicitly chose to build that full real contract rather
than abandon or roll back equipment as the activation target. This slice's
final scope therefore covers both the original 6-domain activation and the
full 17-record, exercise-annotated V1 contract described below.

## Boundary

S-REG-25 includes:

- Equipment registry activation record.
- S-REG-23 hold reference and supersession record.
- S-REG-24 contract reference and supersession record.
- The active `registries/equipment/equipment.registry.json` file - all 17 equipment ids S-V1-22 requires, sourced from the real, differentiated dataset already present in `ci/fixtures/v1_equipment_registry_coverage_contract_negative/s_v1_22_missing_equipment_reference_negative.json`'s `equipment_records` array (this replaced the original 6-record set, which had been sourced from a different, less-authoritative track - the S-REG-07 candidate content - to avoid mixing two data sources for the same registry).
- The `ci/schemas/equipment.registry.schema.json` file, required by `registry_schema_presence_guard.mjs`, extended to require the 4 additional S-V1-22 contract fields (`substitution_relevance`, `template_relevance`, `low_equipment_alternative_relevance`, `copy_legal_boundary_notes`) on every entry.
- The three byte-identical exercise registry schema files (`ci/schemas/exercise_registry.schema.json`, `exercise.registry.schema.json`, `exercise.registry.schema.v1.0.0.json`), each extended with two new optional per-entry array fields: `equipment_requirements`, `equipment_alternatives`.
- `registries/exercise/exercise.registry.json` - all 19 active entries annotated with `equipment_requirements` (translated from each entry's existing legacy `equipment[]` field via a direct token mapping: `dumbbells`→`dumbbell`, `incline_bench`→`bench`, `machine`→`machine_general`, everything else already matched) and `equipment_alternatives: []` (left honestly empty for every entry - no existing data source in this repository distinguishes true substitutable alternatives from requirements, and inventing that distinction would be a product judgement call outside this slice's scope).
- `ci/guards/s_v1_22_equipment_registry_coverage_contract_guard.mjs` evolved from unconditionally blocking any active equipment registry file to additionally validating real active content, once present, against the same `validateEquipmentRegistryCoverage` function its fixture-based negative proof already exercised. The fixture-based proof is unchanged. `test/s_v1_22_equipment_registry_coverage_contract.test.mjs` and `docs/v1/V1_EQUIPMENT_REGISTRY_COVERAGE_CONTRACT.md` gained matching real-content coverage, appended rather than rewritten (see that doc's own supersession log).
- `registries/registry_index.json` order extended with `equipment`.
- `registries/registry_bundle.json` regenerated to include the equipment domain and the exercise-side annotations.
- `registries/registry_surface_classification.json` extended with the equipment registry, classified `launch_critical` like every sibling active domain.
- A full seal `pre_seal` → `sealed` round-trip across all four seal evidence files, re-pinning both the equipment and exercise registry hashes.
- Test and guard proof, including running all of S-REG-24's required proof commands for real, plus S-V1-22's own guard and test now validating real content and S-V1-24's FK-closure guard now genuinely enforcing (previously a no-op with no exercise carrying these fields).
- Documentation.
- Package proof script.
- Generated indexes and checksums through existing generators.

## Non-scope

S-REG-25 must not touch:

- Any other candidate domain (`exercise_registry_3a`, `sport_metric_registry_1c`, `metric_exercise_link_registry_1c_a`, `threshold_marker_registry`, etc.) - equipment only.
- `engine/`, `src/`, `server/`, `app/`, `web/`, or `supabase/` source.
- `ci/guards/registry_law_guard.mjs`, `scripts/bundle_writer.cjs`, `ci/guards/s_v1_24_registry_load_order_fk_closure_guard.mjs`, or any other existing CI script not named in this slice's boundary above - all are already generic over `registry_index.json`'s `order[]` and either require no edit for a new domain, or (for S-V1-24's FK-closure logic) already contained the enforcement this slice needed and simply began firing for real once real `equipment_requirements`/`equipment_alternatives` data existed. `ci/guards/s_v1_22_equipment_registry_coverage_contract_guard.mjs` is the sole exception, named explicitly in this slice's boundary above, because S-V1-22's own contract is what this slice's expanded scope exists to satisfy.
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
- `fk_closure_replay_against_active_bundle` - `registry_law_guard.mjs` re-runs and passes; `s_v1_24_registry_load_order_fk_closure_guard.mjs`'s FK-closure logic, previously a no-op with no exercise carrying `equipment_requirements`/`equipment_alternatives`, now genuinely enforces every exercise's equipment reference against the real 17-id equipment registry, and passes.
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
- `node ci/guards/s_v1_22_equipment_registry_coverage_contract_guard.mjs`
- `node --test test/s_v1_22_equipment_registry_coverage_contract.test.mjs`
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

## Supersession log (append-only)

S-REG-26 later extended the active registry index and bundle with a sixth domain, `sport_subdivision`, appended after `equipment`. That extension was a separate, explicitly human-authorised activation decision and does not touch this slice's own equipment content, schema, or claims in any way - `equipment` remains in its same position, fifth in the active order. This module's own live-file checks (`assertActiveRegistrySurfaceExtendedCorrectly`) were relaxed from an exact-length match to a prefix match against `registries/registry_index.json`'s `order[]` and `registries/registry_bundle.json`'s keys, mirroring the identical fix already applied to S-REG-04/23/24 during this slice's own development - this slice's own historical `active_registry_order_after` field (recorded in `ci/registry/s_reg_25_equipment_registry_activation.json`) is unchanged and still exact-matched, since it is a frozen record of what was true at authoring time, not a live-file check.

- superseded_by_slice_ids: S-REG-26, S-REG-27, S-REG-30

S-REG-27 later extended the active registry index and bundle with a seventh domain, `sport_metric`, appended after `sport_subdivision`. That extension also exposed a second, previously-latent issue in this slice's own **test** file (not its module): `test/s_reg_25_equipment_registry_activation.test.mjs` still asserted `fs.existsSync("registries/sport_metric/sport_metric.registry.json") === false` - a check written to mean "no other domain was activated alongside equipment in this slice," but expressed as a permanent live-filesystem assertion, so it broke the moment `sport_metric` was legitimately activated by a later, separate slice. The order/bundle-key checks in the test were relaxed to the same prefix-match already used by the module (`registryIndex.order.slice(0, length)`), and the stale `sport_metric` existence check was removed; the still-held `threshold_marker` check is untouched since it remains true.

S-REG-30 later activated `threshold_marker` as the tenth active domain, appended after `metric_exercise_link`. This slice's own test still asserted `fs.existsSync("registries/threshold_marker/threshold_marker.registry.json") === false` - the same stale-negative-existence pattern already fixed for `sport_metric` above - and was removed preemptively as part of S-REG-30's build.
