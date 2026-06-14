<!-- DEV NOTE: V1 acceptance-record control document. This binds immutable accepted declaration records with deterministic hash/source metadata. It extends the existing Phase 1 declaration surface and does not create a second declaration system. -->

# V1 Declaration Acceptance Record

Status: active v1 acceptance-record boundary document.
Slice: S-V1-17.
Release boundary: v1 First Lawful Run.

## Purpose

This document binds the v1 declaration acceptance record.

S-V1-17 extends the existing Phase 1 declaration surface by requiring each accepted declaration record to carry deterministic hash metadata and factual source metadata.

The acceptance record exists to prove:

- the accepted declaration payload is the exact payload that was recorded
- the recorded payload hash can be recomputed
- the recorded source fields can be inspected
- accepted records are immutable
- superseded records cannot be used for compile admission
- hash mismatch fails closed

## Existing authority

S-V1-17 does not replace S-V1-16.

S-V1-17 extends:

- `docs/v1/V1_PHASE_1_DECLARATION_SURFACE.md`
- `src/phase1DeclarationSurface.mjs`
- `ci/scripts/run_phase1_acceptance_record_tests.mjs`
- `docs/v0/phase1_acceptance_record_tests.json`

The existing Phase 1 acceptance record suite remains authoritative proof for accepted record immutability, supersession, and compile-admission refusal.

## Accepted record metadata

An accepted declaration record must include:

- accepted_declaration_record = true
- accepted_declaration_record_version
- declaration_payload_sha256
- hash_metadata
- source_metadata
- immutable_fields
- superseded_at_iso8601

Hash metadata must include:

- algorithm
- canonical_json
- payload_sha256
- payload_hash_field

Source metadata must include:

- declaration_source
- declared_at_iso8601
- declared_by_user_id
- subject_user_id
- accepted_terms_version
- copy_acknowledgement_id

## Immutability rule

An accepted declaration record is immutable after creation.

Immutable fields include:

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
- user_declared_factual_state
- product_declaration_state_only
- engine_visible
- accepted_declaration_record
- accepted_declaration_record_version
- hash_metadata
- source_metadata
- immutable
- immutable_fields
- copy_ids

The only allowed lifecycle change is setting `superseded_at_iso8601` from null to an explicit ISO-8601 timestamp through a controlled supersession function.

Supersession must not change payload, hash metadata, source metadata, version pins, declaration identity, user identity, or copy identifiers.

## Compile-admission validity contract

Compile-admission validity is a contract check only.

The product/app precondition may read declaration validity through `assertPhase1DeclarationAcceptedBeforeCompile`.

The check must fail closed when:

- no record exists
- declaration is not accepted
- declaration is superseded
- immutable flag is false
- payload hash does not match recomputed hash
- hash metadata is missing or mismatched
- source metadata is missing or mismatched

S-V1-17 does not run engine phases.

S-V1-17 does not alter deterministic engine output.

S-V1-17 does not add database persistence.

S-V1-17 does not add UI.

S-V1-17 does not add assignment authority.

## Proof required

S-V1-17 acceptance requires proof that:

- a valid accepted record contains deterministic hash metadata
- a valid accepted record contains factual source metadata
- immutable accepted fields cannot be changed
- supersession preserves payload, hash metadata, and source metadata
- a superseded declaration fails compile-admission precondition
- hash mismatch fails closed
- the existing Phase 1 acceptance record suite remains green
- S-V1-16 declaration surface tests and guard remain green
- v0 active scope guard remains green

## Final rule

If an accepted declaration record cannot prove its hash metadata, source metadata, immutability, and current status, it must fail closed.

<!-- S-V1-18:DECLARATION-COMPILE-GATE:START -->
## S-V1-18 Declaration Compile Gate

The canonical v1 declaration compile-gate boundary is `docs/v1/V1_DECLARATION_COMPILE_GATE.md`.

S-V1-18 requires compile admission to fail closed unless the accepted declaration record is current, valid, immutable, and hash-consistent.

S-V1-18 reuses `assertPhase1DeclarationAcceptedBeforeCompile`; it does not create a second declaration system.
<!-- S-V1-18:DECLARATION-COMPILE-GATE:END -->
