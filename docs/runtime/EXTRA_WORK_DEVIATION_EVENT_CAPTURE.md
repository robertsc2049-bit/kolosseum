<!-- DEV NOTE: Developer documentation surface. This document explains repo behaviour or boundaries, but canonical law remains in the tracked contracts, guards, and tests. Keep docs aligned with executable checks. -->

# S36 — Extra Work / Deviation Event Capture

Document: EXTRA_WORK_DEVIATION_EVENT_CAPTURE.md  
Status: v0 implementation contract  
Engine compatibility: EB2-1.0.0  
Scope: v0 Deterministic Execution Alpha  
Rewrite policy: rewrite-only  
Authority level: subordinate runtime implementation contract

## 1. Purpose

This document defines the v0-safe model for recording factual extra work and modified work as runtime events.

The purpose is narrow:

- record that a declared runtime event occurred;
- preserve an append-only factual history;
- expose the event in artefact and history views;
- prove that the event is engine-inert.

This document does not create coaching judgement, correction, recommendation, compensation, compliance tracking, progression, readiness interpretation, safety interpretation, or outcome interpretation.

## 2. Supported event types

v0 supports exactly two deviation capture event types:

- extra_work_recorded
- work_modified_recorded

No other extra-work, variance, rogue-mode, adjustment, correction, or compensation event type exists in S36.

Unknown event_type values must fail validation.

## 3. Boundary statement

Deviation events are runtime facts only.

They must not:

- alter Phase 1 declarations;
- alter Phase 2 canonical input hash;
- alter Phase 3 constraints;
- alter Phase 4 enumeration;
- alter Phase 5 selection or materialisation;
- alter future session compilation;
- create a planned work item retroactively;
- become a future input unless a later lawful specification explicitly permits it.

v0 contains no such later permission.

## 4. Factual event model

All S36 events are append-only runtime events.

Required common fields:

- event_id
- event_type
- session_id
- work_item_id
- actor_user_id
- occurred_at_iso8601
- recorded_at_iso8601
- monotonic_index
- payload

Common field rules:

- event_id is opaque and unique within the runtime event stream.
- event_type must be one of the two supported S36 event types.
- session_id must resolve to the active Phase 5 session.
- work_item_id is null for extra work and required for modified planned work.
- actor_user_id identifies who recorded the fact.
- occurred_at_iso8601 records declared occurrence time.
- recorded_at_iso8601 records capture time.
- monotonic_index must increase by exactly one from the previous event.
- payload must match the schema for the event type.
- No free-text notes are permitted.
- No reason field is permitted.
- No interpretation field is permitted.

## 5. extra_work_recorded payload

Purpose: record factual work that was performed but was not present in the Phase 5 materialised session.

Required payload fields:

- extra_work_item_id
- exercise_token_id
- quantity
- planned_item_effect

Schema:

- extra_work_item_id: opaque string, unique within the event payload context.
- exercise_token_id: opaque string.
- quantity: object containing at least one factual quantity field.
- planned_item_effect: must equal none.

Allowed quantity fields:

- sets: integer
- reps: integer
- load_value: number
- load_unit: kg | lb | bodyweight | none
- duration_seconds: integer
- distance_meters: number

At least one of sets, reps, load_value, duration_seconds, or distance_meters must exist.

Rules:

- The event is allowed to appear in artefact/history.
- The event must not be inserted into Phase 5 planned work.
- The event must not change completion status of planned work.
- The event must not count as planned work completion.
- The event must not generate a future planned item.
- planned_item_effect must always be none.

## 6. work_modified_recorded payload

Purpose: record that a planned work item was completed differently from the materialised Phase 5 item.

Required payload fields:

- planned_work_item_id
- modification_type
- before
- after
- planned_item_effect

Allowed modification_type values:

- sets_changed
- reps_changed
- load_changed
- duration_changed
- distance_changed
- item_not_done_as_planned

before and after are closed factual quantity objects.

Allowed before / after fields:

- sets: integer
- reps: integer
- load_value: number
- load_unit: kg | lb | bodyweight | none
- duration_seconds: integer
- distance_meters: number
- completed: boolean

Rules:

- planned_work_item_id must equal the event work_item_id.
- planned_work_item_id must resolve to a Phase 5 work item in the referenced session.
- The event may appear in artefact/history as a factual record.
- The event must not mutate the Phase 5 work item.
- The event must not rewrite planned quantity.
- The event must not trigger substitution.
- The event must not trigger progression.
- planned_item_effect must always be none.

## 7. Reducer update

The S36 reducer may do only the following:

1. Validate the incoming event.
2. Verify monotonic append order.
3. Verify session and work item references against Phase 5 structure.
4. Append the event to runtime_events.
5. Add a neutral artefact/history row.

The reducer must not:

- recompute legality;
- recompute selection;
- mutate program.sessions;
- mutate program.blocks;
- mutate work_items;
- create future work;
- create alerts;
- create penalties;
- create rewards;
- calculate compliance;
- calculate readiness;
- calculate safety;
- calculate outcome value;
- emit recommendation text.

## 8. Artefact and history projection

Allowed artefact/history fields:

- event_id
- event_type
- session_id
- work_item_id
- actor_user_id
- occurred_at_iso8601
- recorded_at_iso8601
- monotonic_index
- neutral_copy_id
- payload

Allowed neutral copy IDs:

- EXTRA_WORK_RECORDED
- WORK_MODIFIED_RECORDED
- DEVIATION_EVENT_RECORDED
- PLANNED_ITEM_UNCHANGED
- FUTURE_COMPILE_UNCHANGED

Artefact/history must not contain:

- judgement labels;
- compliance scores;
- readiness labels;
- safety labels;
- outcome labels;
- progress labels;
- correction labels;
- compensation labels;
- recommendation labels.

## 9. UI copy surface

UI copy must be neutral and registry-backed.

Allowed text:

- Extra work recorded.
- Work modification recorded.
- Deviation event recorded.
- Planned work item unchanged.
- Future compile unchanged.
- This record is factual only.
- This record does not change planned work.

Forbidden UI semantics:

- correction
- recommendation
- compensation
- compliance score
- progression trigger
- readiness interpretation
- safety interpretation
- outcome interpretation
- effort judgement
- behaviour judgement

## 10. Engine inertness acceptance tests

S36 is accepted only if tests prove all of the following:

1. extra_work_recorded appears in artefact/history.
2. work_modified_recorded appears in artefact/history.
3. Phase 5 program structure is byte-identical before and after event capture.
4. Future compile output is byte-identical before and after event capture when Phase 1 input is unchanged.
5. Extra work does not become a planned item.
6. Modified work does not rewrite planned work.
7. No event payload may contain interpretation fields.
8. Unknown event types fail closed.
9. Non-monotonic append order fails closed.
10. Copy JSON contains only approved copy IDs and neutral strings.

## 11. Failure conditions

The implementation must fail closed for:

- unknown event_type
- missing required field
- unknown payload field
- invalid payload shape
- work_item_id supplied for extra_work_recorded
- missing work_item_id for work_modified_recorded
- unknown session_id
- unknown planned_work_item_id
- non-monotonic index
- attempted planned item mutation
- attempted retroactive planned item insertion
- forbidden copy string

## 12. Final rule

S36 records facts.

It does not decide, correct, recommend, compensate, score, progress, interpret, or protect.

If a deviation event changes engine output, the build is invalid.
