<!-- DEV NOTE: Developer documentation surface. This document explains repo behaviour or boundaries, but canonical law remains in the tracked contracts, guards, and tests. Keep docs aligned with executable checks. -->

# S34 - Live Session Execution Checklist

## Target

Define the exact athlete live-session flow after a lawful first session start.

## Invariant

Live execution records facts only.

Runtime may record what the athlete did, did not do, changed, stopped, or finished.

Runtime must not:

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

- athlete live-session flow
- Phase 6 runtime event recording
- work item display
- work item completion
- work item skipping
- work item modification as a factual event
- stopped session event
- partial session event
- completed session event

Excluded:

- Phase 1 editing
- Phase 3 to Phase 5 re-entry
- Phase 7 output
- Phase 8 output
- score creation
- ranking
- outcome evaluation
- coaching direction
- messaging
- team runtime
- organisation runtime

## Required Live Flow

The live-session flow must follow this order.

1. Session start exists.
2. Current work item is available.
3. Athlete records factual work state.
4. Runtime appends event.
5. Runtime advances only when a recorded event permits advance.
6. Session ends as completed, partially completed, or stopped.

No other flow is part of S34.

## Required Event Outputs

S34 allows only the following event types:

- session_started
- work_item_available
- work_item_started
- work_recorded
- work_item_completed
- work_item_skipped
- work_item_modified
- session_partially_completed
- session_completed
- session_stopped

Any other event type is outside this pack.

## Event Shape

Every live-session event must include:

- event_id
- pilot_id
- athlete_id
- session_id
- event_type
- actor
- occurred_at_utc

Work-item events must also include:

- work_item_id

Recorded work events must also include:

- recorded_payload

The recorded_payload is factual data only.

## Event Meaning Lock

session_started means the lawful session was started.

work_item_available means the next work item is visible to the athlete.

work_item_started means the athlete opened or began the work item.

work_recorded means the athlete entered factual work data.

work_item_completed means the athlete marked the work item complete.

work_item_skipped means the athlete marked the work item skipped.

work_item_modified means the athlete recorded a factual change from the planned work item.

session_partially_completed means the athlete ended the session with at least one required work item not completed.

session_completed means all required work items were completed.

session_stopped means the athlete stopped the session before completion.

These meanings must not be expanded.

## Live Session State Model

Allowed live session states:

- not_started
- in_progress
- partially_completed
- completed
- stopped

Allowed work item states:

- available
- started
- recorded
- completed
- skipped
- modified

## State Transition Rules

A session may move from not_started to in_progress only after session_started exists.

A work item may move to available only when the session is in_progress.

A work item may move to completed only after factual work has been recorded or the athlete explicitly marks it complete.

A work item may move to skipped only by explicit athlete action.

A work item may move to modified only when the athlete records a factual modification.

A session may move to completed only when all required work items are completed.

A session may move to partially_completed only when at least one required work item is completed and at least one required work item is not completed.

A session may move to stopped only by explicit athlete action.

## Blocked Conditions

The live session must not continue when any of the following are true:

| Condition | Required blocked_reason |
|---|---|
| session_started is missing | session_not_started |
| session_id is missing | missing_session_id |
| athlete_id is missing | missing_athlete_id |
| actor is not athlete | invalid_actor |
| work_item_id is missing for a work-item event | missing_work_item_id |
| event_type is outside the allowed set | invalid_event_type |
| session is already completed | session_already_completed |
| session is already stopped | session_already_stopped |
| event would mutate Phase 1 | phase1_mutation_attempt |
| event would trigger recompilation | recompilation_attempt |
| event would alter legality | legality_mutation_attempt |

No fallback is permitted.

No automatic correction is permitted.

No hidden continuation is permitted.

## Operator Checklist

S34 passes only if the operator can show:

- session_started exists
- work_item_available exists
- athlete can record work
- work_recorded exists
- athlete can complete a work item
- work_item_completed exists
- athlete can skip a work item
- work_item_skipped exists
- athlete can record a factual modification
- work_item_modified exists
- athlete can complete the session
- session_completed exists
- athlete can end before full completion
- session_partially_completed exists
- athlete can stop the session
- session_stopped exists
- all events are append-only
- no event mutates Phase 1
- no event re-runs compilation
- no event alters legality
- no event creates score, ranking, outcome judgement, coaching direction, or corrective wording

## Minimum Demonstration Record

A valid S34 demonstration record must contain:

- slice: S34
- proof_name: live_session_execution_checklist
- pilot_id: pilot_manual_v0_001
- athlete_id: athlete_manual_v0_001
- session_id: session_manual_v0_001
- initial_session_state: in_progress
- final_session_state: completed
- partial_session_state: partially_completed
- stopped_session_state: stopped
- append_only: true
- phase1_mutated: false
- recompilation_triggered: false
- legality_changed: false
- advisory_copy_present: false
- event_count: 10

## Final Operator Sentence

"An athlete can run a live session by starting, recording work, completing work, partially completing, stopping, and producing factual Phase 6 runtime events."

## Final Rule

If live execution changes Phase 1, re-runs compilation, alters legality, or creates non-factual interpretation, the S34 live-session flow does not exist.
