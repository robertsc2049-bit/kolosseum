<!-- DEV NOTE: Developer documentation surface. This document explains repo behaviour or boundaries, but canonical law remains in the tracked contracts, guards, and tests. Keep docs aligned with executable checks. -->

# S28 — Phase 1 Acceptance Record

Document ID: phase1_acceptance_record  
Version: 1.0.0  
Status: authoritative  
Scope class: closed_world  
Engine compatibility: EB2-1.0.0  
Enum bundle version: EB2-1.0.0  
Release scope: Kolosseum v0 Deterministic Execution Alpha

## 1. Purpose

This document defines the accepted Phase 1 declaration record required before compile may start.

Compile cannot start unless the platform has a current accepted Phase 1 declaration for the user.

Phase 1 is the only lawful engine entry point.

The acceptance record exists to preserve immutable, version-pinned, hashable declaration truth for compile admission.

## 2. Boundary

This record is platform storage for accepted Phase 1 declarations.

It does not define engine behaviour.

It does not create, repair, infer, complete, or mutate Phase 1 payloads.

It does not read payment state, coach metadata, presentation state, product tier state, or UI state as engine truth.

## 3. Record fields

Each accepted Phase 1 declaration record must contain exactly the following platform fields.

| Field | Type | Required | Rule |
|---|---:|---:|---|
| declaration_id | uuid | yes | Unique immutable record ID. |
| user_id | uuid | yes | Platform user owning the declaration. |
| actor_type | enum | yes | v0 closed set: individual_user, coach. Must match payload. |
| execution_scope | enum | yes | v0 closed set: individual, coach_managed. Must match payload. |
| activity_id | enum | yes | v0 closed set: powerlifting, rugby_union, general_strength. Must match payload. |
| declaration_payload_json | jsonb | yes | Exact accepted Phase 1 declaration payload. |
| declaration_payload_sha256 | text | yes | Lowercase sha256 hex of canonical engine-visible payload bytes. |
| phase1_schema_version | text | yes | Exact accepted schema version. |
| engine_compatibility | text | yes | Exact engine compatibility pin. |
| enum_bundle_version | text | yes | Exact enum bundle pin. |
| consent_granted | boolean | yes | Must be true. |
| jurisdiction_acknowledged | boolean | yes | Must be true. |
| accepted_at | timestamptz | yes | Acceptance timestamp. |
| superseded_at | timestamptz | no | Null unless superseded by a later accepted declaration. |
| immutable | boolean | yes | Must always be true. |
| immutable_status | text | yes | Must always be immutable. |
| created_at | timestamptz | yes | Platform insert timestamp. |

## 4. Canonical hash rule

The declaration hash is computed from the engine-visible Phase 1 payload only.

Canonicalisation rules:

1. Object keys are sorted recursively.
2. Arrays preserve order.
3. Strings are preserved exactly.
4. Numbers are preserved as JSON numbers.
5. Booleans are preserved exactly.
6. Nulls are preserved if lawful under the Phase 1 schema.
7. No platform fields are included in the hash.
8. No payment, coach metadata, product tier, or presentation runtime state is included unless explicitly declared as engine-visible Phase 1 payload by the Phase 1 schema.

Hash format:

- algorithm: sha256
- encoding: lowercase hex
- length: 64 characters

## 5. Acceptance rules

A declaration may be accepted only when all of the following are true:

1. The payload is valid against the active Phase 1 declaration schema.
2. The payload contains no unknown fields.
3. Required fields are present.
4. consent_granted is true.
5. jurisdiction_acknowledged is true.
6. actor_type is within the active v0 closed set.
7. execution_scope is within the active v0 closed set.
8. activity_id is within the active v0 closed set.
9. phase1_schema_version equals the active Phase 1 schema version.
10. engine_compatibility equals EB2-1.0.0.
11. enum_bundle_version equals EB2-1.0.0.
12. declaration_payload_sha256 equals the recomputed canonical payload hash.

If any condition fails, no record is created.

