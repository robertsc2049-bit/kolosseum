# S-REG-19 - Sport Metric Candidate Expansion

## Purpose

S-REG-19 is candidate sport metric expansion only.

It creates the first inert candidate sport metric expansion batch after S-REG-18.

No active registry activation.

No changes to registries/registry_index.json.

No changes to registries/registry_bundle.json.

No metric-exercise links.

No threshold marker records.

No marker evaluator behaviour.

S-REG-20 receives this inert sport metric expansion as dependency input.

## Boundary

S-REG-19 permits:

- One candidate sport metric expansion JSON file.
- One validator/loader module for that sport metric expansion file.
- One test file.
- One guard file.
- One documentation file.
- Package proof wiring.
- Generated guard index, failure-token index, and checksum updates through existing generators.

S-REG-19 must not touch:

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
- Metric-exercise links.
- Exercise content.
- Equipment content.
- Exercise-equipment FK closure content.
- Exercise activity applicability content.
- Coach dashboard interpretation.
- Athlete UI interpretation.
- Marketplace, licensing, compliance, facility, organisation, team, unit, federation, tactical runtime, or enterprise analytics.

## Dependency inputs

The S-REG-14 queue declares S-REG-19 dependency inputs as:

- S-REG-10
- S-REG-11
- S-REG-18

S-REG-19 also keeps foundation proof against:

- S-REG-06 activity IDs

## Candidate sport metric batch

The batch id is:

- `candidate_sport_metric_expansion_batch_1`

The registry target is:

- `sport_metric_registry_1c`

The candidate records follow the S-REG-11 sport metric field shape.

The metric expansion batch is:

- `powerlifting__attempt_count`
- `powerlifting__body_mass_kg`
- `general_strength__set_count`
- `general_strength__duration_seconds`
- `rugby_union__jump_height_cm`
- `rugby_union__sprint_distance_m`

These are inert factual sport metric identity records only.

Each record includes:

- Sport metric id.
- Activity id.
- Sport subdivision id.
- Display label.
- Metric kind.
- Unit.
- Value type.
- Context scope.
- Source slice id.
- Candidate status.
- Runtime status.
- Activation readiness set to false.
- Copy/legal boundary note.

## Non-scope

S-REG-19 does not make a complete sport metric coverage claim.

S-REG-19 does not activate candidate content.

S-REG-19 does not change S-REG-10 sport context records.

S-REG-19 does not change S-REG-11 sport metric seed records.

S-REG-19 does not change S-REG-18 applicability records.

S-REG-19 does not create metric-exercise links.

S-REG-19 does not create threshold marker records.

S-REG-19 does not create marker evaluator behaviour.

S-REG-19 does not create programme formulas, progression logic, assignment logic, substitution logic, ranking logic, marketplace logic, facility runtime, organisation runtime, tactical interpretation, or outcome interpretation.

## Handoff

S-REG-20 receives this inert sport metric expansion as dependency input for candidate metric-exercise link expansion.

## Proof

Required proof:

- `node --test test/s_reg_19_sport_metric_candidate_expansion.test.mjs`
- `node ci/guards/s_reg_19_sport_metric_candidate_expansion_guard.mjs`
- `npm.cmd run proof:s-reg-19`
- S-REG-18 guard still passes.
- S-REG-11 guard still passes.
- S-REG-10 guard still passes.
- S-REG-14 guard still passes.
- S-REG-06 guard still passes.
- Registry bundle, law, and schema guards still pass.
- Guards entrypoint coverage guard passes.
- `npm.cmd run lint:fast`