# S42 - Pilot State Machine Enforcement

Document: PILOT_STATE_MACHINE_ENFORCEMENT.md
Project: Kolosseum v0
Slice: S42
Status: Implementable specification
Scope: Pilot lifecycle state machine and blocked reason enforcement
Engine compatibility: EB2-1.0.0
Rewrite policy: Rewrite-only

## 1. Purpose

S42 turns the pilot lifecycle into code.

Pilot lifecycle state is no longer prose-only. A pilot must move through a controlled state machine, with blocked reasons derived from explicit platform preconditions.

The state machine is platform state only. It must not alter engine output, Phase 1 declarations, compile artefacts, deterministic execution output, or session artefacts.

## 2. Required States

The complete pilot state enum is:

- accepted
- commercial_pending
- platform_pending
- coach_pending
- athlete_pending
- link_pending
- scope_pending
- phase1_pending
- compile_pending
- coach_ready
- active
- paused
- stopped
- cancelled

No other state exists.

Unknown state fails.

## 3. Required Blocked Reasons

The complete blocked reason enum is:

- payment_missing
- workspace_missing
- coach_missing
- athlete_missing
- link_not_accepted
- scope_not_locked
- phase1_missing
- phase1_refused
- compile_failed

No other blocked reason exists.

Blocked reason is nullable only when the lifecycle state is not blocked by one of the controlled conditions.

## 4. Preconditions

The state machine derives from explicit pilot preconditions:

- commercialAccepted
- paymentAccessActive
- workspaceCreated
- coachAccountActive
- athleteAccountActive
- coachAthleteLinkAccepted
- scopeLocked
- phase1Accepted
- phase1Refused
- compilePassed
- compileFailed
- firstExecutableSessionExists
- activationSignalReceived
- pauseRequested
- stopRequested
- cancelRequested

Unknown or missing boolean fields fail closed.

## 5. State Meaning

### accepted

The pilot has been accepted for onboarding, but no later precondition has yet been enforced.

### commercial_pending

Commercial/access preconditions are incomplete.

### platform_pending

Workspace preconditions are incomplete.

### coach_pending

Coach account preconditions are incomplete.

### athlete_pending

Athlete account preconditions are incomplete.

### link_pending

Coach-athlete link preconditions are incomplete.

### scope_pending

v0 scope lock is incomplete.

### phase1_pending

Phase 1 declaration preconditions are incomplete or refused.

### compile_pending

Compile or first executable session preconditions are incomplete or failed.

### coach_ready

All commercial, platform, coach, athlete, link, scope, Phase 1, compile, and first executable session preconditions are satisfied.

### active

Coach Ready has occurred and an activation signal has been received.

### paused

An active pilot has been paused. Pause is operational only.

### stopped

The pilot has been stopped. This is terminal.

### cancelled

The pilot has been cancelled. This is terminal.

## 6. Coach Ready Rule

coach_ready requires all of the following:

- commercialAccepted is true
- paymentAccessActive is true
- workspaceCreated is true
- coachAccountActive is true
- athleteAccountActive is true
- coachAthleteLinkAccepted is true
- scopeLocked is true
- phase1Accepted is true
- phase1Refused is false
- compilePassed is true
- compileFailed is false
- firstExecutableSessionExists is true

If any prerequisite is false or unknown, coach_ready is impossible.

## 7. Active Rule

active requires:

- current state is coach_ready or paused
- all Coach Ready preconditions remain true
- activationSignalReceived is true

A pilot may not become active directly from earlier pending states.

## 8. Terminal Rule

stopped and cancelled are terminal.

Terminal states cannot resume.

Terminal state transition attempts fail closed.

## 9. Illegal Transition Rule

Illegal transitions fail.

Failure returns:

- ok: false
- error: illegal_transition
- current state
- requested state

The transition function must not silently coerce the requested state.

## 10. Unknown State Rule

Unknown current state fails.

Unknown requested state fails.

Unknown blocked reason fails.

Unknown precondition shape fails.

## 11. Blocked Reason Derivation

Blocked reason priority order:

1. payment_missing
2. workspace_missing
3. coach_missing
4. athlete_missing
5. link_not_accepted
6. scope_not_locked
7. phase1_refused
8. phase1_missing
9. compile_failed

If no blocked reason applies, blockedReason is null.

## 12. Automatic State Derivation

The automatic derivation function derives the next lawful lifecycle state from preconditions:

- cancelRequested true -> cancelled
- stopRequested true -> stopped
- commercialAccepted false or paymentAccessActive false -> commercial_pending
- workspaceCreated false -> platform_pending
- coachAccountActive false -> coach_pending
- athleteAccountActive false -> athlete_pending
- coachAthleteLinkAccepted false -> link_pending
- scopeLocked false -> scope_pending
- phase1Refused true -> phase1_pending
- phase1Accepted false -> phase1_pending
- compileFailed true -> compile_pending
- compilePassed false -> compile_pending
- firstExecutableSessionExists false -> compile_pending
- activationSignalReceived true and current state is coach_ready or active or paused -> active
- pauseRequested true and current state is active -> paused
- otherwise -> coach_ready

