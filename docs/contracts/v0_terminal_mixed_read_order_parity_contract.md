# v0 Terminal Mixed Read-Order Parity Contract

## Status

Planned  
Type: executable-slice contract  
Scope: v0 runtime only

---

## Purpose

This contract defines the next required runtime proof slice after restart parity.

It exists to prove that terminal session projections remain stable when read surfaces are interleaved, not just repeated on the same endpoint.

This closes the current highest-value remaining v0 runtime seam.

---

## Why This Slice Exists

Current proof already establishes:

- runnable HTTP spine
- lawful completed terminal path
- lawful partial terminal path
- post-terminal immutability
- repeated `/state` parity
- repeated `/events` parity
- restart read parity

What is not yet proved strongly enough:

- mixed read ordering after terminalization

That gap matters because stable projections must not depend on the order in which the app reads runtime surfaces.

---

## Runtime Boundary

This contract is limited to v0 runtime Phase 6 execution surfaces only.

In scope:

- terminal `completed`
- terminal `partial`
- `GET /sessions/:session_id/state`
- `GET /sessions/:session_id/events`
- in-process mixed read ordering
- stable projection across alternating read sequences

Out of scope:

- Phase 7 reporting
- Phase 8 evidence
- export / seal
- broader org runtime
- non-terminal sessions
- heuristic interpretation of event meaning

---

## Inputs

The slice must create lawful terminal sessions through the existing HTTP spine.

Required terminal outcome setup paths:

### A. Completed terminal setup

- compile block
- create session
- start session
- progress lawfully to terminal `completed`

### B. Partial terminal setup

- compile block
- create session
- start session
- split session
- explicit return gate
- return skip
- progress lawfully to terminal `partial`

---

## Read Sequences That Must Be Proved

For each terminal outcome (`completed`, `partial`), prove all of the following:

### Sequence 1

- `/state`
- `/events`
- `/state`

### Sequence 2

- `/events`
- `/state`
- `/events`

### Sequence 3

- `/state`
- `/events`
- `/state`
- `/events`

### Sequence 4

- `/events`
- `/state`
- `/events`
- `/state`

The executable slice may prove more than these, but not fewer.

---

## Contract Invariants

## Invariant MRO-1 — terminal outcome stability

Terminal outcome MUST remain stable across all mixed read sequences.

Allowed terminal outcomes for this slice:

- `completed`
- `partial`

No drift is permitted.

---

## Invariant MRO-2 — state projection parity

For a given terminal session, every `/state` response read during the mixed sequence MUST be byte-stable against every other `/state` response in that same sequence.

This is a terminal parity contract, not an eventually-consistent contract.

---

## Invariant MRO-3 — events projection parity

For a given terminal session, every `/events` response read during the mixed sequence MUST be byte-stable against every other `/events` response in that same sequence.

No appended noise, reordering drift, or shape drift is permitted.

---

## Invariant MRO-4 — no cross-surface contamination

Reading `/events` MUST NOT alter subsequent `/state` projection.

Reading `/state` MUST NOT alter subsequent `/events` projection.

Read order is observational only.

---

## Invariant MRO-5 — completed terminal semantics preserved

For terminal `completed` sessions:

- no dropped-work semantics may appear
- no return gate may appear
- no partial-only projection fields may appear if they are not part of the completed contract

---

## Invariant MRO-6 — partial terminal semantics preserved

For terminal `partial` sessions:

- dropped-work semantics MUST remain visible
- return gate MUST remain cleared
- no resurrection or reopened execution state may appear

---

## Invariant MRO-7 — post-terminal read neutrality

Mixed reads are neutral observations.

They MUST NOT:

- mutate session state
- append new runtime events
- reopen a terminal session
- advance execution

---

## Invariant MRO-8 — no branch asymmetry by read order

The same terminal session MUST project the same truth regardless of whether the app reads:

- state-first
- events-first
- alternating state/events/state
- alternating events/state/events

---

## Linked Existing Runtime Proof Anchors

This slice extends the proof boundary already established by:

- `test/v0_e2e_runnable_spine_compile_start_split_return_terminal_readback.test.mjs`
- `test/v0_partial_terminal_state_events_read_parity.test.mjs`
- `test/v0_completed_terminal_state_events_read_parity.test.mjs`
- `test/v0_terminal_contract_matrix.test.mjs`
- `test/v0_terminal_restart_read_parity.test.mjs`

This slice must not weaken or reinterpret those existing contracts.

---

## Proposed Executable Slice Name

Primary proposed test file:

- `test/v0_terminal_mixed_read_order_parity.test.mjs`

If the harness style requires grouped naming, an acceptable alternative is:

- `test/v0_terminal_mixed_read_projection_parity.test.mjs`

Do not split this into multiple tiny slices unless the harness forces it.

---

## Required Assertions

Minimum required assertions for each terminal outcome:

### Completed path

- completed terminal reached lawfully
- mixed read order preserves state parity
- mixed read order preserves events parity
- no dropped-work semantics appear
- no return gate appears

### Partial path

- partial terminal reached lawfully
- mixed read order preserves state parity
- mixed read order preserves events parity
- dropped-work semantics remain visible
- return gate remains cleared

---

## Failure Conditions

This slice fails if any of the following occur:

- terminal outcome changes across mixed reads
- `/state` response drifts after `/events`
- `/events` response drifts after `/state`
- completed projection gains partial-only semantics
- partial projection loses dropped-work semantics
- return gate reappears after terminalization
- any read mutates terminal state
- any read causes event count or event payload drift without a lawful write

---

## Acceptance Criteria

This slice is complete only when:

1. one executable grouped proof covers both completed and partial terminal sessions
2. mixed read sequences are asserted explicitly
3. state and events parity are both asserted
4. semantics specific to completed vs partial remain intact
5. the slice passes on CI
6. `docs/v0_RUNTIME_PROOF_MATRIX.md` can be updated to move mixed read-order parity from open seam to covered seam

---

## Follow-On Slice After This One

Once this contract is proved in code, next priority becomes:

- return-continue terminal completion contract

Then:

- restart + mixed-read grouped matrix

---

## Rule

Do not claim mixed read-order parity in v0 status summaries until this contract is backed by an executable test on main.