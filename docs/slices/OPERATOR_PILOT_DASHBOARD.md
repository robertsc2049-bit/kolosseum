<!-- DEV NOTE: Developer documentation surface. This document explains repo behaviour or boundaries, but canonical law remains in the tracked contracts, guards, and tests. Keep docs aligned with executable checks. -->

# S41 - Operator Pilot Dashboard

Document: OPERATOR_PILOT_DASHBOARD.md
Project: Kolosseum v0
Slice: S41
Status: Implementable specification
Scope: Operator-only factual pilot control surface
Engine compatibility: EB2-1.0.0
Rewrite policy: Rewrite-only

## 1. Purpose

S41 defines the implementable Operator Pilot Dashboard for Kolosseum v0.

The dashboard exists to let an authorised operator view the factual operational state of a pilot and identify the next operational action required to progress the pilot toward coach-operable execution.

The dashboard is a factual operator control surface. It does not interpret athlete output, infer human state, rank users, expose aggregate product surfaces, or alter engine truth.

## 2. Binding Scope

The dashboard is permitted only as a factual operator surface.

It may show:

- pilot_id
- coach
- athlete
- workspace status
- payment/access status
- coach account status
- athlete account status
- coach-athlete link status
- scope status
- Phase 1 declaration status
- compile status
- first executable session status
- blocked reason
- next factual action

It must not show prohibited surface classes listed in the S41 data contract.

## 3. Dashboard State Principle

Dashboard state must derive from source records only.

The dashboard must not calculate hidden meaning from partial data.

If a required source record is missing, ambiguous, duplicated, malformed, unreadable, or contains an unsupported enum, the affected state must be unknown.

Unknown state fails closed.

coach_ready must never appear when any required state is unknown.

## 4. Required Source Records

The dashboard may read only platform records required to render factual pilot operation state.

Required source records:

- pilot record
- workspace record
- payment/access entitlement record
- coach user/account record
- athlete user/account record
- coach-athlete link record
- v0 scope lock record
- accepted Phase 1 declaration record
- latest compile attempt record
- first executable session record

Forbidden source record classes for dashboard state derivation are listed as coded classes in the API contract.

## 5. Controlled Status Enums

### 5.1 Dashboard Status

Allowed values:

- blocked
- in_progress
- coach_ready
- unknown

Rules:

- coach_ready may appear only when every required precondition is true.
- blocked appears when one controlled blocked reason other than none applies.
- in_progress appears when no hard block exists but at least one required precondition remains incomplete.
- unknown appears when deterministic state cannot be derived from source records.

### 5.2 Workspace Status

Allowed values:

- created
- missing
- unknown

### 5.3 Payment / Access Status

Allowed values:

- access_active
- access_missing
- access_suspended
- unknown

Payment/access state is a platform access condition only.

It must not alter:

- engine legality
- Phase 1 validity
- compile legality
- deterministic output
- session artefacts

### 5.4 Account Status

Allowed values:

- active
- invited
- missing
- disabled
- unknown

Used independently for coach and athlete accounts.

### 5.5 Coach-Athlete Link Status

Allowed values:

- invited
- accepted
- revoked
- expired
- rejected
- missing
- unknown

Only accepted satisfies the coach-managed execution precondition.

### 5.6 Scope Status

Allowed values:

- locked_v0
- pending
- invalid
- unknown

locked_v0 means the pilot is explicitly limited to:

- actors: individual_user, coach
- execution scopes: individual, coach_managed
- activities: powerlifting, rugby_union, general_strength
- phases: phase1, phase2, phase3, phase4, phase5, phase6

Any broader runtime scope makes the status invalid.

### 5.7 Phase 1 Declaration Status

Allowed values:

- accepted
- pending
- missing
- rejected
- version_mismatch
- unknown

Only accepted satisfies the compile admission precondition.

### 5.8 Compile Status

Allowed values:

- not_started
- passed
- failed
- blocked
- unknown

Only passed satisfies the first executable session precondition.

### 5.9 First Executable Session Status

Allowed values:

- exists
- missing
- not_applicable
- unknown

not_applicable is allowed only when compile has not passed.

## 6. Controlled Blocked Reason Enum

Exactly one blocked reason must be returned.

Allowed values:

- none
- payment_missing
- payment_suspended
- workspace_missing
- coach_account_missing
- coach_account_inactive
- athlete_account_missing
- athlete_account_inactive
- coach_athlete_link_missing
- coach_athlete_link_not_accepted
- scope_not_locked
- scope_invalid
- phase1_declaration_missing
- phase1_declaration_not_accepted
- compile_not_started
- compile_failed
- first_executable_session_missing
- source_state_unknown

Priority order:

1. source_state_unknown
2. payment_missing
3. payment_suspended
4. workspace_missing
5. coach_account_missing
6. coach_account_inactive
7. athlete_account_missing
8. athlete_account_inactive
9. coach_athlete_link_missing
10. coach_athlete_link_not_accepted
11. scope_invalid
12. scope_not_locked
13. phase1_declaration_missing
14. phase1_declaration_not_accepted
15. compile_failed
16. compile_not_started
17. first_executable_session_missing
18. none

