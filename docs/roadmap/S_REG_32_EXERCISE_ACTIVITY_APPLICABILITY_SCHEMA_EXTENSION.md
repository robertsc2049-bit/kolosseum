# S-REG-32 — Exercise Activity Applicability Schema Extension

## Purpose

S-REG-32 extends the already-active `exercise` registry's schema and all 19 live entries with two new fields, `primary_activity_applicability` and `secondary_activity_applicability`, required by the upcoming S-REG-33 activation of `exercise_activity_applicability`.

Unlike every S-REG activation slice (S-REG-25 through S-REG-31), this slice does not bring any new registry domain into the active surface. `registry_index.json`'s `order[]` is unchanged. It does not claim S-REG-23/24's activation authority and is not recorded in their supersession logs - the same way S-REG-25's own exercise-schema extension for `equipment_requirements`/`equipment_alternatives` was bundled inside that activation slice rather than claimed as a separate activation.

`runtime_status` stays `non_runtime` for this slice - nothing consumes the new fields yet.

## Why this is needed

Research into activating the last remaining candidate, `exercise_activity_applicability_registry`, found that `ci/guards/s_v1_23_exercise_activity_applicability_coverage_guard.mjs` requires every exercise record fed to its validator to already carry `primary_activity_applicability` and `secondary_activity_applicability` fields - fields that do not exist on any of the 19 live exercise entries today. This slice adds them first, as a standalone, reviewable step, before S-REG-33 builds the full applicability closure on top.

## Derivation rule (confirmed by explicit human decision)

An exercise applies to an activity iff its `pattern` field appears in that activity's `allowed_movement_ids`, sourced from `ci/registry/candidates/activity_registry_1` (already legacy-active via S-REG-04's bridge):

- `powerlifting`: `squat, hinge, horizontal_push, horizontal_pull, brace`
- `general_strength`: `squat, hinge, horizontal_push, vertical_push, horizontal_pull, vertical_pull, carry, brace, lunge_split_stance`
- `rugby_union`: `squat, hinge, horizontal_push, vertical_push, horizontal_pull, vertical_pull, carry, brace, sprint_acceleration, deceleration_change_of_direction, jump_land, conditioning_general`

Powerlifting is the only activity that excludes `vertical_push` - the 4 live exercises with that pattern (`overhead_press`, `dumbbell_overhead_press`, `single_arm_overhead_press`, `pike_push_up`) apply to `general_strength` and `rugby_union` only.

Primary/secondary split: the 3 competition-lift exercises (`back_squat`, `deadlift`, `bench_press`) get `primary_activity_applicability: "powerlifting"`; every other exercise gets `primary_activity_applicability: "general_strength"`. `secondary_activity_applicability` is every other genuinely-applicable activity for that exercise.

## Boundary

S-REG-32 includes:

- `primary_activity_applicability` (string) and `secondary_activity_applicability` (array) added to all 19 entries in `registries/exercise/exercise.registry.json`.
- Both fields added to `properties` and `required` in all 3 exercise schema files: `ci/schemas/exercise.registry.schema.json`, `ci/schemas/exercise.registry.schema.v1.0.0.json`, `ci/schemas/exercise_registry.schema.json` - mirroring exactly how `equipment_requirements`/`equipment_alternatives` were added to all 3 during S-REG-25's extension, except made `required` this time since every exercise has a real value from the start.
- `registries/registry_bundle.json` regenerated to reflect the extended exercise content.
- A seal snapshot re-pin for `exercise.registry.json`'s recomputed hash (the same content-mutation mechanic S-REG-30 introduced for `sport_metric`).
- This slice's own module (`ci/registry/s_reg_32_exercise_activity_applicability_schema_extension.mjs`) independently re-derives and validates every exercise's `primary_activity_applicability`/`secondary_activity_applicability` against the pattern → `allowed_movement_ids` rule, rather than merely checking field presence.
- Test and guard proof.
- Documentation.
- Package proof script.
- Generated indexes and checksums through existing generators.

