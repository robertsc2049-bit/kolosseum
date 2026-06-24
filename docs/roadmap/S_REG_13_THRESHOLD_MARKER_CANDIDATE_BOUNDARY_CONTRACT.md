# S-REG-13 — Threshold Marker Candidate Boundary Contract

## Purpose

S-REG-13 defines the inert candidate boundary contract for `threshold_marker_registry`.

This slice creates a contract only. It does not create live threshold marker seed content, does not activate canonical registries, does not add marker evaluator behaviour, and does not change deterministic engine output.

## Boundary

S-REG-13 permits:

- `threshold_marker_registry` candidate boundary contract.
- Allowed future field list.
- Forbidden field list.
- Factual marker status vocabulary.
- Contract validation helper.
- Test and guard proof.
- Documentation.
- Package proof script.
- Generated indexes and checksums through existing generators.

S-REG-13 must not touch:

- `registries/registry_index.json`.
- `registries/registry_bundle.json`.
- Active compact registry files.
- Registry law.
- Engine runtime.
- Bundle writer runtime behaviour.
- Marker evaluator.
- Programme templates.
- Template formulas.
- Programme progression internals.
- Substitution registry.
- Marketplace, compliance, or licensing logic.
- Coach-to-coach sharing.
- Organisation, team, unit, federation, tactical, coach dashboard, or athlete UI interpretation surfaces.

## Contract status

- `registry_id`: `threshold_marker_registry`
- `contract_status`: `candidate_boundary_contract`
- `candidate_status`: `contract_only_no_seed_content`
- `runtime_status`: `non_runtime`
- `activation_ready`: `false`
- `seed_content_status`: `not_created`

No threshold marker candidate registry file is created by this slice.

## Allowed future fields

Future candidate records may contain only:

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

Any additional field fails the S-REG-13 contract helper.

## Allowed threshold operators

- `greater_than_or_equal`
- `less_than_or_equal`
- `equal_to`

The contract does not compare values. These are future declared operator tokens only.

## Allowed threshold source values

- `coach_declared`
- `organisation_declared_later`
- `fixture_declared`

These source values identify where an explicit declared threshold would come from later. They do not create authority, advice, runtime control, or organisation/team/unit/federation behaviour in this slice.

## Factual status vocabulary

Future threshold marker candidates may only allow these factual statuses:

- `recorded_met`
- `recorded_not_met`
- `not_recorded`
- `invalid_source`
- `insufficient_recorded_data`

These statuses are factual comparison labels only. They must not be used as readiness, safety, suitability, capability, tactical, return-to-play, recommendation, ranking, optimisation, intervention, or outcome semantics.

## Forbidden fields

The contract refuses:

- `readiness_score`
- `readiness_status`
- `safety_status`
- `risk_status`
- `capability_score`
- `suitability_status`
- `return_to_play_status`
- `tactical_status`
- `recommendation`
- `ranking`
- `optimisation`
- `intervention`
- `programme_change`
- `substitution_change`
- `evaluator_result`
- `automatic_decision`

## Evaluator exclusion

No marker evaluator behaviour exists in S-REG-13.

This slice does not:

- Compare real values.
- Emit marker results.
- Read runtime metric values.
- Change programme selection.
- Change compile output.
- Change substitution.
- Change session execution.
- Change history.
- Create coach or athlete advice.

## Active-registry exclusion

No active registry activation.

S-REG-13 does not add `threshold_marker_registry` to active registry law.

The active compact controlled-launch registry surface remains:

- `activity`
- `movement`
- `exercise`
- `program`

No empty active registry may be created. No canonical registry activation may occur.

## Future dependency

The contract may reference only the future shape expectations from:

- S-REG-11 `sport_metric_registry_1c`
- S-REG-12 `metric_exercise_link_registry_1c_a`

These are dependency expectations only. They do not activate threshold marker content and do not create a `metric_exercise_link_id` field in S-REG-13.

## Proof

Required proof:

- `node --test test/s_reg_13_threshold_marker_candidate_boundary_contract.test.mjs`
- `node ci/guards/s_reg_13_threshold_marker_candidate_boundary_contract_guard.mjs`
- Existing S-REG-04 through S-REG-12 tests and guards.
- Registry bundle/law/schema guards.
- V1 supported activity and registry load-order guards.
- Registry workability audit launch hold check.
- Guards entrypoint coverage guard.
- `npm.cmd run lint:fast`
- Generated-file proof sequence.

## Final rule

S-REG-13 is a boundary contract only.

It does not activate canonical registries, create threshold marker seed content, create marker evaluator behaviour, compare real values, emit advice, or alter deterministic engine output.