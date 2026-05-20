# S37 — Session Artefact Viewer

Document: SESSION_ARTEFACT_VIEWER.md  
Status: v0 implementation contract  
Engine compatibility: EB2-1.0.0  
Scope: v0 Deterministic Execution Alpha  
Rewrite policy: rewrite-only  
Authority level: subordinate product/runtime implementation contract

## 1. Purpose

This document defines the v0 session artefact viewer.

The viewer allows authorised users to inspect factual session artefacts. It is read-only. It does not allow editing, event override, Phase 1 editing, coaching judgement, hidden progression logic, or any interpretation layer.

The viewer exists only to show what was recorded.

## 2. Viewer scope

The viewer may show only the following artefact fields:

- session status
- work item list
- completed factual events
- skipped factual events
- partial factual events
- event timestamps
- source declaration hash
- activity_id
- execution_scope

The viewer must not show or calculate:

- analytics
- trends
- rankings
- readiness labels
- optimisation language
- safety language
- compliance language
- outcome interpretation
- comparison between athletes
- future session implications
- coaching instruction
- correction
- recommendation
- progression trigger

## 3. Actors

Supported viewer actors in v0:

- athlete
- coach

Unsupported actors must be denied.

## 4. Permission matrix

| Actor | Relationship to artefact athlete | Link status | May view artefact | May edit artefact | May override events | May edit Phase 1 |
| --- | --- | --- | --- | --- | --- | --- |
| athlete | own artefact | not required | yes | no | no | no |
| athlete | another athlete | not applicable | no | no | no | no |
| coach | linked athlete | accepted | yes | no | no | no |
| coach | unlinked athlete | none | no | no | no | no |
| coach | linked athlete | invited | no | no | no | no |
| coach | linked athlete | rejected | no | no | no | no |
| coach | linked athlete | expired | no | no | no | no |
| coach | linked athlete | revoked | no | no | no | no |
| unknown actor | any | any | no | no | no | no |

## 5. Revoked link rule

A revoked coach-athlete link denies viewer access.

Historical visibility is also denied unless a separate historical visibility rule is explicitly defined by a later lawful v0 contract. S37 defines no such rule.

If the visibility period is unclear, the viewer must fail closed.

## 6. Artefact record contract

A session artefact record must contain:

- artefact_id
- session_id
- athlete_user_id
- session_status
- work_items
- factual_events
- source_declaration_hash
- activity_id
- execution_scope
- created_at_iso8601
- updated_at_iso8601

Allowed session_status values:

- planned
- in_progress
- completed
- stopped
- partial

Allowed factual event types:

- work_completed
- work_skipped
- work_partial

No other event type may be projected by this viewer.

## 7. Work item list

Each work item shown by the viewer must contain:

- work_item_id
- display_order
- exercise_token_id
- planned_quantity

Allowed planned_quantity fields:

- sets
- reps
- load_value
- load_unit
- duration_seconds
- distance_meters

The viewer must not rewrite planned_quantity.

## 8. Factual event list

Each factual event shown by the viewer must contain:

- event_id
- event_type
- work_item_id
- occurred_at_iso8601
- recorded_at_iso8601
- factual_quantity

The viewer must not add event interpretation.

## 9. API contract

### 9.1 Read session artefact

Method:

GET

Path:

/v0/session-artefacts/:artefact_id

Required actor context:

- actor_type
- user_id

Response 200:

- artefact_id
- session_id
- athlete_user_id
- session_status
- work_items
- factual_events
- source_declaration_hash
- activity_id
- execution_scope
- copy_ids
- read_only

Response 403:

- error: access_denied
- copy_id: ARTEFACT_ACCESS_DENIED

Response 404:

- error: artefact_not_found
- copy_id: ARTEFACT_NOT_FOUND

### 9.2 Mutating requests

All non-GET methods against the viewer path must be rejected.

Rejected methods include:

- POST
- PUT
- PATCH
- DELETE

Response 405:

- error: viewer_read_only
- copy_id: VIEWER_READ_ONLY

### 9.3 Event override requests

Event override requests must not exist in v0.

Any attempted route such as:

/v0/session-artefacts/:artefact_id/events/:event_id/override

must be rejected as read-only.

Response 405:

- error: viewer_read_only
- copy_id: VIEWER_READ_ONLY

### 9.4 Phase 1 edit requests

Phase 1 edit requests must not exist in the viewer.

Any attempted route such as:

/v0/session-artefacts/:artefact_id/phase1

with a mutating method must be rejected.

Response 405:

- error: viewer_read_only
- copy_id: VIEWER_READ_ONLY

## 10. UI states

### 10.1 Loading

Copy ID:

- SESSION_ARTEFACT_LOADING

### 10.2 Loaded

The loaded state shows only factual fields.

Copy IDs:

- SESSION_ARTEFACT_VIEWER_TITLE
- SESSION_STATUS_LABEL
- WORK_ITEMS_LABEL
- FACTUAL_EVENTS_LABEL
- TIMESTAMPS_LABEL
- SOURCE_DECLARATION_HASH_LABEL
- ACTIVITY_ID_LABEL
- EXECUTION_SCOPE_LABEL
- VIEWER_READ_ONLY

### 10.3 Empty factual events

Copy ID:

- NO_FACTUAL_EVENTS_RECORDED

### 10.4 Access denied

Copy ID:

- ARTEFACT_ACCESS_DENIED

### 10.5 Not found

Copy ID:

- ARTEFACT_NOT_FOUND

### 10.6 Read-only rejection

Copy ID:

- VIEWER_READ_ONLY

## 11. Copy rules

All viewer copy must be registry-backed.

Copy must be:

- neutral
- factual
- non-advisory
- non-comparative
- non-directional
- non-judgemental

Copy must not imply:

- athlete quality
- coach approval
- event correction
- future program change
- athlete state
- session value
- hidden scoring
- hidden analysis

## 12. Reducer and API separation

The viewer must read already-created artefacts.

The viewer must not:

- call engine compilation
- call substitution logic
- write runtime events
- write Phase 1
- write coach notes
- write declaration records
- write link records
- mutate artefacts

## 13. Acceptance criteria

S37 is accepted only if tests prove:

1. Athlete can view own artefact.
2. Athlete cannot view another athlete artefact.
3. Accepted linked coach can view linked athlete artefact.
4. Unlinked coach access is denied.
5. Revoked link access is denied.
6. Invited, rejected, and expired link access is denied.
7. Coach cannot edit artefacts.
8. Coach cannot override events.
9. Coach cannot edit Phase 1 through the viewer.
10. Viewer response contains only factual fields.
11. Viewer response includes session status, work items, factual events, timestamps, source declaration hash, activity_id, and execution_scope.
12. Copy JSON contains neutral registered strings only.

## 14. Final rule

The S37 viewer is a read-only factual projection.

If it edits, overrides, interprets, scores, ranks, recommends, compares, or changes engine behaviour, the build is invalid.