# v1 Entry Criteria

## Status

Authoritative phase-entry document
Scope: next-phase entry only
Purpose: define what must be true before calling work "v1" instead of vague post-v0 motion

---

## Why This Document Exists

Once v0 is done, teams often do one of two stupid things:

1. wander into random expansion work without criteria
2. call everything "v1" without a real phase boundary

This document exists to stop that.

It defines the conditions for calling the next phase real.

---

## What v1 Means Here

For this repo, v1 should not mean "anything after v0."

v1 should mean:

- the project has moved beyond the bounded v0 runtime/control-doc finish line
- the next phase has explicit goals
- the next phase has explicit scope
- the next phase has explicit non-goals
- the next phase has named execution lanes

If those are absent, the work is still just post-v0 exploration or hardening.

---

## Minimum Entry Criteria For v1

All of the following should be true before declaring formal v1 entry.

### V1-1. Named phase objective
There must be a plain-English answer to:

- what is v1 for?

Bad example:
- "more stuff"

Good example:
- "extend the system beyond v0 into reporting/evidence/export surfaces with a governed execution model"

### V1-2. Explicit scope
There must be a list of what is in scope for v1.

### V1-3. Explicit out-of-scope list
There must be a list of what v1 will not attempt yet.

### V1-4. Ordered execution lanes
There must be an ordered short list of the first work lanes.

### V1-5. Decision system continuity
The next phase must continue to use:

- explicit boundaries
- blocker discipline
- named priorities
- controlled scope movement

### V1-6. No v0 boundary regression
Nothing in v1 entry may imply that closed v0 work is secretly unfinished.

---

## Recommended First v1 Work Lanes

These are the best current candidates, in order.

### Lane A - Reporting / read-model expansion
If the next value is better visibility, scorecards, summaries, reporting layers, or related runtime read surfaces.

### Lane B - Evidence / export / seal expansion
If the next value is stronger output, evidence packaging, exportability, or seal-related proof surfaces.

### Lane C - Command-center / decision-system expansion
If the next value is stronger control architecture across the wider product and business system.

### Lane D - Broader runtime / product expansion
If the next value is widening beyond the bounded v0 core into larger execution surfaces.

### Lane E - Selective hardening
If the next value is small targeted reinforcement before wider expansion.

---

## What Does NOT Qualify As v1 By Itself

The following do not automatically justify saying v1 has started:

- one extra hardening slice
- one extra runtime test
- one extra control doc
- vague ambition
- broad future ideas without scope
- polish work without a phase objective

---

## Current Assessment

### Current state
Not yet formally in v1.

### Why
Because although v0 is done and closed, the next phase objective and ordered scope are not yet frozen into a formal v1 definition.

### What that means
The repo is currently in:

## post-v0 transition state

That is normal.
It is better than fake-v1 drift.

---

## The Decision That Creates v1

v1 begins only when a later authoritative document does all of the following:

1. names the v1 objective
2. defines v1 in-scope work
3. defines v1 out-of-scope work
4. names the first ordered execution lanes
5. confirms the v0 boundary remains closed

Until then, the honest label is:

- post-v0 transition
- optional hardening
- post-v0 planning
- post-v0 execution experiment

---

## Immediate Next Recommended Slice

After this document lands, the next best slice is:

- a short `docs/V1_PHASE_OBJECTIVE_AND_FIRST_LANES.md`

That document should:
- name the next phase objective
- choose the first 3 execution lanes
- state what stays out

That would be the real bridge from v0 closure into formal v1.

---

## Update Rule

Update this document only when:

- formal v1 scope is defined
- the first ordered work lanes change materially
- the repo transitions from post-v0 transition into actual v1