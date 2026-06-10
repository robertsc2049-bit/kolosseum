# P200 — First Paid Pilot Operational Closure

- Document ID: P200
- Title: First Paid Pilot Operational Closure
- Owner: Founder / Ops / Product
- Status: Draft
- Release Applicability: v0 Deterministic Execution Alpha
- Engine Compatibility: EB2-1.0.0
- Rewrite Policy: Rewrite-only
- Last Updated: 2026-04-21

## Target

Convert P180/P192-style pilot setup into one exact start-to-ready operator flow.

## Invariant

A paid pilot can move from payment to coach-ready with no undocumented founder decisions.

## Proof

- one exact operator checklist
- one exact state transition map
- one blocked-state handling section

## Why now

If this is not sealed, v0 is not commercially real.

## Scope

This document covers only the v0 paid pilot path from payment received through coach-ready.

In scope:
- payment received
- workspace created
- coach invited
- athlete invited
- link accepted
- scope locked
- Phase 1 accepted
- first executable session compiled
- coach ready

Out of scope:
- sales pipeline before payment
- post-coach-ready program iteration beyond first executable compile
- org/team/unit/gym runtime
- messaging systems
- dashboards / analytics / rankings / readiness scoring
- Phase 7 truth projection
- Phase 8 evidence sealing

## Canonical operational rule

The operator may only move the pilot forward when the current step evidence is present. If required evidence is missing, the pilot must remain in the current state or enter the explicit blocked state. No founder memory, implied intent, or informal side-channel approval can substitute for the required evidence.

## Exact operator checklist

Complete these steps in order. Do not skip ahead.

### Step 1 — Payment received

**Entry condition**
- pilot has been commercially agreed
- payment has been received or explicitly marked as commercially satisfied under the current pilot policy

**Operator action**
- confirm payment received status
- record pilot as commercially ready
- open or update pilot record to `commercial_pending` if not already set

**Required evidence**
- payment confirmation or explicit commercial approval recorded

**Exit condition**
- commercial readiness is true
- pilot can move to platform setup

**Failure / hold rule**
- if payment evidence is absent, do not proceed

### Step 2 — Workspace created

**Entry condition**
- commercial readiness is true
- pilot is in `commercial_pending`

**Operator action**
- create the pilot workspace
- confirm workspace exists and is accessible for the pilot flow
- move pilot to `platform_pending` if commercial is complete and workspace setup has started

**Required evidence**
- workspace created confirmation

**Exit condition**
- workspace readiness is true
- pilot can move to coach account setup

**Failure / hold rule**
- if workspace creation fails or is incomplete, hold in platform blocked state

### Step 3 — Coach invited

**Entry condition**
- workspace readiness is true
- pilot is in `platform_pending` or `coach_pending`

**Operator action**
- send coach invitation
- verify coach invitation was sent to the correct recipient
- verify coach account activates

**Required evidence**
- invitation sent
- coach account active

**Exit condition**
- coach account readiness is true
- pilot can move to athlete account setup

**Failure / hold rule**
- if invite bounces, expires, or account is not active, hold in coach blocked state

### Step 4 — Athlete invited

**Entry condition**
- coach account readiness is true
- pilot is in `coach_pending` or `athlete_pending`

**Operator action**
- send athlete invitation
- verify athlete invitation was sent to the correct recipient
- verify athlete account activates

**Required evidence**
- invitation sent
- athlete account active

**Exit condition**
- athlete account readiness is true
- pilot can move to coach-athlete link stage

**Failure / hold rule**
- if invite bounces, expires, or athlete account is not active, hold in athlete blocked state

### Step 5 — Link accepted

**Entry condition**
- coach account readiness is true
- athlete account readiness is true
- pilot is in `athlete_pending` or `link_pending`

**Operator action**
- issue or verify coach-athlete link request
- verify athlete accepted the link
- verify the correct coach-athlete relationship is active

**Required evidence**
- link acceptance confirmation

**Exit condition**
- link accepted is true
- pilot can move to scope lock

**Failure / hold rule**
- if link is not accepted or is linked to the wrong relationship, hold in link blocked state

### Step 6 — Scope locked

**Entry condition**
- link accepted is true
- pilot is in `link_pending` or `scope_pending`

**Operator action**
- confirm v0 lawful scope for the pilot
- confirm actor/scope/activity path is within v0
- lock the agreed operating scope

**Required evidence**
- scope lock recorded

