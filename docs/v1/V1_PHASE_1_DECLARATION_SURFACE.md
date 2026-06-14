<!-- DEV NOTE: V1 declaration-surface control document. This binds factual user-declared Phase 1 declaration state before compile admission. It does not implement medical assessment, diagnosis, safety clearance, suitability clearance, readiness scoring, engine behaviour, registry content, database migrations, auth providers, UI, payment, broad RBAC, or organisation/team/gym/federation roles. -->

# V1 Phase 1 Declaration Surface

Status: active v1 Phase 1 declaration-surface boundary document.
Slice: S-V1-16.
Release boundary: v1 First Lawful Run.

## Purpose

This document binds the v1 Phase 1 declaration surface.

The surface records factual user-declared Phase 1 declaration state before compile admission.

The declaration is not an assessment.

The declaration is not advice.

The declaration is not a clearance.

The declaration is not a readiness score.

The declaration is not a suitability decision.

The declaration is not a medical decision.

## Active v1 declaration surface

S-V1-16 activates one product declaration surface:

- `phase_1_declaration_surface`

The surface may accept a declaration record only when the declaration contains the exact required fields and the declaration payload passes closed-world validation.

The surface may reject a declaration when required fields are missing, when unknown fields are present, when required acknowledgements are false, when pinned versions do not match, or when forbidden claim fields are present.

S-V1-16 does not alter the deterministic engine.

## Required declaration record fields

A Phase 1 declaration surface input must contain exactly:

- declaration_id
- declared_by_user_id
- subject_user_id
- declaration_source
- declaration_scope
- declaration_state
- declaration_payload
- declared_at_iso8601
- accepted_terms_version
- copy_acknowledgement_id

Unknown top-level fields fail closed.

## Required declaration payload fields

The declaration payload must contain exactly:

- actor_type
- execution_scope
- activity_id
- phase1_schema_version
- engine_compatibility
- enum_bundle_version
- consent_granted
- jurisdiction_acknowledged

Unknown payload fields fail closed.

## Active allowed values

The active allowed declaration values are:

- declaration_source: user_declared
- declaration_scope: phase1_compile_prerequisite
- declaration_state: accepted
- actor_type: individual_user or coach
- execution_scope: individual or coach_managed
- activity_id: powerlifting, rugby_union, or general_strength
- phase1_schema_version: 1.0.0
- engine_compatibility: EB2-1.0.0
- enum_bundle_version: EB2-1.0.0
- consent_granted: true
- jurisdiction_acknowledged: true

These values intentionally align with the existing Phase 1 acceptance record proof suite.

## Declaration record output

An accepted declaration record must include:

- declaration_id
- declared_by_user_id
- subject_user_id
- declaration_source
- declaration_scope
- declaration_state
- declaration_payload
- declaration_payload_sha256
- phase1_schema_version
- engine_compatibility
- enum_bundle_version
- consent_granted
- jurisdiction_acknowledged
- declared_at_iso8601
- accepted_terms_version
- copy_acknowledgement_id
- user_declared_factual_state = true
- product_declaration_state_only = true
- engine_visible = false
- copy_ids
- superseded_at_iso8601 = null
- immutable = true

## Compile prerequisite boundary

S-V1-16 may expose a product/app guard named `assertPhase1DeclarationAcceptedBeforeCompile`.

The guard checks declaration-record status only.

The guard does not compile.

The guard does not run engine phases.

The guard does not alter engine input.

The guard does not alter compile output.

The existing Phase 1 acceptance record test suite remains the current proof that compile admission refuses missing, unaccepted, superseded, mismatched, or invalid declaration state.

## Copy boundary

Copy must remain factual.

Permitted copy ids are:

- PHASE_1_DECLARATION_ACCEPTED
- PHASE_1_DECLARATION_REJECTED
- PHASE_1_DECLARATION_REQUIRED
- PHASE_1_DECLARATION_USER_DECLARED_FACTUAL
- PHASE_1_DECLARATION_PRODUCT_STATE_ONLY

Permitted copy text must describe recorded declaration state only.

Copy must not imply:

- medical advice
- diagnosis
- medical assessment
- safety clearance
- suitability clearance
- readiness scoring
- risk scoring
- return-to-play clearance
- fit-for-duty meaning
- recommendation
- coaching decision
- training outcome
- external approval

## Explicit non-scope

S-V1-16 does not implement or activate:

- medical assessment
- diagnosis
- safety clearance
- suitability clearance
- readiness scoring
- readiness or risk labels
- medical advice
- clinical advice
- return-to-play decision
- fit-for-duty decision
- recommendation
- engine behaviour
- registry content
- programme assignment
- substitution
- proof implementation
- database migrations
- auth provider implementation
- product UI
- payment implementation
- broad RBAC
- organisation roles
- organization roles
- team roles
- gym roles
- unit roles
- federation roles
- enterprise roles

## Final rule

If the declaration is not explicit, factual, user-declared, closed-world, and claim-safe, it must fail closed.

If declaration state changes engine truth, this slice is invalid.

<!-- S-V1-17:DECLARATION-ACCEPTANCE-RECORD:START -->
## S-V1-17 Declaration Acceptance Record

The canonical v1 declaration acceptance record boundary is `docs/v1/V1_DECLARATION_ACCEPTANCE_RECORD.md`.

S-V1-17 extends the accepted declaration record created by the Phase 1 declaration surface.

Accepted declaration records must include deterministic hash metadata, factual source metadata, immutable field identity, and explicit supersession state.

S-V1-17 does not create a second declaration system.

S-V1-17 does not change engine output.
<!-- S-V1-17:DECLARATION-ACCEPTANCE-RECORD:END -->