The priority order prevents ambiguous dashboard state.

## 7. Coach Ready Rule

coach_ready may appear only when all conditions are true:

- payment_access_status is access_active
- workspace_status is created
- coach_account_status is active
- athlete_account_status is active
- coach_athlete_link_status is accepted
- scope_status is locked_v0
- phase1_declaration_status is accepted
- compile_status is passed
- first_executable_session_status is exists
- blocked_reason is none

If any field is unknown, coach_ready is forbidden.

## 8. Dashboard Data Contract

The machine-readable data contract lives at:

contracts/operator/operator_pilot_dashboard.contract.json

The contract is closed-world:

- additionalProperties is false
- all required dashboard fields are explicit
- blocked reason is a controlled enum
- status values are controlled enums
- next factual action is represented by copy ID, not inline text
- source record refs are required

## 9. API Contract

The machine-readable API contract lives at:

contracts/operator/operator_pilot_dashboard.api.json

Route:

GET /api/operator/pilots/{pilot_id}/dashboard

Access:

Only authenticated operator users with operator pilot access may call this endpoint.

Forbidden:

- coach access
- athlete access
- public access
- broader platform entity access in v0

Transport errors:

- unauthenticated: 401
- operator access missing: 403
- invalid pilot ID: 400
- pilot not found: 404

Unknown source state must not return transport failure unless the API cannot execute. Unknown source state is represented inside a valid 200 response with:

- dashboard_status: unknown
- blocked_reason: source_state_unknown

## 10. UI Layout

### 10.1 Page Title

Copy ID:

operator_dashboard.title

Rendered text:

Operator pilot dashboard

### 10.2 Header Fields

Display:

- Pilot ID
- Coach
- Athlete
- Pilot status

### 10.3 Status Grid

Render as a fixed factual grid:

- workspace status
- payment/access status
- coach account status
- athlete account status
- coach-athlete link status
- scope status
- Phase 1 declaration status
- compile status
- first executable session status

Each cell displays:

- label copy ID
- value copy ID
- source record ref

### 10.4 Blocked Panel

Visible when blocked_reason is not none.

Panel fields:

- blocked reason
- next factual action

### 10.5 Coach Ready Panel

Visible only when:

- dashboard_status is coach_ready
- blocked_reason is none

Displayed text:

Coach ready

No extra valenced wording is permitted.

## 11. Derivation Algorithm

Input:

- source records for one pilot_id

Steps:

1. Validate that all required source lookups return zero or one record.
2. If any lookup errors, duplicate records, malformed records, or unsupported enum values exist:
   - set dashboard_status to unknown
   - set blocked_reason to source_state_unknown
   - set next_factual_action to operator_dashboard.next_action.review_source_state
   - stop
3. Derive each dashboard status from its matching source record.
4. Select blocked_reason using the controlled priority order.
5. If blocked_reason is not none:
   - set dashboard_status to blocked
   - set next_factual_action from the blocked reason mapping
   - stop
6. If all Coach Ready preconditions are true:
   - set dashboard_status to coach_ready
   - set next_factual_action to operator_dashboard.next_action.none
   - stop
7. Otherwise:
   - set dashboard_status to in_progress
   - set next_factual_action to the first incomplete factual action by priority order

## 12. Copy Surface

The machine-readable copy surface lives at:

copy/operator/operator_pilot_dashboard.copy.json

Rules:

- User-facing text must use copy IDs.
- Next actions must be factual and operational.
- Copy must not contain prohibited claim classes.
- Copy must not refer to broader platform runtime.

## 13. Tests

The executable tests live at:

tests/operator/operator_pilot_dashboard.test.mjs

Required test coverage:

- all preconditions true returns coach_ready
- unknown source state fails closed
- blocked reason is controlled enum
- priority order is deterministic
- link invited is not accepted
- scope invalid blocks
- Phase 1 pending is not accepted
- compile failed blocks
- first executable session missing blocks after compile pass
- extra fields are rejected by contract checks
- inline next action strings are rejected
- prohibited copy language is rejected
- broader runtime fields are rejected
- payment/access changes must not alter engine state assumptions

## 14. Implementation Notes

The dashboard resolver must be a pure derivation layer over platform records.

It must not:

- call the engine
- compile
- mutate Phase 1 declarations
- create coach-athlete links
- create executable sessions
- mutate payment/access state
- read coach notes text for status derivation
- read prohibited state source classes
- create advisory state

It may return the next factual action copy ID, but it must not perform the action.

## 15. Final Acceptance Criteria

S41 is accepted only if:

- dashboard state derives from source records
- unknown state fails closed
- blocked reason is one controlled enum
- Coach Ready appears only when all preconditions are true
- prohibited surface classes are absent
- next action wording is operational and factual
- copy surface uses copy IDs
- API contract has no extra fields
- negative tests cover boundary violations
