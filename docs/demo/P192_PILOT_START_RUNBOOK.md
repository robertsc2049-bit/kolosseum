# P192 — Pilot Start Runbook

Status: Draft  
Owner: Founder / Ops / Product  
Scope: v0 only  
Rewrite policy: rewrite-only  
Last updated: 2026-04-13

---

## Target

Define the exact operator sequence from **“pilot paid”** to **“coach ready”**.

“Coach ready” means:
- the commercial side is active
- the platform side is linked and permissioned
- the athlete has a lawful accepted declaration
- the first executable session exists
- the coach can operate within v0 authority without touching engine truth

---

## Invariant

This runbook MUST preserve the following boundaries at all times:

1. **Payment is access, not engine truth.**
   Payment, tier state, and commercial packaging may control access and visibility only.
   They MUST NOT alter legality, compilation, substitution, execution, determinism, replay, or truth.

2. **Coach relationship is explicit and non-engine.**
   Coach ↔ athlete linkage MUST be explicit platform metadata.
   It MUST NOT be inferred.
   It MUST NOT be stored inside engine truth.

3. **Phase 1 is the only lawful engine entry point.**
   No session may exist until Phase 1 is accepted.
   Unknown fields, missing required fields, and invalid references fail hard.

4. **v0 surface is narrow.**
   v0 allows:
   - onboarding
   - coach assignment
   - session execution
   - history counts
   - factual artefact viewing
   - non-binding coach notes

   v0 excludes:
   - org runtime execution
   - dashboards
   - rankings
   - messaging
   - evidence sealing
   - proof/export language beyond v0

5. **Coach authority is observational only for engine purposes.**
   Coaches may assign within system limits, view artefacts, and write non-binding notes.
   Coaches may not override engine decisions, alter legality, mutate declarations, or affect replay/evidence.

---

## Proof

This runbook is complete when all of the following are true for a pilot:

- payment is confirmed
- workspace exists
- coach account is active
- athlete account is active
- coach ↔ athlete link is accepted
- v0 scope is confirmed
- athlete Phase 1 declaration is accepted
- first executable session compiles successfully
- coach can view the athlete artefact
- coach can add a non-binding note
- no illegal surface is exposed
- no payment, org, or presentation flag changes engine output

---

## Trigger

Start this runbook when:
- payment has been received
- the pilot sale has been accepted
- the pilot is approved to start

---

## Exit condition

This runbook ends only when the pilot status is:

**Coach Ready**

---

## Status model

Use these exact statuses:

- Paid
- Workspace Created
- Coach Invited
- Coach Active
- Athlete Invited
- Athlete Active
- Link Accepted
- Scope Locked
- Phase 1 Pending
- Phase 1 Accepted
- Compilation Passed
- Coach Ready
- Blocked — Commercial
- Blocked — Platform
- Blocked — Declaration
- Blocked — Compile

---

## Operator sequence

### Step 1 — Mark pilot as paid

**Action**
- mark pilot record as `Paid`
- store:
  - customer name
  - billing contact
  - pilot owner
  - start date
  - athlete cap
  - coach seat count
  - included activity scope

**Must not**
- create any engine artefact
- create any session
- simulate readiness

**Success**
- commercial state is active
- status = `Paid`

**Failure route**
- if payment is incomplete or disputed:
  - status = `Blocked — Commercial`

---

### Step 2 — Create pilot workspace

**Action**
- create workspace / pilot shell
- attach commercial entitlement to workspace access only
- enable only v0-approved surfaces

**Enable**
- onboarding
- coach assignment
- session execution
- factual history counts
- coach artefact viewing
- non-binding coach notes

**Disable / withhold**
- org execution flows
- team/unit/gym runtime surfaces
- dashboards
- rankings
- messaging
- evidence/export/proof claims outside v0

**Success**
- workspace exists
- status = `Workspace Created`

**Failure route**
- if entitlement or shell creation fails:
  - status = `Blocked — Commercial`

---

### Step 3 — Create coach account

**Action**
- create or activate coach user
- send invite
- confirm coach accepted invite
- assign coach permissions limited to v0

**Coach permissions in v0**
- assign within allowed system boundaries
- view athlete execution artefacts
- write non-binding notes

**Coach must not be able to**
- edit Phase 1 declarations
- override legality
- trigger engine-side substitutions directly
- mutate registries
- access other athletes without explicit linkage

**Success**
- coach account is active
- status = `Coach Active`

**Failure route**
- if invite not accepted or permissions invalid:
  - status = `Blocked — Platform`

---

### Step 4 — Create athlete account

**Action**
- create or activate athlete user
- send invite
- confirm athlete accepted invite

**Success**
- athlete account is active
- status = `Athlete Active`

**Failure route**
- if invite not accepted:
  - status = `Blocked — Platform`

---

### Step 5 — Create explicit coach ↔ athlete link

**Action**
- create link record with:
  - coach_id
  - athlete_id
  - link_state
  - created_at
  - revoked_at (nullable)

**Rules**
- relationship must be explicit
- no inferred coach ownership
- no engine dependence on this relationship record
- visibility must be scoped to the linked athlete only

**Success**
- link accepted
- status = `Link Accepted`

