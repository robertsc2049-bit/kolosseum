# P201 — Pilot Failure / Recovery Closure

- Document ID: P201
- Title: Pilot Failure / Recovery Closure
- Owner: Founder / Ops / Product
- Status: Draft
- Release Applicability: v0 Deterministic Execution Alpha
- Engine Compatibility: EB2-1.0.0
- Rewrite Policy: Rewrite-only
- Last Updated: 2026-04-21

## Target

Package the exact recovery paths for the failures that will actually happen in a first pilot.

## Invariant

Every common failure has a documented bounded response that stays inside v0 truth and authority rules.

## Proof

- runbook
- failure matrix
- no improvisation language

## Why now

A product is not ready when the happy path works once. It is ready when failure handling is bounded.

## Scope

This document covers only real first-pilot failures that are expected in v0 operation.

In scope:
- invite not accepted
- Phase 1 incomplete
- compile fails
- assignment confusion
- partial session / split confusion
- coach expects extra authority
- athlete expects unsupported feature
- pilot paused / stopped

Out of scope:
- net-new product design
- unsupported feature invention
- authority expansion
- sales exception handling before payment
- post-v0 runtime surfaces
- Phase 7 truth projection
- Phase 8 evidence sealing

## Canonical recovery rule

When failure occurs, the operator must route to the documented bounded response for that failure class. The operator may not invent new workflow steps, grant hidden authority, edit lawful truth, or promise unsupported features. If the documented recovery path cannot resolve the issue inside v0, the lawful answer is HOLD, PAUSE, or STOP.

## Global recovery constraints

- Phase 1 is the only lawful truth entry point
- payment is commercial/access state, not engine truth
- coach authority remains observational only
- operator may coordinate but may not invent missing truth
- unsupported features must never be simulated as if live
- blocked or paused state is lawful; improvisation is not

## Exact failure runbook

### Failure 1 — Invite not accepted

**Trigger**
- coach invite not accepted
- athlete invite not accepted
- invite expired, bounced, or sent to wrong recipient

**Immediate bounded response**
- stop forward progress at the current pending state
- verify recipient identity and destination
- resend or replace invite only after recipient correctness is confirmed
- do not skip the acceptance step

**Allowed operator actions**
- resend invite
- correct recipient details
- record current blocked state
- notify the relevant person of the required next action

**Forbidden operator actions**
- marking account active without activation evidence
- bypassing link or invite acceptance
- moving the pilot forward based on verbal intent alone

**Recovery exit condition**
- required account is active and acceptance evidence is present

**State rule**
- hold in `coach_blocked`, `athlete_blocked`, or `link_blocked` until resolved

### Failure 2 — Phase 1 incomplete

**Trigger**
- declaration missing required fields
- declaration not accepted
- declaration asks for path outside v0 scope

**Immediate bounded response**
- stop at `phase1_pending` or `phase1_blocked`
- request completion or lawful correction through Phase 1 only
- do not edit the declaration on behalf of the athlete
- do not infer missing truth

**Allowed operator actions**
- point the athlete back to the lawful declaration surface
- explain which field or scope item is incomplete
- confirm whether the requested path is inside v0

**Forbidden operator actions**
- editing truth directly
- filling in missing declaration values from chat or memory
- accepting out-of-scope requests into active v0

**Recovery exit condition**
- accepted lawful Phase 1 declaration exists

**State rule**
- hold in `phase1_blocked` until lawful declaration is accepted

### Failure 3 — Compile fails

**Trigger**
- first executable session does not compile
- compile returns failure
- compile succeeds technically but no executable session exists

**Immediate bounded response**
- stop at `compile_pending` or `compile_blocked`
- record exact compile failure evidence
- retry only after the blocking cause is corrected
- do not handwave coach-ready status

**Allowed operator actions**
- capture compile error/output
- verify current scope and accepted Phase 1 truth
- rerun compile after correction

**Forbidden operator actions**
- marking compile complete without executable output
- manually fabricating an executable session
- using undocumented founder-only workarounds

**Recovery exit condition**
- successful compile result exists and first executable session is present

**State rule**
- hold in `compile_blocked` until compile is proven successful

### Failure 4 — Assignment confusion

**Trigger**
- coach does not understand what has been assigned
- athlete cannot tell whether a session is assigned or self-run
- operator cannot determine the current assignment state from the surface

**Immediate bounded response**
- stop any verbal interpretation drift
- use only the factual assignment surface and factual artefacts
- restate what is actually assigned, by whom, and what state it is in

**Allowed operator actions**
- show the factual assignment state
- restate coach-managed versus individual scope
- direct the user back to the canonical assigned session surface

**Forbidden operator actions**
- inventing hidden assignment states
- treating coach commentary as engine truth
- using advisory language as if it changes execution state

**Recovery exit condition**
- all parties can identify the current factual assignment state from canonical surfaces

**State rule**
- remain in current lawful state; this is a clarification recovery, not a hidden state transition

### Failure 5 — Partial session / split confusion

**Trigger**
- athlete exits mid-session
- athlete returns and does not understand continue versus skip
- coach expects catch-up logic or non-factual interpretation

**Immediate bounded response**
- keep the session factual
- route the athlete through the bounded split/return path only
- explain the available decision exactly as implemented

