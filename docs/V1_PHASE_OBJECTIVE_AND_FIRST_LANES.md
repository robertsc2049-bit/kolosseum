# v1 Phase Objective And First Lanes

## Status

Authoritative phase-definition document
Scope: v1 entry only
Purpose: define the first formal objective, first ordered execution lanes, and non-goals for the phase after closed v0

---

## Why This Document Exists

v0 is done and closed.

The repo now has:

- a post-v0 transition plan
- v1 entry criteria
- a frozen v0 boundary

That is enough to stop drift, but not enough to start v1 properly.

v1 should not begin as vague expansion.
It should begin as a named phase with a bounded objective and ordered execution lanes.

This document is that bridge.

---

## v1 Phase Objective

## Primary objective

Extend the system beyond the closed v0 runtime spine into the first governed post-v0 product layer by adding higher-value read, decision, and evidence surfaces without regressing the frozen v0 boundary.

---

## What That Means In Practice

v1 is not about random feature growth.

It is about building the first layer above the v0 runtime core so the system becomes more decision-useful, more auditable, and more operationally valuable.

The first phase after v0 should therefore prioritize surfaces that make the existing engine more usable, interpretable, and governable before chasing broad expansion everywhere at once.

---

## v1 In-Scope Work

The following is in scope for the first v1 phase.

### 1. Higher-value read / reporting surfaces
Build structured outputs that make the existing runtime easier to inspect, review, compare, or operate.

### 2. Evidence / export / decision-support surfaces
Build outputs that strengthen auditability, handoff, review, or later operational use.

### 3. Command-center / control-system expansion
Build the next layer of planning, KPI, blocker, readiness, and execution control around the product and repo.

### 4. Selective targeted hardening that directly supports the above
Hardening is allowed when it directly supports the first v1 objective instead of reopening v0 by habit.

---

## v1 Out Of Scope For This First Phase

The following stays out for now unless later promoted by an explicit decision.

### Out 1. Broad uncontrolled product expansion
Do not widen into many unrelated surfaces at once.

### Out 2. Reopening v0
Do not relabel frozen v0 work as unfinished.

### Out 3. Scale theatre
Do not jump into infrastructure/organisation complexity that is premature for the current stage.

### Out 4. Large surface-area launch work without phase control
Do not explode into marketing, org, marketplace, reporting, evidence, exports, and scale all at once without lane discipline.

### Out 5. Random polish without phase relevance
Do not let convenience work consume the phase.

---

## First Ordered Execution Lanes

These are the first three execution lanes for v1, in order.

## Lane 1 - Reporting / Read-Model Expansion

### Why first
This gives the fastest increase in practical usefulness above the existing runtime core.

The engine already has a materially strong v0 spine.
The next leverage point is making outputs easier to inspect, summarize, reason about, and use.

### Target outcomes
- better higher-level summaries of runtime truth
- stronger read models
- clearer structured outputs for review and downstream decisions
- improved visibility into what the engine did and why

### What belongs here
- summary views
- score/report outputs
- read-side projections
- structured interpretation layers over existing runtime facts

---

## Lane 2 - Evidence / Export / Seal-Oriented Expansion

### Why second
Once the system can report its truth better, the next leverage point is packaging that truth for audit, handoff, or proof.

### Target outcomes
- stronger evidence surfaces
- export-ready outputs
- seal-ready or review-ready packaging
- more operationally useful artifacts

### What belongs here
- export surfaces
- evidence packaging
- output contracts for handoff/review
- seal-related prep or structure if later required

---

## Lane 3 - Command-Center / Decision-System Expansion

### Why third
Once read/reporting and evidence surfaces begin to harden, the next leverage point is strengthening the control layer that governs execution and decisions across the repo and product.

### Target outcomes
- better KPI framing
- better execution governance
- better prioritization surfaces
- stronger command-center control docs

### What belongs here
- KPI structures
- execution scorecards
- phase control surfaces
- decision architecture
- blocker / readiness / sequencing governance

---

## Deferred Lanes

These are valid later lanes, but not first.

### Deferred A - Broad runtime expansion
Valid later, but not before the first higher-value read/evidence layer is shaped.

### Deferred B - Larger product-surface expansion
Valid later, but should follow clearer lane discipline.

### Deferred C - Wider launch/scale systems
Valid later, but premature as a first post-v0 phase lane.

---

## Success Criteria For This First v1 Phase

This first v1 phase is succeeding if:

1. the frozen v0 boundary stays closed
2. the repo gains at least one meaningful higher-level read/reporting layer
3. the repo gains at least one meaningful evidence/export-oriented layer
4. the control system becomes more decision-useful, not more verbose
5. work stays inside the ordered lanes instead of scattering

---

## Failure Conditions

This first v1 phase is failing if:

- work sprawls across too many surfaces at once
- v0 gets reopened by drift
- lane order is ignored
- docs multiply without changing execution quality
- optional hardening consumes the whole phase
- broad expansion starts before the first read/evidence/control layer is shaped

---

## Decision Rules

### Rule 1
If a task does not fit Lane 1, Lane 2, or Lane 3, it needs explicit justification before being treated as first-phase v1 work.

### Rule 2
Lane 1 beats Lane 2 by default.
Lane 2 beats Lane 3 by default.
Do not reverse that order casually.

### Rule 3
Do not reopen frozen v0 to justify new work.

### Rule 4
Prefer work that increases decision-usefulness, auditability, or operational clarity over work that merely increases surface area.

---

## Current Phase Reading

After this document lands, the correct reading should be:

- v0 is done and closed
- the repo has entered formal v1 planning shape
- the first v1 objective is now named
- the first ordered lanes are now named
- the next slices should be chosen against these lanes

---

## Immediate Next Recommended Slice

After this document lands, the next best slice is:

- a Lane 1 control doc that defines the first reporting / read-model surface to build

Recommended file:

- `docs/V1_LANE1_REPORTING_READ_MODEL_TARGET.md`

That should name:
- the exact reporting/read-model target
- why it is first
- what contract it must satisfy
- what is explicitly out

---

## Update Rule

Update this document only when:

- the v1 objective changes materially
- lane order changes materially
- a deferred lane is promoted
- the repo moves beyond this first v1 phase into a later formal phase