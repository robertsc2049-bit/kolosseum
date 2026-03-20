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

### R4. Final v0 completion decision
Status: Closed

Need a final authoritative note that resolves whether v0 is actually done or whether a newly named Required blocker still exists.

**Why this blocks**
Without the final call, the repo stays trapped in "almost done" ambiguity.

**Done when**
There is one authoritative final decision note that either:

- declares v0 done for the current authoritative boundary
- or names the still-open Required blocker that prevents completion

**Current anchor**
- `docs/v0_FINAL_DECISION_NOTE.md`

---

## Required items still open

None.

Under the current authoritative control stack, no Required blocker remains open in this ledger.

That means v0 is not currently blocked by any named Required item.

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

Current default:
- Optional

### Q2
Are any reporting/evidence artifacts part of the chosen v0 law, or explicitly post-v0?

Current default:
- Post-v0 unless explicitly promoted

### Q3
Is launch readiness being judged as engineering-complete, runtime-complete, or release-complete?

Current default reading:
- v0 completion is judged against the authoritative boundary currently defined in repo control docs

### Q4
Is there any still-unstated required blocker not yet promoted into the Required bucket?

Current answer:
- No named item currently justifies promotion

If that changes, it must be named explicitly.
Until then, it does not block v0.

---

## Default Prioritization Rule

When choosing the next slice:

1. prefer items in Required for v0
2. do not pull Optional items ahead unless they collapse a real blocker
3. push anything not proven necessary into Post-v0

---

## Immediate Next Slice Recommendation

Best next slice after this one:

- move from v0 completion control docs into post-v0 planning or selectively chosen optional hardening

More v0 blocker-chasing is no longer the default highest-value move because the Required lane is now closed.