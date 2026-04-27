# S40 - Blocked-State Support Pack

## Target

Define all live pilot blocked states in one place.

## Invariant

A blocked state is factual platform/runtime refusal only.

A blocked state must not:

- infer missing truth
- auto-correct missing truth
- bypass Phase 1
- bypass coach athlete link rules
- create a session where none exists
- continue a return flow without required return data
- create advice
- create recommendation
- create readiness language
- create judgement
- mutate Phase 1
- re-run compilation
- alter legality
- override engine output

## v0 Boundary

This pack is limited to Kolosseum v0 Deterministic Execution Alpha.

Included:

- Phase 1 missing blocked state
- no session blocked state
- no link blocked state
- revoked link blocked state
- return missing blocked state
- factual blocked reason records
- operator-facing blocked state copy
- athlete/coach-safe blocked state copy

Excluded:

- automatic correction
- fallback session creation
- inferred link creation
- Phase 1 editing
- Phase 3 to Phase 5 re-entry
- Phase 7 output
- Phase 8 output
- evidence envelope
- export proof
- readiness assessment
- advice
- recommendation
- optimisation
- judgement
- scoring
- ranking
- messaging
- team runtime
- organisation runtime

## Required Blocked States

S40 defines these blocked_state values:

- phase1_missing
- no_session
- no_link
- revoked_link
- return_missing

No other blocked state exists in S40.

## Required Blocked Reasons

Allowed blocked_reason values:

- phase1_missing
- session_missing
- coach_athlete_link_missing
- coach_athlete_link_revoked
- return_choice_missing
- return_point_missing

No other blocked reason exists in S40.

## Required Blocked Flow

The blocked-state flow must follow this order.

1. A live pilot action is requested.
2. Platform/runtime checks required factual prerequisites.
3. Required prerequisite is missing, invalid, or revoked.
4. Platform/runtime appends blocked_state_recorded.
5. Action is refused.
6. No engine truth is changed.
7. No compilation is triggered.
8. No legality is changed.
9. No advisory copy is displayed.

No other flow is part of S40.

## Required Event Outputs

S40 allows only the following event types:

- blocked_state_checked
- blocked_state_recorded
- blocked_action_refused

Any other event type is outside this pack.

## Event Shape

Every blocked-state event must include:

- event_id
- pilot_id
- event_type
- actor
- occurred_at_utc
- blocked_state
- blocked_reason

Where known, the event may also include:

- coach_id
- athlete_id
- session_id
- link_id
- requested_action

The payload is factual data only.

## Event Meaning Lock

blocked_state_checked means the platform/runtime checked required prerequisites for a requested live pilot action.

blocked_state_recorded means the platform/runtime recorded a factual blocked state.

blocked_action_refused means the requested action did not continue.

These meanings must not be expanded.

## Required Operator Copy

phase1_missing:

"Blocked: Phase 1 declaration is missing. The pilot cannot continue until Phase 1 is accepted."

no_session:

"Blocked: no live session exists for this action."

no_link:

"Blocked: no accepted coach athlete link exists."

revoked_link:

"Blocked: coach athlete link is revoked."

return_missing:

"Blocked: return data is missing."

No alternative wording is part of S40.

## State Rules

phase1_missing applies when a live pilot action requires accepted Phase 1 and no accepted Phase 1 exists.

no_session applies when a live pilot action requires an existing live or assigned session and none exists.

no_link applies when a coach-managed action requires an accepted coach athlete link and no accepted link exists.

revoked_link applies when a coach-managed action has a link record but that link is revoked.

return_missing applies when split/return flow requires return choice or return point data and the required return data is missing.

A blocked state must be terminal for the requested action.

A blocked state must not terminate the pilot globally.

A blocked state must not change Phase 1.

A blocked state must not trigger recompilation.

A blocked state must not alter legality.

A blocked state must not create future-session effects.

## Blocked Conditions

The blocked-state flow must refuse the requested action when any of the following are true:

| Condition | Required blocked_state | Required blocked_reason |
|---|---|---|
| Phase 1 accepted record is missing | phase1_missing | phase1_missing |
| required session is missing | no_session | session_missing |
| accepted coach athlete link is missing | no_link | coach_athlete_link_missing |
| coach athlete link is revoked | revoked_link | coach_athlete_link_revoked |
| return choice is missing | return_missing | return_choice_missing |
| return point is missing | return_missing | return_point_missing |

No fallback is permitted.

No automatic correction is permitted.

No hidden continuation is permitted.

No inferred link is permitted.

No inferred Phase 1 is permitted.

No inferred return choice is permitted.

## Operator Checklist

S40 passes only if the operator can show:

- phase1_missing blocked state exists
- no_session blocked state exists
- no_link blocked state exists
- revoked_link blocked state exists
- return_missing blocked state exists
- each blocked state has exact required copy
- each blocked state has exact blocked_reason
- blocked_state_recorded exists
- blocked_action_refused exists
- requested action does not continue
- no blocked state mutates Phase 1
- no blocked state re-runs compilation
- no blocked state alters legality
- no blocked state overrides engine output
- no blocked state creates readiness, advice, recommendation, judgement, score, ranking, or future-session effect

## Minimum Demonstration Record

A valid S40 demonstration record must contain:

- slice: S40
- proof_name: blocked_state_support_pack
- phase1_missing_blocked: true
- no_session_blocked: true
- no_link_blocked: true
- revoked_link_blocked: true
- return_missing_blocked: true
- exact_operator_copy_present: true
- blocked_action_refused: true
- hidden_continuation_present: false
- inferred_phase1_present: false
- inferred_link_present: false
- inferred_return_choice_present: false
- engine_authority_created: false
- phase1_mutated: false
- recompilation_triggered: false
- legality_changed: false
- engine_output_overridden: false
- readiness_claim_present: false
- advice_present: false
- recommendation_present: false
- judgement_present: false
- future_effect: false
- blocked_case_count: 5
- event_count: 15

## Final Operator Sentence

"Live pilot blocked states are recorded factually, refuse only the requested action, and never infer missing truth, mutate Phase 1, re-run compilation, alter legality, or create advice."

## Final Rule

If a blocked state infers missing truth, allows hidden continuation, mutates Phase 1, re-runs compilation, alters legality, overrides engine output, or creates readiness, advice, recommendation, judgement, or future-session effect, the S40 blocked-state support flow does not exist.