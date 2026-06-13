<!-- DEV NOTE: V1 acceptance-control surface. This document states completion checks for v1. It does not create engine law, registry law, CI token meanings, copy authority, or commercial authority. -->

# V1 Acceptance Gate

Status: active v1 acceptance-control document.
Release name: First Lawful Run.
Slice: S-V1-00.

## Purpose

This document defines the checks that must pass before v1 can be called complete.

It is a release gate, not a behaviour specification.

## Gate rule

V1 is incomplete if any required gate item is missing, untested, manually assumed, or implemented outside its declared authority boundary.

No partial completion language is permitted for v1 acceptance.

## Required product acceptance

V1 must prove:

- coach registration or provisioning exists
- athlete registration or invitation exists
- coach-athlete relationship acceptance exists
- assigned-only coach visibility exists
- athlete self-visibility exists
- lawful Phase 1 declaration exists
- programme assignment exists
- deterministic compile path exists
- session execution exists
- split and return exists
- stop, skip, substitution, and partial completion are factual runtime events
- factual history exists
- coach factual artefact view exists
- coach notes exist and remain engine-invisible
- live session status exists as read-only factual visibility where included
- payment path exists for controlled launch
- support and onboarding docs exist

## Required engine and registry acceptance

V1 must prove:

- engine remains a deterministic library boundary
- app layer owns auth, persistence, UI, payments, and notes
- engine does not read payment state
- engine does not read coach notes
- engine does not read presentation copy
- engine does not branch on UI density or ND presentation fields
- registry load order is enforced
- registry FK closure is enforced
- registry content is complete for locked v1 supported activities
- substitution has no undeclared fallback
- missing registry entries fail closed
- supported activities are locked
- unsupported activities are rejected or dormant according to release boundary
- replay and proof surfaces are honest about their active scope

## Required auth and relationship acceptance

V1 must prove:

- coaches can only view assigned athletes
- coaches cannot view unassigned athletes
- athletes can only view their own data unless explicitly permitted
- coach notes are scoped to relationship authority
- relationship changes do not mutate engine truth
- permission failures are transport or product failures, not engine decisions

## Required copy and claim acceptance

V1 must prove no user-facing copy claims:

- medical advice
- safety
- suitability
- readiness
- optimisation
- guaranteed outcome
- injury prevention
- return to play
- return to run
- fitness for duty
- operational readiness
- deployment readiness
- capability inference
- recommended intervention
- automatic correction
- programme effectiveness

Permitted language must remain factual, recorded, declared, selected, completed, skipped, stopped, substituted, available, unavailable, assigned, viewed, exported where lawful, and source-bound.

## Required commercial acceptance

V1 must prove:

- payment state can control access, plan visibility, seats, or billing surfaces only
- payment state cannot alter engine legality
- payment state cannot alter deterministic compile output
- payment state cannot alter substitution legality
- payment state cannot alter replay or proof truth
- controlled launch path exists
- commercial copy remains claim-safe

## Required proof and export acceptance

Where v1 activates proof or export surfaces, V1 must prove:

- proof artefacts are generated only through permitted flow
- evidence wording proves process integrity only
- exports are immutable where required
- exports do not imply coaching correctness, training value, user ability, safety, suitability, readiness, or external approval
- absence of proof is not represented as proof
- failed replay does not produce accepted proof

## Required developer handover acceptance

V1 must prove:

- active release boundary is documented
- v1 not-in-scope list is documented
- authority map is documented
- slice template exists
- PR template requires boundary, proof, and non-scope
- failure token index is generated
- guard index is generated
- checksums are regenerated
- future developer can find current boundary without founder memory

## Required CI acceptance

Before v1 completion, from a clean tree, these must pass unless replaced by a stricter v1 command:

    npm run verify
    npm run lint:fast
    npm run test:ci
    npm run test:ci:integration

Targeted v1 release gates must also pass where present:

    node ci/scripts/run_v1_release_gate.mjs

If a command is renamed, the replacement must be documented in the active release boundary and README/commands surfaces.

## Final acceptance statement

V1 may be called complete only when the coach-athlete product works end to end and CI proves that product, UI, auth, billing, notes, copy, metrics, proof, and commercial surfaces do not alter engine truth.

## Required controlled-launch operational acceptance

V1 must prove operational readiness for a controlled commercial launch without creating new product scope or engine authority.

V1 controlled-launch operations may include public status, factual error-reporting, backup, restore, and incident-record surfaces only where deliberately activated.

Operational monitoring must remain factual. It must not create readiness, safety, suitability, effectiveness, coaching-quality, medical, operational, or external-approval claims.

Implementation-specific thresholds, alert timings, incident response targets, and service-level targets belong in operational readiness records, not engine law or release-boundary law.

## Required legal acceptance

V1 must prove controlled-launch legal surfaces exist where activated.

Required legal surfaces may include:

- terms surface
- privacy surface
- DPA surface where required
- GDPR export handling
- GDPR deletion-request handling

Legal surfaces must not imply medical, safety, suitability, readiness, coaching-quality, training-effectiveness, operational, or external-approval claims.

## Required billing acceptance

V1 must prove controlled-launch billing surfaces exist where activated.

Required billing acceptance may include:

- Stripe Checkout or equivalent payment entry flow
- customer portal or equivalent billing-management flow
- upgrade and downgrade event handling for access, seats, or billing records only
- non-payment access handling as a product-access rule only

Billing state must not alter engine legality, deterministic compile output, substitution legality, replay truth, proof truth, factual history, or coach-athlete relationship truth.

<!-- S-V1-08:CI-MASTER-GATE-ACCEPTANCE-POINTER:START -->
## CI master gate pointer

V1 completion is blocked unless the v1 CI master gate definition is satisfied.

Gate definition:

- `docs/v1/V1_CI_MASTER_GATE.md`
- `docs/v1/V1_CI_MASTER_GATE.json`
- `ci/guards/s_v1_08_ci_master_gate_definition_guard.mjs`

The v1 CI master gate must distinguish:

- v0 closure
- v1 boundary
- registry
- copy and claims
- auth and permissions
- proof, replay, and export
- no-coupling and engine truth

This pointer does not add product law, engine law, registry law, copy authority, workflow authority, or release approval.
<!-- S-V1-08:CI-MASTER-GATE-ACCEPTANCE-POINTER:END -->
