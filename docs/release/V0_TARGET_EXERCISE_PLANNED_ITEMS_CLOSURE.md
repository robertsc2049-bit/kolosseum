# V0 Target Exercise ID and Planned Items Closure

v0_scope_guard: boundary_doc

Status: active v0 release record.
Slice: S-V0-09 Target Exercise ID and Planned Items Closure.

## DEV NOTE: purpose

This record documents S-V0-09. The slice proves that v0 planned items are explicit, valid, deduped, and tied to target exercise IDs where required.

This slice does not add new exercise content, new registry records, new activities, new substitution scoring, product UI, or v1 expansion.

## Inspected implementation seam

- engine/src/phases/phase4/planned_items.ts
- engine/src/phases/phase4/exercise_pool.ts
- engine/src/phases/phase4/assemble.ts
- engine/src/phases/phase5.ts
- engine/src/phases/phase6.ts
- test/phase4_rich_plan_minimum.test.mjs
- test/phase6_requires_planned_items.test.mjs
- test/phase6_planned_ids_enriched.test.mjs

## Locked behaviour

Phase 4 planned item identity closure:

- planned item exercise identity must come from explicit intent IDs
- duplicate exercise IDs are deduped by first occurrence
- deduped planned items preserve stable array order
- planned_exercise_ids are derived directly from planned_items
- target_exercise_id is derived from the first explicit planned exercise ID
- no target exercise is inferred when no planned exercise ID exists
- planned exercise IDs must resolve against the exercise registry
- missing registry references fail with PHASE4_MISSING_PLANNED_EXERCISE

Phase 6 planned item closure:

- planned_items is the only accepted non-empty plan source for session emission
- missing planned_items must fail with the stable phase6_requires_planned_items token
- planned_exercise_ids and exercises are not allowed to silently replace planned_items for session emission

## Deterministic dedupe rule

The dedupe rule is first occurrence wins.

For example:

- input: bench_press, deadlift, bench_press, back_squat, deadlift
- output: bench_press, deadlift, back_squat, in stable array order

No later phase may reinterpret duplicate entries, infer a different target, sort identities alphabetically, or choose a target from registry order.

## Proof cases

S-V0-09 adds executable tests for:

- valid planned items
- duplicate planned item IDs
- missing planned items/no inferred target
- invalid registry reference
- valid registry reference
- Phase 6 planned_items-only source contract and stable token

## Completion condition

S-V0-09 is complete only when:

- target_exercise_id logic is located
- planned_items validation logic is located
- missing, duplicate, invalid, and valid planned item cases are tested
- dedupe behaviour is deterministic and documented
- error tokens are stable
- registry references resolve or fail with stable token
- required v0 gates pass
- the working tree is clean
- local main is pushed to origin/main after successful gates
