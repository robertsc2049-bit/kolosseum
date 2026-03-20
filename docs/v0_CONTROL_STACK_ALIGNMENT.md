# v0 Control Stack Alignment

## Status

Authoritative alignment pass  
Scope: v0 only  
Purpose: confirm the current v0 control stack does not materially conflict on boundary, status, blockers, or post-v0 scope

---

## Why This Document Exists

The repo now has the key v0 control documents on main:

- `docs/v0_RUNTIME_PROOF_MATRIX.md`
- `docs/v0_READINESS_REBASELINE.md`
- `docs/v0_REMAINING_BLOCKERS.md`
- `docs/v0_AUTHORITATIVE_SHIP_BOUNDARY.md`

That is good, but not enough by itself.

They must also agree.

This document exists to make one explicit statement:

- whether the current control stack is aligned
- where it is aligned
- what still needs care to avoid drift

If another document creates conflict later, this document should be updated or replaced.

---

## Alignment Verdict

### Current verdict

The current v0 control stack is materially aligned on the most important questions.

### What it agrees on

The current control stack agrees that:

- the major terminal-runtime proof seams inside the current v0 boundary are materially closed on main
- terminal runtime proof is no longer the default top blocker
- v0 now depends more on explicit boundary and remaining required-blocker closure
- blocker handling must be explicit and finite
- optional and post-v0 work must not masquerade as required

### What this means

The repo is now in a better state to make a hard v0 decision later.

The project is no longer primarily constrained by lack of runtime proof clarity.
It is now constrained by disciplined blocker management against an explicit boundary.

---

## Documents In This Control Stack

### 1. Runtime proof authority

File:
- `docs/v0_RUNTIME_PROOF_MATRIX.md`

Primary role:
- records what runtime proof is actually backed on main
- records which seams are closed versus still merely possible future hardening

### 2. Readiness interpretation

File:
- `docs/v0_READINESS_REBASELINE.md`

Primary role:
- explains that the true bottleneck has shifted away from terminal-runtime seam chasing
- reframes readiness around real remaining blockers

### 3. Blocker ledger

File:
- `docs/v0_REMAINING_BLOCKERS.md`

Primary role:
- keeps the remaining blocker set finite and bucketed
- separates required, optional, and post-v0 items

### 4. Ship-boundary authority

File:
- `docs/v0_AUTHORITATIVE_SHIP_BOUNDARY.md`

Primary role:
- defines what counts as v0 done
- defines what is required versus optional versus post-v0

---

## Alignment Check By Topic

## Topic A - What v0 runtime currently proves

### Result
Aligned

### Why
The runtime proof matrix states that the major terminal-runtime seams inside the current v0 Phase 1-6 boundary are materially closed on main.

The readiness doc and ship-boundary doc both accept that runtime is now materially strong enough for current bounded v0 decision-making.

### Practical implication
Do not reopen runtime seam chasing as the default next move unless a real contract hole appears.

---

## Topic B - What is now the likely bottleneck

### Result
Aligned

### Why
The readiness doc says the likely remaining blockers now sit in boundary clarity, readiness signaling, and non-runtime required criteria.

The blocker ledger and ship-boundary doc both reinforce that idea by moving focus to explicit required blockers and boundary management.

### Practical implication
The next valuable work should reduce ambiguity or close a Required blocker, not add routine proof density.

---

## Topic C - What counts as Required for v0

### Result
Aligned

### Why
The blocker ledger creates a Required bucket.
The ship-boundary doc states that v0 is not done while any Required blocker remains open.
The readiness doc says remaining non-runtime blockers must be explicitly identified.

### Practical implication
Only Required items should drive the v0 completion call.

---

## Topic D - What is Optional before v0

### Result
Aligned

### Why
The readiness doc says more runtime seam density is probably optional unless it closes a real hole.
The blocker ledger keeps hardening and grouped summaries out of the Required lane by default.
The ship-boundary doc explicitly says optional items do not block v0 unless promoted.

### Practical implication
Optional work must stop competing with real blockers.

---

## Topic E - What is Post-v0 by default

### Result
Aligned

### Why
The readiness doc and blocker ledger both move reporting, evidence/export/seal, broader org runtime, and wider expansion out of the default v0 blocker lane.
The ship-boundary doc makes that explicit.

### Practical implication
Do not quietly re-import post-v0 work into current v0.

---

## Topic F - Whether the blocker list must be finite

### Result
Aligned

### Why
The blocker ledger requires a bounded list.
The readiness doc says vague backlog thinking is not enough.
The ship-boundary doc says a Required blocker must be explicit to block v0.

### Practical implication
Anything not explicitly named should not silently hold v0 hostage.

---

## Current Non-Conflict Summary

At the moment, these statements can all be held true at once without contradiction:

1. runtime terminal proof is materially strong on main
2. v0 is not automatically done yet
3. the remaining reasons v0 may not be done are now mostly boundary/readiness/blocker-management questions
4. optional and post-v0 items should not block the v0 call
5. the next job is disciplined Required-blocker burn-down, not uncontrolled expansion

---

## Remaining Drift Risks

The control stack is aligned now, but these are the main ways drift could re-enter.

### Drift Risk 1 - silent promotion of optional work

Example:
- exact rejection-token pinning
- additional grouped summaries
- more runtime proof density

These must not become fake blockers without an explicit decision.

### Drift Risk 2 - post-v0 expansion leaking back into v0

Example:
- reporting proofs
- evidence/export/seal expansion
- broader org runtime
- launch growth surfaces

These are post-v0 by default and should stay there unless explicitly promoted.

### Drift Risk 3 - contradictory language in later docs

A later doc could reintroduce ambiguity by loosely implying:

- runtime is still the main blocker
- wider surfaces are secretly required for v0
- optional work is actually mandatory

That would break alignment.

---

## Hard Alignment Rules

Use these rules going forward.

### Rule 1
If a document says an item blocks v0, that item must also appear as Required in the blocker ledger or in a later authoritative override.

### Rule 2
If a document says a surface is part of v0, it must not conflict with the authoritative ship-boundary doc.

### Rule 3
If runtime proof is already materially closed for the current boundary, further runtime slices must justify themselves as real hole-closures.

### Rule 4
Post-v0 items remain post-v0 unless explicitly promoted by an authoritative control update.

---

## Operational Reading Of The Current Stack

The clean reading of the repo now is:

- runtime proof core is strong
- v0 is governed by an explicit ship boundary
- remaining blockers are finite and bucketed
- alignment across the control docs is materially good
- the next best work is to close Required blockers or prove that some are not really Required

---

## Immediate Next Move After This Alignment Pass

The next best slice after this document lands is:

- update `docs/v0_REMAINING_BLOCKERS.md`
- mark each Required item as either open, closed, or needing decision
- then rescore v0 against the authoritative boundary

That is the highest-value path because it turns the control stack into an actual finish-line mechanism.

---

## Working Status Statement

Current repo status can now be described as:

The v0 control stack is materially aligned on runtime status, blocker discipline, ship boundary, and post-v0 scope. The next valuable work is Required-blocker closure or Required-blocker reduction, not more default runtime seam expansion.

---

## Update Rule

Update this document whenever:

- a control doc changes meaningfully
- a Required blocker is added or removed
- an optional item is promoted into Required
- a post-v0 item is promoted into current v0
- any conflict appears between the control docs