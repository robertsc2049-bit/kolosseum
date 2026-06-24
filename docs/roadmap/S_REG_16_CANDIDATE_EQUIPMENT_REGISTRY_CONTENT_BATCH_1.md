# S-REG-16 - Candidate Equipment Registry Content Expansion Batch 1

## Purpose

S-REG-16 is candidate equipment registry content only.

It creates the first inert candidate content expansion batch for `equipment_registry` after S-REG-15.

No active registry activation.

No changes to registries/registry_index.json.

No changes to registries/registry_bundle.json.

No exercise-equipment FK closure expansion.

S-REG-17 receives this inert candidate equipment batch as dependency input.

## Boundary

S-REG-16 permits:

- One candidate equipment registry batch JSON file.
- One validator/loader module for that batch.
- One test file.
- One guard file.
- One documentation file.
- Package proof wiring.
- Generated guard index, failure-token index, and checksum updates through existing generators.

S-REG-16 must not touch:

- Active registry activation.
- Active registry index.
- Active registry bundle.
- Engine runtime.
- Bundle writer runtime behaviour.
- Programme templates.
- Substitution behaviour.
- Exercise-equipment FK closure expansion.
- Marker evaluator behaviour.
- Threshold marker records.
- Coach dashboard interpretation.
- Athlete UI interpretation.
- Marketplace, licensing, compliance, facility, organisation, team, unit, federation, or tactical runtime.

## Dependency inputs

S-REG-16 depends on:

- S-REG-07 for equipment candidate seed field shape and seed equipment ids.
- S-REG-15 for candidate exercise content dependency order and next-slice handoff.
- S-REG-14 for build queue authority.
- S-REG-06 for candidate activity and movement IDs.

## Candidate batch

The batch id is:

- `candidate_equipment_registry_content_expansion_batch_1`

The registry target is:

- `equipment_registry`

The candidate equipment ids are:

- `dumbbell`
- `kettlebell`
- `adjustable_bench`
- `pull_up_bar`
- `cable_machine`
- `resistance_band`

These are inert candidate identity records only.

Each record includes:

- Stable equipment id.
- Display label.
- Equipment class.
- Equipment type.
- Activity applicability.
- Movement pattern applicability.
- Candidate relevance fields copied from the S-REG-07 field shape.
- Source slice id.
- Candidate status.
- Runtime status.
- Activation readiness set to false.
- Exercise-equipment FK closure mutation set to false.
- Copy/legal boundary note.

## Non-scope

S-REG-16 does not make a complete-registry claim.

S-REG-16 does not activate candidate content.

S-REG-16 does not assign equipment to exercises.

S-REG-16 does not create exercise-equipment FK closure expansion.

S-REG-16 does not create programme formulas, progression logic, substitution logic, marker evaluator logic, recommendation logic, ranking logic, marketplace equipment logic, facility runtime, organisation runtime, or outcome interpretation.

## Handoff

S-REG-17 receives this inert candidate equipment batch as dependency input for candidate exercise-equipment FK closure expansion.

## Proof

Required proof:

- `node --test test/s_reg_16_candidate_equipment_registry_content_batch_1.test.mjs`
- `node ci/guards/s_reg_16_candidate_equipment_registry_content_batch_1_guard.mjs`
- `npm.cmd run proof:s-reg-16`
- S-REG-15 guard still passes.
- S-REG-14 guard still passes.
- S-REG-07 guard still passes.
- S-REG-06 guard still passes.
- Registry bundle, law, and schema guards still pass.
- Guards entrypoint coverage guard passes.
- `npm.cmd run lint:fast`