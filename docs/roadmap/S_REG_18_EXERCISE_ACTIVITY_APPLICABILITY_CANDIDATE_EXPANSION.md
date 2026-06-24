# S-REG-18 - Exercise Activity Applicability Candidate Expansion

## Purpose

S-REG-18 is candidate exercise activity applicability expansion only.

It creates the first inert candidate exercise activity applicability expansion for the S-REG-15 candidate exercise batch.

No active registry activation.

No changes to registries/registry_index.json.

No changes to registries/registry_bundle.json.

No new exercise content.

No new equipment content.

No new exercise-equipment FK closure content.

S-REG-19 receives this inert applicability expansion as dependency input.

## Boundary

S-REG-18 permits:

- One candidate exercise activity applicability expansion JSON file.
- One validator/loader module for that applicability file.
- One test file.
- One guard file.
- One documentation file.
- Package proof wiring.
- Generated guard index, failure-token index, and checksum updates through existing generators.

S-REG-18 must not touch:

- Active registry activation.
- Active registry index.
- Active registry bundle.
- Engine runtime.
- Bundle writer runtime behaviour.
- Programme templates.
- Programme assignment behaviour.
- Substitution behaviour.
- Marker evaluator behaviour.
- Threshold marker records.
- New exercise content.
- New equipment content.
- New exercise-equipment FK closure content.
- Sport metric records.
- Metric exercise links.
- Coach dashboard interpretation.
- Athlete UI interpretation.
- Marketplace, licensing, compliance, facility, organisation, team, unit, federation, or tactical runtime.

## Dependency inputs

The S-REG-14 queue declares S-REG-18 dependency inputs as:

- S-REG-10
- S-REG-15
- S-REG-17

S-REG-18 also keeps foundation proof against:

- S-REG-06 activity IDs
- S-REG-09 exercise activity applicability candidate seed shape

## Candidate applicability batch

The batch id is:

- `candidate_exercise_activity_applicability_expansion_batch_1`

The registry target is:

- `exercise_activity_applicability_registry`

The candidate records are generated from explicit S-REG-15 exercise activity declarations and S-REG-17 FK closure evidence.

The applicability matrix is:

- `paused_back_squat` to `powerlifting`, `general_strength`, `rugby_union`
- `tempo_back_squat` to `powerlifting`, `general_strength`, `rugby_union`
- `paused_deadlift` to `powerlifting`, `general_strength`, `rugby_union`
- `romanian_deadlift` to `powerlifting`, `general_strength`, `rugby_union`
- `paused_bench_press` to `powerlifting`, `general_strength`, `rugby_union`
- `close_grip_bench_press` to `powerlifting`, `general_strength`, `rugby_union`

These are inert factual candidate training-context applicability links only.

Each record includes:

- Stable applicability id.
- Exercise id.
- Activity id.
- Activity context.
- Exercise batch id.
- Exercise source slice id.
- FK closure source slice id.
- FK closure evidence ids.
- Movement id.
- Relationship basis.
- Applicability state.
- Conditions.
- Tier cap.
- Template applicability.
- Substitution applicability.
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

S-REG-18 does not make a complete applicability coverage claim.

S-REG-18 does not activate candidate content.

S-REG-18 does not change S-REG-15 exercise records.

S-REG-18 does not change S-REG-17 FK closure records.

S-REG-18 does not create programme formulas, progression logic, assignment logic, substitution logic, marker evaluator logic, ranking logic, marketplace logic, facility runtime, organisation runtime, tactical interpretation, or outcome interpretation.

## Handoff

S-REG-19 receives this inert applicability expansion as dependency input for candidate sport metric expansion.

## Proof

Required proof:

- `node --test test/s_reg_18_exercise_activity_applicability_candidate_expansion.test.mjs`
- `node ci/guards/s_reg_18_exercise_activity_applicability_candidate_expansion_guard.mjs`
- `npm.cmd run proof:s-reg-18`
- S-REG-17 guard still passes.
- S-REG-15 guard still passes.
- S-REG-14 guard still passes.
- S-REG-10 guard still passes.
- S-REG-09 guard still passes.
- S-REG-06 guard still passes.
- Registry bundle, law, and schema guards still pass.
- Guards entrypoint coverage guard passes.
- `npm.cmd run lint:fast`