**Allowed operator actions**
- restate 'Continue where I left off' versus 'Skip and move on'
- confirm the resulting session state is partial/factual only
- refer to the manual runtime proof and current session behaviour

**Forbidden operator actions**
- promising hidden catch-up logic not in v0
- reclassifying partial completion as a coaching judgement
- interpreting the partial session as readiness or adherence

**Recovery exit condition**
- athlete completes one bounded return choice and the session remains factual

**State rule**
- remain inside the current execution path; no authority expansion is allowed

### Failure 6 — Coach expects extra authority

**Trigger**
- coach expects legality override
- coach expects direct substitution override
- coach expects direct progression override
- coach expects ability to edit Phase 1 truth

**Immediate bounded response**
- stop the request at the boundary
- restate the coach authority limit
- route back to lawful v0 surfaces only

**Allowed operator actions**
- show the coach boundary pack
- explain that the coach may assign, view factual artefacts, and write non-binding notes only
- direct truth changes back to lawful Phase 1 declaration where relevant

**Forbidden operator actions**
- granting temporary exception authority
- making undocumented founder promises
- manually altering truth to satisfy the request

**Recovery exit condition**
- coach accepts bounded v0 authority and continues within the allowed surface

**State rule**
- no state change required unless the misunderstanding blocks pilot operation; if blocking, record as operational hold

### Failure 7 — Athlete expects unsupported feature

**Trigger**
- athlete asks for messaging, analytics, rankings, readiness scoring, or other excluded features
- athlete expects feature behaviour that is not live in v0

**Immediate bounded response**
- state that the feature is not part of v0
- redirect the athlete to the supported v0 path
- do not imply that excluded features are effectively available

**Allowed operator actions**
- show the current 'not included in v0' boundary pack
- explain the supported surface that does exist now
- record the expectation as out of scope where useful

**Forbidden operator actions**
- promising near-term availability as if already live
- using manual/operator workaround to mimic the excluded feature
- drifting into analytics/advisory interpretation

**Recovery exit condition**
- athlete either continues within supported v0 scope or the pilot is paused/stopped lawfully

**State rule**
- no hidden feature expansion; unsupported remains unsupported

### Failure 8 — Pilot paused / stopped

**Trigger**
- pilot cannot continue operationally
- commercial or operational hold is required
- participant disengages or requests stop

**Immediate bounded response**
- classify as `paused` or `stopped` explicitly
- record why forward operation is not continuing
- preserve factual current state and artefacts

**Allowed operator actions**
- mark `paused` when recovery is expected
- mark `stopped` when the pilot is ended
- record next owner and next action when paused

**Forbidden operator actions**
- pretending the pilot remains active
- continuing hidden work while status remains inaccurate
- discarding factual state history

**Recovery exit condition**
- for `paused`: blocker cleared and re-entry occurs through the canonical state
- for `stopped`: no recovery; state is terminal for this pilot path

**State rule**
- `paused` is recoverable
- `stopped` is terminal

## Failure matrix

| Failure | Detect at state | Lawful response | Hold class | Recovery proof |
|---|---|---|---|---|
| Invite not accepted | coach_pending / athlete_pending / link_pending | stop and correct invite path only | coach_blocked / athlete_blocked / link_blocked | accepted invite and active account/link |
| Phase 1 incomplete | phase1_pending | return to lawful declaration completion only | phase1_blocked | accepted lawful Phase 1 declaration |
| Compile fails | compile_pending | record failure and retry only after correction | compile_blocked | successful compile plus executable session |
| Assignment confusion | coach_ready / active path | use factual assignment surfaces only | operational hold if needed | factual assignment state understood from canonical surfaces |
| Partial session / split confusion | active execution path | use bounded continue/skip flow only | operational hold if needed | factual split/return decision completed |
| Coach expects extra authority | any coached path | restate boundary and refuse authority expansion | operational hold if blocking | coach continues within allowed authority |
| Athlete expects unsupported feature | any pilot path | restate exclusion and route to supported path | operational hold / pause if blocking | athlete continues inside supported v0 or pilot paused/stopped lawfully |
| Pilot paused / stopped | any live operational state | classify explicitly and preserve factual state | paused / stopped | paused blocker cleared or stopped recorded terminally |

## No-improvisation rule

The following responses are forbidden in v0 recovery handling:

- 'We will just do this manually for now' when that changes truth or authority
- 'Treat it as complete' without the required evidence
- 'Assume the coach can do that this once'
- 'The athlete probably meant X so we will use X'
- 'This feature is basically there even though it is not live'
- 'Founder approved it verbally so move ahead'

If the documented bounded response does not solve the issue inside v0 rules, the lawful answer is HOLD, PAUSE, or STOP.

## Required operator artefacts referenced by this slice

- P199 v0 completion gate
- P200 first paid pilot operational closure
- current coach boundary pack
- current not-included-in-v0 boundary pack
- current neutral summary contract
- current manual runtime proof checklist

## Closure test

This slice is GREEN only if all statements below are true:

- every common first-pilot failure listed in scope has one bounded response
- every response stays inside v0 truth and authority rules
- no response requires founder improvisation
- no response expands coach authority
- no response fakes unsupported features
- every failure can end in recover / hold / pause / stop lawfully

## Final rule

If a common first-pilot failure still depends on undocumented judgement, founder memory, hidden authority, or fake feature behaviour, failure handling is not closed and v0 is not operationally ready.