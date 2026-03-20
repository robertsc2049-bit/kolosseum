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
- post-terminal rejection behavior
- restart read parity

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

### Covered terminal outcomes

- `completed`
- `partial`

### Covered terminal assertions

- immutability
- no resurrection
- repeated state parity
- repeated events parity
- stable rejection shape
- grouped contract matrix
- restart parity

---

## Runtime Surfaces Not Yet Proved Enough

These are the main uncovered seams.

### 1. Mixed read ordering contract

Need stronger grouped proof for:

- `/state -> /events -> /state`
- `/events -> /state -> /events`
- alternating reads after terminalization
- stable projection across mixed read order, not only repeated same-endpoint reads

This is now the highest-value remaining seam.

**Formal slice contract**

- `docs/contracts/v0_terminal_mixed_read_order_parity_contract.md`

### 2. RETURN_CONTINUE terminal downstream contract

Current proof heavily covers return skip.
Return continue still needs broader grouped proof around:

- terminal completed via continue path
- downstream state parity after continue path
- no drift vs expected completion contract

### 3. Restart + mixed read order combined

Need proof that:

- after fresh boot
- with mixed read order
- both completed and partial terminal sessions stay byte-stable at the projection level

### 4. Exact error token / body contract pinning

Current proof checks stable error shape.
Still useful to pin:

- exact fields
- exact status
- exact failure token contract
- exact absence of drift in response body if that contract is intended to be locked

### 5. Continue-path grouped matrix

Need one grouped contract slice for continue-path terminal completion so it reaches parity with return-skip proof density.

---

## Runtime Risks Still Open

### Open Risk A — read-order bias

Current parity is strong for repeated reads and restart reads, but alternating read order is not yet proved enough.

### Open Risk B — continue-path undercoverage

Return skip is well proved.
Return continue still needs broader terminal proof density.

### Open Risk C — grouped proof beyond same-surface repetitions

The grouped matrix exists for terminal contracts, but mixed-read and continue-path grouped proofs do not yet exist.

---

## Recommended Next 5 Slices

Ordered by value.

### 1. Mixed read-order parity after terminalization

**Target**

Prove alternating `/state` and `/events` read order does not drift for completed and partial terminals.

**Why first**

This is now the biggest remaining runtime proof seam.

**Formal contract**

- `docs/contracts/v0_terminal_mixed_read_order_parity_contract.md`

---

### 2. Return-continue terminal completion contract

**Target**

Prove split -> return continue -> lawful completion path preserves completed terminal contract.

**Why second**

Return skip is already strong. Continue needs matching depth.

---

### 3. Restart + mixed-read grouped matrix

**Target**

One grouped slice asserting restart parity plus alternating read-order parity for both completed and partial terminal outcomes.

**Why third**

This becomes a stronger runtime summary proof.

---

### 4. Exact post-terminal rejection contract pin

**Target**

Pin exact rejection token/body/status if the response contract is intended to remain fixed.

**Why fourth**

Now worth doing because restart parity is closed.

---

### 5. Continue-path grouped matrix

**Target**

One grouped slice asserting continue-path completion, repeated-read parity, and post-terminal rejection in the same matrix style used for completed/partial skip contracts.

**Why fifth**

This closes the biggest remaining branch asymmetry.

---

## Immediate Working Conclusion

Current v0 runtime proof is now strong on:

- live HTTP runnable spine
- completed terminal hard boundary
- partial terminal hard boundary
- repeated read parity in-process
- stable post-terminal rejection
- grouped terminal contract summary
- fresh-process restart parity

Current weakest seam is:

- mixed read ordering after terminalization

That should be the next runtime slice.

---

## Rule for Future Runtime Proof Work

Do not add more narrow terminal slices until one of the following is true:

- mixed read-order parity is proved
- return-continue contract reaches parity with return-skip coverage
- restart + mixed-read grouped proof exists

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

---

## Planned Next Proof Contract Anchors

- `docs/contracts/v0_terminal_mixed_read_order_parity_contract.md`

---

## Status

This document is a working engineering proof index for v0 runtime.

Update it whenever:
- a runtime proof slice lands on main
- a proof seam is closed
- a next-slice priority changes