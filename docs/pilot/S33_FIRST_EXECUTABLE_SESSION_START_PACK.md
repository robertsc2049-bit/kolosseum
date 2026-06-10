# S33 — First Executable Session Start Pack

## Target

Package exact operator proof that a pilot athlete can lawfully reach and initiate their first executable session.

## Invariant

A first executable session may be started only when all of the following are true:

1. the pilot athlete has an accepted Phase 1 declaration;
2. the pilot athlete has a compiled executable session available;
3. the start action is lawful for the current actor, scope, and pilot state;
4. no blocked reason exists.

If any condition is false, the first session start does not exist.

## v0 Boundary

This pack is limited to Kolosseum v0 Deterministic Execution Alpha.

Included:
- individual_user and coach actors only;
- individual and coach_managed execution scopes only;
- Phase 1 through Phase 6 only;
- factual operator proof;
- factual session availability;
- lawful start control state;
- Phase 6 session-start runtime event.

Excluded:
- readiness;
- optimisation;
- recommendation;
- safety;
- medical or rehabilitation language;
- outcome claims;
- Phase 7 truth projection;
- Phase 8 evidence sealing;
- exportable proof envelopes;
- team, unit, gym, or organisation runtime.

## Required Proof Artefacts

### 1. Phase 1 Acceptance Proof

Required fields:
- pilot_id
- athlete_id
- actor_type
- execution_scope
- activity_id
- phase1_schema_version
- engine_compatibility
- consent_granted
- jurisdiction_acknowledged
- phase1_status
- accepted_at_utc
- phase1_acceptance_record_id

Allowed status values:
- accepted
- missing
- refused
- invalid

Start is lawful only when phase1_status is accepted, consent_granted is true, and jurisdiction_acknowledged is true.

Operator statement:
"Phase 1 accepted."

Forbidden operator statements:
- "Athlete is ready."
- "Athlete is cleared."
- "Athlete is safe to start."
- "Athlete should start."
- "Recommended to begin."

### 2. Session Availability Proof

Required fields:
- pilot_id
- athlete_id
- compile_status
- compile_record_id
- session_id
- session_available
- executable_work_items_count
- compile_failure_token

Allowed compile_status values:
- passed
- failed
- pending
- not_started

Start is lawful only when compile_status is passed, session_available is true, and compile_failure_token is null.

Operator statement:
"Executable session available."

Forbidden operator statements:
- "Best session selected."
- "Optimised session ready."
- "Ideal session generated."
- "Session is suitable."

### 3. Start Button Lawfulness Proof

Required fields:
- pilot_id
- athlete_id
- session_id
- start_control_visible
- start_control_enabled
- start_control_label
- blocked_reason
- evaluated_at_utc

Allowed start_control_label:
Start session

Start is lawful only when start_control_visible is true, start_control_enabled is true, start_control_label is "Start session", and blocked_reason is null.

Allowed blocked_reason values:
- phase1_missing
- phase1_not_accepted
- compile_not_passed
- no_session_available
- scope_violation
- link_not_accepted
- athlete_not_active
- pilot_not_coach_ready
- action_not_permitted

No other blocked reasons are allowed in this pack.

### 4. First Start Action Proof

Required fields:
- pilot_id
- athlete_id
- session_id
- action
- actor
- action_accepted
- rejected_reason
- event_id
- event_type
- occurred_at_utc

Allowed action:
start_session

Allowed event_type:
session_started

A lawful start action must have action start_session, action_accepted true, rejected_reason null, and event_type session_started.

Operator statement:
"Session start recorded."

Forbidden operator statements:
- "Execution proven."
- "Evidence sealed."
- "Athlete completed proof."
- "Lawful run proven."

## Operator State Snapshot

A pilot athlete is start-ready only when:
- pilot_status is coach_ready
- athlete_status is active
- phase1_status is accepted
- compile_status is passed
- session_available is true
- start_control_enabled is true
- blocked_reason is null

## Failure Rules

| Condition | Required blocked_reason |
|---|---|
| Phase 1 record missing | phase1_missing |
| Phase 1 exists but is not accepted | phase1_not_accepted |
| Compile has not passed | compile_not_passed |
| No executable session exists | no_session_available |
| Execution scope is invalid | scope_violation |
| Coach-managed link is missing or not accepted | link_not_accepted |
| Athlete account is not active | athlete_not_active |
| Pilot has not reached coach_ready | pilot_not_coach_ready |
| Actor is not permitted to start the session | action_not_permitted |

No fallback is permitted.
No manual override is permitted.
No advisory copy is permitted.

## Minimum Demonstration Record

A valid S33 demonstration record must contain:
- slice: S33
- proof_name: first_executable_session_start
- pilot_id: pilot_manual_v0_001
- athlete_id: athlete_manual_v0_001
- phase1_status: accepted
- compile_status: passed
- session_available: true
- start_control_label: Start session
- start_control_enabled: true
- blocked_reason: null
- action: start_session
- action_accepted: true
- event_type: session_started

## Acceptance Checklist

S33 passes only if:
- Phase 1 acceptance proof exists.
- Session availability proof exists.
- Start control lawfulness proof exists.
- First start action proof exists.
- Blocked reasons are closed-world.
- The only enabled start label is "Start session".
- The start action creates a factual session_started runtime event.
- No readiness, safety, suitability, recommendation, optimisation, medical, evidence, export, or proof-complete language appears.
- The pack remains inside Phase 1 through Phase 6.

## Final Operator Sentence

"A pilot athlete with accepted Phase 1 and an available executable session can lawfully start the first session, producing a factual session_started event."

## Final Rule

If the declaration is not accepted, the session is not available, or the start button is not lawful, the first executable session start does not exist.