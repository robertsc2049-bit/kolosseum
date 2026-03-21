# V1 Slice 002 - Coach Session Decision Summary HTTP Contract

## Why this slice is next

Slice 001 established the read-only projection builder by `run_id`.

That means the next highest-value step is no longer projection design. It is API exposure.

This slice exists to answer one product question clearly:

**Can a caller request coach session decision summary readback by `run_id` through one stable read-only HTTP/API contract with explicit success and failure behavior?**

---

## Slice name

**Coach session decision summary HTTP contract**

---

## Slice objective

Expose the existing read-only decision summary projection through one stable handler or endpoint contract.

This slice is transport-facing, but still narrow.

Included:
- one read-only handler/endpoint contract
- one lookup key: `run_id`
- explicit request validation
- explicit not-found behavior
- explicit success behavior
- deterministic response shape

Excluded:
- auth redesign
- listing/filtering
- pagination
- UI
- batch readback
- analytics
- write/edit operations
- recomputation

---

## Product value

This gives V1 the first callable external seam for decision summary readback.

It allows:
- downstream UI/API work to consume a stable contract
- explicit operational verification against a real endpoint seam
- audit-friendly inspection of persisted engine-run decisions
- later product surfaces to build on a fixed response shape instead of internal function calls

---

## Entry conditions

This slice assumes:
- Slice 001 projection/read-model exists
- `buildCoachSessionDecisionSummaryFromRunId(run_id)` exists
- persisted engine run lookup exists
- repo CI is stable enough to absorb one narrow API seam

---

## Request contract

### Method
Read-only handler/endpoint only.

This doc does not force a transport shape, but the implementation must behave as one stable read request.

### Required input
- `run_id: string`

### Optional inputs
None in Slice 002.

---

## Response contract

The handler/endpoint must return exactly one of these outcomes.

### Success
- success status
- stable JSON payload containing the decision summary projection for the requested `run_id`

### Bad request
- explicit bad-request status
- explicit error token/message for missing or invalid `run_id`

### Not found
- explicit not-found status
- explicit error token/message when `run_id` does not resolve to a persisted run

### Invalid source
- explicit failure status
- explicit error token/message when persisted source data is malformed and cannot be projected safely

---

## Minimum success body

The success body must preserve the Slice 001 projection shape.

Minimum semantic areas:
1. schema/version
2. identity.run_id
3. currentness.state
4. outcome
5. drivers
6. timeline
7. audit
8. issues

The endpoint/handler must not reshape these into a looser or ambiguous transport form.

---

## Invariants

### INV-001 - Read-only
The HTTP/API path must not mutate DB state, engine state, or session state.

### INV-002 - Projection reuse
The handler/endpoint must delegate to the existing read-model projection path rather than duplicating projection logic.

### INV-003 - Explicit error mapping
Bad input, missing run, and malformed source must map to clearly distinct failure behavior.

### INV-004 - Deterministic success body
For the same persisted run, repeated successful reads must preserve response structure.

### INV-005 - No fabricated fallback
Malformed persisted source data must fail explicitly. No synthetic success payloads.

### INV-006 - Narrow seam
This slice must not introduce batch reads, auth redesign, filters, search, or UI concerns.

### INV-007 - Audit fidelity
Transport response must preserve the audit fields proving readback was resolved from persisted engine-run lookup by `run_id`.

---

## Scope included

Included in this slice:
- one read-only query seam
- input validation for `run_id`
- explicit success / bad-request / not-found / invalid-source responses
- handler source contract tests
- executed HTTP/handler tests if the seam exists
- narrow wiring from transport layer to read-model builder

---

## Scope excluded

Excluded from this slice:
- route discovery/index work unrelated to this endpoint
- auth policy expansion
- list/search endpoints
- pagination
- UI rendering
- batch export
- CSV/PDF download
- aggregation across runs
- analytics/state dashboards
- new persistence format changes unrelated to transport mapping

---

## Expected code touch areas

Likely touch areas include some subset of:
- handler file that owns the relevant read endpoint
- `src/api/session_state_query_service.ts`
- `src/api/session_state_read_model.ts`
- executed HTTP contract tests
- source contract tests for handler/query delegation

This list is directional, not mandatory.

---

## Test requirements

### TR-001 - valid run_id success
Valid request returns success status and stable projection body.

### TR-002 - missing run_id bad request
Missing `run_id` fails before persistence lookup completes.

### TR-003 - unknown run_id not found
Unknown `run_id` returns explicit not-found behavior.

### TR-004 - malformed source explicit failure
Malformed persisted source does not fabricate success.

### TR-005 - audit fields preserved
Transport success response preserves audit linkage from Slice 001.

### TR-006 - projection delegation
Handler/query seam reuses the projection builder instead of re-implementing projection logic.

### TR-007 - no mutation
Read path performs no persistence writes.

---

## Suggested implementation order

1. Find the narrowest existing query/handler seam
2. Wire `run_id` input into the read-model builder
3. Lock explicit error mapping
4. Add handler source contract tests
5. Add executed success-path test
6. Add executed failure-path tests
7. Land narrow PR

---

## Definition of done

This slice is done only when:
- one stable read-only handler/endpoint exists for decision summary by `run_id`
- success / bad-request / not-found / invalid-source behavior is explicit
- transport path delegates to the projection builder
- no write side effects exist
- tests prove the contract
- CI passes
- main absorbs the slice cleanly

---

## Kill criteria

Stop and cut a narrower slice if this work starts to require:
- auth redesign
- router-wide refactor
- endpoint family design
- batch/list/search behavior
- schema migration unrelated to transport mapping
- UI work
- policy/governance work outside this read seam

---

## Follow-on slice after completion

Once this lands, the next likely slice is:

**V1 Slice 003 - expose decision summary readback to a consumer-facing surface using the new stable endpoint**

That should remain separate from this transport-contract slice.

---

## Delivery note

This document is the source of truth for the next V1-facing API exposure step and should be treated as the contract for scope, invariants, and completion criteria.
