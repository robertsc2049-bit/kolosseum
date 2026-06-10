# V1 Slice 001 - Coach Session Decision Summary Readback

## Why this slice is next

The repo plumbing is now stable enough to move back to product work.

Recent work established:
- decision summary projection direction
- read-model dependency on engine run lookup
- persistence seam needed for run-backed readback
- CI/main protection so product slices can land more safely

The next highest-leverage V1 step is to lock the first product-facing slice around coach session decision summary readback so implementation stays narrow, testable, and deterministic.

This slice exists to answer one product question clearly:

**Given a valid run_id, can the system return a stable, explicit, audit-friendly coach session decision summary projection?**

---

## Slice name

**Coach session decision summary readback**

---

## Slice objective

Return a deterministic read model for a previously persisted engine run using `run_id` as the lookup key.

This is a read-only slice.

No mutation.
No write-back.
No coach editing surface.
No UI work.
No cross-run aggregation.
No historical analytics.

---

## Product value

This gives V1 a concrete audit/readback capability:
- a coach/admin can inspect what the engine decided
- decision output is tied to a persisted run
- downstream product/API work has a stable contract to build on
- future UI can render from a fixed payload instead of guessing from engine internals

---

## Entry conditions

This slice assumes:
- engine runs can be persisted
- engine run lookup by `run_id` exists
- decision summary projection logic exists or is partially scaffolded
- repo CI/protection is green enough to land a focused read-model slice

---

## Inputs

### Required input
- `run_id: string`

### Optional inputs
None in V1 Slice 001.

---

## Output contract

The readback operation must return either:

### Success
A stable JSON object representing a decision summary projection for the requested run.

### Not found
An explicit not-found result when no persisted run exists for the provided `run_id`.

### Invalid request
An explicit bad-request result when `run_id` is missing or invalid.

---

## Minimum success payload shape

The exact field names can evolve only through an explicit contract change, but the payload must support the following semantic areas:

- projection identity
- source auditability
- run linkage
- decision summary body
- issues / warnings
- deterministic output structure

Minimum semantic structure:
1. `run_id`
2. `audit.source`
3. `audit.resolved_from`
4. summary/projection content derived from persisted run output
5. `issues` array
6. no silent omission of missing critical source data

---

## Invariants

### INV-001 - Read-only
This slice must not mutate DB state, engine state, or session state.

### INV-002 - Run-bound
Projection must be derived from exactly one persisted engine run identified by `run_id`.

### INV-003 - Deterministic
The same persisted run must produce the same readback payload shape every time.

### INV-004 - Explicit failure modes
Missing `run_id`, invalid `run_id`, and unknown `run_id` must not collapse into ambiguous success payloads.

### INV-005 - No silent fallback
If required source material is absent, the code must fail explicitly or return a deliberate empty/not-found shape. No fabricated summary.

### INV-006 - Audit-first
Returned payload must make it obvious that data came from persisted engine-run readback, not recomputation.

### INV-007 - Shape stability
V1 consumers must be able to rely on stable top-level structure even if inner summary content expands later.

---

## Scope included

Included in this slice:
- read-model contract for decision summary by `run_id`
- source lookup from persisted engine run storage
- explicit success / not-found / bad-request behavior
- contract-level tests
- source-level handler/service tests if applicable

---

## Scope excluded

Excluded from this slice:
- UI rendering
- filtering/search across many runs
- pagination
- coach-auth policy
- write/edit flows
- recomputation from raw engine inputs
- analytics dashboards
- multi-run comparisons
- export/download
- cross-session linking beyond single-run readback

---

## Expected code touch areas

Expected touch areas are likely to include some subset of:
- `src/api/session_state_read_model.ts`
- `src/api/engine_run_persistence_service.ts`
- handler/query seam for readback endpoint or service access
- tests covering source contract and executed behavior

This list is directional, not mandatory.

---

## Test requirements

This slice is not done unless the following are covered.

### TR-001 - valid run_id success
A known persisted run returns a stable success payload.

### TR-002 - missing run_id bad request
Missing required input fails explicitly before lookup.

### TR-003 - unknown run_id not found
Unknown run returns explicit not-found behavior.

### TR-004 - audit fields present
Success payload includes source/audit linkage proving run-backed readback.

### TR-005 - deterministic shape
Repeated reads for the same persisted run preserve payload structure.

### TR-006 - no mutation
Readback path performs no persistence writes.

### TR-007 - failure transparency
Malformed source data does not silently fabricate a success projection.

---

## Suggested implementation order

1. Lock the payload contract
2. Lock bad-request / not-found behavior
3. Wire persisted run lookup cleanly
4. Add success-path executed test
5. Add failure-path tests
6. Verify no mutation side effects
7. Land narrow PR

---

## Definition of done

This slice is done only when:
- a single-run decision summary readback path exists by `run_id`
- success / not-found / bad-request behavior is explicit
- tests prove deterministic behavior
- no write side effects exist
- payload is audit-friendly
- CI passes
- main can absorb the slice without follow-up plumbing fixes

---

## Kill criteria

Stop and re-scope if implementation starts to require:
- broad auth redesign
- UI dependencies
- multi-run analytics
- schema migration unrelated to readback
- recomputation engine changes
- policy/governance work outside read-model scope

If any of those appear, cut a narrower slice and keep this one read-only.

---

## Follow-on slice after completion

Once this slice lands, the next likely V1 slice is:

**V1 Slice 002 - expose decision summary readback through a stable API handler/endpoint contract**

That should remain separate from this contract-locking slice unless the repo already has the endpoint seam ready and trivial to complete.

---

## Delivery note

This document is the implementation contract for the next V1-facing product slice and should be treated as the source of truth for scope, invariants, and completion criteria.
