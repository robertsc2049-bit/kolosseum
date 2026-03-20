# v1 Lane 1 Reporting Read-Model Target

## Status

Authoritative lane-target document  
Scope: v1 Lane 1 only  
Purpose: define the first coach-readable reporting / read-model surface to build on top of the closed v0 runtime core

---

## Why This Document Exists

v0 closed the runtime truth boundary.

That was necessary, but it is not yet the first commercial-value layer.

The next step must not be random reporting.
It must define the first output that turns engine truth into something a coach can understand, trust, and use quickly.

This document sets that first Lane 1 target.

---

## Lane 1 Primary Target

## Coach Session Decision Summary

This is the first reporting / read-model target for v1.

It should produce a coach-readable summary of what happened in a session and why that outcome matters.

This is the first visible layer above the closed v0 runtime spine.

---

## Why This Is First

This is first because it creates the shortest path from:

- engine truth
- to readable value
- to coach trust
- to commercial usefulness

The engine already knows runtime truth.
What it does not yet give in a commercially useful way is a compact readable summary that answers:

- what happened
- what changed
- what was completed
- what was dropped
- whether the session finished completed or partial
- why that matters operationally

That is the first leverage point.

---

## Product-Level Goal

A coach should be able to look at one summary artifact and understand the execution outcome without reading raw runtime events.

This is not a replacement for raw truth.
It is a read-model layer built on top of raw truth.

---

## Core User

Primary user:

- coach reviewing a completed or partial session outcome

Secondary users later:

- athlete
- reviewer
- support/admin
- audit/evidence surfaces

But the first version is coach-first.

---

## Core Questions The Summary Must Answer

The first target must answer these questions clearly:

1. What session outcome was reached?
2. Was the session completed or partial?
3. Which exercises were completed?
4. Which exercises were dropped?
5. Was split / return involved?
6. Was the return decision continue or skip?
7. What should the coach understand from this outcome immediately?

If it does not answer those clearly, it is not the right first read-model target.

---

## In Scope For This First Target

### 1. Outcome summary
The summary must state the final execution outcome clearly:

- completed
- partial

### 2. Exercise outcome summary
The summary must provide:

- completed exercise ids
- dropped exercise ids
- remaining exercise ids only if still relevant to final readable interpretation

### 3. Split / return summary
The summary must indicate whether:

- split occurred
- return decision occurred
- return decision was continue
- return decision was skip

### 4. Coach-readable interpretation layer
The summary must include a plain-language interpretation field derived from runtime truth, not hand-wavy prose.

Examples of the kind of meaning this layer should carry:

- session completed as planned
- session ended partial after return_skip with dropped work preserved
- session resumed after return_continue and completed without dropped work

### 5. Contract-first structure
This should be defined as a structured read model, not a loose paragraph blob.

---

## Explicitly Out Of Scope For This First Target

### Out 1. Full dashboard system
Do not build a broad reporting suite yet.

### Out 2. Visual polish/UI theatre
Do not jump into design-heavy presentation before the read-model contract is right.

### Out 3. Full athlete analytics
Do not widen into broader performance analytics yet.

### Out 4. Broad KPI layer
Do not try to solve all coach/business metrics in this slice.

### Out 5. Export/seal/report bundle systems
Those belong later unless explicitly promoted.

### Out 6. Narrative AI explanations
Do not introduce fuzzy explanatory text that outruns the underlying runtime truth.

---

## Read-Model Contract Shape

The first target should aim toward a structured shape like this conceptually:

- session_id
- execution_status
- split_used
- return_decision
- completed_ids
- dropped_ids
- coach_summary_code
- coach_summary_text

This document does not freeze the final schema yet, but it does freeze the required direction.

The shape must stay:

- deterministic
- readable
- derived from runtime truth
- stable enough to become a contract surface

---

## Required Invariants

## Invariant L1-1 - Truth-derived only
The summary must be derived from existing lawful runtime truth.
It must not invent facts.

---

## Invariant L1-2 - No contradiction with runtime state
The summary must not conflict with:

- session execution status
- dropped-work truth
- split / return truth
- completed exercise truth

---

## Invariant L1-3 - Coach-readable in one pass
A coach should be able to understand the session outcome in one quick pass without reading raw events.

---

## Invariant L1-4 - Completed vs partial distinction must remain explicit
The summary must not blur completed and partial outcomes.

---

## Invariant L1-5 - Return path meaning must remain explicit
If split / return changed the session outcome, that must remain visible in the summary.

---

## Invariant L1-6 - Raw truth remains sovereign
The read model is a readable projection layer, not a replacement for the underlying runtime facts.

---

## What Good Looks Like

A good first Lane 1 result would let you show a coach something like:

- Session outcome: Partial
- Completed: squat, deadlift
- Dropped: bench_press
- Split used: yes
- Return decision: skip
- Summary: Session ended partial after split; remaining low-priority work was dropped and terminal state was preserved

Or:

- Session outcome: Completed
- Completed: squat, bench_press, deadlift
- Dropped: none
- Split used: yes
- Return decision: continue
- Summary: Session resumed after split and completed without dropped work

That is commercially legible.
That is the point.

---

## Why This Matters Commercially

This is the first layer that helps a coach say:

- I can see what the engine did
- I can trust what happened
- I can explain the outcome to an athlete
- this is more useful than raw event plumbing

That is the beginning of visible differentiation.

Not because it is flashy.
Because it is legible.

---

## Success Criteria

This target is succeeding if:

1. it creates one compact coach-readable session outcome layer
2. it stays grounded in runtime truth
3. it clearly distinguishes completed vs partial outcomes
4. it makes split / return effects understandable
5. it can be shown in a demo as a visible value layer above the engine core

---

## Failure Conditions

This target is failing if:

- it becomes vague prose instead of a structured read model
- it hides important execution facts
- it contradicts runtime truth
- it sprawls into a whole reporting platform
- it becomes polish-heavy before contract clarity exists
- it is readable only to the person who built it

---

## Recommended Next Slice After This Doc

After this document lands, the next best slice is:

- define the formal contract for the Coach Session Decision Summary

Recommended file:

- `docs/contracts/v1_coach_session_decision_summary_contract.md`

That next contract should define:

- exact fields
- required invariants
- example completed output
- example partial output
- what must never drift

---

## Decision Rule

If a proposed Lane 1 task does not strengthen the Coach Session Decision Summary target directly, it should not beat this work by default.

---

## Working Status Language

Use this language after this document lands:

- Lane 1 target is now defined
- the first readable coach-value layer is Coach Session Decision Summary
- next work should formalize the contract for that surface before wider reporting expansion

---

## Update Rule

Update this document only if:

- the first Lane 1 target changes materially
- the primary user changes materially
- the lane objective changes materially
- a later authoritative document replaces this target