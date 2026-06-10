# V1 Slice 003 - Coach Session Decision Summary Consumer Surface

## Why this slice is next

Slice 002 is now complete.

That means the system has crossed an important boundary:
- the decision summary projection exists
- the projection is exposed through one stable read-only HTTP contract by `run_id`

The next highest-value step is no longer transport plumbing.

The next job is to define the first **consumer-facing surface** that uses that stable endpoint without exploding into broad product/UI scope.

This slice exists to answer one product question clearly:

**What is the narrowest consumer-facing surface that can request and render one coach session decision summary by `run_id` using the new stable endpoint, while preserving deterministic behavior and audit fidelity?**

---

## Slice name

**Coach session decision summary consumer surface**

---

## Slice objective

Define the first consumer-facing contract that consumes the new stable decision summary read endpoint.

This slice is consumer-facing, but still narrow.

Included:
- one consumer-facing read surface
- one lookup key: `run_id`
- one happy-path display contract
- one explicit empty/error state contract
- one explicit loading state contract
- one explicit field allowlist for what is shown
- one strict boundary on what this surface does not own

Excluded:
- list views
- search
- filters
- pagination
- write/edit actions
- auth redesign
- batch readback
- analytics dashboards
- export/download
- notification flows
- cross-run comparisons
- session editing/replay

---

## Product value

This slice gives V1 the first real downstream consumer of the decision summary endpoint.

It allows:
- the new endpoint to prove product usefulness, not just transport correctness
- a future UI or read surface to be built against a frozen narrow contract
- explicit decisions about what the consumer sees vs what remains audit/internal
- later surfaces to expand from one known-good display model instead of improvising

---

## Entry conditions

This slice assumes:
- Slice 001 projection builder exists
- Slice 002 stable HTTP read contract exists by `run_id`
- success and failure transport behavior is already explicit
- repo/main is green after the Slice 002 merge

---

## Consumer surface contract

### Surface type

Exactly one consumer-facing read surface.

This document does not force a specific framework or file layout.
It does force behavior.

### Input

Required:
- `run_id: string`

Optional:
- none in Slice 003

### Consumer states

The surface must support exactly these semantic states:

1. **loading**
   - request in progress
   - no fabricated summary body

2. **success**
   - stable read-only presentation of the decision summary payload

3. **not found**
   - explicit surface state when `run_id` does not resolve

4. **bad request**
   - explicit surface state when `run_id` is missing/invalid

5. **invalid source / internal failure**
   - explicit failure state when persisted source data cannot be projected safely

No silent failure.
No ambiguous empty success.
No synthetic fallback payload.

---

## Minimum displayed fields

The first consumer-facing surface must display only the minimum meaningful readback areas.

Required display groups:
1. `identity.run_id`
2. `currentness.state`
3. `outcome`
4. `drivers`
5. `timeline`
6. `audit`
7. `issues`

Optional display groups:
- `schema.version` may be shown or retained internally, but if shown it must be labelled clearly

Excluded from Slice 003:
- broad raw payload dumping
- debug-only internals without explicit product value
- unrelated session runtime data
- unrelated block/session write controls

---

## Display behavior rules

### DB-001 - read-only
The consumer surface must not create, mutate, retry-write, or recompute domain state.

### DB-002 - endpoint reuse
The consumer surface must consume the stable Slice 002 endpoint contract instead of bypassing it and calling persistence/read-model seams directly.

### DB-003 - stable field mapping
The success surface must map displayed information from the existing response structure without inventing alternate semantics.

### DB-004 - explicit status mapping
Transport outcomes must map to visibly distinct consumer states:
- bad request
- not found
- invalid source / internal failure
- success

### DB-005 - no fake data
No placeholder success payloads.
No mocked-looking fabricated cards in real runtime behavior.

### DB-006 - audit fidelity
If audit information is displayed, it must preserve the proof that readback resolved from persisted engine-run lookup by `run_id`.

### DB-007 - narrowness
This slice must not grow into route families, dashboards, list pages, or search.

---

## Consumer-facing success contract

On success, the surface must make these things legible:

- which run was requested
- whether the summary is current/stale according to `currentness`
- what decision or result was produced
- what drivers explain that result
- when the source run was created/completed if present
- whether there are issues
- the audit origin of the result

The surface should optimize for comprehension, not raw JSON exposure.

---

## Failure contract

### Bad request
When `run_id` is missing or invalid:
- explicit bad-input state
- clear explanation that a valid `run_id` is required

### Not found
When the run is not found:
- explicit not-found state
- no fake success scaffold

### Invalid source / internal failure
When the source is malformed or otherwise invalid for projection:
- explicit failure state
- no fallback rendering that pretends the summary is trustworthy

---

## Scope included

Included in this slice:
- one consumer-facing contract doc
- one state model for loading/success/failure rendering
- one display allowlist for the first read surface
- one explicit rule that the new consumer surface must call the Slice 002 endpoint

---

## Scope excluded

Excluded from this slice:
- implementation across multiple pages
- search by athlete/session/coach
- collection/list pages
- auth and permissions redesign
- rich navigation framework decisions
- analytics reporting
- multi-run comparisons
- export flows
- mutation controls
- mobile/desktop parity work beyond basic contract definition

---

## Expected code touch areas for the implementation slice that follows

Likely future touch areas may include some subset of:
- a consumer-facing route/page/view
- one API client or fetch seam pointed at the Slice 002 endpoint
- rendering logic for success/loading/failure states
- consumer-surface contract tests

This document is a contract for the next implementation slice, not the implementation itself.

---

## Test requirements for the implementation slice that follows

### TR-001 - valid run_id success render
Valid `run_id` produces a stable success view using the Slice 002 endpoint response.

### TR-002 - loading state
The consumer surface exposes a clear loading state while the request is unresolved.

### TR-003 - missing run_id bad request state
Missing/invalid `run_id` produces a distinct bad-input state.

### TR-004 - unknown run_id not found state
Unknown `run_id` maps to a distinct not-found state.

### TR-005 - invalid source failure state
Malformed source maps to a distinct internal failure state.

### TR-006 - endpoint consumption
The consumer surface consumes the Slice 002 endpoint rather than bypassing transport and reading internal projection seams directly.

### TR-007 - field allowlist
The success surface displays only the approved minimum semantic groups for Slice 003.

### TR-008 - no writes
The consumer surface causes no write-side effects.

---

## Suggested implementation order

1. Freeze the first consumer-facing state model
2. Freeze the minimum field allowlist
3. Define the one narrow fetch seam to the Slice 002 endpoint
4. Implement success/loading/failure rendering
5. Add consumer-surface contract tests
6. Land one narrow PR

---

## Definition of done

This slice is done only when:
- the first consumer-facing decision summary surface is contract-defined
- the surface is explicitly read-only
- the surface consumes the stable Slice 002 endpoint
- loading, success, bad-request, not-found, and invalid-source states are distinct
- the display field allowlist is fixed
- the slice remains narrow and does not sprawl into search/list/dashboard work

---

## Kill criteria

Stop and cut a narrower slice if this work starts to require:
- search/list/index design
- auth redesign
- broad UI framework debates
- dashboard composition
- export/reporting
- batch reads
- route-family expansion
- write-side controls

---

## Follow-on slice after completion

Once this contract lands, the next likely slice is:

**V1 Slice 004 - implement the first consumer-facing decision summary read surface against the stable endpoint**

That implementation slice should stay separate from this contract-definition slice.

---

## Delivery note

This document is the source of truth for the first consumer-facing decision summary surface and should be treated as the contract boundary between the completed transport slice and the next implementation slice.
