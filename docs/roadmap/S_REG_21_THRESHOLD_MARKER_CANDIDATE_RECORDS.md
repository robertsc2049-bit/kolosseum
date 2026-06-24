# S-REG-21 — Threshold Marker Candidate Records

## Purpose

S-REG-21 creates the first inert candidate threshold marker record batch for `threshold_marker_registry`.

This slice exists after S-REG-13, S-REG-19, and S-REG-20. It uses the S-REG-13 threshold marker boundary contract, the S-REG-19 sport metric candidate expansion, and the S-REG-20 metric-exercise link candidate expansion.

S-REG-21 is candidate content only.

## Boundary

S-REG-21 includes:

- `threshold_marker_registry` candidate record batch 1.
- Explicit declared threshold marker records.
- S-REG-13 allowed field vocabulary.
- S-REG-13 factual marker status vocabulary.
- S-REG-19 sport metric FK validation.
- S-REG-20 metric-exercise link foundation validation.
- S-REG-14 queue alignment.
- Test and guard proof.
- Documentation.
- Package proof script.
- Generated indexes and checksums through existing generators.
- S-REG-20 guard branch-scope compatibility patch for full lint execution on the S-REG-21 branch.

## Non-scope

S-REG-21 must not touch:

- Active registry activation.
- `registries/registry_index.json`.
- `registries/registry_bundle.json`.
- Active registry law.
- Deterministic engine output.
- Phase 1 runtime schema.
- Runtime metric input.
- Recorded value input.
- Real value comparison.
- Marker evaluator.
- Programme assignment.
- Substitution runtime.
- UI behaviour.
- Coach interpretation.
- Advice.
- Outcome inference.
- Readiness, safety, suitability, capability, tactical, return-to-play, recommendation, optimisation, ranking, effectiveness, or programme-outcome semantics.
- Marketplace, licensing, compliance, facility, organisation, team, unit, federation, tactical runtime, or enterprise analytics.

No active registry activation.

No marker evaluator behaviour.

No real comparison.

No advice.

No outcome inference.

## Registry status

- `registry_id`: `threshold_marker_registry`
- `batch_id`: `candidate_threshold_marker_records_batch_1`
- `candidate_status`: `candidate_content_draft`
- `runtime_status`: `non_runtime`
- `activation_ready`: `false`
- `content_batch_status`: `candidate_content_expanded_inert`

## Dependency inputs

S-REG-21 depends on:

- S-REG-13 — threshold marker candidate boundary contract.
- S-REG-19 — sport metric candidate expansion.
- S-REG-20 — metric-exercise link candidate expansion.

S-REG-21 is aligned to S-REG-14 queue order 7.

S-REG-22 receives this inert threshold marker candidate record batch as dependency input.

## Candidate record rules

Each candidate threshold marker record contains only the S-REG-13 allowed fields:

- `threshold_marker_id`
- `sport_metric_id`
- `activity_id`
- `threshold_operator`
- `threshold_value`
- `threshold_unit`
- `threshold_source`
- `marker_status_allowed_values`
- `source_slice_id`
- `candidate_status`
- `runtime_status`
- `activation_ready`
- `copy_boundary_notes`

Each record must:

- Reference a sport metric created or expanded by S-REG-19.
- Reference a metric that has S-REG-20 metric-exercise link evidence.
- Match the S-REG-19 metric activity.
- Match the S-REG-19 metric unit.
- Use S-REG-13 threshold operators.
- Use S-REG-13 factual marker status values.
- Use `coach_declared` source only for this batch.
- Stay `non_runtime`.
- Stay `activation_ready: false`.

## Candidate records

S-REG-21 creates these inert candidate records:

- `threshold_marker__powerlifting__attempt_count__gte_1`
- `threshold_marker__powerlifting__attempt_count__lte_3`
- `threshold_marker__general_strength__set_count__gte_1`
- `threshold_marker__general_strength__duration_seconds__gte_60`
- `threshold_marker__general_strength__duration_seconds__lte_3600`

These records are declared threshold candidates only.

They do not evaluate recorded metric values.

They do not emit marker results.

They do not create coach or athlete instructions.

They do not alter programme assignment, substitution, compile, runtime, history, replay, proof, or export surfaces.

## Factual status vocabulary

Candidate records only carry the allowed future status vocabulary:

- `recorded_met`
- `recorded_not_met`
- `not_recorded`
- `invalid_source`
- `insufficient_recorded_data`

These are factual marker-status labels only for later evaluator design. They must not be used as readiness, safety, suitability, capability, tactical, return-to-play, recommendation, optimisation, intervention, ranking, effectiveness, or outcome semantics.

## Proof

Expected proof:

- `node --test test/s_reg_21_threshold_marker_candidate_records.test.mjs`
- `node ci/guards/s_reg_21_threshold_marker_candidate_records_guard.mjs`
- `npm.cmd run proof:s-reg-21`
- S-REG-13 guard.
- S-REG-19 guard.
- S-REG-20 guard.
- S-REG-14 guard.
- Guards entrypoint coverage guard.
- Failure token index check.
- Guards index guard.
- `npm.cmd run lint:fast`
- Generated-file proof sequence.

## Final boundary

S-REG-21 creates inert candidate threshold marker records only.

It does not activate canonical registries, create marker evaluator behaviour, compare real values, emit advice, infer outcomes, or alter deterministic engine output.