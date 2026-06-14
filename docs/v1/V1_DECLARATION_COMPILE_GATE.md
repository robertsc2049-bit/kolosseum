<!-- DEV NOTE: V1 compile-gate control document. This binds declaration compile admission to the existing declaration validity contract. It does not make product, coach, payment, presentation, relationship, account, or support state part of engine truth. -->

# V1 Declaration Compile Gate

Status: active v1 declaration compile-gate boundary document.
Slice: S-V1-18.
Release boundary: v1 First Lawful Run.

## Purpose

This document binds the v1 declaration compile gate.

S-V1-18 requires compile admission to depend on a current valid accepted declaration record.

The gate exists to prove that compile admission fails closed when declaration state is missing, invalid, superseded, or hash-mismatched.

## Existing authority

S-V1-18 does not replace S-V1-16 or S-V1-17.

S-V1-18 extends:

- `docs/v1/V1_PHASE_1_DECLARATION_SURFACE.md`
- `docs/v1/V1_DECLARATION_ACCEPTANCE_RECORD.md`
- `src/phase1DeclarationSurface.mjs`
- `ci/scripts/run_phase1_acceptance_record_tests.mjs`
- `docs/v0/phase1_acceptance_record_tests.json`

The existing declaration validity seam is:

- `assertPhase1DeclarationAcceptedBeforeCompile`

The existing engine-isolation probe is:

- `compileIgnoringPhase1DeclarationSurface`

S-V1-18 may add a narrow compile-gate wrapper around these seams.

## Compile gate rule

Compile admission must require a current valid accepted declaration record.

The compile gate must fail closed when:

- the declaration record is missing
- the declaration record is not accepted
- the declaration record is superseded
- the declaration payload hash does not match the recomputed hash
- accepted declaration hash metadata is invalid
- accepted declaration source metadata is invalid
- the accepted declaration record identity is invalid

## Product-state isolation rule

Product state must not mutate declaration truth.

The following states must not become engine input and must not alter declaration hash, declaration source metadata, accepted declaration identity, compile probe output, canonical payload, planned session, runtime trace, registry authority, replay truth, proof truth, or evidence truth:

- coach notes
- payment state
- billing state
- subscription state
- presentation state
- UI state
- account state
- relationship state
- support state

## Failure token

The stable CI failure token for this boundary is:

- `CI_V1_DECLARATION_COMPILE_GATE`

Runtime declaration validity errors must remain stable and fail closed through the declaration validity contract.

## Non-scope

S-V1-18 does not implement:

- new engine phases
- real `/blocks/compile` route mutation
- database persistence
- UI
- billing
- payment
- coach notes
- assignment
- substitution
- proof implementation
- registry content
- broad RBAC
- organisation roles
- organization roles
- team roles
- gym roles
- unit roles
- federation roles
- enterprise roles

## Proof required

S-V1-18 acceptance requires proof that:

- compile gate refuses missing declaration
- compile gate refuses unaccepted declaration
- compile gate refuses superseded declaration
- compile gate refuses hash mismatch
- compile gate refuses invalid accepted record metadata
- compile gate allows current valid accepted declaration
- product state does not mutate declaration truth
- product state does not alter compile probe output
- S-V1-16 declaration surface proof remains green
- S-V1-17 declaration acceptance proof remains green
- Phase 1 acceptance record proof remains green
- no-coupling proof remains green
- v0 active scope proof remains green

## Final rule

If declaration state is not current, valid, accepted, immutable, and hash-consistent, compile admission must fail closed.

If coach notes, payment state, billing state, presentation state, UI state, account state, relationship state, or support state can alter declaration truth or engine-facing compile output, this slice is invalid.
