<!-- DEV NOTE: Developer documentation surface. This document explains repo behaviour or boundaries, but canonical law remains in the tracked contracts, guards, and tests. Keep docs aligned with executable checks. -->

# S35 - Split Return Runtime Proof Pack

## Target

Prove split and return works operationally inside a live v0 session.

## Invariant

Split and return records factual Phase 6 runtime events only.

Split and return must not:

- change Phase 1 declarations
- re-run compilation
- alter legality
- alter session selection
- issue coaching direction
- create scores
- create outcome judgements
- create corrective wording

## v0 Boundary

This pack is limited to Kolosseum v0 Deterministic Execution Alpha.

Included:

- started live session
- split point recording
- return choice availability
- continue from split point
- skip remaining work
- stop session
- partial outcome recording
- factual Phase 6 runtime events

Excluded:

- Phase 1 editing
- Phase 3 to Phase 5 re-entry
- Phase 7 output
- Phase 8 output
- evidence envelope
- export proof
- scoring
- ranking
- outcome evaluation
- coaching direction
- messaging
- team runtime
- organisation runtime

## Required Split Return Flow

The split return flow must follow this order.

1. session_started exists.
2. Runtime has at least one current or remaining work item.
3. Athlete records split point.
4. Runtime appends session_split_recorded.
5. Return choice becomes available.
6. Athlete records one explicit return choice.
7. Runtime appends factual event for the selected choice.
8. Session ends as continued, partially completed, or stopped according to the recorded choice.

No other flow is part of S35.

## Required Event Outputs

S35 allows only the following event types:

- session_started
- work_item_available
- work_recorded
- session_split_recorded
- return_choice_available
- return_choice_recorded
- session_continued
- remaining_work_skipped
- session_partially_completed
- session_stopped

Any other event type is outside this pack.

## Event Shape

Every split return event must include:

- event_id
- pilot_id
- athlete_id
- session_id
- event_type
- actor
- occurred_at_utc

Split point events must also include:

- split_point

Return choice events must also include:

- return_choice

Work-linked split events may also include:

- work_item_id

The split_point and return_choice payloads are factual data only.

## Event Meaning Lock

session_started means the lawful session was started.

work_item_available means the next work item is visible to the athlete.

work_recorded means the athlete entered factual work data.

session_split_recorded means the athlete recorded a split point in the live session.

return_choice_available means the system displayed lawful return choices.

return_choice_recorded means the athlete selected one available return choice.

session_continued means the athlete continued from the recorded split point.

remaining_work_skipped means the athlete explicitly skipped remaining work.

session_partially_completed means the session ended with at least one required work item not completed.

session_stopped means the athlete stopped the session before completion.

These meanings must not be expanded.

## Allowed Return Choices

Allowed return_choice values:

- continue_from_split_point
- skip_remaining_work
- stop_session

No other return choice exists in S35.

## Live Session State Model

Allowed live session states:

- in_progress
- split_recorded
- return_choice_available
- continued
- partially_completed
- stopped

Allowed split states:

- none
- split_recorded
- return_choice_recorded

## State Transition Rules

A session may move from in_progress to split_recorded only after session_split_recorded exists.

A session may move from split_recorded to return_choice_available only after return_choice_available exists.

A return choice may be recorded only after return_choice_available exists.

A session may move to continued only after return_choice_recorded has return_choice continue_from_split_point.

A session may move to partially_completed only after return_choice_recorded has return_choice skip_remaining_work and remaining_work_skipped exists.

A session may move to stopped only after return_choice_recorded has return_choice stop_session and session_stopped exists.

A split point must never change Phase 1.

A split point must never trigger recompilation.

A split point must never alter legality.

## Blocked Conditions

The split return flow must not continue when any of the following are true:

| Condition | Required blocked_reason |
|---|---|
| session_started is missing | session_not_started |
| session_id is missing | missing_session_id |
| athlete_id is missing | missing_athlete_id |
| actor is not athlete | invalid_actor |
| split point is missing | missing_split_point |
| return choice is missing | missing_return_choice |
| return choice is outside allowed set | invalid_return_choice |
| return choice is recorded before availability | return_choice_not_available |
| event_type is outside the allowed set | invalid_event_type |
| event would mutate Phase 1 | phase1_mutation_attempt |
| event would trigger recompilation | recompilation_attempt |
| event would alter legality | legality_mutation_attempt |
| session is already completed | session_already_completed |
| session is already stopped | session_already_stopped |

No fallback is permitted.

No automatic correction is permitted.

No hidden continuation is permitted.

## Operator Checklist

S35 passes only if the operator can show:

- session_started exists
- session_split_recorded exists
- split point is factual
- return_choice_available exists
- return_choice_recorded exists
- athlete can continue from split point
- session_continued exists
- athlete can skip remaining work
- remaining_work_skipped exists
- partial outcome can be recorded
- session_partially_completed exists
- athlete can stop session
- session_stopped exists
- all events are append-only
- no event mutates Phase 1
- no event re-runs compilation
- no event alters legality
- no event creates score, ranking, outcome judgement, coaching direction, or corrective wording

## Minimum Demonstration Record

A valid S35 demonstration record must contain:

- slice: S35
- proof_name: split_return_runtime_proof_pack
- pilot_id: pilot_manual_v0_001
- athlete_id: athlete_manual_v0_001
- session_id: session_manual_v0_001
- initial_session_state: in_progress
- split_state: split_recorded
- return_choice_available: true
- continue_choice_recorded: true
- skip_choice_recorded: true
- stop_choice_recorded: true
- partial_session_state: partially_completed
- stopped_session_state: stopped
- append_only: true
- phase1_mutated: false
- recompilation_triggered: false
- legality_changed: false
- advisory_copy_present: false
- event_count: 8

## Final Operator Sentence

"An athlete can split a live session, return to it, continue or skip remaining work, and produce factual Phase 6 runtime events."

## Final Rule

If split return changes Phase 1, re-runs compilation, alters legality, or creates non-factual interpretation, the S35 split return flow does not exist.
