# v0 Remaining Blockers

## Status

Working blocker ledger  
Scope: v0 only  
Purpose: name the real remaining blockers after runtime proof closure

---

## How To Use This Document

Every remaining item must be placed in exactly one bucket:

- Required for v0
- Optional before v0
- Post-v0

If an item cannot be placed cleanly, it is not defined well enough yet.

Status values for Required items:

- Open
- Closed
- Needs decision

If a Required item is Closed, it should stop acting like a blocker.

---

## Required for v0

### R1. Authoritative ship boundary
Status: Closed

Need one explicit statement of what v0 includes and excludes.

**Why this blocks**
Without it, "done" is unstable and can drift.

**Done when**
There is one authoritative doc or section that states:

- in scope
- out of scope
- required before v0
- deferred after v0

**Current anchor**
- `docs/v0_AUTHORITATIVE_SHIP_BOUNDARY.md`

---

### R2. Remaining blocker list must be finite and explicit
Status: Closed

Need a bounded list of what is still actually open.

**Why this blocks**
An unbounded backlog is not a release boundary.

**Done when**
Each open blocker is named, short, and defensible.

**Current anchor**
- this document

---

### R3. Core control docs must align
Status: Closed

Need readiness, runtime, and v0-definition docs to agree.

**Why this blocks**
Contradictory control docs destroy decision quality.

**Done when**
There is no material conflict on:

- what v0 is
- what is done
- what remains
- what is deferred

**Current anchors**
- `docs/v0_RUNTIME_PROOF_MATRIX.md`
- `docs/v0_READINESS_REBASELINE.md`
- `docs/v0_REMAINING_BLOCKERS.md`
- `docs/v0_AUTHORITATIVE_SHIP_BOUNDARY.md`
- `docs/v0_CONTROL_STACK_ALIGNMENT.md`

---

## Required items still needing decision

At this moment, no additional Required blocker is explicitly open in this ledger beyond keeping the control stack aligned and avoiding fake blocker promotion.

That means the remaining question is now mainly a decision question:

- is there any other item that truly must be promoted into Required for v0?

If the answer is no, the path to a v0 completion call is much shorter.

---

## Optional before v0

### O1. Exact rejection token/body pinning
Status: Optional

Useful hardening, but not automatically a blocker unless v0 law explicitly says so.

### O2. More grouped audit summaries
Status: Optional

Helpful, but not automatically ship-blocking.

### O3. Additional terminal-runtime seam density
Status: Optional

Low priority unless a real contract hole is found.

---

## Post-v0

### P1. Phase 7 reporting proof expansion
Status: Post-v0

Move out unless separately declared required.

### P2. Phase 8 evidence / export / seal proof work
Status: Post-v0

Move out unless separately declared required.

### P3. Broader org runtime and wider launch surfaces
Status: Post-v0

Not part of current core v0 runtime finish line by default.

### P4. Convenience polish that does not change ship decision quality
Status: Post-v0

Do not keep this in the v0 blocker lane.

---

## Open Questions That Still Need Decisions

These are not blockers by themselves until resolved into a bucket.

### Q1
Is exact post-terminal rejection token/body/status pinning required for v0, or just useful?

### Q2
Are any reporting/evidence artifacts part of the chosen v0 law, or explicitly post-v0?

### Q3
Is launch readiness being judged as engineering-complete, runtime-complete, or release-complete?

### Q4
Is there any still-unstated required blocker not yet promoted into the Required bucket?

If yes, it must be named explicitly.
If no, v0 should be judged against the already-closed Required items and the authoritative ship boundary.

---

## Default Prioritization Rule

When choosing the next slice:

1. prefer items in Required for v0
2. do not pull Optional items ahead unless they collapse a real blocker
3. push anything not proven necessary into Post-v0

---

## Immediate Next Slice Recommendation

Best next control-doc slice after this one:

- create a v0 decision scorecard that answers whether v0 is now done, almost done, or still blocked by a newly named Required item

That is higher value than more terminal-runtime seam work.