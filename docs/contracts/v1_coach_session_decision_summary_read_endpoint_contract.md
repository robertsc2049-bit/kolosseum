# v1 Coach Session Decision Summary Read Endpoint Contract

## Status
Authoritative contract document

## Scope
v1 Lane 1 only

## Purpose
Freeze the first external read endpoint contract for retrieving a single coach session decision summary on top of the query-path contract.

---

## Why This Document Exists

The repo now has:

- the Lane 1 reporting target
- the coach session decision summary contract
- the projection contract
- the payload contract
- the query-path contract

What is still missing is the external read boundary that defines:

- what request inputs are accepted
- how lookup inputs are transported
- what success responses contain
- how internal query failures map to transport-visible failures
- what clients may rely on from the endpoint

Without this document, endpoint implementation can drift even if the underlying query contract is correct.

---

## Contract Goal

Define one deterministic read endpoint contract so that external clients retrieve the same summary semantics every time and do not reinterpret internal query behaviour.

---

## Non-Goals

This document does not:

- define write or mutation endpoints
- define list, search, or bulk endpoints
- define UI rendering
- define full authorization policy
- redefine payload or query semantics already frozen upstream

---

## Endpoint Responsibility

The read endpoint is responsible for:

1. accepting one valid lookup request
2. validating request shape
3. delegating deterministic resolution to the query-path layer
4. returning the summary payload unchanged in contract meaning
5. mapping failure classes into explicit endpoint responses

The read endpoint is not responsible for:

- inventing business semantics
- changing currentness meaning
- repairing bad source truth
- returning multiple summaries in one response
- silently swallowing ambiguity or degraded-state conditions

---

## Endpoint Shape

The first endpoint contract is a single-summary read.

Canonical shape:

- Method: GET
- Route pattern: /v1/coach/session-decision-summary

This document freezes semantics, not framework-specific wiring.

---

## Allowed Request Inputs

The endpoint may accept one of the following lookup forms:

### Request Form A
- run_id

### Request Form B
- session_id
- athlete_id

### Request Form C
- lineage_id
- prefer_current (optional)

These map directly to the allowed query inputs defined in the query-path contract.

---

## Request Rules

- at least one valid lookup form must be present
- mixed forms are allowed only if they do not conflict
- if mixed forms conflict, the request must fail with invalid_input
- request parsing must not infer hidden values
- empty strings count as missing
- unknown extra fields may be ignored only if doing so cannot change resolution semantics

---

## Query Parameter Contract

If transported as query parameters, the accepted parameter names are:

- run_id
- session_id
- athlete_id
- lineage_id
- prefer_current

Allowed prefer_current values:

- true
- false

---

## Success Response Contract

A successful response must return one object conforming to the payload contract.

Success status:

- 200 OK

Success body shape:

{
  "data": {
    "schema": {},
    "identity": {},
    "currentness": {},
    "outcome": {},
    "drivers": [],
    "timeline": {},
    "audit": {},
    "issues": []
  }
}

---

## Success Rules

- data must contain exactly one payload object
- the endpoint must not wrap business meaning in extra transport-only fields that change interpretation
- degraded states that are valid under the payload contract may still return 200 OK
- stale, current, superseded, and incomplete meanings live inside the payload and must not be overwritten by transport wording

---

## Failure Mapping

The endpoint must map internal query failure classes as follows:

- invalid_input -> 400
- not_found -> 404
- ambiguous_target -> 409
- projection_unavailable -> 503
- projection_incomplete -> 503
- source_truth_inconsistent -> 409

---

## Failure Response Shape

All non-success responses must use this shape:

{
  "error": {
    "code": "invalid_input",
    "message": "Human-readable failure summary."
  }
}

Required fields:

- error.code
- error.message

Rules:

- error.code must be machine-readable and stable
- error.message may be human-readable but must not leak hidden internals by default
- endpoint failure shape must remain single and deterministic across all mapped failure classes

---

## Failure Code Set

Allowed endpoint error codes:

- invalid_input
- not_found
- ambiguous_target
- projection_unavailable
- projection_incomplete
- source_truth_inconsistent

---

## Transport vs Payload Semantics

The endpoint layer must preserve this distinction:

- transport status communicates request or result class
- payload currentness communicates business or read-model state

Examples:

- a stale but valid summary may still be 200 OK
- a superseded but contract-valid summary may still be 200 OK
- a request that cannot resolve unambiguously must not return 200 OK

---

## Determinism Rules

For the same request and same authoritative persisted truth:

- the same status code must be returned
- the same payload must be returned on success
- the same error code must be returned on failure

---

## Idempotency Rules

This endpoint is read-only.

Therefore:

- repeated identical requests must not mutate state
- repeated identical requests may be replayed safely
- read access must not change lineage or currentness semantics

---

## Auditability Rules

A successful endpoint response must remain traceable through internal logs or diagnostics to:

- the request input shape
- the resolved query-path target
- the payload returned

A failed endpoint response must remain traceable to:

- the failure class selected
- the request validation or resolution step that failed

---

## Security and Exposure Rules

The endpoint may expose only the frozen payload contract and stable failure codes.

It must not expose by default:

- raw internal database rows
- hidden source-truth blobs
- internal stack traces
- accidental debug-only lineage internals

---

## Test Implications

Implementation of this contract should be backed by tests that prove:

1. valid run_id requests return 200 plus contract-valid payload
2. invalid request shapes return 400 plus stable error body
3. not_found returns 404
4. ambiguity returns 409
5. unavailable and incomplete projection states map to 503
6. successful responses preserve the payload contract unchanged in meaning
7. repeated identical requests remain deterministic

---

## Exit Criteria

This slice is complete when:

- request inputs are frozen
- success response shape is frozen
- failure mapping is frozen
- transport versus payload semantics are explicit
- downstream implementation can build the first read endpoint without inventing behaviour

---

## Next Likely Downstream Slice

After this, the next most likely slice is:

1. the first coach session decision summary implementation and test matrix
or
2. the first list or search endpoint contract only if single-read implementation is accepted first