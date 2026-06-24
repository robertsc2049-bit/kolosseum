# S-REG-20 — Metric-Exercise Link Candidate Expansion

## Status

Candidate content expansion.

S-REG-20 is candidate metric-exercise link expansion only.

## Purpose

S-REG-20 creates the first inert candidate metric-exercise link expansion after S-REG-19.

It adds factual FK relationship records between selected S-REG-19 sport metric candidates and S-REG-15 exercise candidates where S-REG-18 exercise-activity applicability evidence exists.

## Boundary

- S-REG-20 is candidate metric-exercise link expansion only.
- No active registry activation.
- No changes to registries/registry_index.json.
- No changes to registries/registry_bundle.json.
- No Phase 1 runtime schema change.
- No deterministic engine output change.
- No threshold marker records.
- No marker evaluator behaviour.
- No comparison result.
- No advice.
- No coach interpretation.
- No programme assignment.
- No substitution runtime behaviour.
- No UI behaviour.
- No complete metric-exercise link coverage claim.

## Queue position

S-REG-20 is S-REG-14 queue order 6.

Queue dependency inputs:

- S-REG-15
- S-REG-19

Foundation validation inputs:

- S-REG-12
- S-REG-18

This distinction is intentional. S-REG-14 declares S-REG-20 queue dependencies as S-REG-15 and S-REG-19. S-REG-12 and S-REG-18 remain validation foundations for seed-link duplication checks and exercise-activity applicability evidence.

## Created artefacts

- ci/registry/s_reg_20_metric_exercise_link_candidate_expansion.mjs
- ci/registry/s_reg_20_metric_exercise_link_candidate_expansion.json
- test/s_reg_20_metric_exercise_link_candidate_expansion.test.mjs
- ci/guards/s_reg_20_metric_exercise_link_candidate_expansion_guard.mjs
- docs/roadmap/S_REG_20_METRIC_EXERCISE_LINK_CANDIDATE_EXPANSION.md

## Candidate records

S-REG-20 creates inert factual candidate links for:

- powerlifting__attempt_count__paused_back_squat
- powerlifting__attempt_count__paused_deadlift
- powerlifting__attempt_count__paused_bench_press
- general_strength__set_count__paused_back_squat
- general_strength__set_count__romanian_deadlift
- general_strength__set_count__close_grip_bench_press
- general_strength__duration_seconds__tempo_back_squat
- general_strength__duration_seconds__romanian_deadlift

These are factual FK relationship records only.

## Validation

S-REG-20 validates that:

- The document is S-REG-20.
- The registry target is metric_exercise_link_registry_1c_a.
- The batch id is candidate_metric_exercise_link_expansion_batch_1.
- The source queue order is 6.
- Queue dependency inputs are S-REG-15 and S-REG-19.
- Foundation inputs are S-REG-12 and S-REG-18.
- S-REG-12 seed links remain valid.
- S-REG-15 candidate exercises remain valid.
- S-REG-18 exercise-activity applicability remains valid.
- S-REG-19 sport metrics remain valid.
- Link IDs do not duplicate S-REG-12 seed link IDs.
- Each sport_metric_id resolves to S-REG-19.
- Each exercise_id resolves to S-REG-15.
- Each activity_id matches the referenced S-REG-19 metric.
- Each exercise declares the linked activity_id.
- Each exercise/activity pair has S-REG-18 applicability evidence.
- Active registry files remain unchanged.
- The candidate record order is deterministic.

## Forbidden semantics

S-REG-20 must not contain:

- Active registry activation.
- Canonical registry activation.
- Phase 1 runtime schema mutation.
- Threshold IDs.
- Threshold marker records.
- Threshold values.
- Marker evaluator fields.
- Comparison result fields.
- Selection fields.
- Ranking fields.
- Recommendation fields.
- Optimisation fields.
- Capability fields.
- Readiness fields.
- Safety fields.
- Suitability fields.
- Return-to-play fields.
- Tactical status fields.
- Outcome fields.
- Performance score fields.
- Coach interpretation fields.
- Programme assignment fields.
- Substitution runtime fields.
- UI behaviour fields.

## Proof

Expected proof commands:

- node --test test/s_reg_20_metric_exercise_link_candidate_expansion.test.mjs
- node ci/guards/s_reg_20_metric_exercise_link_candidate_expansion_guard.mjs
- npm.cmd run proof:s-reg-20
- S-REG-19 guard still passes.
- S-REG-18 guard still passes.
- S-REG-15 guard still passes.
- S-REG-14 guard still passes.
- S-REG-12 guard still passes.
- Registry bundle, law, and schema guards still pass.
- Guards entrypoint coverage guard passes.
- Failure token index check passes.
- Guards index guard passes.
- npm.cmd run lint:fast passes.

## Handoff

S-REG-21 receives this inert metric-exercise link expansion as dependency input.

S-REG-20 does not authorise S-REG-21 by itself. S-REG-21 still requires its own explicit slice, proof, and non-scope boundary.