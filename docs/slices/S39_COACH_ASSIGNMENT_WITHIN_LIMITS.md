# S39 — Coach Assignment Within Limits

Document status: v0 slice specification  
Slice: S39  
Title: Coach Assignment Within Limits  
Engine compatibility: EB2-1.0.0  
Release scope: Kolosseum v0 Deterministic Execution Alpha  
Rewrite policy: rewrite-only  
Scope class: closed-world  

## 1. Purpose

This document defines the v0 platform semantics, database model, API contract, permission rules, and negative tests for coach assignment within limits.

Coach assignment is a platform access and visibility action only.

A coach assignment may expose an already-existing lawful session or compiled artefact to an athlete when, and only when, the coach has an accepted active coach-athlete link and the action remains within active tier limits.

Coach assignment must never create, modify, recompile, reselect, substitute, progress, repair, enrich, explain, or validate engine output.

## 2. Binding v0 Boundary

Kolosseum v0 permits coach-managed execution only inside the v0 boundary.

The active v0 boundary is:

- actor types: individual_user and coach only
- execution scopes: individual and coach_managed only
- activities: powerlifting, rugby_union, general_strength only
- active engine phases: Phase 1 through Phase 6 only
- permitted coach surface: assign, view factual artefacts, and write non-binding coach notes
- excluded surfaces: organisation runtime, team runtime, gym runtime, evidence export, truth projection, dashboards, analytics, rankings, messaging, readiness scoring, outcome evaluation, safety or medical claims

Coach assignment belongs to the permitted coach surface.

It does not expand v0 scope.

## 3. Definitions

### 3.1 Coach Assignment

A coach assignment is a platform record that links:

- one coach user
- one athlete user
- one existing lawful session or existing lawful compiled artefact
- one assignment status

The assignment controls whether the athlete can access the assigned item through the product surface.

The assignment is not engine truth.

The assignment is not a Phase 1 declaration.

The assignment is not a registry entry.

The assignment is not a substitution instruction.

The assignment is not a progression rule.

The assignment is not a compile trigger.

### 3.2 Existing Lawful Artefact

An existing lawful artefact is a session or compiled artefact already produced through the allowed v0 compile path.

For this slice, the assignment API must treat artefact validity as a precondition.

The API may read artefact identity and immutable hash metadata to prove that assignment did not mutate the artefact.

The API must not call engine compilation or mutation paths.

### 3.3 Active Coach-Athlete Link

An active coach-athlete link exists only when a link record between the same coach_user_id and athlete_user_id has status accepted and is not revoked, expired, or rejected.

No inferred link is permitted.

No email-domain, organisation, gym, team, roster, payment, or prior interaction may infer a link.

### 3.4 Tier Seat Cap

A tier seat cap is a commercial access limit.

If an active coach tier cap exists, assignment must not cause the coach to exceed the permitted active athlete count.

A tier cap denial prevents the platform action.

A tier cap denial does not invalidate engine output, alter artefact legality, alter compiled content, or alter artefact hashes.

## 4. Authority Rules

### 4.1 Coach May

A coach may assign an existing lawful session or compiled artefact to an athlete when all of the following are true:

- coach_user_id is authenticated as the acting coach
- athlete_user_id is the linked athlete
- an accepted active coach-athlete link exists
- the target session_id or compiled_artefact_id exists
- the target item is immutable and already lawful
- the target item belongs to the permitted v0 surface
- active tier cap is not exceeded where tier cap enforcement is active
- assignment_status is valid
- no attempt is made to mutate engine truth

### 4.2 Coach Must Not

A coach must not use assignment to:

- create engine output
- modify engine output
- change artefact content
- change artefact hash
- edit Phase 1 declarations
- amend accepted Phase 1 declarations
- force substitution
- trigger substitution
- force progression
- trigger progression
- bypass compile gate
- mutate registries
- modify registry content
- alter legality
- infer athlete consent
- infer coach-athlete relationship
- exceed an active seat cap
- use payment/tier state to change artefact content

Any such attempt must fail.

## 5. Assignment Truth Model

The assignment table is platform metadata.

It records the fact that an assignment action occurred.

It must keep an immutable echo of the assigned artefact hash at assignment time.

