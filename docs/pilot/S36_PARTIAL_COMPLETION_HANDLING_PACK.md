<!-- DEV NOTE: Developer documentation surface. This document explains repo behaviour or boundaries, but canonical law remains in the tracked contracts, guards, and tests. Keep docs aligned with executable checks. -->

# S36 - Partial Completion Handling Pack

## Target

Define exact rules for incomplete live sessions.

## Invariant

Partial completion is factual Phase 6 runtime state only.

Partial completion must not:

- create catch-up logic
- create judgement
- create penalty
- create readiness language
- create score
- create recommendation
- mutate Phase 1
- trigger recompilation
- alter legality
- alter future sessions

## v0 Boundary

This pack is limited to Kolosseum v0 Deterministic Execution Alpha.

Included:

- started live session
- completed work item facts
- skipped work item facts
- modified work item facts
- incomplete work item facts
- partial session terminal state
- factual Phase 6 runtime events

Excluded:

- Phase 1 editing
- Phase 3 to Phase 5 re-entry
- Phase 7 output
- Phase 8 output
- evidence envelope
- export proof
- catch-up generation
- future-session adjustment
- scoring
- ranking
- readiness impact
- outcome evaluation
- coaching direction
- messaging
- team runtime
- organisation runtime

## Required Partial Completion Flow

The partial completion flow must follow this order.

1. session_started exists.
2. At least one work item has a factual runtime state.
3. At least one required work item is not completed.
4. Athlete ends the session before full completion.
5. Runtime appends work_item_incomplete for incomplete required work where needed.
6. Runtime appends session_partially_completed.
7. Session becomes partially_completed.

No other flow is part of S36.

## Required Event Outputs

S36 allows only the following event types:

- session_started
- work_item_completed
- work_item_skipped
- work_item_modified
- work_item_incomplete
- session_partially_completed

Any other event type is outside this pack.

## Event Shape

Every partial-completion event must include:

- event_id
- pilot_id
- athlete_id
- session_id
- event_type
- actor
- occurred_at_utc

Work-item events must also include:

- work_item_id

Modified work-item events may also include:

- recorded_payload

Incomplete work-item events must also include:

- incomplete_reason

The incomplete_reason is factual data only.

## Event Meaning Lock

session_started means the lawful session was started.

work_item_completed means the athlete marked the work item complete.

work_item_skipped means the athlete explicitly skipped the work item.

work_item_modified means the athlete recorded a factual change from the planned work item.

work_item_incomplete means a required work item remained incomplete at session end.

session_partially_completed means the session ended with at least one required work item not completed.

These meanings must not be expanded.

## Allowed Incomplete Reasons

Allowed incomplete_reason values:

- session_ended_before_work_item
- athlete_stopped_before_completion
- remaining_work_not_done
- work_item_skipped
- work_item_modified_not_completed

No other incomplete reason exists in S36.

## Live Session State Model

Allowed session states:

- in_progress
- partially_completed

Allowed work item states:

- completed
- skipped
- modified
- incomplete

## State Transition Rules

A session may move from in_progress to partially_completed only after session_partially_completed exists.

A session may move to partially_completed only when at least one required work item is not completed.

A completed work item remains completed.

A skipped work item remains skipped.

A modified work item remains a factual modification only.

An incomplete work item remains incomplete unless a later lawful runtime event records completion within the same session before terminal state.

After session_partially_completed, no further work item completion is part of S36.

Partial completion must never change Phase 1.

Partial completion must never trigger recompilation.

Partial completion must never alter legality.

Partial completion must never create a future-session adjustment.

## Blocked Conditions

The partial completion flow must not continue when any of the following are true:

| Condition | Required blocked_reason |
|---|---|
| session_started is missing | session_not_started |
| session_id is missing | missing_session_id |
| athlete_id is missing | missing_athlete_id |
| actor is not athlete | invalid_actor |
| no work item state exists | no_work_item_state |
| all required work items are completed | no_incomplete_work |
| incomplete reason is missing | missing_incomplete_reason |
| incomplete reason is outside allowed set | invalid_incomplete_reason |
| event_type is outside the allowed set | invalid_event_type |
| event would mutate Phase 1 | phase1_mutation_attempt |
| event would trigger recompilation | recompilation_attempt |
| event would alter legality | legality_mutation_attempt |
| event would create catch-up claim | catch_up_claim_attempt |
| event would alter future session | future_session_adjustment_attempt |
| event would create judgement | judgement_attempt |
| event would create readiness language | readiness_claim_attempt |
| event would create recommendation | recommendation_attempt |

No fallback is permitted.

No automatic correction is permitted.

No hidden continuation is permitted.

No catch-up claim is permitted.

No judgement is permitted.

## Forbidden Copy

The following wording classes are forbidden:

- missed work will be added later
- catch-up required
- session failed
- poor adherence
- readiness impact
- progression adjusted
- recommendation
- penalty
- non-compliant
- underperformed

## Operator Checklist

S36 passes only if the operator can show:

- session_started exists
- at least one factual work item state exists
- at least one required work item is incomplete
- work_item_incomplete exists where required
- session_partially_completed exists
- incomplete work is recorded factually
- partial session state is partially_completed
- no catch-up claim exists
- no judgement exists
- no readiness claim exists
- no score exists
- no recommendation exists
- no future-session adjustment exists
- all events are append-only
- no event mutates Phase 1
- no event re-runs compilation
- no event alters legality

## Minimum Demonstration Record

A valid S36 demonstration record must contain:

- slice: S36
- proof_name: partial_completion_handling_pack
- pilot_id: pilot_manual_v0_001
- athlete_id: athlete_manual_v0_001
- session_id: session_manual_v0_001
- initial_session_state: in_progress
- final_session_state: partially_completed
- completed_work_item_count: 1
- skipped_work_item_count: 1
- modified_work_item_count: 1
- incomplete_work_item_count: 2
- catch_up_claim_present: false
- judgement_present: false
- readiness_claim_present: false
- recommendation_present: false
- future_session_adjusted: false
- append_only: true
- phase1_mutated: false
- recompilation_triggered: false
- legality_changed: false
- event_count: 6

## Final Operator Sentence

"A partial session records completed, skipped, modified, and incomplete work as factual Phase 6 runtime state only."

## Final Rule

If partial completion creates catch-up logic, judgement, readiness language, recommendation, future-session adjustment, Phase 1 mutation, recompilation, or legality change, the S36 partial completion flow does not exist.
