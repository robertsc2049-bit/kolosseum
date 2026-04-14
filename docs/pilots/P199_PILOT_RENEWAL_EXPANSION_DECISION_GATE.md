# P199 — Pilot Renewal / Expansion Decision Gate

## Slice contract
- Target: exact rule set for whether an active coach pilot should renew, expand, or stop.
- Invariant: decision uses lawful factual criteria only.
- Proof: output is based on explicit counts, explicit scope state, explicit blockers, and explicit commercial fit only.

## Why this exists
This gate converts a first pilot into the next commercial decision without inventing outcomes, implying success, or drifting into advisory language.

It is a commercial decision surface, not a coaching judgement, not a performance assessment, and not an engine truth layer.
Commercial constructs may limit access and seat count, but they must not change execution truth.

## v0 boundary lock
This gate is limited to current v0 reality:
- individual_user and coach only
- individual and coach_managed execution only
- powerlifting, rugby_union, and general_strength only
- Phase 1 through Phase 6 only
- onboarding, compilation, factual session execution, split/return, partial completion, factual artefact viewing, counts-only history, coach assignment, and non-binding coach notes only

This gate must not claim or imply:
- improvement
- success
- effectiveness
- readiness
- safety
- compliance
- optimisation
- performance outcomes
- replay or evidence access for coach pilots
- dashboards or analytics beyond lawful factual counts

## Allowed inputs only
The decision gate may use only the following categories.

### A. Scope fit facts
- pilot tier
- athlete cap
- active linked athletes
- whether current linked athletes are within cap
- whether coach role and surface used matches current v0 coach surface

### B. Activation facts
- number of linked athletes
- number of accepted Phase 1 declarations
- number of athletes with at least one compiled session
- number of athletes with at least one started session
- number of athletes with at least one completed session

### C. Usage facts
- sessions assigned
- sessions started
- sessions completed
- partial completions
- split / return events
- substitution events
- coach notes added

### D. Blocker facts
- declaration pending
- compile blocked
- link not accepted
- athlete cap reached
- payment status for renewal period
- pilot owner decision pending
- coach seat or athlete seat mismatch

### E. Commercial fit facts
- current cap reached or not reached
- additional named athletes waiting to be added
- current pilot still inside declared scope
- next paid period accepted or not accepted

## Forbidden inputs
Do not use:
- improvement claims
- success claims
- value claims not tied to explicit commercial acceptance
- athlete results
- readiness or fatigue language
- behavioural scoring
- engagement interpretation
- compliance framing
- inferred satisfaction
- inferred retention likelihood
- inferred product-market fit
- advice or recommendation language framed as engine truth

Forbidden wording includes:
- improving
- successful
- working well
- high engagement
- low engagement
- compliant
- non-compliant
- ready
- safer
- better
- optimal
- effective
- likely to renew
- should renew because
- should expand because

## Decision classes

### 1. RENEW
Use **RENEW** only when all are true:
- current pilot remains within current v0 scope
- payment / commercial continuation is available for the next period
- at least one athlete has an accepted declaration
- at least one athlete has at least one compiled session
- no unresolved blocker exists that prevents continued lawful use for the currently linked pilot set

Meaning:
Continue current pilot at current scope.

### 2. EXPAND
Use **EXPAND** only when all are true:
- all conditions for **RENEW** are true
- current pilot is at cap, or named additional athletes cannot be added within current cap
- requested expansion remains inside lawful current v0 scope
- expansion requested is commercial or access expansion only, not engine-authority expansion

Meaning:
Continue pilot and increase permitted commercial scope, usually athlete capacity.

### 3. STOP
Use **STOP** if any of the following is true:
- renewal payment or continuation is not accepted
- no accepted declarations exist and pilot is not progressing past onboarding
- no compiled sessions exist and pilot cannot lawfully move forward
- unresolved blockers prevent continued lawful use
- requested next step depends on excluded v0 features or non-v0 runtime

Meaning:
Do not continue the pilot into a further paid period at this time.

