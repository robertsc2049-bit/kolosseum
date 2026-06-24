# S-REG-15 - Candidate Exercise Registry Content Expansion Batch 1

## Purpose

S-REG-15 is candidate exercise registry content only.

It creates the first inert candidate content expansion batch for `exercise_registry_3a` after the S-REG-14 registry build-readiness start gate.

No active registry activation.

No changes to registries/registry_index.json.

No changes to registries/registry_bundle.json.

S-REG-16 receives this inert candidate exercise batch as dependency input.

## Boundary

S-REG-15 permits:

- One candidate exercise registry batch JSON file.
- One validator/loader module for that batch.
- One test file.
- One guard file.
- One documentation file.
- Package proof wiring.
- Generated guard index, failure-token index, and checksum updates through existing generators.

S-REG-15 must not touch:

- Active registry activation.
- Active registry index.
- Active registry bundle.
- Engine runtime.
- Bundle writer runtime behaviour.
- Programme templates.
- Substitution behaviour.
- Marker evaluator behaviour.
- Threshold marker records.
- Coach dashboard interpretation.
- Athlete UI interpretation.
- Marketplace, licensing, compliance, organisation, team, unit, federation, or tactical runtime.

## Dependency inputs

S-REG-15 depends on:

- S-REG-06 for candidate activity, movement, exercise token, and seed exercise surfaces.
- S-REG-08 for exercise-equipment FK closure status.
- S-REG-09 for exercise-activity applicability candidate FK status.
- S-REG-14 for build queue authority.

## Candidate batch

The batch id is:

- `candidate_exercise_registry_content_expansion_batch_1`

The registry target is:

- `exercise_registry_3a`

The candidate exercise ids are:

- `paused_back_squat`
- `tempo_back_squat`
- `paused_deadlift`
- `romanian_deadlift`
- `paused_bench_press`
- `close_grip_bench_press`

These are inert candidate identity records only.

Each record includes:

- Stable exercise id.
- Name.
- Parent seed exercise id.
- Activity ids.
- Movement id.
- Exercise token id.
- Equipment ids.
- Equipment dependency status.
- Activity applicability dependency status.
- Source slice id.
- Candidate status.
- Runtime status.
- Activation readiness set to false.
- Copy/legal boundary note.

## Non-scope

S-REG-15 does not make a complete-registry claim.

S-REG-15 does not activate candidate content.

S-REG-15 does not create programme formulas, progression logic, substitution logic, marker evaluator logic, recommendation logic, ranking logic, or outcome interpretation.

S-REG-15 does not copy protected methods or expose formula internals.

## Handoff

S-REG-16 receives this inert candidate exercise batch as dependency input for candidate equipment registry content expansion.

S-REG-17 later closes exercise-equipment FK expansion after both S-REG-15 and S-REG-16 exist.

## Proof

Required proof:

- `node --test test/s_reg_15_candidate_exercise_registry_content_batch_1.test.mjs`
- `node ci/guards/s_reg_15_candidate_exercise_registry_content_batch_1_guard.mjs`
- `npm.cmd run proof:s-reg-15`
- S-REG-14 guard still passes.
- S-REG-06, S-REG-08, and S-REG-09 checks still pass.
- Registry bundle, law, and schema guards still pass.
- Guards entrypoint coverage guard passes.
- `npm.cmd run lint:fast`