The immutable echo exists only to prove non-mutation.

The echo must not become a source of engine truth.

### 5.1 Status Model

Allowed assignment_status values:

- assigned
- revoked

Status rules:

- assigned means the assignment is currently visible/active.
- revoked means the platform assignment has been withdrawn.
- Revocation removes assignment visibility/access only.
- Revocation must not delete the original artefact.
- Revocation must not modify the original artefact.
- Revocation must set revoked_at.
- Revoked assignments must not be reassigned by mutating the same row back to assigned. A new assignment record must be created.

No other status exists in v0.

### 5.2 Target Rules

An assignment must reference exactly one target:

- session_id
- compiled_artefact_id

The record must not reference both.

The record must not reference neither.

The target must already exist before assignment.

The target must be immutable at assignment time.

The target hash must be captured in assigned_artefact_hash.

## 6. Required Data Fields

Minimum requested fields:

- assignment_id
- coach_user_id
- athlete_user_id
- session_id or compiled_artefact_id
- assignment_status
- assigned_at
- revoked_at
- created_at

Additional implementation fields required for determinism and audit separation:

- coach_athlete_link_id
- assigned_artefact_hash
- created_by
- updated_at

These additional fields do not extend engine behaviour. They harden auditability and permission enforcement.

## 7. Database Model

The canonical v0 table is public.coach_assignments.

The database must enforce:

- assignment_id is primary key
- coach_user_id is required
- athlete_user_id is required
- coach_athlete_link_id is required
- exactly one of session_id or compiled_artefact_id is present
- assignment_status is closed set
- assigned_artefact_hash is required
- assigned_at is required
- created_at is required
- revoked_at is required when status is revoked
- revoked_at is forbidden when status is assigned
- created_by must equal coach_user_id for coach-created assignments
- duplicate active assignment for the same coach, athlete, and target is forbidden

The table must not contain fields that allow:

- engine mutation
- Phase 1 mutation
- registry mutation
- substitution triggering
- progression triggering
- compile triggering
- content generation
- safety or suitability claims

## 8. SQL Schema

See db/schema/coach_assignments.sql.

The SQL schema is intentionally platform-side.

It assumes existing application tables for:

- app_users or equivalent user identity
- coach_athlete_links
- sessions or equivalent session records
- compiled_artefacts or equivalent compiled artefact records

If the repository uses different table names, map the foreign keys in one migration while preserving the same constraints and semantics.

## 9. API Contract

Base path:

/api/v0/coach/assignments

All routes are platform routes.

No route may call engine compilation.

No route may mutate engine artefacts.

No route may write Phase 1 declarations.

No route may write registries.

No route may alter substitution or progression state.

### 9.1 Create Assignment

Method:

POST /api/v0/coach/assignments

Purpose:

Create a platform assignment from an accepted linked coach to an athlete for an existing lawful session or compiled artefact.

Request body:

{
  "athlete_user_id": "usr_athlete_001",
  "session_id": "sess_001",
  "compiled_artefact_id": null
}

Alternative request body:

{
  "athlete_user_id": "usr_athlete_001",
  "session_id": null,
  "compiled_artefact_id": "artefact_001"
}

Server-derived fields:

- assignment_id
- coach_user_id from authenticated actor
- coach_athlete_link_id from active accepted link lookup
- assignment_status = assigned
- assigned_artefact_hash from immutable target
- assigned_at
- created_at
- created_by

Validation sequence:

1. Authenticate actor.
2. Assert actor is a coach.
3. Assert request has exactly one target: session_id or compiled_artefact_id.
4. Assert accepted active coach-athlete link exists for coach_user_id and athlete_user_id.
5. Assert target exists.
6. Assert target is already lawful and immutable.
7. Read target hash.
8. Assert tier seat cap does not block the action when active.
9. Assert no active duplicate assignment exists for the same coach, athlete, and target.
10. Insert assignment.
11. Return assignment record.

Success response:

201 Created

{
  "assignment_id": "asg_001",
  "coach_user_id": "usr_coach_001",
  "athlete_user_id": "usr_athlete_001",
  "coach_athlete_link_id": "link_001",
  "session_id": "sess_001",
  "compiled_artefact_id": null,
  "assignment_status": "assigned",
  "assigned_artefact_hash": "sha256_lower_hex",
  "assigned_at": "2026-05-20T12:00:00Z",
  "revoked_at": null,
  "created_at": "2026-05-20T12:00:00Z"
}

