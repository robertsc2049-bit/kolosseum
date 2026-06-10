# S28 — Phase 1 Acceptance Record API Contract

Document ID: phase1_acceptance_record_api_contract  
Version: 1.0.0  
Status: authoritative  
Scope class: closed_world  
Engine compatibility: EB2-1.0.0

## 1. Purpose

This document defines the platform API contract for creating, reading, and selecting current accepted Phase 1 declarations.

The API is platform-owned.

The engine consumes accepted declaration truth only after compile admission.

## 2. Common rules

All endpoints must enforce:

- no inference
- no defaults
- no payload repair
- no unknown fields
- exact version pins
- exact enum pins
- exact hash verification
- append-only declaration records

## 3. Active pins

The active v0 pins are:

- phase1_schema_version: 1.0.0
- engine_compatibility: EB2-1.0.0
- enum_bundle_version: EB2-1.0.0

## 4. Create accepted declaration

Endpoint:

POST /api/v0/phase1/declarations

### 4.1 Request

Body:

{
  "user_id": "uuid",
  "declaration_payload_json": {
    "actor_type": "individual_user",
    "execution_scope": "individual",
    "activity_id": "powerlifting",
    "phase1_schema_version": "1.0.0",
    "engine_compatibility": "EB2-1.0.0",
    "enum_bundle_version": "EB2-1.0.0",
    "consent_granted": true,
    "jurisdiction_acknowledged": true
  }
}

### 4.2 Server-side derivation

The server derives these fields from the payload:

- actor_type
- execution_scope
- activity_id
- phase1_schema_version
- engine_compatibility
- enum_bundle_version
- consent_granted
- jurisdiction_acknowledged
- declaration_payload_sha256
- accepted_at

The client must not supply accepted_at, superseded_at, immutable, immutable_status, or created_at.

### 4.3 Validation

The server must:

1. Validate request shape.
2. Validate declaration_payload_json against the Phase 1 schema.
3. Reject unknown fields.
4. Confirm consent_granted is true.
5. Confirm jurisdiction_acknowledged is true.
6. Confirm actor_type is individual_user or coach.
7. Confirm execution_scope is individual or coach_managed.
8. Confirm activity_id is powerlifting, rugby_union, or general_strength.
9. Confirm all version pins match active pins.
10. Canonicalise the engine-visible payload.
11. Compute declaration_payload_sha256.
12. Insert a new immutable record.
13. Supersede previous current declaration for the same user in the same transaction when replacement is intended.

### 4.4 Success response

Status: 201

Body:

{
  "ok": true,
  "declaration": {
    "declaration_id": "uuid",
    "user_id": "uuid",
    "actor_type": "individual_user",
    "execution_scope": "individual",
    "activity_id": "powerlifting",
    "declaration_payload_sha256": "64-char-lowercase-sha256",
    "phase1_schema_version": "1.0.0",
    "engine_compatibility": "EB2-1.0.0",
    "enum_bundle_version": "EB2-1.0.0",
    "consent_granted": true,
    "jurisdiction_acknowledged": true,
    "accepted_at": "ISO-8601 timestamp",
    "superseded_at": null,
    "immutable": true,
    "immutable_status": "immutable",
    "created_at": "ISO-8601 timestamp"
  }
}

### 4.5 Failure responses

Invalid payload:

Status: 400

{
  "ok": false,
  "code": "PHASE1_ACCEPTANCE_PAYLOAD_INVALID"
}

Consent missing:

Status: 400

{
  "ok": false,
  "code": "PHASE1_ACCEPTANCE_CONSENT_MISSING"
}

Jurisdiction missing:

Status: 400

{
  "ok": false,
  "code": "PHASE1_ACCEPTANCE_JURISDICTION_MISSING"
}

Version mismatch:

Status: 409

{
  "ok": false,
  "code": "PHASE1_ACCEPTANCE_VERSION_MISMATCH"
}

Hash mismatch:

Status: 409

