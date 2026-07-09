<!-- DEV NOTE: BETA-10 Phase 3 constraint prune record. This document records deterministic remove-only constraint resolution only; it does not create substitute selection, coach interpretation, registry activation, or downstream programme assembly semantics. -->

# BETA-10 Phase 3 Constraint Prune

Status: beta contract record.

## Purpose

BETA-10 hardens Phase 3 so explicit beta declarations resolve constraints by removing possibilities only.

## Boundary

Phase 3 constraint resolution only.

BETA-10 does not add registry content, activate candidate registries, generate substitute options, choose nearest alternatives, create coach interpretation, or alter downstream programme assembly semantics.

## Deterministic order

BETA-10 applies beta constraint stages in this order:

1. authority constraints
2. consent constraints
3. declared legality constraints
4. context constraints
5. equipment constraints
6. activity/role constraints

The order is machine-checkable in `test/beta_10_phase3_constraint_prune.test.mjs`.

## Remove-only rule

Each stage may only keep or remove existing candidate IDs.

No stage may add a candidate, replace a removed candidate, soften a declared constraint, or synthesize an alternative.

If the solution space becomes empty, Phase 3 returns `empty_solution_space` and stops.

## Machine proof

Machine-checkable implementation and proof:

- `engine/src/phases/phase3.ts`
- `engine/src/phases/beta10Phase3ConstraintPrune.ts`
- `test/beta_10_phase3_constraint_prune.test.mjs`

## Negative proof

The BETA-10 test covers:

- invalid authority
- consent violation
- unavailable equipment
- unsupported activity
- empty solution space

## Compatibility

BETA-10 is gated to explicit beta remove-only declarations so existing v0 Phase 3 canonicalisation and S3/S4 regression locks remain stable.
