# S30 — Pilot Launch Control Checklist

Status: v0 aligned  
Scope: founder/operator launch-day control  
Release boundary: v0 Deterministic Execution Alpha  

## Target

Launch-day checklist for founder/operator.

## Invariant

A pilot must not start unless start/hold checks, green proof, pilot cap, and rollback triggers are explicitly satisfied.

No analytics.  
No advisory language.  
No org/team/unit runtime.  
No evidence/export claims.  

## 1. Start / Hold Checklist

### Commercial access

- Payment/access confirmed
- Workspace exists
- Pilot owner assigned
- Pilot record created

If any fail: HOLD.

### Coach state

- Coach account active
- Coach role valid
- Coach authority observational only
- Coach notes non-binding only

If any fail: HOLD.

### Athlete state

- Athlete account active
- Athlete actor valid for v0
- Athlete access available

If any fail: HOLD.

### Coach-athlete link

- Link exists
- Link accepted
- Link not revoked
- Link scope valid

If any fail: HOLD.

### Phase 1 gate

- Phase 1 declaration exists
- consent_granted = true
- Required fields present
- No unknown fields
- Actor type valid
- Execution scope valid
- Activity valid

If any fail: HOLD.

### Compile gate

- First compile attempted
- Compile passed
- No failure token present
- First executable session exists
- Compile artefact preserved

If any fail: HOLD.

## 2. Green Proof Check

Required proof:

- Checklist completed
- Runbook reference exists
- CI green state confirmed
- Manual runtime proof exists
- Intake copy used is known
- Setup completion record exists
- Factual session artefact sample exists

If any proof item is missing: HOLD.

## 3. Pilot Cap Check

Required cap fields:

- max_live_pilots
- max_athletes_per_pilot
- max_total_live_athletes
- max_coaches_per_pilot
- cap_owner

Rules:

- Caps are hard
- Silent overflow is forbidden
- Cap breach blocks new starts
- Cap state must not affect engine output

If cap is missing or breached: HOLD.

## 4. Rollback Triggers

STOP if any of the following occur:

- same input produces different output
- compile occurs without valid Phase 1
- unknown Phase 1 field is accepted
- coach can override engine decisions
- coach note influences engine output
- org/team/unit/gym runtime appears
- analytics/readiness/ranking/messaging appears
- evidence/export proof claim appears
- surfaced language implies safety, suitability, readiness, optimisation, correction, recommendation, or guarantee
- CI green state cannot be shown
- pilot cap exceeded
- payment/access state changes engine behaviour

## 5. Launch Decision

### GO

All checks passed. Pilot may start.

### HOLD

One or more required checks are missing or failed. Pilot must not start.

### STOP

Rollback trigger fired. Pilot launch path is invalid.

## 6. Blocked Reason Closed Set

- commercial_access_not_confirmed
- workspace_missing
- coach_account_inactive
- athlete_account_inactive
- coach_athlete_link_missing
- coach_athlete_link_not_accepted
- scope_outside_v0
- phase1_missing
- phase1_invalid
- compile_not_attempted
- compile_failed
- first_executable_session_missing
- runtime_surface_unavailable
- green_proof_missing
- pilot_cap_missing
- pilot_cap_breached
- rollback_trigger_fired

## Final Rule

Founder memory is not a launch control system.

Artefact first.  
Launch second.