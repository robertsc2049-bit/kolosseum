# v1 Coach Session Decision Summary First Ticket Set

## Status
Authoritative execution ticket-planning document

## Scope
v1 Lane 1 only

## Purpose
Freeze the first concrete implementation ticket set for the coach session decision summary read surface so build work can begin without semantic drift.

---

## Why This Document Exists

The repo now has the full single-summary Lane 1 stack:

- reporting target
- summary contract
- projection contract
- payload contract
- query-path contract
- read endpoint contract
- implementation and test matrix

What is still missing is the first concrete build queue.

Without a fixed first ticket set, implementation can drift into:

- mixing multiple seams in one slice
- proving the wrong invariant first
- starting endpoint wiring before projection truth is stable
- cutting tickets that sound useful but do not close the first vertical slice

---

## Primary Goal

Define the minimum ticket set required to deliver the first coach session decision summary read surface by run_id with deterministic behaviour and proof coverage.

---

## Ticket Set Boundaries

This first ticket set is intentionally narrow.

Included:

- projection builder seam for run_id happy path
- payload conformance proof
- query resolver seam for run_id plus not_found path
- read endpoint adapter for GET single summary by run_id
- endpoint mapping proof
- vertical e2e proof for repeated deterministic reads

Excluded for now:

- ambiguity expansion beyond what is required to prevent silent fallthrough
- lineage-first lookup implementation
- session_id plus athlete_id multi-key expansion
- bulk and list surfaces
- UI rendering

---

## Ticket Ordering

Tickets must be executed in this order:

1. TICKET-A projection builder
2. TICKET-B projection proof
3. TICKET-C query resolver
4. TICKET-D endpoint adapter
5. TICKET-E endpoint and e2e proof

Do not reorder without an explicit decision because the lower seams define truth for the upper seams.

---

## TICKET-A Projection Builder For Run ID Happy Path

### Objective
Implement the first projection builder that maps authoritative persisted truth into the frozen payload shape for one valid run_id target.

### Inputs
- authoritative persisted runtime truth
- frozen payload contract
- frozen projection contract

### Outputs
- one builder path that emits a contract-valid payload object

### Must Prove
- payload fields are sourced from authoritative truth
- currentness is explicit
- stale or incomplete conditions are not hidden

### Must Not Do
- invent endpoint logic
- resolve ambiguous identifiers
- add list semantics

### Done When
- builder exists
- happy path emits contract-valid payload
- degraded-state behaviour is explicit in code and tests

---

## TICKET-B Projection Payload Proof

### Objective
Prove that the projection builder output conforms to the frozen payload contract and degraded-state rules.

### Required Test Cases
- valid truth projects to valid payload
- stale truth remains marked stale
- incomplete truth remains incomplete or unavailable
- superseded truth is not mislabeled current

### Done When
- proof cases are automated
- failures are understandable and pinned to payload invariants

---

## TICKET-C Query Resolver For Run ID Plus Not Found

### Objective
Implement the first deterministic query resolver using run_id as the primary lookup input, including not_found behaviour.

### Inputs
- run_id
- projection builder output or projection access seam

### Outputs
- deterministic success for valid run_id
- explicit not_found failure for missing run_id

### Must Prove
- same run_id and same truth resolve the same target every time
- missing run_id does not fall through to accidental matches

### Must Not Do
- accept ambiguous multi-key resolution yet unless required by guard rails
- change payload semantics

### Done When
- query resolver exists for run_id path
- success and not_found cases are automated

---

## TICKET-D Read Endpoint Adapter For GET By Run ID

### Objective
Implement the first external read endpoint adapter for GET single summary by run_id.

### Inputs
- HTTP GET request with run_id
- query resolver result

### Outputs
- 200 plus payload body on success
- 400 or 404 or 503 style error mapping when appropriate

### Must Prove
- request validation is explicit
- endpoint returns one payload object only
- transport mapping matches the frozen endpoint contract

### Must Not Do
- add UI-specific wrapper semantics
- weaken degraded-state honesty

### Done When
- endpoint adapter exists
- request validation and success response are automated

---

## TICKET-E Endpoint Mapping And Vertical E2E Proof

### Objective
Prove the first vertical slice end to end for GET single summary by run_id.

### Required Proof Cases
- valid run_id returns 200 and contract-valid payload
- invalid request shape returns 400 and stable error body
- missing run_id returns 404 and stable error body
- degraded projection unavailability maps to 503
- repeated identical reads return the same result without mutation

### Done When
- endpoint proof is automated
- vertical slice is deterministic
- repeated reads are idempotent

---

## Mandatory Invariants Across Entire Ticket Set

All tickets must preserve these invariants:

- payload contract remains stable
- currentness remains explicit
- no silent ambiguity
- no silent not_found fallthrough
- no endpoint-driven semantic drift
- same truth plus same input equals same result

---

## Ticket Granularity Rules

Each ticket should:

- own one seam or one proof layer
- have one named objective
- have explicit inputs and outputs
- have explicit done criteria
- point to the invariants it proves

Each ticket should not:

- span projection, query, and endpoint implementation all at once
- mix semantic definition with unrelated cleanup
- include broad future expansion work

---

## Recommended First Delivery Sequence

Recommended practical delivery sequence:

1. implement TICKET-A
2. prove TICKET-B
3. implement TICKET-C
4. implement TICKET-D
5. prove TICKET-E

This sequence should produce the first real read surface with honest behaviour.

---

## Failure Conditions

This ticket set has failed if any of the following occur:

- projection builder emits shape drift from payload contract
- query resolver silently selects wrong target
- endpoint returns 200 for invalid or unresolved request
- repeated reads mutate or change result without truth change
- degraded or stale truth is hidden behind a clean-looking success object

---

## Exit Criteria

This document is complete when:

- the first implementation ticket set is frozen
- ticket order is explicit
- each ticket has objective, scope, and done criteria
- the first vertical slice can be built from these tickets without inventing new semantics

---

## Next Likely Downstream Slice

After this, the next most likely slice is:

1. the first runnable implementation scaffold for TICKET-A and TICKET-B
or
2. formal ticket files for each implementation slice if you want them broken out individually