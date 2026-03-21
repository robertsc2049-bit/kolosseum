# v1 Coach Session Decision Summary Implementation And Test Matrix

## Status
Authoritative execution-planning document

## Scope
v1 Lane 1 only

## Purpose
Freeze the first implementation order, proof matrix, and done criteria for the coach session decision summary read surface.

---

## Why This Document Exists

The repo now has the full Lane 1 single-summary contract chain:

- reporting target
- summary contract
- projection contract
- payload contract
- query-path contract
- read endpoint contract

What is still missing is the execution bridge between contract and build.

Without this document, implementation can drift into:

- building the wrong seam first
- proving the wrong thing
- passing isolated tests while missing the actual vertical contract
- mixing projection, query, and endpoint concerns
- shipping a surface that is not fully auditable

---

## Primary Goal

Define the minimum implementation slices and proof obligations required to ship the first coach session decision summary read surface without semantic drift.

---

## Non-Goals

This document does not:

- redefine any upstream contract
- define UI work
- define list or bulk surfaces
- define write or mutation flows
- approve broader reporting expansion before the first single-summary vertical slice is proven

---

## Upstream Contract Inputs

This execution matrix depends on:

- docs/V1_LANE1_REPORTING_READ_MODEL_TARGET.md
- docs/contracts/v1_coach_session_decision_summary_contract.md
- docs/contracts/v1_coach_session_decision_summary_projection_contract.md
- docs/contracts/v1_coach_session_decision_summary_payload_contract.md
- docs/contracts/v1_coach_session_decision_summary_query_path_contract.md
- docs/contracts/v1_coach_session_decision_summary_read_endpoint_contract.md

Implementation must conform to those documents and must not weaken them.

---

## First Shippable Vertical Slice

The first shippable vertical slice is:

one deterministic read path that returns one coach session decision summary for one valid lookup input

Initial preferred happy path:

- GET single summary by run_id

This is first because it has the highest specificity and the lowest ambiguity risk.

---

## Required Implementation Seams

The first implementation must be split into these seams:

### Seam 1 - Projection builder
- turns authoritative persisted truth into the frozen summary payload shape
- must preserve currentness and degraded-state honesty

### Seam 2 - Query resolver
- resolves a valid lookup input to one deterministic target
- must enforce ambiguity and not-found semantics

### Seam 3 - Read endpoint adapter
- validates request shape
- delegates to query resolver
- maps result and failure classes into endpoint responses

### Seam 4 - Proof harness
- proves the vertical contract end to end
- proves same input plus same truth equals same output

---

## Implementation Order

Build order is fixed for the first slice:

1. projection builder seam
2. payload conformance proof
3. query resolver seam
4. query determinism and ambiguity proof
5. read endpoint adapter
6. endpoint transport mapping proof
7. single vertical e2e proof

Do not start with endpoint polish before the lower seams are proven.

---

## Mandatory Invariants To Prove

The first shipped surface must prove all of the following:

### I1 - Payload conformance
Returned summary matches the frozen payload contract shape.

### I2 - Query determinism
Same authoritative truth plus same lookup input returns same target and same result.

### I3 - No silent ambiguity
Ambiguous lookup cannot fall through to arbitrary winner selection.

### I4 - Honest degraded state
Stale, incomplete, or unavailable states stay explicit.

### I5 - Currentness honesty
Superseded truth is never mislabeled current.

### I6 - Endpoint mapping correctness
Query failure classes map to the frozen endpoint status and error shapes.

### I7 - Read-only idempotence
Repeated reads do not mutate state or alter lineage semantics.

---

## Minimum Test Matrix

The first matrix should include at least these cases:

| ID | Area | Scenario | Expected |
|---|---|---|---|
| T1 | projection | valid persisted truth projects to payload | payload contract satisfied |
| T2 | projection | stale projection state | payload marks stale explicitly |
| T3 | projection | incomplete source truth | incomplete or unavailable exposed explicitly |
| T4 | query | valid run_id resolves one target | deterministic success |
| T5 | query | missing run_id target | not_found failure class |
| T6 | query | ambiguous session_id plus athlete_id | ambiguous_target failure class |
| T7 | query | superseded target lookup | superseded remains explicit |
| T8 | endpoint | valid run_id request | 200 plus contract-valid payload |
| T9 | endpoint | invalid input shape | 400 plus stable error body |
| T10 | endpoint | not_found mapping | 404 plus stable error body |
| T11 | endpoint | ambiguous mapping | 409 plus stable error body |
| T12 | endpoint | projection unavailable mapping | 503 plus stable error body |
| T13 | e2e | same request replayed twice | same result, no mutation |

---

## Recommended Initial Slice Plan

The first implementation tickets should be cut in this order:

### Slice A
implement projection builder for run_id happy path only

### Slice B
prove payload conformance and degraded-state visibility at projection seam

### Slice C
implement query resolution for run_id happy path and not_found path

### Slice D
implement endpoint adapter for GET single summary by run_id

### Slice E
prove endpoint mapping and end-to-end deterministic replay

### Slice F
expand to ambiguity and lineage-sensitive cases only after A through E are green

---

## Required Evidence For First Done Claim

The first surface is not done until all of the following exist:

- implementation at projection seam
- implementation at query seam
- implementation at endpoint seam
- automated proof for payload conformance
- automated proof for not_found and invalid_input mapping
- automated proof for degraded-state honesty
- automated e2e proof for deterministic repeated reads

---

## Failure Conditions

The first implementation attempt is considered not done if any of the following are true:

- payload fields drift from the frozen payload contract
- endpoint returns 200 for ambiguous lookup
- stale or incomplete truth is hidden behind a clean-looking payload
- repeated identical lookups produce inconsistent results
- endpoint-specific convenience logic changes currentness semantics

---

## Ownership Boundary

The first vertical slice should preserve these boundaries:

- projection seam owns payload assembly
- query seam owns deterministic target resolution
- endpoint seam owns request validation and transport mapping
- tests own proof of invariants, not invention of new semantics

No seam should steal semantic responsibility from another.

---

## Recommended First Acceptance Gate

The first acceptance gate for implementation should be:

one green proof set showing that GET single summary by run_id returns a contract-valid payload and preserves degraded-state honesty

That is the first real win condition.

---

## Exit Criteria

This slice is complete when:

- build order is frozen
- required seams are explicit
- mandatory invariants are explicit
- minimum test matrix is frozen
- first implementation tickets can be cut without semantic ambiguity

---

## Next Likely Downstream Slice

After this, the next most likely slice is:

1. the first implementation ticket set for projection, query, endpoint, and proof harness
or
2. the first runnable implementation and test scaffold if ticket slicing is skipped intentionally