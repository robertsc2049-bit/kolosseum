<!-- DEV NOTE: Developer documentation surface. This document explains repo behaviour or boundaries, but canonical law remains in the tracked contracts, guards, and tests. Keep docs aligned with executable checks. -->

# FIRST_EXECUTABLE_SESSION_STUB

Document ID: first_executable_session_stub  
Document title: FIRST EXECUTABLE SESSION STUB  
Document type: implementation_contract  
Document version: 1.0.0  
Status: v0 slice contract  
Engine compatibility: EB2-1.0.0  
Scope class: closed_world  
Rewrite policy: rewrite_only  

## 1. Purpose

This document defines S32, the minimum deterministic first executable session artefact produced after compile admission.

This is not a product expansion. It is the smallest lawful executable session path for Kolosseum v0.

The artefact exists to convert an already accepted Phase 1 declaration into a deterministic Phase 6-ready session stub.

## 2. Boundary

S32 sits after compile admission.

S32 does not admit compile.  
S32 does not validate coach links.  
S32 does not create declarations.  
S32 does not produce evidence.  
S32 does not export proof.  
S32 does not adapt progression.

S32 may only materialise a first executable session from an accepted declaration already admitted by the previous gate.

## 3. Required artefact fields

The first executable session artefact must include exactly:

- session_id
- source_phase1_declaration_id
- source_phase1_hash
- engine_compatibility
- activity_id
- execution_scope
- generated_at_policy
- ordered_work_items
- session_status
- factual_labels

No additional fields are permitted in v0.

## 4. Deterministic timestamp handling

S32 uses:

generated_at_policy: omitted_for_determinism

No wall-clock generated_at timestamp is emitted.

Reason: wall-clock time is not part of the accepted declaration and would create replay drift. If a timestamp is required later, it must be supplied as a declared deterministic input and covered by replay. That is not part of this v0 stub.

## 5. Session ID law

session_id is derived from canonical bytes only.

The derivation input is:

- fixed artefact namespace
- contract version
- source_phase1_declaration_id
- source_phase1_hash
- engine_compatibility
- activity_id
- execution_scope
- ordered work items

The ID must not read:

- payment state
- tier state
- coach metadata
- presentation flags
- UI state
- current time
- random values
- external services

## 6. Ordered work item law

ordered_work_items is an ordered array.

Each item must include:

- work_item_id
- ordinal
- kind
- exercise_token_id
- factual_label
- status
- prescription

Allowed item status for initial materialisation:

- pending

Allowed session status for initial materialisation:

- materialised

All labels are factual. No item may contain explanation, advice, valuation, predicted result, suitability language, or benefit language.

## 7. Activity support

S32 is limited to v0 activities:

- powerlifting
- rugby_union
- general_strength

Any other activity_id must fail before output materialisation.

## 8. Execution scope support

S32 is limited to v0 execution scopes:

- individual
- coach_managed

Any other execution_scope must fail before output materialisation.

## 9. Forbidden influence

The materialisation function must not read or branch on:

- payment state
- product tier
- coach metadata
- presentation flags
- UI density
- copy profile
- runtime UI state

A test pair that changes only any of those values must produce byte-identical output.

## 10. Missing accepted declaration

If accepted_declaration is missing, null, not accepted, or missing any required source field, S32 must fail before materialisation.

No partial artefact may be emitted.

## 11. Positive acceptance criteria

S32 is accepted only if:

- the golden fixture passes byte-equivalence
- repeat materialisation of the same accepted declaration produces byte-identical output
- payment-only changes produce byte-identical output
- coach-metadata-only changes produce byte-identical output
- presentation-only changes produce byte-identical output
- missing accepted declaration fails before output exists
- unsupported activity fails before output exists
- unsupported execution scope fails before output exists

## 12. Negative test matrix

| Test ID | Input change | Expected result |
|---|---|---|
| S32_NEG_001 | Missing accepted_declaration | Throw before output |
| S32_NEG_002 | declaration status not accepted | Throw before output |
| S32_NEG_003 | Unsupported activity_id | Throw before output |
| S32_NEG_004 | Unsupported execution_scope | Throw before output |
| S32_NEG_005 | Payment state changed only | Output byte-identical |
| S32_NEG_006 | Coach metadata changed only | Output byte-identical |
| S32_NEG_007 | Presentation flags changed only | Output byte-identical |
| S32_NEG_008 | Repeat same input | Output byte-identical |

## 13. CI integration notes

Add this test suite to the fast deterministic test chain.

Recommended target:

- engine/session/firstExecutableSessionStub.test.ts

The test must compare canonical JSON bytes, not loose object equality.

## 14. Final rule

If the first executable session cannot be produced from the accepted declaration alone, it does not exist.
