# S25 — v0 support boundary pack

Document ID: s25_v0_support_boundary_pack
Status: Draft
Owner: Founder / Product / Ops
Release Applicability: v0 Deterministic Execution Alpha
Rewrite Policy: rewrite_only

## Target

Write the exact support and user-facing response rules for unsupported asks.

## Invariant

Users and coaches never receive language that implies capability outside current v0.

## Proof

- response templates
- escalation rules
- "not in v0" references
- allowed wording classes
- banned implication classes

## Why now

This protects commercial trust and keeps pilots inside contract.

---

## 1. v0 boundary this pack enforces

Current v0 support must treat the following as the only active surface:

- actors: individual_user and coach
- execution scopes: individual and coach_managed
- activities: powerlifting, rugby_union, general_strength
- engine phases: Phase 1 through Phase 6 only
- active product surface:
  - onboarding / declaration
  - session execution
  - history counts
  - coach assignment
  - factual artefact viewing
  - non-binding coach notes

Support must treat the following as outside current v0:

- team / club / unit / organisation runtime
- aggregate interpretation surfaces
- in-app contact surfaces
- user-state judgement surfaces
- plan-change control surfaces
- authority-bypass surfaces
- proof, envelope, or export surfaces
- Phase 7
- Phase 8

---

## 2. Support response law

### 2.1 Exact structure for unsupported asks

Every unsupported response MUST follow this order:

1. direct boundary statement
2. exact current-v0 statement
3. nearest lawful v0 alternative, if one exists
4. stop

Support MUST NOT add:

- hidden-process implication
- manual-bypass implication
- near-equivalent implication
- future-scope-as-current implication

### 2.2 Exact base template

Use this when the ask is outside current v0 and no narrower lawful surface exists:

> This is not available in current v0. Current v0 is limited to individual and coach-managed execution, factual runtime surfaces, and Phase 1–6 only. That request sits outside the current v0 boundary.

### 2.3 Exact base template with lawful redirect

Use this when the ask is outside current v0 but a narrower factual surface exists:

> This is not available in current v0. Current v0 is limited to individual and coach-managed execution, factual runtime surfaces, and Phase 1–6 only. What is available in v0 is [exact lawful surface only].

### 2.4 Exact authority-boundary template

Use this when the ask attempts to force, edit, bypass, or decide:

> That action is not available in current v0. In v0 this surface is observational only. Current v0 does not allow support, coach, or user actions that bypass declared inputs or factual outputs.

### 2.5 Exact proof-boundary template

Use this when the ask requests envelope, proof package, or export:

> This is not available in current v0. Current v0 does not include the proof-layer path. v0 can expose factual execution artefacts only.

---

## 3. Unsupported ask classes and exact replies

### 3.1 team_org_runtime

Applies to asks about:

- teams
- clubs
- units
- organisations
- group runtime
- parallel group flow
- attendance runtime
- shared entity management

Exact reply:

> This is not available in current v0. Current v0 supports individual and coach-managed execution only. Team, club, unit, and organisation runtime are outside the current v0 boundary.

Lawful redirect:

> What is available in v0 is coach assignment, athlete-specific factual artefact viewing, history counts, and non-binding coach notes.

### 3.2 aggregate_interpretation

Applies to asks about:

- dashboards
- trends with judgement
- rankings
- cross-athlete interpretation
- scoring
- predictive or evaluative summaries

Exact reply:

> This is not available in current v0. Current v0 does not include aggregate interpretation surfaces. What v0 can show is factual history and counts within the permitted scope.

Lawful redirect:

> What is available in v0 is factual execution history, counts, and artefact viewing only.

### 3.3 in_app_contact

Applies to asks about:

- chat
- direct message
- thread
- in-app conversation
- message broadcast

Exact reply:

> This is not available in current v0. Current v0 does not include in-app contact surfaces. In v0, coach input is limited to non-binding coach notes only.

Lawful redirect:

> What is available in v0 is non-binding coach notes where that surface is permitted.

### 3.4 user_state_request

Applies to asks for:

- a state score
- a session-status judgement
- a train / do-not-train judgement
- a traffic-light state
- a go / no-go judgement

Exact reply:

> This is not available in current v0. Current v0 records factual execution only and does not produce user-state judgement surfaces.

Lawful redirect:

> What is available in v0 is factual execution history, counts, and recorded runtime events.

### 3.5 plan_change_control

Applies to asks about:

- automatic plan change
- coach-triggered plan change
- next-step change control
- dynamic forward adjustment
- support-triggered program change

