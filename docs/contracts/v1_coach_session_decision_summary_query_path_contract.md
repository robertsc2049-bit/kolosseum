# v1 Coach Session Decision Summary Query-Path Contract

## Status
Authoritative contract document

## Scope
v1 Lane 1 only

## Purpose
Freeze the query-path contract that resolves the coach session decision summary payload from authoritative persisted truth and its projection layer.

---

## Why This Document Exists

The repo now has:

- the Lane 1 reporting target
- the coach session decision summary contract
- the projection contract
- the payload contract

What is still missing is the read/query boundary that answers:

- what identifiers a caller may use
- how current vs superseded truth is resolved
- what happens when truth is stale or incomplete
- what not-found means
- what the query layer is allowed to return

Without this document, implementation can drift on lookup rules and silently return the wrong summary.

---

## Contract Goal

Define one deterministic query-path contract so that any later endpoint, service, or UI reads the same summary for the same authoritative truth.

---

## Non-Goals

This document does not:

- define transport routing or HTTP shape
- define final endpoint URL design
- define UI rendering
- define bulk list/search surfaces
- define caching infrastructure
- create new runtime truth

---

## Query Responsibility

The query path is responsible for:

1. accepting a valid lookup input
2. resolving the correct session/run/lineage target
3. returning the current authoritative summary payload when available
4. exposing degraded or unavailable states honestly
5. refusing to invent or infer hidden truth

The query path is not responsible for:

- fabricating presentation copy beyond the payload contract
- deciding new runtime semantics
- mutating source truth
- silently picking a random matching lineage

---

## Allowed Query Inputs

A caller may resolve the summary by one of the following authoritative input sets:

### Input Set A
- `run_id`

### Input Set B
- `session_id`
- `athlete_id`

### Input Set C
- `lineage_id`
- optional `prefer_current=true|false`

---

## Input Rules

- `run_id` is the highest-specificity lookup key
- `session_id` plus `athlete_id` is allowed only if it resolves unambiguously
- `lineage_id` may be used only when lineage semantics are explicit
- if an input resolves to multiple candidates without a contractually valid tie-break, the query must fail explicitly
- callers may not rely on accidental storage order

---

## Resolution Priority

When multiple identifiers are supplied, resolution priority is:

1. `run_id`
2. `lineage_id`
3. `session_id` plus `athlete_id`

Lower-priority identifiers must not override a valid higher-priority identifier.

---

## Resolution Stages

The query path must follow these stages in order:

1. validate input shape
2. resolve authoritative target identity
3. resolve lineage/currentness status
4. load summary projection/payload
5. apply degraded-state checks
6. return one deterministic result or one explicit failure state

---

## Currentness Resolution Rules

The query path must distinguish between:

- current
- superseded
- terminal
- incomplete
- unavailable

### Rules

- if a `run_id` points to superseded truth, the payload may still be returned, but its `currentness.status` must remain `superseded`
- if lookup is by `lineage_id` and current truth exists, the current summary must be preferred by default
- if lookup is by `session_id` plus `athlete_id`, the query path must return the current authoritative summary only if exactly one valid current target exists
- superseded truth must never be silently returned as current
- terminal truth must not be hidden if it is the real resolved state

---

## Lineage Rules

If lineage exists for the target summary:

- lineage membership must be resolved from persisted authoritative truth
- current lineage head must be deterministically identified
- superseded members must remain auditable
- no-resurrection rules from the upstream contracts still apply

If lineage cannot be resolved safely, the query must fail explicitly rather than guess.

---

## Stale and Degraded-State Rules

The query path must preserve degraded-state honesty.

### If the projection is stale
- return the payload only if the stale state is explicitly represented in `currentness` and/or `issues`

### If projection rebuild is in progress
- return only if the payload contract allows a rebuilding state to be represented honestly
- otherwise return explicit unavailable/incomplete result

### If required truth is missing
- do not fabricate a partial clean-looking summary
- return explicit unavailable/incomplete result

---

## Not-Found Semantics

`not_found` means one of the following and must be distinguishable internally:

1. no authoritative target matched the provided key
2. the target identity existed but no contract-valid summary projection exists yet
3. the caller provided an invalid identifier combination

External transport mapping may collapse some of these later, but query-layer semantics must keep them distinct.

---

## Ambiguity Semantics

If a query input resolves to more than one candidate and the contract provides no valid deterministic winner:

- the query must return an explicit ambiguity failure
- it must not pick the newest, oldest, or first row implicitly
- it must not rely on database default order

---

## Returned Object

A successful query must return exactly one object conforming to:

- `docs/contracts/v1_coach_session_decision_summary_payload_contract.md`

The query path must not return:
- multiple payloads
- partial ad hoc objects
- projection internals that are not part of the payload contract

---

## Failure Classes

The query path must expose one of these internal failure classes when successful payload return is not possible:

- `invalid_input`
- `not_found`
- `ambiguous_target`
- `projection_unavailable`
- `projection_incomplete`
- `source_truth_inconsistent`

These names may later be mapped into endpoint-specific responses, but their semantics should remain stable.

---

## Determinism Rules

For the same authoritative persisted truth and same input:

- the same target must be resolved
- the same payload must be returned
- the same failure class must be returned if resolution fails

No harmless read-timing variation should produce a different resolved target.

---

## Auditability Rules

A successful query result must remain traceable back to:

- the lookup input used
- the resolved target identity
- the lineage/currentness decision made
- the payload returned

The query path must therefore be explainable in logs/debug traces even if the external caller only sees the final payload.

---

## Query Boundary

The query path sits between:

- persisted runtime/projection truth
and
- later endpoint or application delivery

This means:

- upstream truth contracts constrain what may be returned
- downstream transports must not reinterpret currentness semantics

---

## Test Implications

Implementation of this contract should be backed by tests that prove:

1. `run_id` lookup resolves one deterministic summary
2. `session_id` plus `athlete_id` fails if ambiguous
3. `lineage_id` resolves current truth deterministically
4. superseded truth is never mislabeled current
5. stale/incomplete/unavailable states remain explicit
6. invalid inputs do not fall through to accidental matches
7. repeated identical lookups return identical results

---

## Exit Criteria

This slice is complete when:

- allowed lookup inputs are frozen
- resolution priority is explicit
- current/superseded/lineage rules are explicit
- not-found/ambiguity/degraded-state semantics are explicit
- downstream endpoint work can proceed without inventing query behaviour

---

## Next Likely Downstream Slice

After this, the next most likely slice is:

1. the first coach session decision summary read endpoint contract

Do not jump into UI-level design before the endpoint contract is frozen.