# S38 - Coach Artefact Viewing Pack

## Target

Define the exact coach view-only artefact surface.

## Invariant

A coach may view factual athlete artefacts only when the athlete is linked to the coach.

Coach artefact viewing is observational only.

Coach artefact viewing must not:

- create analytics
- create readiness language
- create advice
- create recommendations
- create judgement
- create scores
- create rankings
- create safety language
- create medical language
- mutate Phase 1
- re-run compilation
- alter legality
- override engine output

## v0 Boundary

This pack is limited to Kolosseum v0 Deterministic Execution Alpha.

Included:

- linked athlete artefact access
- view-only factual artefact surface
- factual session artefacts
- factual assignment artefacts
- factual Phase 6 runtime event artefacts
- factual coach visibility state

Excluded:

- analytics
- readiness
- advice
- recommendations
- optimisation
- scoring
- ranking
- judgement
- safety assessment
- medical or rehabilitation language
- coach override
- Phase 1 editing
- Phase 3 to Phase 5 re-entry
- Phase 7 output
- Phase 8 output
- evidence envelope
- export proof
- messaging
- team runtime
- organisation runtime

## Required Coach Artefact Viewing Flow

The coach artefact viewing flow must follow this order.

1. Coach account exists.
2. Athlete account exists.
3. Coach athlete link exists.
4. Coach athlete link is accepted.
5. Coach opens linked athlete artefact view.
6. Platform verifies link.
7. Platform displays allowed factual artefacts only.
8. Coach remains view-only.
9. No analytics, readiness, advice, recommendation, judgement, score, ranking, safety, or medical language is displayed.

No other flow is part of S38.

## Required Actor Scope

Allowed actor:

- coach

Allowed target actor:

- athlete

Allowed execution scope:

- coach_managed

Coach artefact viewing is invalid for unlinked athletes.

Coach artefact viewing is invalid for revoked links.

Coach artefact viewing is invalid for pending links.

Coach artefact viewing is invalid if the artefact is not inside the linked athlete surface.

## Allowed Artefact Types

S38 allows only the following artefact_type values:

- phase1_acceptance_summary
- session_assignment_record
- session_availability_record
- session_started_event
- work_item_event
- session_partially_completed_event
- session_completed_event
- session_stopped_event
- split_return_event

Any other artefact type is outside this pack.

## Allowed View Fields

The coach artefact view may show only factual fields:

- artefact_id
- artefact_type
- coach_id
- athlete_id
- link_id
- session_id
- event_id
- event_type
- occurred_at_utc
- created_at_utc
- status
- factual_payload
- source_record_id

No other field is part of S38.

## Required View State

Allowed view_mode values:

- read_only

Allowed visibility_status values:

- visible_to_linked_coach

No other view mode or visibility status exists in S38.

## Required Event Outputs

S38 allows only the following event types:

- coach_artefact_view_requested
- coach_athlete_link_verified
- coach_artefact_view_rendered

Any other event type is outside this pack.

## Event Shape

Every coach artefact viewing event must include:

- event_id
- coach_id
- athlete_id
- artefact_id
- artefact_type
- event_type
- actor
- occurred_at_utc

Link verification events must also include:

- link_id
- link_status

View rendered events must also include:

- view_mode
- visibility_status
- displayed_field_count

## Event Meaning Lock

coach_artefact_view_requested means the coach opened a factual artefact view for a linked athlete.

coach_athlete_link_verified means the platform confirmed the coach athlete link was accepted and active.

coach_artefact_view_rendered means the platform displayed a view-only factual artefact surface.

These meanings must not be expanded.

## Coach View Boundary

A coach may view:

- factual Phase 1 acceptance summary
- factual session assignment records
- factual session availability records
- factual session start event
- factual work item events
- factual partial completion event
- factual completion event
- factual stopped event
- factual split return event

A coach may not view or generate:

- analytics
- readiness
- advice
- recommendation
- optimisation
- score
- ranking
- judgement
- safety assessment
- medical assessment
- hidden engine authority
- unlinked athlete artefacts

## Blocked Conditions

The coach artefact viewing flow must not continue when any of the following are true:

| Condition | Required blocked_reason |
|---|---|
| coach_id is missing | missing_coach_id |
| athlete_id is missing | missing_athlete_id |
| artefact_id is missing | missing_artefact_id |
| actor is not coach | invalid_actor |
| coach athlete link is missing | link_missing |
| coach athlete link is pending | link_pending |
| coach athlete link is refused | link_refused |
| coach athlete link is revoked | link_revoked |
| coach athlete link is expired | link_expired |
| artefact type is outside allowed set | invalid_artefact_type |
| view mode is not read_only | invalid_view_mode |
| visibility status is not visible_to_linked_coach | invalid_visibility_status |
| event_type is outside allowed set | invalid_event_type |
| view would show analytics | analytics_surface_attempt |
| view would show readiness | readiness_surface_attempt |
| view would show advice | advice_surface_attempt |
| view would show recommendation | recommendation_surface_attempt |
| view would show judgement | judgement_surface_attempt |
| view would show score | score_surface_attempt |
| view would show ranking | ranking_surface_attempt |
| view would show safety language | safety_surface_attempt |
| view would show medical language | medical_surface_attempt |
| view would mutate Phase 1 | phase1_mutation_attempt |
| view would trigger recompilation | recompilation_attempt |
| view would alter legality | legality_mutation_attempt |
| view would override engine output | engine_override_attempt |

No fallback is permitted.

No automatic linking is permitted.

No inferred coach authority is permitted.

No artefact access for unlinked athletes is permitted.

No analytics are permitted.

No readiness surface is permitted.

No advice is permitted.

## Operator Checklist

S38 passes only if the operator can show:

- coach exists
- athlete exists
- accepted coach athlete link exists
- coach_artefact_view_requested exists
- coach_athlete_link_verified exists
- coach_artefact_view_rendered exists
- view_mode is read_only
- visibility_status is visible_to_linked_coach
- only allowed artefact types are visible
- only allowed factual fields are visible
- unlinked athlete artefact view is blocked
- revoked link artefact view is blocked
- pending link artefact view is blocked
- coach artefact viewing does not mutate Phase 1
- coach artefact viewing does not re-run compilation
- coach artefact viewing does not alter legality
- coach artefact viewing does not override engine output
- coach artefact viewing does not create analytics, readiness, advice, recommendation, judgement, score, ranking, safety, or medical language

## Minimum Demonstration Record

A valid S38 demonstration record must contain:

- slice: S38
- proof_name: coach_artefact_viewing_pack
- coach_id: coach_manual_v0_001
- athlete_id: athlete_manual_v0_001
- link_id: link_manual_v0_001
- link_status: accepted
- artefact_id: artefact_manual_v0_001
- artefact_type: session_started_event
- view_mode: read_only
- visibility_status: visible_to_linked_coach
- factual_artefacts_only: true
- analytics_present: false
- readiness_claim_present: false
- advice_present: false
- recommendation_present: false
- judgement_present: false
- score_present: false
- ranking_present: false
- safety_claim_present: false
- medical_claim_present: false
- unlinked_artefact_view_blocked: true
- pending_link_view_blocked: true
- revoked_link_view_blocked: true
- engine_authority_created: false
- phase1_mutated: false
- recompilation_triggered: false
- legality_changed: false
- engine_output_overridden: false
- event_count: 3

## Final Operator Sentence

"A coach can view factual artefacts for an accepted linked athlete in read-only mode only, with no analytics, readiness, advice, recommendation, judgement, or engine authority."

## Final Rule

If coach artefact viewing exposes analytics, readiness, advice, recommendation, judgement, score, ranking, safety, medical language, unlinked athlete data, Phase 1 mutation, recompilation, legality change, or engine override, the S38 coach artefact viewing flow does not exist.