Exact reply:

> This is not available in current v0. Current v0 does not include plan-change control surfaces. Coach authority in v0 is observational only.

Lawful redirect:

> What is available in v0 is program assignment within system limits, factual artefact viewing, and non-binding coach notes.

### 3.6 authority_bypass

Applies to asks about:

- forcing a compile result
- forcing a different session output
- editing accepted declarations
- bypassing a blocked path
- changing factual truth after acceptance
- support-side unlock requests

Exact reply:

> That action is not available in current v0. Current v0 does not allow bypass of declared inputs, factual outputs, or engine boundaries.

Lawful redirect:

> The lawful v0 path is limited to declared inputs, compile result, execution result, and factual artefact viewing.

### 3.7 proof_export

Applies to asks about:

- export package
- audit package
- envelope
- sealed artefact
- proof download
- portability of proof artefacts

Exact reply:

> This is not available in current v0. Current v0 does not include the proof-layer path or export surfaces. v0 can expose factual execution artefacts only.

---

## 4. Escalation rules

### 4.1 Allowed escalation

Escalation is allowed only to:

- confirm whether an ask is inside or outside current v0
- route a product-boundary question
- log a future-scope request without implying current availability

### 4.2 Forbidden escalation

Support MUST NOT escalate by implying:

- manual handling can create the excluded capability
- ops can unlock the excluded capability
- engineering can bypass the excluded capability for a pilot
- a hidden route exists behind support

### 4.3 Exact escalation line

Use this line when escalation is lawful but capability is still absent:

> This sits outside current v0 scope. It can be logged as future-scope, but it is not available in current v0.

---

## 5. Exact "not in v0" reference lines

Approved short forms:

- This is not available in current v0.
- That sits outside the current v0 boundary.
- Current v0 does not include that capability.
- That capability does not exist in current v0.
- Current v0 is limited to factual execution surfaces and does not include that feature.

Approved long form:

- Current v0 is the Deterministic Execution Alpha: individual_user and coach only, individual and coach-managed execution only, three supported activities only, Phase 1–6 only, with factual execution surfaces and non-binding coach notes.

---

## 6. Allowed wording classes

Support MAY use wording from these classes:

- direct boundary statements
- factual scope statements
- actor / scope / phase limits
- observational-only statements
- factual-history statements
- factual-count statements
- non-binding-note statements
- future-scope logging statements that do not imply availability now

Approved examples:

- factual artefact
- factual history
- count
- within current v0
- outside current v0
- observational only
- non-binding coach notes
- declared inputs
- factual outputs
- not available in current v0

---

## 7. Banned wording classes

### 7.1 Raw blocked strings

This document MUST NOT duplicate the raw blocked strings already governed by CI lint artefacts under `/ci/lint/`.
Support implementation MUST treat those artefacts as the exact blocked-string source of truth.

### 7.2 Hidden-capability implication class

Support MUST NOT imply:

- a hidden route exists
- support can simulate the missing feature
- the missing feature can be manually reproduced inside v0
- the missing feature is effectively present

Disallowed examples:

- we can do that behind the scenes
- support can handle that for now
- that is effectively available
- we can reproduce that manually

### 7.3 Near-equivalent implication class

Support MUST NOT imply:

- the user is receiving an almost-the-same surface
- a narrower factual surface is a substitute for the excluded one
- the excluded feature exists under a different name

Disallowed examples:

- this is basically the same thing
- this works like that feature
- this is the same outcome through a different route

### 7.4 Boundary-softening class

Support MUST NOT imply:

- temporary permissibility
- pilot-only bypass
- one-off unlock
- commercial exception
- founder-side exception

Disallowed examples:

- we can allow it for this pilot
- we can switch that on for your account
- we can make an exception here

### 7.5 Authority inflation class

Support MUST NOT imply that support, coach, payment state, or pilot state can:

- alter legality
- alter compile truth
- alter runtime truth
- alter proof status
- alter accepted declarations after the fact

---

## 8. Operator decision rule

If the user asks for something outside current v0:

- say it is not available in current v0
- state the exact current boundary
- offer only the nearest lawful factual surface, if one exists
- stop

Do not improvise.
Do not simulate.
Do not soften.

---

## 9. Final rule

For support, silence is not permission, roadmap is not availability, and broader platform law is not current-v0 reachability. If an ask falls outside the active v0 slice, support must say so directly and must not imply a hidden process, manual bypass, or near-equivalent capability.