## Non-scope

S-REG-32 must not touch:

- `registries/registry_index.json`'s `order[]`, `registries/registry_surface_classification.json`, or any candidate domain's activation - no new registry domain becomes active in this slice.
- `registries/exercise_activity_applicability/exercise_activity_applicability.registry.json` or `ci/guards/s_v1_23_exercise_activity_applicability_coverage_guard.mjs` - both are S-REG-33's responsibility.
- `engine/`, `src/`, `server/`, `app/`, `web/`, or `supabase/` source.
- Marker evaluator behaviour, real value comparison, advice, outcome inference, programme assignment, substitution runtime, UI behaviour, coach interpretation.
- Deterministic engine output - proven unchanged by the runtime parity proof below. Since `registry_index.json`'s `order[]` is untouched, PHASE_3's `loaded_registries` list (the only thing golden fixtures are sensitive to for registry changes) is not affected at all - this was verified directly by running `npm run e2e:golden`, which reported all 13 fixtures byte-identical with zero re-pinning needed, not merely assumed.

## Runtime parity proof

`npm run e2e:golden`'s 13 fixtures were captured before this slice and re-captured after every mutation in this slice. All 13 were byte-identical, including `phase3_precedence_banned_over_available` and `phase3_sovereign_constraints_envelope` - unlike every prior S-REG slice, this one required **zero** golden fixture re-pinning, since it never touches `registry_index.json`'s `order[]` and PHASE_3's `loaded_registries` list is generated entirely from that order. This was confirmed by actually running the golden suite, not assumed from the absence of a new domain.

## Rollback plan

Primary: `git revert <this-slice-commit>` reverses the extended `exercise.registry.json`, all 3 exercise schema files, `registry_bundle.json`, and the seal snapshot hash atomically back to the pre-extension sealed state in one step.

Fallback if a clean revert is not possible: remove `primary_activity_applicability`/`secondary_activity_applicability` from all 19 entries in `registries/exercise/exercise.registry.json` and from the `required`/`properties` lists in all 3 exercise schema files, then run `npm run registry:bundle` and `node ci/scripts/run_registry_seal_freeze.mjs` to confirm the tree returns to a clean sealed state matching the pre-extension snapshot recorded in `active_registry_hashes_before`.

## Proof

Expected proof:

- `node --test test/s_reg_32_exercise_activity_applicability_schema_extension.test.mjs`
- `node ci/guards/s_reg_32_exercise_activity_applicability_schema_extension_guard.mjs`
- `npm.cmd run proof:s-reg-32`
- `node ci/guards/registry_bundle_guard.mjs`
- `node ci/guards/registry_law_guard.mjs`
- `node ci/guards/registry_schema_presence_guard.mjs`
- `node ci/guards/s_v1_24_registry_load_order_fk_closure_guard.mjs`
- `node ci/guards/s_v1_21_exercise_registry_contract_guard.mjs`
- `node ci/guards/s_v1_22_equipment_registry_coverage_contract_guard.mjs` (must stay green - unrelated domain, confirms no cross-contamination)
- `node ci/scripts/run_registry_seal_gate.mjs`
- `node ci/scripts/run_registry_seal_drift_diff_reporter.mjs`
- `node ci/scripts/run_failure_token_index_guard.mjs`
- `node ci/guards/guards_index_guard.mjs`
- `node ci/guards/guards_entrypoint_coverage_guard.mjs`
- `npm.cmd run lint:fast`

## Final boundary

S-REG-32 extends the `exercise` registry's schema and content only, preparing it for S-REG-33's activation of `exercise_activity_applicability`.

It does not activate any candidate domain, create marker evaluator behaviour, compare real values, emit advice, infer outcomes, alter programme assignment, alter substitution runtime, create UI behaviour, or alter deterministic engine output.
