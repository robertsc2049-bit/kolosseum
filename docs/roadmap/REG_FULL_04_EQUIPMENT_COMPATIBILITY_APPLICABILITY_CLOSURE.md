# REG-FULL-04 — Equipment Compatibility + Applicability Closure

## Goal

Close exercise-to-equipment and exercise-to-activity relationships as explicit governed relations for the complete REG-FULL-03 exercise universe.

## Authority

- `registries/exercise_equipment_compatibility/exercise_equipment_compatibility.registry.json` is the explicit exercise→equipment relation authority created by this slice.
- `registries/exercise_activity_applicability/exercise_activity_applicability.registry.json` remains the explicit exercise→activity relation authority.
- `registries/exercise/exercise.registry.json` remains the exercise entity authority and the direct exercise→movement FK authority.
- Embedded `equipment_requirements`, `equipment_alternatives`, `primary_activity_applicability`, and `secondary_activity_applicability` fields are retained only as compatibility projections. They must exactly equal the explicit relation surfaces and may not diverge into independent truth.

## Required closure

Every one of the 215 production exercises must resolve fail-closed to:

1. exactly one declared `movement_pattern_id` that exists in the movement registry;
2. at least one explicit `required` exercise-equipment compatibility edge;
3. zero or more explicit `alternative` exercise-equipment compatibility edges;
4. only equipment IDs that exist in the equipment registry and are allowed by the exercise movement's explicit `equipment_vocab`;
5. one or more explicit exercise-activity relation pairs represented by complete `training`, `testing`, and `competition` context rows;
6. only activity IDs that exist in the activity registry and are allowed by the exercise movement's explicit `activity_applicability`.

## Prohibited behavior

REG-FULL-04 must reject:

- equipment inferred from a movement pattern when no explicit exercise-equipment edge exists;
- generic fallback, unknown, unspecified, catch-all, or default-equipment resolution;
- missing exercise, movement, equipment, or activity foreign keys;
- duplicate exercise-equipment edges;
- an equipment edge outside the movement's equipment vocabulary;
- an activity relation outside the movement's activity applicability;
- incomplete activity-context closure;
- divergence between explicit relation truth and retained embedded compatibility projections.

## Compatibility types

The canonical `compatibility_type` vocabulary is closed to:

- `required`
- `alternative`

No additional type is valid without a later explicit schema-authority change.

## Materialisation

`scripts/reg_full_04_materialize_relations.mjs` is a controlled migration utility. It bootstraps the new explicit exercise-equipment registry from the already-reviewed REG-FULL-03 embedded projection, validates all FKs and movement scoping before writing, and emits a hash-pinned closure evidence record.

After materialisation, CI treats the explicit relation registry as authority and the embedded fields as projections only.

Run:

```text
node scripts/reg_full_04_materialize_relations.mjs --write
```

Generated governed outputs:

- `registries/exercise_equipment_compatibility/exercise_equipment_compatibility.registry.json`
- `ci/evidence/reg_full_04_equipment_applicability_closure.v1.json`

## CI proof

`ci/registry/reg_full_04_equipment_compatibility_applicability_closure.mjs` enforces the closure and exposes a fail-closed resolver used by direct negative tests.

`test/reg_full_04_equipment_compatibility_applicability_closure.test.mjs` proves:

- all 215 exercises resolve;
- missing explicit equipment is not inferred from movement vocabulary;
- unknown equipment FKs fail;
- movement-incompatible equipment fails;
- incomplete activity context closure fails;
- movement-incompatible activity fails;
- embedded equipment/activity projection drift fails;
- unknown exercises do not receive generic fallback resolution.

The test is included in the indexed registry-law positive CI cluster, so REG-FULL-04 cannot be omitted from `test:ci`.