**Failure route**
- if relationship not accepted or visibility is incorrect:
  - status = `Blocked — Platform`

---

### Step 6 — Lock pilot scope to v0

**Action**
- confirm pilot sits inside active v0 boundaries

**Allowed activities**
- powerlifting
- rugby_union
- general_strength

**Allowed actors**
- individual_user
- coach

**Allowed execution scopes**
- individual
- coach_managed

**Not allowed in this runbook**
- org_managed execution
- team/unit/gym/org runtime
- Phase 7
- Phase 8
- evidence sealing
- proof-complete export language

**Success**
- scope recorded and accepted
- status = `Scope Locked`

**Failure route**
- if requested pilot scope exceeds v0:
  - stop
  - park out-of-scope asks for later release
  - status = `Blocked — Platform`

---

### Step 7 — Send Phase 1 onboarding request

**Action**
- send athlete onboarding request
- request only lawful Phase 1 declarations
- keep collection closed-world

**Must collect only what the engine may legally read**
- consent
- required authority fields
- activity declaration
- execution scope
- context / equipment declarations
- presentation flags
- explicit constraints

**Must not**
- infer missing fields
- collect advisory free text as engine truth
- use manual ops judgment to “fill gaps”

**Success**
- onboarding requested
- status = `Phase 1 Pending`

**Failure route**
- if onboarding flow breaks:
  - status = `Blocked — Declaration`

---

### Step 8 — Validate and accept Phase 1

**Action**
- validate submitted declaration against Phase 1 law and schema
- accept only if all required checks pass

**Hard fail conditions include**
- unknown fields
- missing required fields
- invalid actor type
- invalid execution scope
- invalid activity
- invalid equipment/profile reference
- consent failure
- missing governing authority when required

**Rules**
- no defaults
- no inference
- no correction
- no silent coercion

**Success**
- lawful declaration accepted
- canonical Phase 1 input exists
- status = `Phase 1 Accepted`

**Failure route**
- reject submission
- return user to declaration correction
- status = `Blocked — Declaration`

---

### Step 9 — Compile first executable session

**Action**
- pass accepted Phase 1 into engine
- execute:
  - canonicalisation and hashing
  - constraint resolution
  - enumeration
  - selection / materialisation
- generate first executable session if lawful

**Rules**
- empty solution space is valid
- operators must not improvise a workaround
- commercial/platform metadata must not affect compile outcome

**Success**
- first executable session exists
- status = `Compilation Passed`

**Failure route**
- if Phase 1 is accepted but compile fails:
  - status = `Blocked — Compile`

---

### Step 10 — Expose coach-ready surface

**Action**
- expose to coach:
  - assigned athlete
  - first executable session
  - factual artefact view
  - history counts where available
  - non-binding note entry

**Must not expose**
- declaration editing
- legality override
- engine override
- registry access
- out-of-scope dashboards or org surfaces

**Success**
- coach can operate within v0 boundaries
- status = `Coach Ready`

---

## Done definition

A pilot is **Coach Ready** only when all checks below are true:

- [ ] payment confirmed
- [ ] workspace created
- [ ] coach active
- [ ] athlete active
- [ ] coach ↔ athlete link accepted
- [ ] v0 scope locked
- [ ] Phase 1 accepted
- [ ] first session compiled
- [ ] coach can view artefact
- [ ] coach can add non-binding note
- [ ] no illegal surface exposed
- [ ] engine output unchanged by payment/org/presentation state

---

## Block handling

### Blocked — Commercial
Use when:
- payment missing
- entitlement missing
- pilot shell not activated
- seat/cap issue prevents access

Resolution owner:
- founder / ops

### Blocked — Platform
Use when:
- coach invite not accepted
- athlete invite not accepted
- link not accepted
- permissions or visibility incorrect
- requested pilot scope exceeds v0

Resolution owner:
- ops / product

### Blocked — Declaration
Use when:
- onboarding flow failed
- Phase 1 invalid
- required fields missing
- invalid references or unlawful values present

Resolution owner:
- athlete for resubmission
- ops for flow fault
- product/eng only if system bug

### Blocked — Compile
Use when:
- lawful Phase 1 accepted but no executable session can be produced
- deterministic compile fails
- solution space is empty

Resolution owner:
- product / eng
- not coach
- not ops improvisation

---

## Non-goals

This runbook does not:
- define commercial pricing
- widen v0 scope
- create org-managed runtime
- permit proof-complete claims
- let coaches alter engine truth
- replace engineering diagnosis when compile fails

---

## Notes for implementation

Recommended operational ownership split:

- Commercial owner:
  - payment
  - entitlement
  - workspace activation

- Ops owner:
  - account creation
  - invite flow
  - linkage
  - scope lock
  - state progression

- Engine owner:
  - Phase 1 validation
  - compile path
  - deterministic output

Do not collapse these layers into one “ready” button unless the system still preserves the boundary between:
- payment/access
- platform relationships
- engine truth

---

## Final rule

If the pilot is paid but:
- no explicit relationship exists,
- no lawful Phase 1 exists,
- or no executable session exists,

then the pilot is **not** coach ready.

Payment starts the runbook.
Phase 1 starts the engine.
Compilation makes the pilot operable.
Only then may the coach be considered ready.