**Exit condition**
- scope locked is true
- pilot can move to Phase 1 intake/declaration

**Failure / hold rule**
- if the requested pilot path is outside v0 scope, hold in scope blocked state

### Step 7 — Phase 1 accepted

**Entry condition**
- scope locked is true
- pilot is in `scope_pending` or `phase1_pending`

**Operator action**
- collect lawful Phase 1 declaration
- verify declaration submission is accepted
- do not edit or infer missing truth

**Required evidence**
- accepted Phase 1 declaration

**Exit condition**
- Phase 1 accepted is true
- pilot can move to first compile

**Failure / hold rule**
- if declaration is incomplete, invalid, or outside lawful v0 truth entry, hold in Phase 1 blocked state

### Step 8 — First executable session compiled

**Entry condition**
- Phase 1 accepted is true
- pilot is in `phase1_pending` or `compile_pending`

**Operator action**
- run compile path for first executable session
- verify compile succeeds
- verify executable session exists for the pilot path

**Required evidence**
- successful compile result
- first executable session present

**Exit condition**
- first executable session compiled is true
- pilot can move to coach-ready

**Failure / hold rule**
- if compile fails or executable session is missing, hold in compile blocked state

### Step 9 — Coach ready

**Entry condition**
- first executable session compiled is true
- pilot is in `compile_pending` or `coach_ready`

**Operator action**
- verify coach can access the bounded v0 surfaces required to operate
- verify pilot handoff materials are available
- mark coach-ready

**Required evidence**
- coach-ready confirmation

**Exit condition**
- pilot state is `coach_ready`
- operational handoff is complete

**Failure / hold rule**
- if bounded operational access is not available, remain blocked until corrected

## Exact state transition map

Canonical ordered path:

1. `accepted`
2. `commercial_pending`
3. `platform_pending`
4. `coach_pending`
5. `athlete_pending`
6. `link_pending`
7. `scope_pending`
8. `phase1_pending`
9. `compile_pending`
10. `coach_ready`

Required state-transition truth gates:

- `accepted -> commercial_pending` requires pilot acceptance and commercial handoff start
- `commercial_pending -> platform_pending` requires commercial readiness true
- `platform_pending -> coach_pending` requires workspace readiness true
- `coach_pending -> athlete_pending` requires coach account readiness true
- `athlete_pending -> link_pending` requires athlete account readiness true
- `link_pending -> scope_pending` requires link accepted true
- `scope_pending -> phase1_pending` requires scope locked true
- `phase1_pending -> compile_pending` requires Phase 1 accepted true
- `compile_pending -> coach_ready` requires first executable session compiled true

No transition may be treated as complete unless its gate is explicitly evidenced.

## Blocked-state handling

Blocked states are operational holds, not silent founder fixes. The operator must record the blocking point and stop advancement until the blocker is cleared.

### Blocked state classes
- `commercial_blocked`
- `platform_blocked`
- `coach_blocked`
- `athlete_blocked`
- `link_blocked`
- `scope_blocked`
- `phase1_blocked`
- `compile_blocked`

### Blocking rule
- when an entry condition is not met, do not progress
- when required evidence is absent, do not progress
- when the requested path exceeds v0 scope, do not progress
- when compile does not produce the first executable session, do not progress

### Minimum blocked-state record
- current state
- blocked state class
- blocker description
- evidence missing or failed
- next owner
- next action

### Recovery rule
- clear the blocker at the blocked state
- verify the missing gate is now satisfied
- re-enter the canonical path at the blocked step
- do not skip forward because of urgency

## Operator decision rules

- payment is access/commercial readiness, not engine truth
- Phase 1 is the only lawful truth entry point
- coach authority remains observational only
- operator may coordinate setup but may not invent missing truth
- blocked state is the lawful answer when evidence is incomplete

## Required artefacts for closure

- P180-style pilot setup checklist coverage
- P192-style pilot start runbook coverage
- current coach boundary pack
- current v0 exclusions pack
- current neutral summary contract
- current manual runtime proof checklist

## Operational closure test

This slice is GREEN only if all statements below are true:

- one exact operator checklist exists
- one exact state transition map exists
- one explicit blocked-state handling section exists
- payment to coach-ready can be executed from docs only
- no undocumented founder decisions are required
- no step depends on non-canonical side-channel memory

## Final rule

If any step from payment received to coach-ready requires undocumented judgement, hidden system knowledge, or founder-only intervention, this closure is not complete and v0 remains operationally incomplete.