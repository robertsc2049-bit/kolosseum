# v0 Readiness Rebaseline

## Status

Working control document  
Scope: v0 only  
Purpose: rebaseline what still blocks calling v0 done after major runtime proof seam closure on main

---

## Why This Document Exists

The major terminal-runtime proof seams inside the current v0 Phase 1-6 boundary are now materially closed on main.

That changes the decision landscape.

This document exists to answer four questions clearly:

1. What is now strong enough for v0?
2. What still blocks calling v0 done?
3. What is required versus optional?
4. What should be pushed to post-v0?

This is a readiness and ship-boundary document, not product copy.

---

## Rebaseline Conclusion

### What is no longer the main blocker

The main blocker is no longer terminal-runtime proof density.

Current runtime proof now materially covers:

- runnable HTTP spine
- completed terminal hard boundary
- partial terminal hard boundary
- repeated-read parity
- mixed read-order parity
- restart parity
- return-continue downstream contract
- restart plus mixed-read grouped matrix

That means current v0 runtime terminal behavior is strongly defended for the present boundary.

### What is now more likely to block v0

The likely remaining blockers now sit in one or more of these areas:

- release boundary clarity
- readiness signaling and control docs
- non-runtime required ship criteria
- evidence of what is explicitly in versus out
- any still-unclosed required product/API contracts outside the already-defended runtime terminal spine

---

## What Is Strong Enough Right Now

The following can now be treated as materially strong for current v0 boundary decisions.

### A. Core runtime terminal spine

Strong enough on main:

- lawful completed path
- lawful partial path
- split and return gate behavior
- post-terminal immutability
- post-terminal rejection presence
- repeated state/events parity
- mixed read-order parity
- restart stability
- continue-branch downstream completion

### B. Runtime proof posture

Strong enough on main:

- proof is executable, not only documentary
- proof is grouped, not only isolated
- proof covers both skip and continue branches
- proof covers both in-process and post-restart observation

### C. Runtime decision implication

Strong enough to stop treating terminal runtime proof as the primary default next slice.

---

## Still-Blocking Questions Before Calling v0 Done

These are now the questions that matter more.

### 1. Exact v0 ship boundary

Need a single clear answer to:

- what is required for v0 ship
- what is allowed but not required
- what is explicitly deferred to post-v0

Until that is stable, v0 completion can drift.

### 2. Non-runtime required contracts

Need to confirm whether any required v0 contracts remain outside the already-proved terminal runtime spine, for example:

- required API contract pinning still not explicitly frozen
- required release-law docs not yet aligned
- required evidence/reporting/readiness artifacts not yet sufficient for the chosen v0 definition

### 3. Release readiness signaling

Need to know whether the repo has enough control docs to support a hard statement such as:

- v0 is ship-complete
- v0 is runtime-complete but not launch-complete
- v0 is dev-complete but not release-law complete

Without that language, decision quality stays weak.

### 4. Required versus optional split

Need to remove ambiguity between:

- must-have for v0
- useful before launch but not required
- explicitly post-v0

This prevents waste and keeps slices pointed at the actual finish line.

---

## Required Before Calling v0 Done

This section defines the current default view.

These items should be treated as required unless a later decision document explicitly changes the rule.

### Required 1 - Stable v0 ship boundary

There must be one authoritative statement of what v0 includes and excludes.

### Required 2 - Runtime proof closure recorded

This is now effectively satisfied, but the readiness stack must reflect it consistently.

### Required 3 - Remaining non-runtime blockers identified

There must be a short explicit list of the actual remaining blockers, not a vague backlog.

### Required 4 - Required docs aligned

Core control docs must not contradict one another on:

- what v0 is
- what is done
- what is still required
- what is deferred

### Required 5 - No fake must-haves

Items that are merely nice-to-have must not remain mislabeled as v0 blockers.

---

## Probably Optional Before v0

Unless a stronger requirement is defined elsewhere, these should currently be treated as optional for v0.

### Optional A - More terminal-runtime seam density

Do not keep adding narrow runtime proof slices just because they are available.

### Optional B - Audit-polish summaries

Useful, but lower value than real ship-boundary clarity.

### Optional C - Wider-than-v0 proof surfaces

Do not widen into reporting, evidence, export, or broader org runtime unless they are explicitly part of the v0 ship law.

---

## Explicit Post-v0 Candidates

These are the first things that should move out if they are still being mentally counted as v0 blockers.

### Post-v0 Candidate 1

Phase 7 reporting proof surfaces, unless separately declared required.

### Post-v0 Candidate 2

Phase 8 evidence / export / seal work, unless separately declared required.

### Post-v0 Candidate 3

Broader org runtime and non-core launch expansion work.

### Post-v0 Candidate 4

Additional terminal-runtime proof density that does not close a real contract hole.

---

## Current Recommended Interpretation

### Best current reading

v0 appears to be:

- runtime-terminal-spine strong
- no longer mainly blocked by terminal runtime proof
- now more dependent on final boundary clarity and non-runtime readiness decisions

### What should happen next

The next slice after this rebaseline should identify the actual remaining v0 blockers in one bounded control doc and separate them into:

- required now
- optional now
- post-v0

---

## Decision Rules

Use these rules for future prioritization.

### Rule 1

Do not create another runtime test by default unless it closes a real remaining contract hole.

### Rule 2

Do not widen scope until required v0 blockers are named explicitly.

### Rule 3

If a task does not move v0 from ambiguous to explicit, it is probably not the highest-value next slice.

### Rule 4

When runtime is already strong, clarity work can be more valuable than more proof density.

---

## Immediate Next 5 Moves

Ordered by value.

### 1. Create explicit remaining-blockers control doc

Target:

- one short authoritative list of remaining v0 blockers
- each blocker marked required, optional, or post-v0

### 2. Align ship-boundary language across docs

Target:

- no contradiction between readiness, runtime, and v0-definition docs

### 3. Freeze what is out of scope

Target:

- stop scope creep by naming explicit post-v0 items

### 4. Pin any truly required non-runtime contracts

Target:

- only if they are required for the chosen v0 ship law

### 5. Re-score v0 readiness after blocker split

Target:

- convert fuzzy status into explicit readiness state

---

## Working Status Statement

Current status can now be described as:

v0 runtime terminal spine is materially strong on main, but final v0 completion should now be judged primarily by ship-boundary clarity and any remaining non-runtime required blockers rather than by more terminal runtime seam work.

---

## Update Rule

Update this document whenever:

- a supposed blocker is removed from v0 scope
- a new item is explicitly declared required for v0
- runtime closure changes the true bottleneck again
- the ship boundary is formally tightened