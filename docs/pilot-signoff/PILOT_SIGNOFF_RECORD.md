# S46 — Pilot Sign-Off Record

Status: v0 implementation slice  
Scope: platform operator record  
Engine impact: none  
Authority: subordinate to v0 scope, pilot acceptance pack, CI gates, and platform storage policy

## Purpose

The Pilot Sign-Off Record stores the final operator result for a paid coach pilot.

It records one of two outcomes:

- `coach_ready`
- `blocked`

The record is a platform artefact. It is not an engine input, not an engine output, not a pricing claim, not a public claim surface, and not a coach authority surface.

## Required record fields

The record contains exactly these top-level fields:

- `signoff_id`
- `pilot_id`
- `checklist_id`
- `checklist_version`
- `final_status`
- `readiness_item_results`
- `negative_boundary_results`
- `source_artefact_refs`
- `blocked_reasons`
- `signed_by_operator_id`
- `signed_at_utc`
- `record_hash`

No additional top-level fields are permitted.

## Final status

`final_status` is a closed enum:

- `coach_ready`
- `blocked`

Unknown status values fail validation.

## Coach-ready rule

A record with `final_status: coach_ready` is valid only when all of the following are true:

1. Every required item in `readiness_item_results` has `passed: true`.
2. Every item in `negative_boundary_results` has `passed: true`.
3. `source_artefact_refs` contains at least one source artefact reference.
4. `blocked_reasons` is empty.
5. `record_hash` matches the deterministic hash of the sign-off content excluding `record_hash`.

If any condition fails, the record is invalid.

## Blocked rule

A record with `final_status: blocked` is valid only when all of the following are true:

1. `blocked_reasons` contains at least one reason.
2. `record_hash` matches the deterministic hash of the sign-off content excluding `record_hash`.

A blocked record may contain failed readiness or boundary results. That failure state must remain factual and non-advisory.

## Readiness item result shape

Each item in `readiness_item_results` must contain exactly:

- `item_id`
- `required`
- `passed`
- `source_artefact_ref_ids`

Rules:

- `item_id` is an opaque string.
- `required` is boolean.
- `passed` is boolean.
- `source_artefact_ref_ids` is an array of opaque strings.
- Unknown fields fail validation.

This slice does not redefine S45. It records S45 item outcomes supplied by the acceptance pack.

## Negative boundary result shape

Each item in `negative_boundary_results` must contain exactly:

- `boundary_id`
- `passed`
- `source_artefact_ref_ids`

Rules:

- `boundary_id` is an opaque string.
- `passed` is boolean.
- `source_artefact_ref_ids` is an array of opaque strings.
- Unknown fields fail validation.

## Source artefact reference shape

Each item in `source_artefact_refs` must contain exactly:

- `artefact_ref_id`
- `artefact_type`
- `artefact_uri`
- `content_hash`

Rules:

- `artefact_ref_id` is an opaque string.
- `artefact_type` is a closed enum:
  - `payment_confirmation`
  - `workspace_record`
  - `coach_account_record`
  - `athlete_account_record`
  - `coach_athlete_link_record`
  - `scope_lock_record`
  - `phase1_acceptance_record`
  - `compile_result_record`
  - `coach_surface_check_record`
  - `boundary_check_record`
  - `operator_note_record`
- `artefact_uri` is a platform-local or repository-local reference.
- `content_hash` is a lowercase SHA-256 hex string.
- Unknown fields fail validation.

## Hash rule

`record_hash` is computed over canonical JSON of the full record excluding `record_hash`.

Canonical JSON means:

- object keys sorted lexicographically at every level
- arrays preserved in declared order
- no whitespace
- UTF-8 input
- SHA-256 lowercase hex digest

Changing any sign-off content must change `record_hash`.

## Append-only rule

Pilot sign-off records are append-only.

Allowed storage operation:

- create new sign-off record

Forbidden storage operations:

- update existing sign-off record
- patch existing sign-off record
- delete existing sign-off record
- mutate `final_status`
- mutate source artefact references
- mutate operator identity
- mutate signing timestamp
- mutate hash after creation

Correction requires a new sign-off record with a new `signoff_id`.

## Prohibited semantics

The record must not contain marketing claims.

The record must not introduce or imply:

- Phase 7 runtime capability
- Phase 8 runtime capability
- exportable proof
- organisation runtime
- team runtime
- gym runtime
- analytics
- messaging
- score or ranking
- medical meaning
- safety meaning
- optimisation
- coach override

The record stores operator sign-off facts only.

## Acceptance criteria

The executable test runner must assert:

- valid `coach_ready` record passes
- missing required item fails
- failed negative boundary item fails
- missing source artefact fails
- unknown status fails
- record hash changes when sign-off content changes