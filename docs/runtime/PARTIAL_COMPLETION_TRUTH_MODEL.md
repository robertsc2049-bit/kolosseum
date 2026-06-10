# PARTIAL_COMPLETION_TRUTH_MODEL.md

Document ID: partial_completion_truth_model  
Slice: S35 — Partial Completion Truth Model  
Status: v0 implementation contract  
Engine compatibility: EB2-1.0.0  
Scope class: closed-world  
Rewrite policy: rewrite-only  

## 1. Purpose

Partial completion is factual runtime truth capture.

It records the declared amount completed against the planned amount for a materialised work item. It does not alter planned work, generate replacement work, trigger later compile behaviour, affect future engine decisions, or interpret the event.

## 2. Event model

partial_complete_work_item uses the RuntimeEvent schema.

Required fields:

    event_id
    session_id
    user_id
    event_type
    work_item_id
    factual_payload
    occurred_at
    created_at

Required payload:

    declared_completed_quantity: number
    declared_planned_quantity: number
    unit: string

Optional payload:

    reason_code: RuntimeClosedReason

No note field is included in v0.

## 3. Payload constraints

declared_completed_quantity:

- must be finite
- must be greater than or equal to zero
- must be less than declared_planned_quantity

declared_planned_quantity:

- must be finite
- must be greater than zero

unit:

- must be a non-empty string
- must match the planned work-item unit

reason_code:

- optional
- if present, must be in the closed enum

## 4. Reducer behaviour

When a legal partial_complete_work_item event is applied:

- the event is appended
- the target work item becomes partial
- completed quantity is recorded
- planned quantity is echoed
- unit is echoed
- partial count increments mechanically
- planned work remains unchanged

The reducer MUST NOT:

- edit the planned quantity
- complete the item by implication
- skip the item by implication
- generate substitute work
- create a new work item
- modify future engine decisions
- mutate Phase 1
- mutate Phase 5 materialised output

## 5. History counts

History may include:

- completed count
- skipped count
- partial count
- pending count

These counts are mechanical summaries only.

## 6. Engine output invariance

Applying a partial completion event must not change:

- phase1 hash
- materialised session structure
- planned work item list
- work item legality
- future compile inputs
- registry reads
- selection output

Runtime state changes are contained to event-derived state only.

## 7. Acceptance criteria

The slice is accepted only if:

- partial event records factual amount only
- invalid partial quantities fail
- unknown work item fails
- duplicate partial event for the same work item fails
- completed item cannot become partial
- skipped item cannot become partial
- planned work is unchanged after partial event
- history count includes partial count
- copy contains no judgement or advice