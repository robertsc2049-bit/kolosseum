<!-- DEV NOTE: Developer documentation surface. This document explains repo behaviour or boundaries, but canonical law remains in the tracked contracts, guards, and tests. Keep docs aligned with executable checks. -->

# S49 — Coach Queue / Review Surface Contract

Document class: implementation contract
Status: v0 implementation slice
Authority: subordinate to v0 scope, engine contract, CI gates, public/sales claim guard, and product/design references
Scope: linked coach review queue and factual queue-item status derivation
Engine impact: none
Does not define: engine behaviour, training advice, medical judgement, safety status, readiness certification, ranking, scoring, organisation runtime, team runtime, gym runtime, evidence sealing, or exportable proof

## 1. Purpose

The Coach Queue / Review Surface gives a linked coach a factual list of athlete records that require attention or are available for review.

This is a commercial product surface because coaches are a primary buyer/operator group.

The surface must feel like an operational queue, not a motivational dashboard or advisory engine.

## 2. Current v0 boundary

This slice is allowed in v0 because it is coach-managed, factual, and platform-only.

It may show:

- athlete identifier
- coach-athlete link status
- latest session record status
- latest check-in record status
- latest coach note status
- history count status
- review state
- blocked reason IDs
- queue item status
- source record references

It must not show or imply:

- safety status
- medical readiness
- injury risk
- performance prediction
- athlete ranking
- score
- suitability judgement
- best action
- prescribed training advice
- organisation dashboard
- team dashboard
- gym dashboard
- evidence sealing
- exportable proof

## 3. Classification

This is an active v0 surface.

It is platform-only.

It is engine-inert.

It is not a public/sales claim surface.

It is not an operator pilot sign-off surface.

It is not an organisation/team/gym runtime surface.

## 4. Queue item model

Each coach queue item represents one coach-visible athlete review record.

The canonical input fields are:

- `queue_item_id`
- `coach_id`
- `athlete_id`
- `coach_athlete_link_status`
- `latest_session_record_status`
- `latest_checkin_record_status`
- `latest_coach_note_status`
- `history_count_status`
- `source_record_refs`

No additional fields are permitted in the pure builder input.

## 5. Closed enums

`coach_athlete_link_status` is one of:

- `linked`
- `revoked`
- `missing`

`latest_session_record_status` is one of:

- `record_available`
- `review_required`
- `missing`

`latest_checkin_record_status` is one of:

- `record_available`
- `missing`

`latest_coach_note_status` is one of:

- `note_available`
- `none`

`history_count_status` is one of:

- `counts_available`
- `missing`

## 6. Derived queue status

The builder derives exactly one `queue_status`.

Allowed values:

- `review_required`
- `available`
- `blocked`

Rules:

A queue item is `blocked` when:

- coach-athlete link status is `revoked`
- coach-athlete link status is `missing`
- source record refs are missing
- an unknown enum value is present
- an unknown field is present

A queue item is `review_required` when:

- link status is `linked`
- source record refs are present
- latest session record status is `review_required`

A queue item is `available` when:

- link status is `linked`
- source record refs are present
- latest session record status is not `review_required`
- no blocked reasons exist

## 7. Blocked reason IDs

Allowed blocked reason IDs:

- `coach_athlete_link_revoked`
- `coach_athlete_link_missing`
- `source_record_missing`
- `unknown_queue_item_field`
- `unknown_queue_item_status`

Unknown blocked reason IDs are not permitted.

## 8. Output model

Each output queue item contains exactly:

- `queue_item_id`
- `coach_id`
- `athlete_id`
- `queue_status`
- `review_required`
- `blocked_reasons`
- `source_record_refs`

No additional output fields are permitted.

## 9. Sorting

Queue output order is deterministic.

Order:

1. `review_required`
2. `blocked`
3. `available`

Within each status group, sort by `athlete_id`, then `queue_item_id`.

## 10. Prohibited behaviour

The builder must not:

- read from storage
- call external services
- use current time
- use randomness
- mutate input
- infer missing data
- produce training advice
- produce public/sales claims
- alter engine behaviour
- alter Phase 1 to Phase 6 output
- create organisation/team/gym runtime
- create ranking
- create score
- create readiness certification
- create safety or medical meaning

## 11. Copy surface

Allowed user-facing copy strings are factual only.

Allowed copy keys:

- `coach_queue_title`
- `coach_queue_empty`
- `coach_queue_review_required`
- `coach_queue_available`
- `coach_queue_blocked`
- `coach_queue_source_missing`
- `coach_queue_link_missing`
- `coach_queue_link_revoked`
- `coach_queue_open_record`
- `coach_queue_review_item`

Copy must not contain:

- safe
- safer
- safety
- injury
- medical
- clinical
- optimal
- optimised
- best for you
- tailored to you
- guaranteed
- proven
- ready to train
- performance prediction
- readiness certification

## 12. Acceptance criteria

Tests must prove:

- linked athlete with `review_required` session derives `review_required`
- linked athlete without review-required session derives `available`
- revoked coach-athlete link derives `blocked`
- missing coach-athlete link derives `blocked`
- missing source refs derive `blocked`
- unknown input field derives `blocked`
- unknown enum derives `blocked`
- sorting is deterministic
- builder does not mutate input
- output does not contain score, rank, readiness certification, safety, medical, optimisation, or advice fields
