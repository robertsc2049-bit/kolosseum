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
The runtime proof matrix now records the major terminal-runtime seams for the current Phase 1-6 boundary as materially closed on main.

---

## Axis 2 - Ship Boundary Explicitness

### Question
Is there one authoritative statement of what v0 includes, excludes, requires, and defers?

### Pass when
There is one authoritative ship-boundary document and the repo uses it as the controlling interpretation.

### Current assessment
Pass

### Why
`docs/v0_AUTHORITATIVE_SHIP_BOUNDARY.md` now provides that authority.

---

## Axis 3 - Blocker Finiteness

### Question
Is the remaining blocker set explicit and finite rather than vague?

### Pass when
The blocker ledger is bounded, bucketed, and readable as a real release control surface.

### Current assessment
Pass

### Why
`docs/v0_REMAINING_BLOCKERS.md` now provides explicit Required, Optional, and Post-v0 buckets.

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
Partial

### Why
The ledger now marks the named Required items as Closed.
However, the ledger still leaves one live decision question:

- is there any still-unstated item that truly belongs in Required for v0?

That is not the same as an open blocker, but it is still unresolved enough to stop a fully clean "done" call.

---

## Axis 6 - Optional / Post-v0 Containment

### Question
Has the repo clearly stopped optional and post-v0 work from masquerading as required?

### Pass when
Optional and post-v0 items are explicitly named and not treated as hidden blockers.

### Current assessment
Pass

### Why
The blocker ledger, readiness rebaseline, ship-boundary doc, and alignment pass all reinforce the same containment rule.

---

## Current Score Summary

| Axis | Result |
|---|---|
| Runtime Core Closure | Pass |
| Ship Boundary Explicitness | Pass |
| Blocker Finiteness | Pass |
| Control Stack Alignment | Pass |
| Required Blockers Still Open | Partial |
| Optional / Post-v0 Containment | Pass |

---

## Current Decision

## Decision State: v0 Almost Done

### Why not "Blocked"
Because the major runtime core is materially strong, the ship boundary is explicit, the blocker ledger is finite, and the current named Required blockers are closed.

### Why not "Done"
Because there is still one unresolved release-decision question left:

- whether any still-unstated item must actually be promoted into the Required bucket before a legitimate v0 completion call can be made

That is now the last serious ambiguity.

---

## Hard Reading Of The Current Position

The best current reading is:

- runtime no longer justifies delay by default
- control docs are now strong enough to support a real completion decision
- the remaining gap is not engineering fog
- the remaining gap is a final explicit decision on whether there is any true Required blocker left that has not yet been named

If the answer is **no**, v0 is very close to a valid done call.

If the answer is **yes**, that item must be named explicitly and inserted into the Required bucket.

---

## What Must Happen Next

Only one of these two paths is valid now.

### Path A - Promote a real remaining blocker
Use this path only if there is a concrete item that truly must be Required for v0.

Required action:
- name it explicitly
- explain why it is Required
- add it to `docs/v0_REMAINING_BLOCKERS.md`
- rescore this document

### Path B - Confirm no further Required blockers exist
Use this path if no concrete hidden blocker can be defended.

Required action:
- record that no additional Required item is being promoted
- update this scorecard from "Almost Done" to "Done"
- ensure the blocker ledger reflects that state cleanly

---

## What Must NOT Happen Next

Do not do any of the following by default:

- add more routine runtime seam tests
- widen into post-v0 proof surfaces
- create polish docs that avoid the real decision
- keep v0 in limbo because of vague unease
- treat optional hardening as a fake blocker

---

## Preferred Immediate Next Slice

The next highest-value slice after this document lands is:

- a final v0 completion decision note that answers:
  - no further Required blockers exist, therefore v0 is done
  - or
  - one newly named Required blocker exists, therefore v0 is not done yet

That slice should be short, explicit, and binary.

---

## Working Status Language

Until the next decision slice lands, the preferred language is:

**v0 is almost done.**  
The runtime core is materially strong, the ship boundary is explicit, the control stack is aligned, and the named Required blockers are closed. The only remaining serious question is whether any still-unstated item truly belongs in the Required bucket.

---

## Update Rule

Update this document whenever:

- a new Required blocker is explicitly added
- a decision question is resolved into Required, Optional, or Post-v0
- the current state changes from Almost Done to Done
- the control stack falls out of alignment again