## 6. Append-only law

Phase 1 declaration records are append-only.

Edits require a new declaration.

An accepted declaration must not be changed after insertion except for superseded_at when a later accepted declaration explicitly replaces it.

The following fields are permanently immutable after insert:

- declaration_id
- user_id
- actor_type
- execution_scope
- activity_id
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

## 7. Supersession rule

Latest accepted declaration is selected by accepted_at descending where superseded_at is null.

When a new valid declaration is accepted for the same user:

1. The previous current accepted declaration may have superseded_at set.
2. The new accepted declaration is inserted as a new immutable record.
3. The old declaration remains retained.
4. Compile must not use superseded declarations.

Supersession changes current selection only.

Supersession does not edit the original declaration payload.

## 8. Current accepted declaration rule

A current accepted declaration is one where:

- user_id matches
- accepted_at is not null
- superseded_at is null
- immutable is true
- immutable_status is immutable
- consent_granted is true
- jurisdiction_acknowledged is true
- phase1_schema_version matches active compile version
- engine_compatibility matches active compile version
- enum_bundle_version matches active compile version
- declaration_payload_sha256 matches recomputed canonical payload hash

If no current accepted declaration exists, compile must fail.

## 9. Compile admission rule

Compile admission must receive:

- user_id
- requested_activity_id
- requested_execution_scope
- active_phase1_schema_version
- active_engine_compatibility
- active_enum_bundle_version

Compile must refuse when:

- no accepted declaration exists
- declaration is superseded
- declaration is unaccepted
- declaration is invalid
- declaration is mutable
- declaration version pins mismatch active compile pins
- declaration hash mismatches recomputed payload hash
- requested activity does not match declaration activity_id
- requested execution_scope does not match declaration execution_scope

## 10. Compile blocked codes

Allowed blocked codes:

- PHASE1_COMPILE_BLOCKED_NO_ACCEPTED_DECLARATION
- PHASE1_COMPILE_BLOCKED_UNACCEPTED_DECLARATION
- PHASE1_COMPILE_BLOCKED_SUPERSEDED_DECLARATION
- PHASE1_COMPILE_BLOCKED_MUTABLE_DECLARATION
- PHASE1_COMPILE_BLOCKED_VERSION_MISMATCH
- PHASE1_COMPILE_BLOCKED_HASH_MISMATCH
- PHASE1_COMPILE_BLOCKED_INVALID_DECLARATION
- PHASE1_COMPILE_BLOCKED_ACTIVITY_MISMATCH
- PHASE1_COMPILE_BLOCKED_SCOPE_MISMATCH

## 11. Forbidden behaviour

The acceptance record must not be mutated by:

- payment state
- coach metadata
- coach notes
- presentation state
- product tier state
- UI state
- compile attempts
- runtime events

The compile gate must not:

- accept declarations
- repair declarations
- infer missing values
- inject defaults
- edit accepted records
- alter hashes
- alter version pins
- choose superseded records
- use payment state as engine truth
- use coach metadata as engine truth
- use presentation state as engine truth

## 12. Acceptance criteria

S28 is accepted when:

1. Valid declaration can be accepted and hashed.
2. Accepted declaration record is immutable.
3. Accepted record cannot be updated except superseded_at when explicitly allowed.
4. Compile refuses missing declarations.
5. Compile refuses invalid declarations.
6. Compile refuses superseded declarations.
7. Compile refuses unaccepted declarations.
8. Compile refuses version-mismatched declarations.
9. Compile refuses hash-mismatched declarations.
10. Hash changes when engine-visible declaration content changes.
11. Payment, coach metadata, and presentation state cannot mutate the record.
12. Current accepted declaration selection uses latest accepted_at where superseded_at is null.

## 13. Final rule

Compile starts only after accepted, immutable, version-pinned Phase 1 declaration truth exists.

If accepted Phase 1 truth is missing, invalid, mutable, superseded, unaccepted, mismatched, or hash-inconsistent, compile must fail closed.
