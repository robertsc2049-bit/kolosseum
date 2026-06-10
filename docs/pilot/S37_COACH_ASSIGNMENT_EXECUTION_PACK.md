# S37 - Coach Assignment Execution Pack

## Target

Define the exact coach assignment flow from coach dashboard action to athlete session availability.

## Invariant

A coach may assign a session only to a linked athlete.

Coach assignment is platform workflow only.

Coach assignment must not:

- create engine authority
- alter Phase 1 declarations
- re-run compilation
- alter legality
- override engine decisions
- alter substitutions
- alter progression
- create recommendation language
- create readiness language
- create safety language

## v0 Boundary

This pack is limited to Kolosseum v0 Deterministic Execution Alpha.

Included:

- coach dashboard assignment action
- linked athlete validation
- session assignment record
- athlete availability state
- factual assignment events
- coach authority boundary

Excluded:

- coach override
- coach-authored engine decisions
- Phase 1 editing
- Phase 3 to Phase 5 re-entry
- Phase 7 output
- Phase 8 output
- evidence envelope
- export proof
- readiness assessment
- safety assessment
- recommendation
- optimisation
- messaging
- team runtime
- organisation runtime

## Required Coach Assignment Flow

The coach assignment flow must follow this order.

1. Coach account exists.
2. Athlete account exists.
3. Coach athlete link exists.
4. Coach athlete link is accepted.
5. Coach selects linked athlete.
6. Coach selects existing session assignment target.
7. Runtime records coach assignment.
8. Athlete session availability is updated as factual platform state.
9. Athlete can see assigned session as available.

No other flow is part of S37.

## Required Actor Scope

Allowed actor:

- coach

Allowed target actor:

- athlete

Allowed execution scope:

- coach_managed

Coach assignment is invalid for unlinked athletes.

Coach assignment is invalid for revoked links.

Coach assignment is invalid for pending links.

Coach assignment is invalid for individual execution scope unless a lawful coach-managed link exists.

## Required Event Outputs

S37 allows only the following event types:

- coach_assignment_requested
- coach_athlete_link_verified
- coach_assignment_recorded
- athlete_session_available

Any other event type is outside this pack.

## Event Shape

Every coach assignment event must include:

- event_id
- coach_id
- athlete_id
- session_id
- event_type
- actor
- occurred_at_utc

Link verification events must also include:

- link_id
- link_status

Assignment recorded events must also include:

- assignment_id
- assignment_scope

Athlete availability events must also include:

- availability_status

## Event Meaning Lock

coach_assignment_requested means the coach selected a linked athlete and requested assignment of an existing session target.

coach_athlete_link_verified means the platform confirmed the coach athlete link was accepted and active.

coach_assignment_recorded means the platform recorded assignment metadata.

athlete_session_available means the assigned session became visible to the athlete as available platform state.

These meanings must not be expanded.

## Allowed Link Status Values

Allowed link_status values:

- accepted

Blocked link_status values:

- missing
- pending
- refused
- revoked
- expired

## Allowed Assignment Scope Values

Allowed assignment_scope values:

- coach_managed

No other assignment scope exists in S37.

## Allowed Availability Status Values

Allowed availability_status values:

- available_to_athlete

No other availability status exists in S37.

## Coach Authority Boundary

A coach may:

- select a linked athlete
- assign an existing lawful session target
- create assignment metadata
- make the assigned session available to the linked athlete
- view factual assignment status

A coach may not:

- decide engine legality
- override engine output
- edit Phase 1 declarations
- force compilation
- alter substitutions
- alter progression
- mark athlete readiness
- declare safety
- recommend changes through assignment
- assign sessions to unlinked athletes

## Blocked Conditions

The coach assignment flow must not continue when any of the following are true:

| Condition | Required blocked_reason |
|---|---|
| coach_id is missing | missing_coach_id |
| athlete_id is missing | missing_athlete_id |
| session_id is missing | missing_session_id |
| actor is not coach | invalid_actor |
| coach athlete link is missing | link_missing |
| coach athlete link is pending | link_pending |
| coach athlete link is refused | link_refused |
| coach athlete link is revoked | link_revoked |
| coach athlete link is expired | link_expired |
| assignment scope is not coach_managed | invalid_assignment_scope |
| event_type is outside the allowed set | invalid_event_type |
| event would mutate Phase 1 | phase1_mutation_attempt |
| event would trigger recompilation | recompilation_attempt |
| event would alter legality | legality_mutation_attempt |
| event would override engine output | engine_override_attempt |
| event would create readiness language | readiness_claim_attempt |
| event would create safety language | safety_claim_attempt |
| event would create recommendation | recommendation_attempt |

No fallback is permitted.

No automatic linking is permitted.

No inferred coach authority is permitted.

No assignment to unlinked athletes is permitted.

No engine authority is created.

## Operator Checklist

S37 passes only if the operator can show:

- coach exists
- athlete exists
- accepted coach athlete link exists
- coach_assignment_requested exists
- coach_athlete_link_verified exists
- coach_assignment_recorded exists
- athlete_session_available exists
- assignment scope is coach_managed
- linked athlete only is enforced
- unlinked athlete assignment is blocked
- revoked link assignment is blocked
- pending link assignment is blocked
- coach assignment does not mutate Phase 1
- coach assignment does not re-run compilation
- coach assignment does not alter legality
- coach assignment does not override engine output
- coach assignment does not create readiness, safety, recommendation, optimisation, or judgement language

## Minimum Demonstration Record

A valid S37 demonstration record must contain:

- slice: S37
- proof_name: coach_assignment_execution_pack
- coach_id: coach_manual_v0_001
- athlete_id: athlete_manual_v0_001
- link_id: link_manual_v0_001
- link_status: accepted
- session_id: session_manual_v0_001
- assignment_id: assignment_manual_v0_001
- assignment_scope: coach_managed
- availability_status: available_to_athlete
- linked_athlete_only: true
- unlinked_assignment_blocked: true
- pending_link_assignment_blocked: true
- revoked_link_assignment_blocked: true
- engine_authority_created: false
- phase1_mutated: false
- recompilation_triggered: false
- legality_changed: false
- engine_output_overridden: false
- readiness_claim_present: false
- safety_claim_present: false
- recommendation_present: false
- event_count: 4

## Final Operator Sentence

"A coach can assign an existing lawful session target to an accepted linked athlete, making it available as factual platform state without creating engine authority."

## Final Rule

If coach assignment targets an unlinked athlete, mutates Phase 1, re-runs compilation, alters legality, overrides engine output, or creates readiness, safety, recommendation, optimisation, or judgement language, the S37 coach assignment flow does not exist.