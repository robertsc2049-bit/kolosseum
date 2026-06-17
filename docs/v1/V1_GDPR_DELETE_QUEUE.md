# S-V1-L-03 GDPR Delete Queue

## Purpose

S-V1-L-03 implements a GDPR deletion request queue for controlled v1.

The slice records a deletion request for later legal/product review. It does not perform deletion.

## Boundary

Included:

- GDPR deletion request contract.
- Own-user permission check.
- Deletion request queue record.
- Explicit audit/legal retention boundary.
- Explicit proof/audit retention review flags.
- API adapter.
- Neutral copy IDs.
- Tests and CI guard.

Not included:

- hard deletion of product records.
- hard deletion of proof or audit records.
- runtime event deletion.
- engine truth rewriting.
- provider calls.
- organisation deletion workflow.
- broad data warehouse deletion workflow.

## Invariants

- Delete request is recorded.
- Audit/legal retention boundaries are explicit.
- Engine truth is not retroactively mutated.
- The queue record does not create coaching, training-value, approval, or external attestation claims.
- Retained records stay review-only until a later lawful boundary explicitly permits action.

## Queue shape

The queue record contains:

- request metadata.
- permission boundary.
- queue status.
- deletion execution status.
- retention review status.
- retained record count.
- retained record review rows.
- deterministic probe hash where supplied.
- queue request hash.
- copy IDs.

## Permission model

The only active permission model in this slice is own-user request handling.

A request is blocked if:

- actor_user_id differs from target_user_id.
- requested_action is not subject_erasure_request.
- requested_scope is not own_user_data.
- actor_type is not athlete or coach.
- reason_code is unknown.
- input includes an unknown top-level key.
- retained records declare another owner user.
- blocked hard-delete or retroactive-mutation keys appear.

## Retention boundary

Retention records are not deleted by this slice.

Supported retained record types:

- audit_record.
- proof_record.
- legal_retention_record.
- billing_record.
- engine_truth_record.

Supported retention reasons:

- audit_integrity_review_required.
- proof_integrity_review_required.
- legal_retention_review_required.
- billing_retention_review_required.
- engine_truth_immutability_boundary.

## Engine boundary

The implementation does not import engine code.

The deterministic probe is hashed only to prove pass-through invariance.

The queue surface returns:

- request_recorded: true on accepted queue requests.
- hard_delete_performed: false.
- proof_or_audit_records_hard_deleted: false.
- engine_visible: false.
- engine_truth_changed: false.
- retroactive_engine_mutation: false.

## CI token

- CI_V1_GDPR_DELETE_QUEUE

## Standard proof sequence

Target proof:

- node --test test/s_v1_l_03_gdpr_delete_queue.test.mjs
- node ci/guards/s_v1_l_03_gdpr_delete_queue_guard.mjs

Generated-file proof:

- node ci/scripts/run_failure_token_index_guard.mjs
- node ci/guards/guards_index_guard.mjs
- node ci/scripts/sha256_guard.mjs

Full proof:

- GitHub PR checks run lint:fast and full suites.