Failure responses:

401 unauthenticated

{
  "error": "unauthenticated"
}

403 actor_not_coach

{
  "error": "actor_not_coach"
}

403 coach_link_not_accepted

{
  "error": "coach_link_not_accepted"
}

403 coach_tier_seat_cap_exceeded

{
  "error": "coach_tier_seat_cap_exceeded"
}

404 target_not_found

{
  "error": "assignment_target_not_found"
}

409 assignment_target_not_lawful

{
  "error": "assignment_target_not_lawful"
}

409 duplicate_active_assignment

{
  "error": "duplicate_active_assignment"
}

422 invalid_assignment_target

{
  "error": "exactly_one_assignment_target_required"
}

422 engine_mutation_forbidden

{
  "error": "engine_mutation_forbidden"
}

### 9.2 List Coach Assignments

Method:

GET /api/v0/coach/assignments

Purpose:

Return assignments created by the authenticated coach.

Query parameters:

- athlete_user_id optional
- assignment_status optional: assigned or revoked
- limit optional
- cursor optional

Rules:

- Coach may see only assignments where coach_user_id equals authenticated coach.
- Cross-coach visibility is forbidden.
- Cross-athlete visibility without accepted or archived relationship is forbidden.
- Listing must not call engine compilation.
- Listing must not recompute artefacts.

Success response:

200 OK

{
  "items": [
    {
      "assignment_id": "asg_001",
      "coach_user_id": "usr_coach_001",
      "athlete_user_id": "usr_athlete_001",
      "session_id": "sess_001",
      "compiled_artefact_id": null,
      "assignment_status": "assigned",
      "assigned_artefact_hash": "sha256_lower_hex",
      "assigned_at": "2026-05-20T12:00:00Z",
      "revoked_at": null,
      "created_at": "2026-05-20T12:00:00Z"
    }
  ],
  "next_cursor": null
}

### 9.3 Read Assignment

Method:

GET /api/v0/coach/assignments/{assignment_id}

Purpose:

Return one assignment if the authenticated actor has visibility.

Coach visibility:

- coach_user_id must equal authenticated coach_user_id

Athlete visibility:

- athlete_user_id must equal authenticated athlete_user_id
- assignment_status must be assigned unless archive visibility is explicitly allowed by product policy

Success response:

200 OK

{
  "assignment_id": "asg_001",
  "coach_user_id": "usr_coach_001",
  "athlete_user_id": "usr_athlete_001",
  "coach_athlete_link_id": "link_001",
  "session_id": "sess_001",
  "compiled_artefact_id": null,
  "assignment_status": "assigned",
  "assigned_artefact_hash": "sha256_lower_hex",
  "assigned_at": "2026-05-20T12:00:00Z",
  "revoked_at": null,
  "created_at": "2026-05-20T12:00:00Z"
}

### 9.4 Revoke Assignment

Method:

POST /api/v0/coach/assignments/{assignment_id}/revoke

Purpose:

Revoke platform visibility/access for an assigned item.

Rules:

- Authenticated actor must be the assigning coach.
- Assignment must currently be assigned.
- Revocation sets assignment_status = revoked.
- Revocation sets revoked_at.
- Revocation must not delete the target artefact.
- Revocation must not mutate the target artefact.
- Revocation must not mutate artefact hash.
- Revocation must not write Phase 1.
- Revocation must not call compilation.

Request body:

{
  "reason": null
}

The reason field is optional and must be ignored unless a later v0 policy explicitly adds neutral audit reasons. Free-text reasons should be avoided in v0 to reduce claim drift.

Success response:

200 OK

{
  "assignment_id": "asg_001",
  "assignment_status": "revoked",
  "revoked_at": "2026-05-20T12:30:00Z"
}

Failure responses:

403 assignment_not_owned_by_coach

{
  "error": "assignment_not_owned_by_coach"
}

409 assignment_already_revoked

{
  "error": "assignment_already_revoked"
}

