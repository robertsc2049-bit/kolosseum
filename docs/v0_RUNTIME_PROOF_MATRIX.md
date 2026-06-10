# V0 Runtime Proof Matrix

## Purpose

This document is the working proof index for the current v0 runtime spine.

It exists to answer five questions in one place:

1. What does v0 runtime currently prove on main?
2. Which invariants are covered by executable tests?
3. Which runtime surfaces are already defended?
4. Which seams are still exposed?
5. What should be built next?

This is a proof-index document, not product copy and not release-law.

---

## Current v0 Runtime Boundary

Current active runtime proof work is inside the v0 Phase 1–6 boundary only.

This matrix tracks proof of:

- compile
- session creation
- session start
- runtime events
- split / return
- terminal completed state
- terminal partial state
- state readback
- events readback
- repeated-read parity
- mixed read-order parity
- post-terminal rejection behavior
- restart read parity
- return-continue downstream completion contract
- restart + mixed-read grouped matrix

This matrix does **not** claim proof for:

- Phase 7 reporting
- Phase 8 evidence
- export/sealing
- broader org runtime
- post-v0 proof layers

---

## Runtime Proof Coverage on Main

### A. Runnable spine

**Covered**

- compile -> create session
- start session
- complete path to terminal completed
- split path to explicit return gate
- return skip path to terminal partial
- terminal readback from `/state`
- terminal readback from `/events`

**Primary executable slice**

- `test/v0_e2e_runnable_spine_compile_start_split_return_terminal_readback.test.mjs`

**What this proves**

- the live HTTP spine is runnable end to end
- both completed and partial lawful terminal paths exist
- split / return gate is surfaced explicitly
- readback works after terminalization

---

### B. Completed terminal immutability

**Covered**

- completed terminal state cannot be mutated
- post-terminal mutation attempt is rejected
- completed state remains unchanged after rejection

**Primary executable slice**

- `test/v0_terminal_no_resurrection_after_terminal.test.mjs`

**What this proves**

- completed terminal is a hard boundary
- no resurrection after completion

---

### C. Partial terminal immutability

**Covered**

- return skip leads to lawful terminal partial
- dropped work is preserved
- post-terminal mutation attempt is rejected
- partial state remains unchanged after rejection

**Primary executable slice**

- `test/v0_partial_terminal_no_resurrection_after_return_skip.test.mjs`

**What this proves**

- partial terminal is also a hard boundary
- no resurrection after return skip

---

### D. Partial terminal repeated-read parity

**Covered**

- repeated `/state` reads after partial terminal are stable
- repeated `/events` reads after partial terminal are stable
- dropped work remains visible
- return gate remains cleared

**Primary executable slice**

- `test/v0_partial_terminal_state_events_read_parity.test.mjs`

**What this proves**

- partial terminal read surfaces are parity-stable
- repeated reads do not drift within the same running process

---

### E. Completed terminal repeated-read parity

**Covered**

- repeated `/state` reads after completed terminal are stable
- repeated `/events` reads after completed terminal are stable
- no dropped work appears
- no return gate appears

**Primary executable slice**

- `test/v0_completed_terminal_state_events_read_parity.test.mjs`

**What this proves**

- completed terminal read surfaces are parity-stable
- repeated reads do not drift within the same running process

---

### F. Post-terminal rejection-shape parity

**Covered**

- completed terminal repeated illegal events reject consistently
- partial terminal repeated illegal events reject consistently
- rejection shape stays stable on repeated illegal post-terminal events

**Primary executable slice**

- `test/v0_post_terminal_rejection_error_shape_parity.test.mjs`

**What this proves**

- rejection is not only present
- rejection contract shape is stable and repeatable

---

### G. Grouped terminal contract matrix

**Covered**

- completed terminal contract in one grouped slice
- partial terminal contract in one grouped slice
- repeated-read parity in grouped form
- rejection behavior in grouped form

**Primary executable slice**

- `test/v0_terminal_contract_matrix.test.mjs`

**What this proves**

- the terminal contract can be asserted as one matrix instead of only isolated proofs

---

### H. Fresh-process restart parity

