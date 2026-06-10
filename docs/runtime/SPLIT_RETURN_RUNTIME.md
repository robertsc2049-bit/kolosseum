# SPLIT_RETURN_RUNTIME.md

Document ID: split_return_runtime  
Slice: S34 — Split / Return Runtime  
Status: v0 implementation contract  
Engine compatibility: EB2-1.0.0  
Scope class: closed-world  
Rewrite policy: rewrite-only  

## 1. Purpose

This document defines lawful v0 split, return, and resume runtime behaviour.

Split / return exists to record a factual interruption and later continuation of the same materialised session. It does not re-run compile, alter legality, alter planned work, generate new work, or modify any previous work-item state.

## 2. Runtime event additions

The following event types are added to the runtime event enum:

- split_session
- return_to_session
- resume_session

These events use the same RuntimeEvent schema as S33.

## 3. Payload rules

split_session:

    factual_payload: {
      reason_code?: RuntimeClosedReason
    }

return_to_session:

    factual_payload: null

resume_session:

    factual_payload: null

No reason is required.

If a reason is recorded, it must come from the closed enum.

No inferred reason exists.

## 4. Session states

SessionRuntimeStatus is extended:

    not_started
    active
    split
    ended

## 5. Legal transition model

Legal split / return transitions:

- active + split_session -> split
- split + return_to_session -> split
- split + resume_session -> active

Illegal transitions:

- split_session before start_session
- split_session after ended
- split_session when already split
- return_to_session unless status is split
- resume_session unless status is split
- work-item event while status is split
- end_session while status is split
- any new work item generated during split / return
- any change to completed, skipped, or partial work-item state during split / return

## 6. Restore rule

Return restores the prior factual state by replaying the same ordered event history.

The runtime state after resume is exactly:

- the same planned session
- the same work item statuses
- the same counts
- the same session_id
- the same user_id
- one additional return_to_session event if recorded
- one additional resume_session event if recorded

No work items are added.

No completed item is reopened.

No skipped item is reopened.

No partial item is completed by implication.

## 7. Determinism rule

Given identical materialised session input and identical ordered runtime event history, the reducer must emit identical restored state.

Event order is authoritative.

No time-based branching is permitted.

## 8. Acceptance criteria

The slice is accepted only if:

- split session can resume from previous state
- completed items remain completed
- skipped items remain skipped
- partial items remain partial
- no new work items are generated
- the same event history produces the same restored state
- illegal split / return transitions fail
- copy surface contains neutral labels only