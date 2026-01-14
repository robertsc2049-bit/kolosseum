# TICKET 013 — Phase1: allow empty constraints envelope

## Goal
Allow an explicit Phase1 `constraints: {}` envelope to be schema-valid. This supports the “sovereign envelope” rule where an explicitly provided empty constraints object suppresses Phase3 default constraint injection.

## Problem
Phase1 schema previously required `constraints` to contain at least one property. That made the explicit empty envelope `{}` invalid even though it is a meaningful signal.

## Change
- `ci/schemas/phase1.input.schema.v1.0.0.json`:
  - Removed `constraints.minProperties` requirement.
  - `constraints` may now be omitted, `{}`, or contain supported keys.

## Invariants
- `additionalProperties: false` is retained at the Phase1 root.
- `constraints.additionalProperties: false` is retained (closed-world keys only).
- Individual constraint arrays retain `minItems: 1` (no empty arrays).

## Acceptance
- `npm run lint` passes.
- `npm test` passes.
- Explicit `{ constraints: {} }` is schema-valid.