**Covered**

- completed terminal `/state` survives fresh process restart without drift
- completed terminal `/events` survives fresh process restart without drift
- partial terminal `/state` survives fresh process restart without drift
- partial terminal `/events` survives fresh process restart without drift
- dropped-work semantics survive restart
- return-gate semantics stay cleared after restart

**Primary executable slice**

- `test/v0_terminal_restart_read_parity.test.mjs`

**What this proves**

- terminal projections survive a fresh harness boot without drift
- persistence-backed terminal read surfaces remain stable across restart

---

### I. Mixed read-order parity after terminalization

**Covered**

- `/state -> /events -> /state` stays stable for completed terminal sessions
- `/events -> /state -> /events` stays stable for completed terminal sessions
- `/state -> /events -> /state` stays stable for partial terminal sessions
- `/events -> /state -> /events` stays stable for partial terminal sessions
- longer alternating read sequences stay stable
- read order does not alter terminal state or event projections

**Primary executable slice**

- `test/v0_terminal_mixed_read_order_parity.test.mjs`

**What this proves**

- terminal projections do not depend on read order
- state and events surfaces are observational only after terminalization
- completed and partial terminals remain stable under alternating reads

---

### J. Return-continue terminal downstream contract

**Covered**

- split emits explicit return decision contract
- `RETURN_CONTINUE` clears the return decision gate
- continue path remains live before terminal completion
- continue path does not drop work
- continue path reaches lawful completed terminal state
- downstream repeated `/state` parity holds after continue path
- downstream repeated `/events` parity holds after continue path

**Primary executable slice**

- `test/v0_return_continue_terminal_contract.test.mjs`

**What this proves**

- the continue branch is now defended, not just the skip branch
- split -> return_continue -> lawful completion is stable and contract-safe
- the major branch asymmetry inside current v0 runtime is closed

---

### K. Restart + mixed-read grouped matrix

**Covered**

- completed terminal state survives fresh process restart and mixed read order
- completed terminal events survive fresh process restart and mixed read order
- partial terminal state survives fresh process restart and mixed read order
- partial terminal events survive fresh process restart and mixed read order
- completed terminal semantics remain clean after restart and alternating reads
- partial dropped-work semantics remain intact after restart and alternating reads
- cleared return-gate semantics remain intact after restart and alternating reads

**Primary executable slice**

- `test/v0_terminal_restart_mixed_read_matrix.test.mjs`

**What this proves**

- grouped restart + mixed-read proof now exists on main
- the strongest remaining terminal runtime summary seam inside the current v0 boundary is closed
- current runtime terminal projections are strongly defended across lawful paths and read patterns

---

## Runtime Surfaces Covered

### Covered endpoint surfaces

- `POST /blocks/compile`
- `POST /sessions/:session_id/start`
- `POST /sessions/:session_id/events`
- `GET /sessions/:session_id/state`
- `GET /sessions/:session_id/events`

### Covered event types

- `COMPLETE_EXERCISE`
- `SPLIT_SESSION`
- `RETURN_SKIP`
- `RETURN_CONTINUE`

### Covered terminal outcomes

- `completed`
- `partial`

### Covered terminal assertions

- immutability
- no resurrection
- repeated state parity
- repeated events parity
- mixed read-order parity
- stable rejection shape
- grouped contract matrix
- restart parity
- continue-path downstream completion contract
- restart + mixed-read grouped matrix

---

## Runtime Surfaces Still Not Fully Locked

These are the remaining runtime proof opportunities, but they are no longer the primary v0 bottleneck.

### 1. Exact rejection token / body contract pinning

Current proof checks stable error shape.
Still useful to pin:

- exact fields
- exact status
- exact failure token contract
- exact absence of drift in response body if that contract is intended to be locked

### 2. Higher-density grouped summary matrix

A broader grouped summary slice could still combine more proved seams into one matrix-style artifact for audit convenience, but this is now secondary because the underlying branches and read patterns are already defended.

### 3. Wider-than-v0 runtime surfaces

Potential future proof work beyond current v0 boundary may include:

