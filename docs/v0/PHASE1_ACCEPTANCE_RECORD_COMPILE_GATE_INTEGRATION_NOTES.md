<!-- DEV NOTE: Developer documentation surface. This document explains repo behaviour or boundaries, but canonical law remains in the tracked contracts, guards, and tests. Keep docs aligned with executable checks. -->

# S28 — Phase 1 Acceptance Record Compile Gate Integration Notes

Document ID: phase1_acceptance_record_compile_gate_integration_notes  
Version: 1.0.0  
Status: authoritative  
Scope class: closed_world  
Engine compatibility: EB2-1.0.0

## 1. Purpose

This document defines how compile admission consumes the current accepted Phase 1 declaration record.

Compile may admit or refuse compile.

Compile must not create, edit, infer, repair, complete, or supersede Phase 1 declarations.

## 2. Compile dependency

Compile requires a current accepted Phase 1 declaration.

A current accepted Phase 1 declaration must be:

- accepted
- immutable
- unsuperseded
- valid
- version-pinned
- hash-consistent
- consented
- jurisdiction-acknowledged

## 3. Compile input

Compile admission receives:

- user_id
- requested_activity_id
- requested_execution_scope
- active_phase1_schema_version
- active_engine_compatibility
- active_enum_bundle_version

## 4. Lookup

Compile must call:

getCurrentAcceptedPhase1Declaration(user_id)

If the result is null, compile refuses with:

PHASE1_COMPILE_BLOCKED_NO_ACCEPTED_DECLARATION

## 5. Validation order

Compile must validate in this order:

1. Confirm current accepted declaration exists.
2. Confirm accepted_at is not null.
3. Confirm superseded_at is null.
4. Confirm immutable is true.
5. Confirm immutable_status is immutable.
6. Confirm consent_granted is true.
7. Confirm jurisdiction_acknowledged is true.
8. Validate declaration_payload_json against the active Phase 1 schema.
9. Recompute canonical engine-visible payload hash.
10. Compare recomputed hash to declaration_payload_sha256.
11. Confirm phase1_schema_version equals active_phase1_schema_version.
12. Confirm engine_compatibility equals active_engine_compatibility.
13. Confirm enum_bundle_version equals active_enum_bundle_version.
14. Confirm requested_activity_id equals activity_id.
15. Confirm requested_execution_scope equals execution_scope.
16. Admit compile.

## 6. Blocked responses

Compile may return only these Phase 1 acceptance record blocked codes:

- PHASE1_COMPILE_BLOCKED_NO_ACCEPTED_DECLARATION
- PHASE1_COMPILE_BLOCKED_UNACCEPTED_DECLARATION
- PHASE1_COMPILE_BLOCKED_SUPERSEDED_DECLARATION
- PHASE1_COMPILE_BLOCKED_MUTABLE_DECLARATION
- PHASE1_COMPILE_BLOCKED_VERSION_MISMATCH
- PHASE1_COMPILE_BLOCKED_HASH_MISMATCH
- PHASE1_COMPILE_BLOCKED_INVALID_DECLARATION
- PHASE1_COMPILE_BLOCKED_ACTIVITY_MISMATCH
- PHASE1_COMPILE_BLOCKED_SCOPE_MISMATCH

## 7. Forbidden reads

Compile admission must not read:

- payment state
- product tier state
- coach metadata
- coach notes
- presentation state
- UI state
- runtime events
- previous compile output

## 8. Forbidden writes

Compile admission must not write:

- declaration_payload_json
- declaration_payload_sha256
- phase1_schema_version
- engine_compatibility
- enum_bundle_version
- consent_granted
- jurisdiction_acknowledged
- accepted_at
- immutable
- immutable_status
- created_at
- superseded_at

## 9. Final rule

Compile starts only after accepted Phase 1 declaration truth exists.

If accepted Phase 1 truth is missing, invalid, mutable, superseded, unaccepted, mismatched, or hash-inconsistent, compile fails closed.
