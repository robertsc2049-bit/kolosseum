# S-REG-17 - Exercise-to-Equipment Candidate FK Closure Expansion

## Purpose

S-REG-17 is candidate exercise-equipment FK closure expansion only.

It creates the first inert candidate FK closure expansion between S-REG-15 candidate exercises and S-REG-16 candidate equipment.

No active registry activation.

No changes to registries/registry_index.json.

No changes to registries/registry_bundle.json.

No new exercise content.

No new equipment content.

S-REG-18 receives this inert FK closure expansion as dependency input.

## Boundary

S-REG-17 permits:

- One candidate exercise-equipment FK closure expansion JSON file.
- One validator/loader module for that closure file.
- One test file.
- One guard file.
- One documentation file.
- Package proof wiring.
- Generated guard index, failure-token index, and checksum updates through existing generators.

S-REG-17 must not touch:

- Active registry activation.
- Active registry index.
- Active registry bundle.
- Engine runtime.
- Bundle writer runtime behaviour.
- Programme templates.
- Programme assignment behaviour.
- Substitution behaviour.
- Fallback logic.
- Marker evaluator behaviour.
- Threshold marker records.
- New exercise content.
- New equipment content.
- Exercise activity applicability expansion.
- Sport metric records.
- Metric exercise links.
- Coach dashboard interpretation.
- Athlete UI interpretation.
- Marketplace, licensing, compliance, facility, organisation, team, unit, federation, or tactical runtime.

## Dependency inputs

S-REG-17 depends on:

- S-REG-15 for candidate exercise records.
- S-REG-16 for candidate equipment records.
- S-REG-14 for build queue authority.

## Candidate closure batch

The batch id is:

- `candidate_exercise_equipment_fk_closure_expansion_batch_1`

The registry target is:

- `exercise_equipment_fk_closure`

The candidate closure records are generated from exact activity and movement FK matches only.

The closure matrix is:

- `paused_back_squat` to `dumbbell`, `kettlebell`, `resistance_band`
- `tempo_back_squat` to `dumbbell`, `kettlebell`, `resistance_band`
- `paused_deadlift` to `dumbbell`, `kettlebell`, `resistance_band`
- `romanian_deadlift` to `dumbbell`, `kettlebell`, `resistance_band`
- `paused_bench_press` to `dumbbell`, `adjustable_bench`, `cable_machine`, `resistance_band`
- `close_grip_bench_press` to `dumbbell`, `adjustable_bench`, `cable_machine`, `resistance_band`

These are inert FK relationship records only.

Each record includes:

- Stable closure id.
- Exercise id.
- Equipment id.
- Exercise batch id.
- Equipment batch id.
- Exercise source slice id.
- Equipment source slice id.
- Movement id.
- Activity id intersection.
- Relationship basis.
- Source slice id.
- Candidate status.
- Runtime status.
- Activation readiness set to false.
- Active registry mutation set to false.
- Engine runtime mutation set to false.
- Programme assignment mutation set to false.
- Substitution runtime mutation set to false.
- Marker evaluator mutation set to false.
- Threshold marker mutation set to false.
- Copy/legal boundary note.

## Non-scope

S-REG-17 does not make a complete-coverage claim.

S-REG-17 does not activate candidate content.

S-REG-17 does not change S-REG-15 exercise records.

S-REG-17 does not change S-REG-16 equipment records.

S-REG-17 does not create programme formulas, progression logic, assignment logic, substitution logic, fallback logic, marker evaluator logic, ranking logic, marketplace logic, facility runtime, organisation runtime, or outcome interpretation.

## Handoff

S-REG-18 receives this inert FK closure expansion as dependency input for candidate exercise activity applicability expansion.

## Proof

Required proof:

- `node --test test/s_reg_17_exercise_equipment_candidate_fk_closure_expansion.test.mjs`
- `node ci/guards/s_reg_17_exercise_equipment_candidate_fk_closure_expansion_guard.mjs`
- `npm.cmd run proof:s-reg-17`
- S-REG-16 guard still passes.
- S-REG-15 guard still passes.
- S-REG-14 guard still passes.
- S-REG-08 guard still passes.
- S-REG-07 guard still passes.
- S-REG-06 guard still passes.
- Registry bundle, law, and schema guards still pass.
- Guards entrypoint coverage guard passes.
- `npm.cmd run lint:fast`