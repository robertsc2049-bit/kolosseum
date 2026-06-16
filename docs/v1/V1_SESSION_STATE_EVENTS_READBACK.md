<!-- DEV NOTE: Developer documentation surface. Executable tests and guards prove behaviour; this note records the S-V1-39 boundary for future maintainers. -->

# V1 Session State and Events Readback

Status: active v1 slice record
Slice: S-V1-39
Surface: `v1_session_state_events_readback`

## Purpose

S-V1-39 binds session state and runtime event readback to explicit coach-athlete product permission checks.

The slice proves:

- athlete own-session readback is allowed
- assigned coach readback is allowed for the assigned athlete
- unassigned coach readback is rejected
- state readback is stable for the same explicit input
- events readback is stable for the same explicit input
- events readback preserves recorded sequence order

## Boundary

In scope:

- factual state readback envelope
- factual events readback envelope
- relationship-scoped access decision
- stable JSON byte comparison helper
- read-only mutation contract

Out of scope:

- broad analytics
- live coach intervention
- recommendation or judgement language
- engine mutation
- session event append behaviour
- organisation, team, gym, federation, or marketplace scope

## Permission rule

The readback surface uses `session_readback` inside the existing relationship permission guard.

Allowed:

- athlete actor where `actor.user_id` equals the session athlete id
- coach actor with an accepted individual coach-athlete relationship to the session athlete and explicit `session_readback` visibility

Rejected:

- unassigned coach
- other athlete
- missing relationship records
- invalid or incomplete session readback input

## Proof

Executable proof:

- `test/s_v1_39_session_state_events_readback.test.mjs`
- `ci/guards/s_v1_39_session_state_events_readback_guard.mjs`
- `ci/fixtures/v1_session_state_events_readback/s_v1_39_session_state_events_readback_cases.json`

Linked existing API readback surfaces:

- `src/api/sessions.handlers.ts`
- `src/api/session_state_query_service.ts`
- `src/api/session_events_query_service.ts`

This slice does not rewrite the existing `/sessions/:session_id/state` or `/sessions/:session_id/events` transport handlers. It establishes the v1 permission-scoped readback contract that those surfaces must obey when actor context is wired in a later API integration slice.
