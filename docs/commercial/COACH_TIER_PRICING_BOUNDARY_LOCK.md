# COACH TIER PRICING BOUNDARY LOCK

Document ID: coach_tier_pricing_boundary_lock  
Version: 1.0.0  
Status: Draft slice proof  
Scope: Active v0 only  
Rewrite policy: rewrite-only

## Purpose

This document defines the only lawful claims that may appear in coach-tier pricing context for the active v0 coach surface.

This boundary exists to stop pricing copy from outrunning:
- the active v0 coach capability boundary
- the active coach authority boundary
- the available value proof pack

## Active v0 scope lock

Coach-tier pricing for the current v0 build is locked to `coach_16` only.

Pricing copy MUST remain within the active v0 build fence:
- individual_user and coach only
- individual and coach_managed execution only
- powerlifting, rugby_union, and general_strength only
- Phase 1 through Phase 6 only
- coach assign/view/note surface only
- no replay access
- no evidence access
- no legality override
- no substitution authority
- no progression authority
- no registry authority
- no Phase-1 edit authority

## Allowed pricing claim classes

Only the following claim classes may appear in coach-tier pricing context:

- `price_fact`
- `seat_cap_fact`
- `access_fact`
- `visibility_fact`
- `authority_limit`
- `proof_scoped_value`

## Allowed coach-tier value boundary

Coach-tier pricing copy MAY say only that coach tier allows the coach to:

- assign programs within system limits
- view athlete execution artefacts
- write non-binding coach notes
- manage athlete lists up to the tier cap
- request session planning within system limits
- operate with observational-only authority

Coach-tier pricing copy MAY say only that coach tier does NOT allow the coach to:

- override engine decisions
- change constraints
- trigger substitutions
- edit registries
- edit Phase-1 declarations
- see unmanaged athletes
- see aggregate organisation data
- access replay
- access evidence

## Forbidden pricing categories

Coach-tier pricing copy MUST NOT include any claim that implies or states:

- outcome improvement
- optimisation
- safety
- injury reduction
- medical or rehab semantics
- suitability
- readiness
- compliance enforcement
- correction
- recommendation
- hidden engine authority
- replay-backed coach authority
- evidence-backed coach authority
- program validity changes caused by payment
- substitutions controlled by coach tier
- progression controlled by coach tier
- legality controlled by coach tier

## Proof rule

Every allowed pricing claim MUST map to at least one proof item in the coach-tier value proof pack.

If a surfaced pricing phrase has no matching registered claim with valid proof support, it is unlawful and must fail.

## Lint rule

The pricing boundary lint MUST fail closed.

It MUST fail when:
- a surfaced pricing phrase does not exactly match a registered allowed claim
- a surfaced pricing phrase matches a forbidden semantic pattern
- an allowed claim has no valid proof linkage
- a proof item references a missing claim
- a proof-backed claim exceeds active v0 coach scope
- duplicate claim IDs or duplicate proof IDs exist

## Canonical coach-tier summary for active v0

Use only this value frame for active v0 pricing context:

- assign programs within system limits
- view athlete execution artefacts
- write non-binding coach notes
- manage up to 16 athletes
- observational only
- coaches may comment, never decide

## Final rule

If coach-tier pricing copy says more than the active coach proof pack can prove, it must fail.