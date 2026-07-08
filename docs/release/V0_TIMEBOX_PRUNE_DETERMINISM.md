# V0 Timebox Prune Determinism

v0_scope_guard: boundary_doc

Status: active v0 release record.
Slice: S-V0-08 Timebox Prune Determinism.

## DEV NOTE: purpose

This record documents S-V0-08. The slice proves that Phase 4 timebox pruning is deterministic and cannot produce unstable planned-item ordering.

This slice does not add new planning logic, new activities, new scoring, new substitution behaviour, product UI, or v1 expansion.

## Inspected implementation seam

- engine/src/phases/phase4/timebox.ts
- engine/src/phases/phase4/planned_items.ts
- engine/src/phases/phase4/assemble.ts
- test/phase4_rich_plan_minimum.test.mjs

## Locked pruning behaviour

Phase 4 builds the planned item order before timebox pruning.

Timebox pruning then applies fixed threshold rules:

- non-finite timebox, including invalid or absent declared timebox values: preserve existing planned item order
- timebox below 30 minutes: keep primary planned items only
- timebox from 30 to below 45 minutes: keep primary planned items plus the first existing accessory
- timebox at or above 45 minutes: preserve existing planned item order

The rule is removal-only. It must not reorder tied items, score alternatives, use runtime state, or emit advisory selection wording.

## Proof cases

S-V0-08 adds executable tests for:

- exact fit
- overrun below 45 minutes
- zero timebox
- invalid or absent timebox as non-finite/no-prune behaviour
- tie ordering
- repeated runs

## Completion condition

S-V0-08 is complete only when:

- the timebox prune phase is located
- pruning edge cases are covered
- output ordering is stable
- repeated runs are byte-stable
- the non-obvious prune ordering rule has a DEV NOTE
- required v0 gates pass
- the working tree is clean
- local main is pushed to origin/main after successful gates
