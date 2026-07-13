# BETA-13 Phase 6 Event Schema

## Status

BETA-13 locks the closed-world beta Phase 6 runtime event admission schema.

Validation occurs before reducer execution. Invalid payloads therefore cannot change reducer state through the BETA-13 admission surface.

## Materialised identity authority

The materialised session is authoritative for:

- `session_id`
- `block_id`
- `work_item_id`
- work-item-to-block binding

A client must not submit `session_id`, `block_id`, `event_id`, or `seq` inside a runtime event payload.

User-entered block IDs are forbidden.

## Closed event types

The exact beta event type set is:

- `SESSION_START`
- `WORK_ITEM_START`
- `WORK_ITEM_DONE`
- `WORK_ITEM_SKIP`
- `SPLIT_ENTER`
- `SPLIT_RETURN_DECISION`
- `PAIN_FLAG`
- `PAIN_FOLLOW_UP`
- `SESSION_END`

Unknown event types fail.

## Closed factual values

Split return decisions:

- `continue`
- `skip_remaining`

Pain follow-up response codes:

- `continue`
- `skip_work_item`
- `end_session`

Session end codes:

- `completed`
- `stopped`

Pain events record only factual declared runtime state. They do not infer diagnosis, safety, readiness, severity, suitability, treatment, or recommendation.

## Free-text runtime truth

Free-text runtime truth is forbidden.

Runtime payloads cannot contain notes, comments, messages, descriptions, coach notes, pain text, or other undeclared fields.

## Append-only law

Accepted logs must:

- start with one `SESSION_START`;
- use exact sequence values beginning at 1;
- contain unique deterministic event IDs;
- contain only materialised session, block, and work-item IDs;
- resolve an active split through one return decision;
- resolve a required pain follow-up before work-item or session termination;
- contain no event after `SESSION_END`.

Invalid event logs fail before reducer state changes.
