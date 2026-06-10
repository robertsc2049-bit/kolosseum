# V0 Boundary Index

Status: working boundary index  
Scope: current v0 only  
Rewrite policy: rewrite-only by convention for this pack

## Purpose

This index exists to make current v0 boundaries explicit, easy to communicate, and hard to contradict.

It points to:

- the plain-language exclusion pack
- the machine-readable exclusion registry
- the machine-readable allowed claim registry
- the CI guard that fails contradictions between the two

This is a communication and claim-control surface. It does not define engine behaviour.

## Pinned artefacts

- `docs/product/NOT_INCLUDED_IN_V0_BOUNDARY_PACK.md`
- `docs/product/v0_boundary_exclusions.json`
- `docs/product/v0_allowed_claims.json`
- `ci/guards/run_v0_boundary_claim_consistency_guard.mjs`

## Binding intent for this pack

For current v0, anything excluded by the boundary pack:

- must not be promised in demo copy
- must not be claimed in founder/sales-facing v0 wording
- must not be represented as available now
- must fail CI if a machine-readable allowed claim contradicts it

## Current v0 anchor

This pack assumes the current v0 boundary remains:

- individual_user and coach only
- individual and coach_managed execution only
- powerlifting, rugby_union, and general_strength only
- Phase 1 through Phase 6 only
- factual execution, split/return, partial completion, coach assignment, factual artefact viewing, and non-binding coach notes only

Everything else is either v1/post-v0, dormant platform law, or not implemented.

## Final rule

If a boundary is excluded here and a v0 claim says or implies it exists now, the contradiction is invalid and must fail.