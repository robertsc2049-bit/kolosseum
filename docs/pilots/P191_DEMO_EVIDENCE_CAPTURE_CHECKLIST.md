# P191 - Demo Evidence Capture Checklist

Status: Draft
Scope: current v0 surfaces only
Boundary: one internal checklist for what to capture during and after demo
Purpose: feed internal evidence collection without improvisation

## Intent

This document defines the internal checklist for capturing demo proof during and immediately after a founder/demo session.

It is limited to current v0 only.

Capture:
- surface proof
- factual outputs
- counts
- replay-honest examples

Do not treat demo captures as:
- proof-complete evidence
- sealed evidence
- v1 audit artefacts
- Phase 7 / Phase 8 capability proof

It excludes:
- evidence envelopes
- export proof claims
- readiness scoring
- rankings
- outcome judgement
- coaching claims
- safety claims
- medical or advisory framing

---

## Section 1 - Pre-demo setup capture

Capture before the demo starts.

- [ ] Demo date
- [ ] Demo time
- [ ] Demo operator
- [ ] Demo audience type
- [ ] Build identifier or commit SHA
- [ ] Active branch or environment
- [ ] Confirm current v0 boundary is the one being shown
- [ ] Confirm demo activity is one of:
  - powerlifting
  - rugby_union
  - general_strength
- [ ] Confirm demo actor/scope is one of:
  - individual_user
  - coach
  - individual
  - coach_managed

Do not capture or claim:
- org/team/unit/gym runtime flows
- Phase 7 outputs
- Phase 8 outputs
- evidence envelopes
- proof-complete export language
- readiness, ranking, outcome judgement, or advice claims

---

## Section 2 - Demo input proof

Capture exactly what was declared.

- [ ] Screenshot or export of intake/onboarding surface used
- [ ] Proof that only declared fields were used
- [ ] Consent capture visible
- [ ] Activity selection visible
- [ ] Role selection visible
- [ ] Execution scope visible
- [ ] Environment declarations visible
- [ ] Equipment declarations visible where used
- [ ] Presentation modifiers visible where used
- [ ] Constraint declarations visible where used

Rule:
- explicit declarations only
- no inference
- no defaults
- no hidden correction
- no implied inputs

---

## Section 3 - Surface proof during demo

Capture what the product visibly does.

- [ ] Onboarding completion screen
- [ ] Session generation screen
- [ ] Session execution start screen
- [ ] Split / return path if shown
- [ ] Partial completion path if shown
- [ ] Coach assignment view if shown
- [ ] Coach factual artefact view if shown
- [ ] History view with counts only if shown

Capture as proof of:
- lawful surface reachability
- factual session flow
- deterministic product slice visibility

Do not capture as proof of:
- coaching quality
- safety
- correctness
- optimisation
- outcome superiority

---

## Section 4 - Runtime event proof

Capture factual events only.

- [ ] Session started
- [ ] Exercise event shown, if used
- [ ] Substitution event shown, if used
- [ ] Extra work event shown, if used
- [ ] Skipped work event shown, if used
- [ ] Partial completion shown, if used
- [ ] Session ended
- [ ] Saved state shown, if used

Rule:
- runtime outputs are factual and append-only
- deviation events must not be framed as correction
- no advisory language
- no behavioural judgement

---

## Section 5 - Counts and summaries to capture

Capture neutral counts only.

- [ ] Number of sessions generated in demo
- [ ] Number of sessions executed in demo
- [ ] Number of split / return examples shown
- [ ] Number of partial completion examples shown
- [ ] Number of runtime event types shown
- [ ] Number of coach-view artefacts shown
- [ ] Number of supported activities demonstrated
- [ ] Number of supported roles/scopes demonstrated
- [ ] Number of closed-world constraints shown in action
- [ ] Number of screenshots captured
- [ ] Number of clips or recordings captured

Allowed summary style:
- counts
- sums
- grouped factual totals
- date or scope grouping

Forbidden summary style:
- better
- improved
- optimised
- safer
- recommended
- effective
- suitable

---

## Section 6 - Lawful example pack

For each example shown in the demo, capture one row.

### Per-example row

- [ ] Example ID
- [ ] Activity
- [ ] Role
- [ ] Execution scope
- [ ] Surface shown
- [ ] Input declaration used
- [ ] Output surface shown
- [ ] Runtime event or events shown
- [ ] Count summary recorded
- [ ] Screenshot or video filename
- [ ] Notes limited to factual description only

Allowed example types:
- lawful intake example
- lawful execution example
- lawful split / return example
- lawful partial completion example
- lawful coach factual-view example
- lawful history-count example

Avoid:
- hypothetical examples
- inferred user stories
- advisory examples
- medical narratives
- safety narratives

---

## Section 7 - Replay-honest proof capture

For v0, keep this narrow.

- [ ] Record whether replay or determinism was claimed in the demo
- [ ] If claimed, record the exact wording used
- [ ] Record the exact scope of replay proof actually available
- [ ] Confirm no one used:
  - evidence-complete
  - sealed evidence
  - proof-complete
  - audit-proven
  for current v0

Rule:
v0 may claim deterministic verification only within the replay scope it can lawfully prove.
Do not describe v0 as proof-complete or evidence-complete.

---

## Section 8 - CI / build proof to attach after demo

Capture post-demo operational proof.

- [ ] Latest relevant PR or main run IDs
- [ ] CI pass screenshot or copied status
- [ ] gh run list --limit 10 output saved
- [ ] Relevant green checks recorded
- [ ] Commit reference recorded
- [ ] Merge reference recorded, if applicable

Rule:
If CI does not pass, the build does not exist.

---

## Section 9 - Copy and language review

Do a fast pass on what was said and what was shown.

- [ ] No medical language
- [ ] No safety claims
- [ ] No optimisation claims
- [ ] No advisory language
- [ ] No outcomes presented as evidence
- [ ] No reports presented as attestations
- [ ] No proof-layer wording applied to current v0
- [ ] No claim that the system judged readiness, compliance, or quality

---

## Section 10 - Post-demo evidence pack contents

Minimum internal pack:

- [ ] Demo metadata note
- [ ] Screenshot set
- [ ] Screen recording or clipped highlights
- [ ] Count summary sheet
- [ ] Lawful examples sheet
- [ ] CI status capture
- [ ] Short founder note covering:
  - what was shown
  - what was not shown
  - what remains outside current v0
- [ ] Explicit statement that this is internal demo capture, not sealed evidence

---

## Section 11 - Founder close-out statement

Use this exact internal framing:

This demo pack captures current-v0 surface proof only: declared inputs, factual outputs, neutral counts, and replay-honest examples within the active v0 boundary. It is not a sealed evidence artefact, not a proof-complete audit pack, and not a claim of Phase 7/8 capability.

---

## Operating rules

Use this checklist to support:
- founder demos
- internal walkthroughs
- controlled pilot demonstrations
- post-demo proof collation

Do not use this checklist to imply:
- legal attestation
- evidence sealing
- replay suite completeness
- export-grade audit proof
- broader platform capability outside current v0

---

## Founder summary

The demo evidence capture checklist is restricted to:

1. Pre-demo setup
2. Live capture
3. Post-demo counts
4. Evidence-pack assembly

That is the narrowest current-v0 lawful demo capture surface.