## 13. Legal Transition Table

| From | To | Condition |
|---|---|---|
| accepted | commercial_pending | commercial or payment/access incomplete |
| accepted | platform_pending | commercial and payment/access complete, workspace incomplete |
| accepted | coach_pending | prior preconditions complete, coach incomplete |
| accepted | athlete_pending | prior preconditions complete, athlete incomplete |
| accepted | link_pending | prior preconditions complete, link incomplete |
| accepted | scope_pending | prior preconditions complete, scope incomplete |
| accepted | phase1_pending | prior preconditions complete, Phase 1 incomplete or refused |
| accepted | compile_pending | prior preconditions complete, compile/session incomplete or failed |
| accepted | coach_ready | all Coach Ready preconditions true |
| commercial_pending | platform_pending | commercial and payment/access complete, workspace incomplete |
| commercial_pending | coach_pending | prior preconditions complete, coach incomplete |
| commercial_pending | athlete_pending | prior preconditions complete, athlete incomplete |
| commercial_pending | link_pending | prior preconditions complete, link incomplete |
| commercial_pending | scope_pending | prior preconditions complete, scope incomplete |
| commercial_pending | phase1_pending | prior preconditions complete, Phase 1 incomplete or refused |
| commercial_pending | compile_pending | prior preconditions complete, compile/session incomplete or failed |
| commercial_pending | coach_ready | all Coach Ready preconditions true |
| platform_pending | coach_pending | workspace complete, coach incomplete |
| platform_pending | athlete_pending | prior preconditions complete, athlete incomplete |
| platform_pending | link_pending | prior preconditions complete, link incomplete |
| platform_pending | scope_pending | prior preconditions complete, scope incomplete |
| platform_pending | phase1_pending | prior preconditions complete, Phase 1 incomplete or refused |
| platform_pending | compile_pending | prior preconditions complete, compile/session incomplete or failed |
| platform_pending | coach_ready | all Coach Ready preconditions true |
| coach_pending | athlete_pending | coach complete, athlete incomplete |
| coach_pending | link_pending | prior preconditions complete, link incomplete |
| coach_pending | scope_pending | prior preconditions complete, scope incomplete |
| coach_pending | phase1_pending | prior preconditions complete, Phase 1 incomplete or refused |
| coach_pending | compile_pending | prior preconditions complete, compile/session incomplete or failed |
| coach_pending | coach_ready | all Coach Ready preconditions true |
| athlete_pending | link_pending | athlete complete, link incomplete |
| athlete_pending | scope_pending | prior preconditions complete, scope incomplete |
| athlete_pending | phase1_pending | prior preconditions complete, Phase 1 incomplete or refused |
| athlete_pending | compile_pending | prior preconditions complete, compile/session incomplete or failed |
| athlete_pending | coach_ready | all Coach Ready preconditions true |
| link_pending | scope_pending | link accepted, scope incomplete |
| link_pending | phase1_pending | prior preconditions complete, Phase 1 incomplete or refused |
| link_pending | compile_pending | prior preconditions complete, compile/session incomplete or failed |
| link_pending | coach_ready | all Coach Ready preconditions true |
| scope_pending | phase1_pending | scope locked, Phase 1 incomplete or refused |
| scope_pending | compile_pending | prior preconditions complete, compile/session incomplete or failed |
| scope_pending | coach_ready | all Coach Ready preconditions true |
| phase1_pending | compile_pending | Phase 1 accepted and compile/session incomplete or failed |
| phase1_pending | coach_ready | all Coach Ready preconditions true |
| compile_pending | coach_ready | compile passed and first executable session exists |
| coach_ready | active | activation signal received |
| active | paused | pause requested |
| active | stopped | stop requested |
| active | cancelled | cancel requested |
| paused | active | activation signal received and Coach Ready preconditions still true |
| paused | stopped | stop requested |
| paused | cancelled | cancel requested |
| coach_ready | stopped | stop requested |
| coach_ready | cancelled | cancel requested |

No transition is legal from stopped or cancelled.

## 14. Implementation Artefacts

The TypeScript implementation lives at:

src/pilot/pilot_state_machine.ts

The test vectors live at:

tests/fixtures/pilot_state_machine_vectors.json

The executable tests live at:

tests/pilot/pilot_state_machine.test.mjs

## 15. Acceptance Criteria

S42 is accepted only if:

- every state is represented as code
- every blocked reason is represented as code
- every legal transition is tested
- every illegal transition is tested
- unknown current state fails
- unknown requested state fails
- Coach Ready is impossible with a missing prerequisite
- active requires Coach Ready plus activation signal
- terminal states cannot resume
- pilot state does not alter engine output