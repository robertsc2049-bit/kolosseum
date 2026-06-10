<!-- DEV NOTE: Developer documentation surface. This document explains repo behaviour or boundaries, but canonical law remains in the tracked contracts, guards, and tests. Keep docs aligned with executable checks. -->

# SESSION_EXECUTION_RUNTIME_SHELL.md

Document ID: session_execution_runtime_shell  
Slice: S33 — Session Execution Runtime Shell  
Status: v0 implementation contract  
Engine compatibility: EB2-1.0.0  
Scope class: closed-world  
Rewrite policy: rewrite-only  

## 1. Purpose

This document defines the minimal v0 session execution runtime shell.

The runtime shell records what the user declares during an executable session. It does not alter engine truth, Phase 1 declarations, Phase 5 materialised work, registry legality, future engine decisions, recompilation, progression, substitution, or any later compile path.

The shell exists to support factual execution capture only.

## 2. v0 runtime boundary

The runtime shell supports these actions only:

- start_session
- complete_work_item
- skip_work_item
- partial_complete_work_item
- end_session

The runtime shell stores events append-only.

The reducer consumes:

- a materialised executable session from the engine
- an ordered event history
- one new proposed runtime event

The reducer emits:

- a deterministic runtime state
- or a deterministic runtime failure

No database write is performed by the reducer. Persistence belongs to the app layer.

## 3. Non-authority rules

Runtime events MUST NOT:

- trigger recompilation
- alter Phase 1
- alter Phase 5 output
- alter future engine decisions
- mutate registries
- generate substitute work
- change planned work
- change work item legality
- interpret the user's behaviour
- add unplanned work items

## 4. Event schema

RuntimeEvent:

    event_id: string
    session_id: string
    user_id: string
    event_type: RuntimeEventType
    work_item_id: string | null
    factual_payload: object | null
    occurred_at: ISO-8601 string
    created_at: ISO-8601 string

RuntimeEventType:

    start_session
    complete_work_item
    skip_work_item
    partial_complete_work_item
    end_session

Required field rules:

- event_id is required and must be unique in the event history.
- session_id is required and must match the materialised session.
- user_id is required and must match the session owner.
- event_type is required and must be in the closed enum.
- work_item_id is required for work-item events.
- work_item_id must be null for session-level events.
- factual_payload is null unless required by the event type.
- occurred_at and created_at must be valid ISO-8601 strings.

## 5. Factual payloads

start_session:

    factual_payload: null

complete_work_item:

    factual_payload: null

skip_work_item:

    factual_payload: {
      reason_code?: RuntimeClosedReason
    }

partial_complete_work_item:

    factual_payload: {
      declared_completed_quantity: number
      declared_planned_quantity: number
      unit: string
      reason_code?: RuntimeClosedReason
    }

end_session:

    factual_payload: null

RuntimeClosedReason is optional and closed:

    not_declared
    time_unavailable
    equipment_unavailable
    user_stopped
    other_closed_reason

No free-text advice field exists in v0.

## 6. Session state

SessionRuntimeStatus:

    not_started
    active
    ended

WorkItemRuntimeStatus:

    pending
    completed
    skipped
    partial

Initial state:

- session status is not_started
- every planned work item is pending
- event history is empty

## 7. Legal transition model

Legal transitions:

- not_started + start_session -> active
- active + complete_work_item -> active
- active + skip_work_item -> active
- active + partial_complete_work_item -> active
- active + end_session -> ended

Illegal transitions:

- any work-item event before start_session
- start_session after start_session
- end_session before start_session
- end_session after ended
- any work-item event after ended
- any event for unknown work_item_id
- any duplicate event_id
- any event for a different session_id
- any event for a different user_id
- any unknown event_type
- any null required field

## 8. Duplicate completion handling

Duplicate handling is deterministic:

- If a work item is already completed, later complete_work_item for the same item fails.
- If a work item is already skipped, later complete_work_item fails.
- If a work item is partial, later complete_work_item fails.
- If a work item is already completed, later skip_work_item fails.
- If a work item is already completed, later partial_complete_work_item fails.
- If a work item is already partial, later partial_complete_work_item fails.

The reducer does not merge, amend, replace, or reconcile runtime truth.

## 9. Completion classification

Session completion is derived only from recorded event state.

Derived counts may include:

- total planned work items
- completed count
- skipped count
- partial count
- pending count

These are mechanical counts only.

## 10. CI and copy constraints

All user-facing strings must come from the copy surface JSON.

The copy surface must contain neutral labels only.

Inline UI strings are not permitted.

Copy must not contain advisory, judgement, correction, compliance, readiness, optimisation, medical, or outcome semantics.

## 11. Acceptance criteria

The slice is accepted only if:

- invalid transitions fail
- duplicate completion handling is deterministic
- ended sessions reject further work events
- event schema rejects unknown event types
- event schema rejects unknown work items
- partial completion records factual amount only
- runtime events do not alter planned work
- runtime events do not trigger recompilation
- copy lint passes
