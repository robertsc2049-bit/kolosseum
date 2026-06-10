# v0 Decision Scorecard

## Status

Authoritative decision-control document
Scope: v0 only
Purpose: convert the current v0 control stack into a hard decision surface for whether v0 is done, almost done, or still blocked

---

## Why This Document Exists

The repo now has the major control pieces in place:

- runtime proof matrix
- readiness rebaseline
- remaining blocker ledger
- authoritative ship boundary
- control-stack alignment pass

That means the next highest-value move is no longer more framing.

It is a decision.

This document exists to answer one question cleanly:

**Based on the current authoritative control stack, is v0 done, almost done, or still blocked?**

---

## Decision States

This scorecard allows only three states:

### State A - v0 Done
Use only when all Required conditions are satisfied and no Required blocker remains open or unresolved.

### State B - v0 Almost Done
Use when the runtime core is materially strong and the remaining gap is small, explicit, and bounded.

### State C - v0 Blocked
Use when one or more Required items are still open, undefined, or conflicting strongly enough to prevent a legitimate completion call.

---

## Source Of Truth Inputs

This scorecard must be read against these documents:

- `docs/v0_RUNTIME_PROOF_MATRIX.md`
- `docs/v0_READINESS_REBASELINE.md`
- `docs/v0_REMAINING_BLOCKERS.md`
- `docs/v0_AUTHORITATIVE_SHIP_BOUNDARY.md`
- `docs/v0_CONTROL_STACK_ALIGNMENT.md`
- `docs/v0_FINAL_DECISION_NOTE.md`

If a later document conflicts with these and is not authoritative, ignore it for scoring.

---

## Scoring Axes

Each axis is scored as one of:

- Pass
- Partial
- Fail

---

## Axis 1 - Runtime Core Closure

### Question
Is the current bounded v0 runtime core materially strong on main?

### Pass when
The repo has executable proof for the present v0 runtime boundary across:

- lawful completed path
- lawful partial path
- split and return behavior
- terminal immutability
- repeated-read parity
- mixed read-order parity
- restart parity
- continue-path downstream completion
- restart plus mixed-read grouped matrix

### Current assessment
Pass

### Why
The runtime proof matrix records the major terminal-runtime seams for the current Phase 1-6 boundary as materially closed on main.

---

## Axis 2 - Ship Boundary Explicitness

### Question
Is there one authoritative statement of what v0 includes, excludes, requires, and defers?

### Pass when
There is one authoritative ship-boundary document and the repo uses it as the controlling interpretation.

### Current assessment
Pass

### Why
`docs/v0_AUTHORITATIVE_SHIP_BOUNDARY.md` provides that authority.

---

## Axis 3 - Blocker Finiteness

### Question
Is the remaining blocker set explicit and finite rather than vague?

### Pass when
The blocker ledger is bounded, bucketed, and readable as a real release control surface.

### Current assessment
Pass

### Why
`docs/v0_REMAINING_BLOCKERS.md` provides explicit Required, Optional, and Post-v0 buckets.

---

## Axis 4 - Control Stack Alignment

### Question
Do the main v0 control documents materially agree?

### Pass when
There is no meaningful contradiction on:

- what v0 is
- what runtime currently proves
- what still blocks v0
- what is optional
- what is post-v0

### Current assessment
Pass

### Why
`docs/v0_CONTROL_STACK_ALIGNMENT.md` records the current control stack as materially aligned.

---

## Axis 5 - Required Blockers Still Open

### Question
Does the blocker ledger still contain any Required item that is Open or unresolved strongly enough to block a v0 call?

### Pass when
No Required blocker remains open.

### Partial when
No Required blocker is explicitly open, but one or more decision questions could still be promoted into Required.

### Fail when
One or more Required blockers are explicitly open.

### Current assessment
Pass

### Why
The blocker ledger now has no Required blocker left open.
The final decision note also records that no additional unnamed item is currently being promoted into Required.

---

## Axis 6 - Optional / Post-v0 Containment

### Question
Has the repo clearly stopped optional and post-v0 work from masquerading as required?

### Pass when
Optional and post-v0 items are explicitly named and not treated as hidden blockers.

### Current assessment
Pass

### Why
The blocker ledger, readiness rebaseline, ship-boundary doc, alignment pass, and final decision note all reinforce the same containment rule.

---

## Current Score Summary

| Axis | Result |
|---|---|
| Runtime Core Closure | Pass |
| Ship Boundary Explicitness | Pass |
| Blocker Finiteness | Pass |
| Control Stack Alignment | Pass |
| Required Blockers Still Open | Pass |
| Optional / Post-v0 Containment | Pass |

---

## Current Decision

## Decision State: v0 Done

### Why
Because:

- the major runtime core is materially strong
- the ship boundary is explicit
- the blocker ledger is finite
- the control stack is aligned
- the Required lane is closed
- no additional concrete item is currently justified as Required

---

## Hard Reading Of The Current Position

The best current reading is:

- runtime no longer justifies delay
- the control stack is strong enough to support a hard completion call
- no named Required blocker remains open
- optional and post-v0 work remain available, but they do not block v0

That means the correct repo reading is now:

## v0 is done.

---

## What Must Happen Next

The next work should no longer be framed as "finish v0" unless a real new blocker is discovered.

Valid next directions are now:

- selective optional hardening
- post-v0 planning
- wider-scope execution after v0
- later boundary expansion by explicit decision

---

## What Must NOT Happen Next

Do not do any of the following by default:

- reopen v0 because of vague discomfort
- invent hidden blockers after the fact
- relabel optional work as mandatory without an explicit decision
- widen into post-v0 surfaces and pretend v0 was never actually closed
- continue seam-chasing just because more tests could be written

---

## Working Status Language

Use this language now:

**v0 is done for the current authoritative boundary.**

You may also say:

- runtime core is materially strong on main
- the Required blocker lane is closed
- remaining work is optional hardening or post-v0 unless explicitly reclassified

Avoid this language:

- "v0 is basically done"
- "v0 is almost done"
- "v0 is done except for some unnamed concerns"

If a concern is real enough to block v0, it must be named and promoted explicitly.
Otherwise it does not block v0.

---

## Update Rule

Update this document only if:

- a new Required blocker is explicitly added
- the authoritative boundary changes
- the final decision note is formally reversed or replaced
- the control stack falls out of alignment again