## Hard rules
- **RENEW** is not "pilot succeeded."
- **EXPAND** is not "pilot proved outcomes."
- **STOP** is not "pilot failed athletes."
- The gate records only whether continued paid use at the next decision point is supported by explicit lawful facts.

## Canonical operator template

**Pilot:** [Pilot Name]  
**Coach:** [Coach Name]  
**Decision date:** [DD MMM YYYY]  
**Current tier:** [Coach 6 / Coach 16 / Coach 32 / Coach 64 / Coach 120 / Coach 250]  
**Decision:** [RENEW / EXPAND / STOP]

### 1) Factual decision inputs
- Athlete cap: [X]
- Active linked athletes: [X]
- Accepted declarations: [X]
- Athletes with compiled session: [X]
- Athletes with started session: [X]
- Athletes with completed session: [X]
- Sessions assigned: [X]
- Sessions started: [X]
- Sessions completed: [X]
- Partial completions: [X]
- Split / return events: [X]
- Substitutions: [X]
- Coach notes added: [X]
- Additional athletes waiting for access: [X]
- Renewal payment / continuation accepted: [Yes / No]
- Current blockers: [None / listed factual blockers]

### 2) Gate checks
- Within current v0 scope: [Yes / No]
- Within current athlete cap: [Yes / No]
- At least one accepted declaration exists: [Yes / No]
- At least one compiled session exists: [Yes / No]
- Continued lawful use currently possible: [Yes / No]
- Additional commercial scope requested: [Yes / No]
- Requested expansion stays inside v0: [Yes / No]

### 3) Decision output
- **RENEW** when: current scope remains lawful and commercially continued, with explicit accepted declaration and compiled-session presence, and no blocker prevents continued use.
- **EXPAND** when: renewal conditions are met and current cap blocks named additional athletes or requested access growth within v0.
- **STOP** when: continuation is not commercially accepted, or lawful continued use is blocked, or the requested next step depends on excluded scope.

### 4) Decision basis note
- [Single factual sentence only.]

## Short-form version

**Pilot renewal / expansion gate — [Pilot Name] — [DD MMM YYYY]**

- Current tier: [X]
- Active linked athletes: [X] / [Cap]
- Accepted declarations: [X]
- Athletes with compiled session: [X]
- Additional athletes waiting: [X]
- Renewal payment / continuation accepted: [Yes / No]
- Current blockers: [None / blocker]

**Decision:** [RENEW / EXPAND / STOP]  
**Basis:** [Single factual sentence only.]

## Example filled version

**Pilot:** Northside Strength  
**Coach:** Jamie Carter  
**Decision date:** 14 Apr 2026  
**Current tier:** Coach 16  
**Decision:** EXPAND

### 1) Factual decision inputs
- Athlete cap: 16
- Active linked athletes: 16
- Accepted declarations: 16
- Athletes with compiled session: 16
- Athletes with started session: 12
- Athletes with completed session: 9
- Sessions assigned: 16
- Sessions started: 12
- Sessions completed: 9
- Partial completions: 2
- Split / return events: 3
- Substitutions: 2
- Coach notes added: 8
- Additional athletes waiting for access: 5
- Renewal payment / continuation accepted: Yes
- Current blockers: athlete cap reached for named additional athletes

### 2) Gate checks
- Within current v0 scope: Yes
- Within current athlete cap: Yes
- At least one accepted declaration exists: Yes
- At least one compiled session exists: Yes
- Continued lawful use currently possible: Yes
- Additional commercial scope requested: Yes
- Requested expansion stays inside v0: Yes

### 3) Decision output
- **Decision:** EXPAND

### 4) Decision basis note
- Current pilot is at athlete cap, continuation is accepted, and named additional athletes cannot be added within current paid scope.

## Acceptance rule
If the decision basis contains anything beyond explicit counts, explicit blocker state, explicit cap state, explicit continuation status, and explicit v0 scope fit, the gate has drifted and must be corrected.