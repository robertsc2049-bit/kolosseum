# V1 Live Session Status Read-Only

Status: active v1 slice documentation
Slice: S-V1-43
Surface: live_session_status

## Purpose

Live session status is read-only factual visibility for assigned coach-athlete relationships.

Assigned coach can view live status only.

Watching does not mutate session state.

Status labels are factual only.

## Boundary

Allowed:

- Assigned coach views factual live session status for an assigned athlete.
- The read model may show status, started_at, last_event_at, recorded counts, current work item, last work item, and event timeline.
- The UI model may render copy identifiers and recorded facts.
- The API may return a read-only response or a product-auth failure.

Not included:

- Live coach override.
- Messaging or chat.
- Video.
- Coach-triggered substitution.
- Live coach action controls.
- Session state mutation caused by watching.
- Runtime event append caused by watching.
- Engine call caused by watching.
- Recommendation, readiness, fatigue, risk, safety, or advice labels.

## Required proof

- Live status permission test.
- Watching does not alter reducer output or session state test.
- Copy lint.
- S-V1-43 guard.
- Standard generated index and checksum proof.