- Phase 7 reporting surfaces
- Phase 8 evidence surfaces
- export / seal runtime projections
- broader org runtime

These are outside current v0 runtime proof scope.

---

## Runtime Risks Still Open

### Open Risk A — exact rejection body pinning not yet locked

Rejection exists and its shape is stable, but exact body/token pinning is not yet the top-level locked contract.

### Open Risk B — wider release readiness may now dominate

Core terminal runtime proof is strong.
The bigger remaining risks for calling v0 done may now sit outside terminal runtime proof and inside release boundary, readiness, reporting, evidence, and ship-law clarity.

---

## Recommended Next 5 Slices

Ordered by value **after** current runtime seam closure.

### 1. Update v0 readiness and ship-boundary docs

**Target**

Reflect that major current-boundary runtime proof seams are now closed on main.

**Why first**

This improves decision quality immediately and prevents outdated status reporting.

---

### 2. Exact post-terminal rejection contract pin

**Target**

Pin exact rejection token/body/status if that response contract is intended to remain fixed.

**Why second**

This is now the cleanest remaining runtime-detail hardening slice.

---

### 3. Reassess true non-runtime v0 blockers

**Target**

Move focus from terminal runtime proof to remaining v0 ship blockers outside the now-strong runtime spine.

**Why third**

This prevents local optimisation in an area that is already well defended.

---

### 4. Optional grouped audit summary artifact

**Target**

Create a compact grouped summary of the now-proved runtime spine for audit / release-law convenience.

**Why fourth**

This is useful, but lower value than readiness clarity.

---

### 5. Post-v0 / wider-boundary planning

**Target**

Only after v0 readiness is re-evaluated, decide whether Phase 7/8 or export/evidence surfaces should become the next formal proof frontier.

**Why fifth**

Do not widen scope before cashing in the proof already earned.

---

## Immediate Working Conclusion

Current v0 runtime proof is now strong on:

- live HTTP runnable spine
- completed terminal hard boundary
- partial terminal hard boundary
- repeated read parity in-process
- mixed read-order parity
- stable post-terminal rejection
- grouped terminal contract summary
- fresh-process restart parity
- return-continue downstream contract
- restart + mixed-read grouped matrix

Current runtime conclusion:

- the major terminal-runtime proof seams inside the current v0 Phase 1–6 boundary are materially closed on main

Current likely next v0 bottleneck:

- not terminal runtime proof density
- but overall v0 readiness, release boundary clarity, and any non-runtime ship blockers

---

## Rule for Future Runtime Proof Work

Do not keep adding narrow terminal-runtime slices by default.

Before adding more runtime-proof density, first ask:

- does this close a real remaining contract hole?
- or is v0 now more constrained by release/readiness/document-law gaps?

This prevents local optimisation and proof duplication.

---

## Files Currently Acting As Runtime Proof Anchors

- `test/v0_e2e_runnable_spine_compile_start_split_return_terminal_readback.test.mjs`
- `test/v0_terminal_no_resurrection_after_terminal.test.mjs`
- `test/v0_partial_terminal_no_resurrection_after_return_skip.test.mjs`
- `test/v0_partial_terminal_state_events_read_parity.test.mjs`
- `test/v0_completed_terminal_state_events_read_parity.test.mjs`
- `test/v0_post_terminal_rejection_error_shape_parity.test.mjs`
- `test/v0_terminal_contract_matrix.test.mjs`
- `test/v0_terminal_restart_read_parity.test.mjs`
- `test/v0_terminal_mixed_read_order_parity.test.mjs`
- `test/v0_return_continue_terminal_contract.test.mjs`
- `test/v0_terminal_restart_mixed_read_matrix.test.mjs`

---

## Planned / Historical Contract Anchors

- `docs/contracts/v0_terminal_mixed_read_order_parity_contract.md`

This contract is now materially backed by executable proof on main and remains useful as a design anchor.

---

## Status

This document is a working engineering proof index for v0 runtime.

Update it whenever:
- a runtime proof slice lands on main
- a proof seam is closed
- a next-slice priority changes
- the true v0 bottleneck shifts away from runtime proof and toward release readiness