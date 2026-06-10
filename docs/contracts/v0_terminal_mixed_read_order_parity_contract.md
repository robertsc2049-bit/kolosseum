# v0 Terminal Mixed Read-Order Parity Contract

## Status

Satisfied on main  
Type: executable-slice contract  
Scope: v0 runtime only

Primary executable proof on main:

- `test/v0_terminal_mixed_read_order_parity.test.mjs`

Related grouped restart proof on main:

- `test/v0_terminal_restart_mixed_read_matrix.test.mjs`

---

## Purpose

This contract defined the required runtime proof slice after restart parity.

It exists to prove that terminal session projections remain stable when read surfaces are interleaved, not just repeated on the same endpoint.

This seam is now materially closed on main.

---

## Why This Slice Exists

Current proof now establishes:

- runnable HTTP spine
- lawful completed terminal path
- lawful partial terminal path
- post-terminal immutability
- repeated `/state` parity
- repeated `/events` parity
- restart read parity
- mixed read-order parity
- grouped restart + mixed-read matrix

That means stable terminal projections are now proved not to depend on read order inside the current v0 runtime boundary.

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

The executable proof creates lawful terminal sessions through the existing HTTP spine.

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

## Read Sequences Proved

For each terminal outcome (`completed`, `partial`), executable proof covers:

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

The grouped restart matrix extends this proof after fresh process boot.

---

## Contract Invariants

## Invariant MRO-1 — terminal outcome stability

Terminal outcome remains stable across mixed read sequences.

Allowed terminal outcomes for this slice:

- `completed`
- `partial`

---

## Invariant MRO-2 — state projection parity

For a given terminal session, every `/state` response read during the mixed sequence is byte-stable against every other `/state` response in that same sequence.

---

## Invariant MRO-3 — events projection parity

For a given terminal session, every `/events` response read during the mixed sequence is byte-stable against every other `/events` response in that same sequence.

---

## Invariant MRO-4 — no cross-surface contamination

Reading `/events` does not alter subsequent `/state` projection.

Reading `/state` does not alter subsequent `/events` projection.

Read order is observational only.

---

## Invariant MRO-5 — completed terminal semantics preserved

For terminal `completed` sessions:

- no dropped-work semantics appear
- no return gate appears
- no partial-only projection fields appear outside the completed contract

---

## Invariant MRO-6 — partial terminal semantics preserved

For terminal `partial` sessions:

- dropped-work semantics remain visible
- return gate remains cleared
- no resurrection or reopened execution state appears

---

## Invariant MRO-7 — post-terminal read neutrality

Mixed reads are neutral observations.

They do not:

- mutate session state
- append new runtime events
- reopen a terminal session
- advance execution

---

## Invariant MRO-8 — no branch asymmetry by read order

The same terminal session projects the same truth regardless of whether the app reads:

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

The mixed-read seam is now materially backed by:

- `test/v0_terminal_mixed_read_order_parity.test.mjs`
- `test/v0_terminal_restart_mixed_read_matrix.test.mjs`

---

## Proposed Executable Slice Name

Primary test file:

- `test/v0_terminal_mixed_read_order_parity.test.mjs`

Grouped restart extension:

- `test/v0_terminal_restart_mixed_read_matrix.test.mjs`

---

## Required Assertions

Minimum assertions are now satisfied on main for each terminal outcome.

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

## Acceptance Criteria

This slice is satisfied because:

1. one executable grouped proof covers both completed and partial terminal sessions
2. mixed read sequences are asserted explicitly
3. state and events parity are both asserted
4. semantics specific to completed vs partial remain intact
5. the slice passes on CI
6. grouped restart + mixed-read proof now also exists on main

---

## Follow-On Slice After This One

This seam is no longer the primary next runtime target.

Higher-value next work now tends to be:

- exact rejection token/body/status pinning, if needed
- v0 readiness and release-boundary clarity
- non-runtime blockers to calling v0 done

---

## Rule

Mixed read-order parity can now be claimed in v0 runtime status summaries because it is backed by executable proof on main.