## 10. Permission Rules

### 10.1 Actor Permissions

Individual user:

- may view assigned lawful sessions assigned to self
- may not assign sessions
- may not assign artefacts
- may not revoke coach assignments unless explicit future policy permits athlete-side rejection
- may not see other athletes assignments

Coach:

- may assign existing lawful artefacts to linked athletes
- may list own assignments
- may revoke own assignments
- may not assign to unlinked athletes
- may not assign to athletes linked only to another coach
- may not assign if active tier cap is exceeded
- may not mutate engine output

System:

- may enforce constraints
- may reject invalid actions
- may log neutral audit records
- must not infer relationships
- must not modify engine artefacts as a side effect of assignment

### 10.2 Link Permission

Required link status:

accepted

Forbidden link statuses:

- invited
- revoked
- expired
- rejected
- missing

### 10.3 Tier Cap Permission

If tier cap enforcement is inactive, assignment proceeds if all non-tier conditions pass.

If tier cap enforcement is active:

- count active distinct athletes assigned or managed under the coach tier policy
- include the athlete if this assignment would make them active
- deny assignment if the count exceeds the cap

Tier cap denial must return coach_tier_seat_cap_exceeded.

Tier cap denial must not change target artefact content.

Tier cap denial must not change target artefact hash.

Tier cap denial must not alter engine legality.

## 11. Hash Invariance Rules

Assignment must never change artefact hash.

Required invariant:

target_hash_before_assignment == target_hash_after_assignment

Payment and tier state must never change artefact content.

Required invariant:

target_hash_before_tier_check == target_hash_after_tier_check

If either invariant fails, the implementation is non-canonical.

## 12. Negative Tests

Required negative tests:

- unlinked coach cannot assign
- invited link cannot assign
- revoked link cannot assign
- expired link cannot assign
- rejected link cannot assign
- assignment target missing fails
- both session_id and compiled_artefact_id fails
- neither session_id nor compiled_artefact_id fails
- assignment cannot edit Phase 1
- assignment cannot force substitution
- assignment cannot bypass compile gate
- assignment cannot create engine output
- assignment cannot mutate artefact hash
- payment state cannot change artefact content
- tier cap denial cannot change artefact content
- coach cannot exceed active seat cap where cap is active
- duplicate active assignment fails
- revoked assignment cannot be reactivated by row mutation
- coach cannot revoke another coach assignment
- athlete cannot assign to self through coach route
- assignment cannot mutate registries

## 13. Acceptance Criteria

### AC1 — Valid linked coach can assign existing lawful artefact

Given an authenticated coach  
And an accepted active coach-athlete link  
And an existing lawful immutable artefact  
And tier cap allows the action  
When the coach creates an assignment  
Then an assigned coach_assignments record is created  
And assigned_artefact_hash equals the target hash  
And the target artefact content is unchanged  

### AC2 — Unlinked coach cannot assign

Given an authenticated coach  
And no accepted active link to the athlete  
When the coach attempts assignment  
Then the API rejects the request  
And no assignment row is created  
And no engine artefact is changed  

### AC3 — Assignment does not change artefact hash

Given an existing lawful artefact  
When the artefact is assigned  
Then artefact hash before assignment equals artefact hash after assignment  

### AC4 — Payment/tier state cannot change artefact content

Given an existing lawful artefact  
When tier cap state is evaluated  
Then artefact content remains unchanged  
And artefact hash remains unchanged  
And only platform permission is allowed to change  

## 14. CI and Implementation Notes

Recommended implementation surfaces:

- docs/slices/S39_COACH_ASSIGNMENT_WITHIN_LIMITS.md
- db/schema/coach_assignments.sql
- tests/s39/coach_assignment_within_limits.negative.json
- tests/s39/run_coach_assignment_within_limits_negative_tests.mjs

The tests in this slice are static contract tests.

They do not prove runtime implementation.

They prevent obvious boundary drift and provide fixtures for the later executable API layer.

## 15. Final Rule

Coach assignment controls platform visibility/access only.

If an assignment changes engine legality, Phase 1 declarations, substitutions, progression, registries, compile admission, artefact content, artefact hashes, or payment-driven engine behaviour, the system is non-canonical and must not ship.