# v0 Authoritative Ship Boundary

## Status

Authoritative control document  
Scope: v0 only  
Purpose: define exactly what counts as v0 complete, what is required before v0, what is optional, and what is explicitly post-v0

---

## Why This Document Exists

v0 cannot be called done unless the ship boundary is explicit.

This document exists to remove ambiguity.

It defines:

- what is in scope for v0
- what is required before calling v0 done
- what is optional but not required
- what is explicitly out of scope and post-v0

If another doc conflicts with this one on v0 ship boundary, this document wins unless it is formally replaced.

---

## Authoritative v0 Completion Statement

v0 is complete when the current bounded core runtime and supporting control-doc boundary are both true:

1. the current v0 runtime spine is materially strong on main for the agreed Phase 1-6 boundary
2. the remaining required non-runtime blockers listed here are closed
3. no item explicitly marked post-v0 is being treated as a hidden v0 requirement

This means v0 completion is not judged by endless proof density.
It is judged by a bounded runtime core plus explicit readiness/boundary closure.

---

## In Scope For v0

These items are inside the authoritative v0 ship boundary.

### A. Core compile and session runtime spine

Included in v0:

- compile block
- create session
- start session
- append runtime events
- read session state
- read session events

### B. Core lawful execution paths

Included in v0:

- lawful completed path
- lawful partial path
- split session behavior
- explicit return gate behavior
- return skip path
- return continue path

### C. Core terminal runtime protections

Included in v0:

- completed terminal immutability
- partial terminal immutability
- no resurrection after terminal state
- stable post-terminal rejection presence
- repeated-read parity
- mixed read-order parity
- restart parity
- restart plus mixed-read grouped stability

### D. Core control-doc clarity for v0 decisions

Included in v0:

- runtime proof status is recorded accurately
- readiness is rebaselined against real blockers
- remaining blockers are explicit and finite
- this ship boundary is explicit and authoritative

---

## Required Before Calling v0 Done

These are the required conditions.

### Required 1. Runtime proof boundary materially closed

This is satisfied when the runtime proof matrix correctly reflects main and the major terminal-runtime seams inside the current v0 boundary are materially closed.

Current status:
- treated as satisfied on main, subject to docs staying aligned

### Required 2. Authoritative ship boundary exists

This document must exist and remain aligned with the rest of the v0 control stack.

Current status:
- satisfied when this document lands on main

### Required 3. Remaining blockers are finite and explicit

There must be a bounded blocker ledger rather than a vague moving target.

Current status:
- `docs/v0_REMAINING_BLOCKERS.md` provides the active blocker ledger

### Required 4. Core control docs do not materially conflict

The following docs must align on v0 meaning and status:

- `docs/v0_RUNTIME_PROOF_MATRIX.md`
- `docs/v0_READINESS_REBASELINE.md`
- `docs/v0_REMAINING_BLOCKERS.md`
- `docs/v0_AUTHORITATIVE_SHIP_BOUNDARY.md`

### Required 5. No optional item is being silently treated as mandatory

Anything not explicitly required for v0 must not block the v0 completion call.

### Required 6. Any still-open blocker in the blocker ledger marked Required for v0 is closed

If a blocker remains in the Required bucket, v0 is not yet done.

---

## Optional Before v0

These may be useful, but they are not automatically required for v0.

### Optional A. Exact rejection token/body/status pinning

Useful hardening.
Not required unless another authoritative control doc explicitly upgrades it.

### Optional B. Higher-density grouped audit summaries

Useful for convenience and audit readability.
Not required for v0 by default.

### Optional C. More terminal-runtime proof slices

Not required unless they close a real remaining contract hole.

### Optional D. Extra polish docs that do not change ship decisions

Helpful, but not blockers by default.

---

## Explicitly Out Of Scope For v0

These are outside the authoritative v0 ship boundary unless later moved in by an explicit decision.

### Out of scope 1. Phase 7 reporting proof expansion

Not a default v0 requirement.

### Out of scope 2. Phase 8 evidence / export / seal proof expansion

Not a default v0 requirement.

### Out of scope 3. Broader org runtime

Not part of current v0 completion.

### Out of scope 4. Launch expansion and wider surface growth

Not part of current v0 completion.

### Out of scope 5. Additional proof density without a real contract hole

Do not drag this into v0.

---

## Post-v0 By Default

Unless explicitly promoted into v0 by a later authoritative decision, these belong after v0:

- reporting-surface proof expansion
- evidence/export/seal proof expansion
- broader org runtime
- wider launch and scale surfaces
- extra audit polish
- additional seam tests that do not close a real blocker

---

## What Does NOT Count As a v0 Blocker By Default

The following should not block v0 unless explicitly moved into the Required bucket:

- a desire for even more runtime proof density
- convenience summaries
- broader-than-v0 expansion work
- future-facing reporting/evidence surfaces
- polish work that does not alter release decision quality

---

## Current v0 Decision Rule

Use this rule now:

v0 is done only if every Required condition in this document is satisfied and no still-open item in the blocker ledger remains in the Required bucket.

Use this companion rule:

v0 is not blocked by work that lives only in Optional or Post-v0 buckets.

---

## Alignment With Existing Control Docs

### Aligns with `docs/v0_RUNTIME_PROOF_MATRIX.md`

This boundary accepts that the current major terminal-runtime seams for the present v0 boundary are materially closed on main.

### Aligns with `docs/v0_READINESS_REBASELINE.md`

This boundary accepts that the likely next bottleneck is no longer terminal-runtime seam density, but explicit boundary and blocker clarity.

### Aligns with `docs/v0_REMAINING_BLOCKERS.md`

This boundary accepts that the blocker list must remain finite, explicit, and bucketed.

---

## What Should Happen Immediately After This Doc Lands

The next highest-value move is:

- review `docs/v0_REMAINING_BLOCKERS.md`
- close any still-open Required items
- remove fake blockers from the Required lane
- then rescore v0 against this boundary

That is higher value than returning to terminal-runtime seam chasing.

---

## Hard Rule Against Drift

Do not treat vague unease, future ideas, or polish wishes as v0 blockers.

A v0 blocker must be one of the following:

- explicitly required in this document
- explicitly listed as Required in the blocker ledger
- required by another authoritative control doc that clearly overrides this boundary

If it does not meet one of those tests, it does not block v0.

---

## Working v0 Status Language

After this document lands, the preferred status language is:

- v0 runtime core is materially strong on main
- v0 completion is now governed by explicit ship-boundary and remaining required-blocker closure
- optional and post-v0 work must not be allowed to masquerade as required

---

## Update Rule

Update this document only when one of the following happens:

- a currently required item is removed from v0
- a new item is explicitly promoted into Required for v0
- the blocker ledger changes in a way that alters the ship decision
- this document is formally replaced by a newer authoritative boundary doc