# BETA-14 Phase 6 Runtime Reducer

## Status

BETA-14 defines the deterministic factual runtime reducer for the September controlled beta.

The reducer consumes only BETA-13 canonical runtime events.

## Factual state

The reducer records:

- session start and end;
- pending, active, completed and skipped work items;
- split entry and return decision;
- factual pain follow-up state;
- accepted event IDs and event-type counts;
- completed, partial or terminated classification.

## Event order

The reducer enforces:

- `SESSION_START` first;
- exact next sequence only;
- unique accepted event IDs;
- one active work item at a time;
- work-item terminal events only after work-item start;
- no work-item event while split is active;
- return decision only while split is active;
- no event after terminal session state;
- no session end while a required pain follow-up is pending.

## Split return

`continue` clears the split and preserves unresolved work items.

`skip_remaining` factually marks unresolved work items as skipped for the current session only.

Split decisions do not alter later engine input, future planning, registry truth or programme truth.

## Classification

`completed` means every work item was explicitly completed before a completed session end.

`partial` means some work was completed but the session ended with skipped or unresolved work, or a completed end contained explicit work-item skips.

`terminated` means the session stopped without a completed work item.

## Immutability and replay

Reducer state is deeply frozen and carries a deterministic state hash.

Edited reducer state fails before another event is applied.

Canonical event logs are validated through BETA-13 before replay. Replaying identical accepted events produces byte-identical factual state.

The reducer emits no advice, interpretation, readiness, safety, optimisation or recommendation.