{
  "ok": false,
  "code": "PHASE1_ACCEPTANCE_HASH_MISMATCH"
}

## 5. Read declaration by ID

Endpoint:

GET /api/v0/phase1/declarations/{declaration_id}

### 5.1 Success response

Status: 200

{
  "ok": true,
  "declaration": {
    "declaration_id": "uuid",
    "user_id": "uuid",
    "actor_type": "individual_user",
    "execution_scope": "individual",
    "activity_id": "powerlifting",
    "declaration_payload_json": {},
    "declaration_payload_sha256": "64-char-lowercase-sha256",
    "phase1_schema_version": "1.0.0",
    "engine_compatibility": "EB2-1.0.0",
    "enum_bundle_version": "EB2-1.0.0",
    "consent_granted": true,
    "jurisdiction_acknowledged": true,
    "accepted_at": "ISO-8601 timestamp",
    "superseded_at": null,
    "immutable": true,
    "immutable_status": "immutable",
    "created_at": "ISO-8601 timestamp"
  }
}

### 5.2 Not found response

Status: 404

{
  "ok": false,
  "code": "PHASE1_DECLARATION_NOT_FOUND"
}

## 6. Read current accepted declaration

Endpoint:

GET /api/v0/users/{user_id}/phase1/declarations/current

### 6.1 Selection rule

Select the latest declaration where:

- user_id matches
- accepted_at is not null
- superseded_at is null
- immutable is true
- immutable_status is immutable

Order:

1. accepted_at descending
2. created_at descending
3. declaration_id descending

### 6.2 Success response

Status: 200

{
  "ok": true,
  "declaration": {
    "declaration_id": "uuid",
    "user_id": "uuid",
    "actor_type": "individual_user",
    "execution_scope": "individual",
    "activity_id": "powerlifting",
    "declaration_payload_json": {},
    "declaration_payload_sha256": "64-char-lowercase-sha256",
    "phase1_schema_version": "1.0.0",
    "engine_compatibility": "EB2-1.0.0",
    "enum_bundle_version": "EB2-1.0.0",
    "consent_granted": true,
    "jurisdiction_acknowledged": true,
    "accepted_at": "ISO-8601 timestamp",
    "superseded_at": null,
    "immutable": true,
    "immutable_status": "immutable",
    "created_at": "ISO-8601 timestamp"
  }
}

### 6.3 Missing current declaration response

Status: 404

{
  "ok": false,
  "code": "PHASE1_CURRENT_ACCEPTED_DECLARATION_NOT_FOUND"
}

## 7. Supersede declaration

Endpoint:

POST /api/v0/phase1/declarations/{declaration_id}/supersede

### 7.1 Purpose

This endpoint marks an existing current declaration as superseded when a later accepted declaration replaces it.

It must not edit the declaration payload.

### 7.2 Request

{
  "superseded_at": "ISO-8601 timestamp"
}

### 7.3 Success response

Status: 200

{
  "ok": true,
  "declaration_id": "uuid",
  "superseded_at": "ISO-8601 timestamp"
}

### 7.4 Failure responses

Already superseded:

Status: 409

{
  "ok": false,
  "code": "PHASE1_DECLARATION_ALREADY_SUPERSEDED"
}

Immutable field mutation attempted:

Status: 409

{
  "ok": false,
  "code": "PHASE1_ACCEPTANCE_RECORD_IMMUTABLE"
}

## 8. Compile gate interface

Function:

getCurrentAcceptedPhase1Declaration(user_id)

Returns:

- current accepted immutable declaration record, or
- null

Compile admission then validates version pins, hash, activity, and execution scope.

## 9. Prohibited API inputs

Create and supersede endpoints must reject:

- payment fields
- product tier fields
- coach metadata fields
- coach note fields
- presentation runtime state fields
- compile output fields
- runtime event fields

## 10. Final rule

The API creates and reads accepted Phase 1 declaration truth.

It must not create engine truth from anything except an explicit valid Phase 1 declaration payload.