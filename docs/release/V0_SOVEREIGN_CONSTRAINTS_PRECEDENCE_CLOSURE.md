# V0 Sovereign Constraints Precedence Closure

Status: active v0 release record.
Slice: S-V0-06 Sovereign Constraints Precedence Closure.

## DEV NOTE: purpose

This record documents S-V0-06. The slice proves that explicit Phase 1 constraints remain authoritative through Phase 3 and cannot be silently bypassed by lower-priority planning logic.

This slice does not create a new phase, a new guard, or a new recommendation surface. It strengthens the existing Phase 3 precedence proof surface.

## Inspected canonical files

- engine/src/phases/phase3.ts
- engine/src/phases/phase4/timebox.ts
- test/s3_phase3_sovereign_precedence_lock_engine.test.mjs
- test/s4_phase3_remove_only_constraint_engine.test.mjs
- test/phase4_rich_plan_minimum.test.mjs

## Boundary invariant

Sovereign constraints are deterministic and precedence-ordered.

Phase 3 owns canonical constraint resolution for v0. Later phases may consume the Phase 3 constraint output but must not restore removed options, reinterpret explicit declarations, create soft-warning pass-through, recommend alternatives, or silently bypass constraints.

The current proven precedence rule is:

- banned_equipment overrides available_equipment

When a token appears in both lists, the token is removed from effective available_equipment and remains in banned_equipment. The rule identity is recorded as banned_over_available_equipment.

## Positive proof cases

S-V0-06 adds labelled cases proving:

- explicit banned equipment wins over lower-priority availability
- equivalent declared constraint ordering replays the same effective Phase 3 output
- precedence summary is stable and explicit
- removed lower-priority values are recorded deterministically

## Negative proof cases

S-V0-06 adds labelled cases proving:

- invalid constraints shape fails closed
- the failure token remains type_mismatch
- failure details identify the constraints path
- Phase 3 output does not contain recommendation language, fallback bypass language, or override language

## Failure behaviour

A plan cannot proceed through valid constraint resolution when the constraints envelope has invalid shape. The failure must be explicit and stable.

Do not fix S-V0-06 failures by adding fallback behaviour, advisory language, recommendation wording, or lower-priority planning overrides.

## Completion condition

S-V0-06 is complete only when:

- sovereign constraint phase and tests are located
- precedence positive tests pass
- invalid-shape negative tests pass
- fixture labels explain the intent of each case
- no recommendation or fallback-bypass wording is emitted by Phase 3 proof output
- required v0 gates pass
- the working tree is clean
- local main is pushed to origin/main after successful gates
