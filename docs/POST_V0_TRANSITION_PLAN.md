# Post-v0 Transition Plan

## Status

Authoritative transition-control document
Scope: post-v0 transition only
Purpose: freeze v0 as done and move the repo into the next execution phase without reopening v0 by drift

---

## Why This Document Exists

v0 is now done for the current authoritative boundary.

That creates a new risk:

- not failure
- but drift

Without a transition document, the repo can fall into one of two bad states:

1. re-opening v0 because of vague discomfort
2. moving into post-v0 work without a controlled entry point

This document exists to stop both.

---

## Transition Decision

## v0 is closed.
## Work now moves to post-v0 / v1-entry planning and execution.

That means:

- v0 is no longer the default framing for new work
- new work must justify itself as post-v0, optional hardening, or a formally expanded boundary
- no one should keep using "finish v0" as a catch-all label

---

## What This Freeze Means

### v0 freeze means

- the current authoritative v0 boundary remains satisfied
- v0 control docs remain valid unless explicitly replaced
- v0 is not reopened by unease, polish wishes, or broader ambitions

### v0 freeze does not mean

- development stops
- hardening stops
- documentation stops
- broader product evolution stops

It means the next work must be labeled honestly.

---

## Allowed Work Lanes After v0

All new work should fall into one of these lanes.

### Lane 1 - Optional hardening
Useful improvements that do not change the fact that v0 is done.

Examples:
- exact rejection token/body pinning
- extra audit summaries
- selective contract hardening
- targeted cleanup that improves confidence without changing boundary

### Lane 2 - Post-v0 planning
Documents that define what comes next and prevent random motion.

Examples:
- v1 entry criteria
- post-v0 roadmap
- first execution lane priorities
- KPI and decision-system expansion for the next phase

### Lane 3 - Post-v0 execution
Actual work beyond the v0 boundary.

Examples:
- reporting surfaces
- evidence/export/seal work
- broader runtime surfaces
- wider product and launch expansion
- operational scale-up lanes

### Lane 4 - Boundary override work
Rare case only.

This is where a later authoritative decision intentionally changes the old v0 boundary.
That should be exceptional, not routine.

---

## Work That Must Stop Now

The following should stop being the default move:

- "one more v0 seam"
- "one more v0 completion note"
- "one more v0 blocker maybe"
- any work whose only justification is unresolved discomfort
- any attempt to quietly re-import post-v0 work back into v0

If a task is real, it must be named in the correct lane.

---

## Immediate Post-v0 Priorities

These are the next highest-value moves after the v0 freeze.

### Priority 1 - Define v1 entry criteria
Need a clean statement of what qualifies work as the next formal phase instead of random post-v0 motion.

### Priority 2 - Name the first execution lanes
Need a short ordered list of the next 3-5 work lanes so effort stops scattering.

### Priority 3 - Protect against boundary regression
Need a rule that prevents people from relabeling post-v0 work as unfinished v0.

### Priority 4 - Shift reporting language
Need repo language to move from "is v0 done?" to "what is the next highest-value post-v0 lane?"

---

## Hard Rule Against Reopening v0

v0 may only be reopened if one of the following happens:

1. a real contradiction is discovered in the authoritative v0 control stack
2. a concrete missing item is found that truly belonged inside the authoritative v0 boundary
3. a newer authoritative boundary document explicitly replaces the previous v0 decision

Absent one of those three cases:

## v0 stays closed.

---

## Operational Reading

The correct repo reading after this document lands is:

- v0 is done
- v0 is frozen
- optional hardening is allowed but does not redefine completion
- post-v0 planning and execution now become the main lane

---

## Immediate Next Recommended Slice

After this document lands, the next best slice is:

- `docs/V1_ENTRY_CRITERIA.md`

That should define what must be true before saying the repo has formally entered the next phase.

---

## Preferred Language Going Forward

Use this language:

- v0 is done and closed
- this work is optional hardening
- this work is post-v0 planning
- this work is post-v0 execution
- this work proposes a boundary override

Avoid this language:

- "still finishing v0"
- "basically still v0"
- "probably part of v0"
- "v0 except for..."
- "might as well treat this as v0"

If work is not inside the frozen v0 boundary, label it correctly.

---

## Update Rule

Update this document only if:

- the v0 final decision is formally reversed
- a boundary override is approved
- the post-v0 lane structure changes materially