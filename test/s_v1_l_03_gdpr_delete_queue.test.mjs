import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  GDPR_DELETE_QUEUE_BOUNDARY,
  createGdprDeleteQueueRequest,
  hashGdprDeleteQueueValue,
  serializeGdprDeleteQueueRequest
} from "../src/v1GdprDeleteQueue.mjs";
import {
  handleGdprDeleteQueueApiRequest
} from "../src/api/v1GdprDeleteQueueApi.mjs";

function validRequest(overrides = {}) {
  return {
    request_id: "gdpr_delete_req_001",
    actor_user_id: "user_001",
    actor_type: "athlete",
    target_user_id: "user_001",
    requested_action: "subject_erasure_request",
    requested_scope: "own_user_data",
    requested_at: "2026-06-17T13:00:00.000Z",
    reason_code: "user_requested_erasure",
    deterministic_probe: {
      canonical_input_hash: "a".repeat(64),
      output_hash: "b".repeat(64)
    },
    retention_records: [
      {
        record_id: "audit_001",
        record_type: "audit_record",
        user_id: "user_001",
        retention_reason: "audit_integrity_review_required"
      },
      {
        record_id: "proof_001",
        record_type: "proof_record",
        user_id: "user_001",
        retention_reason: "proof_integrity_review_required"
      },
      {
        record_id: "engine_001",
        record_type: "engine_truth_record",
        user_id: "user_001",
        retention_reason: "engine_truth_immutability_boundary"
      }
    ],
    ...overrides
  };
}

test("S-V1-L-03 delete request queued test records own-data request without hard deletion", () => {
  const result = createGdprDeleteQueueRequest(validRequest());

  assert.equal(result.ok, true);
  assert.equal(result.surface_id, "gdpr_delete_queue");
  assert.equal(result.queue_status, "queued_for_review");
  assert.equal(result.request_recorded, true);
  assert.equal(result.queue.deletion_execution_status, "not_performed");
  assert.equal(result.queue.hard_delete_performed, false);
  assert.equal(result.hard_delete_performed, false);
  assert.equal(result.engine_truth_changed, false);
  assert.equal(result.retroactive_engine_mutation, false);
  assert.equal(result.retention_boundary.retained_record_count, 3);
  assert.equal(result.retention_boundary.legal_review_required_before_any_action, true);
  assert.match(result.queue_id, /^gdpr_delete_queue_[a-f0-9]{16}$/);
  assert.match(result.request_hash, /^[a-f0-9]{64}$/);
});

test("S-V1-L-03 retention boundary test keeps proof audit and engine truth records review-only", () => {
  const result = createGdprDeleteQueueRequest(validRequest());

  assert.equal(result.ok, true);
  assert.equal(result.boundary.legal_request_queue_only, true);
  assert.equal(result.boundary.request_recorded, true);
  assert.equal(result.boundary.retention_review_required, true);
  assert.equal(result.boundary.hard_delete_performed, false);
  assert.equal(result.boundary.proof_or_audit_records_hard_deleted, false);
  assert.equal(result.boundary.engine_truth_changed, false);
  assert.equal(result.boundary.retroactive_engine_mutation, false);

  for (const retained of result.retained_records) {
    assert.equal(retained.retained_pending_review, true);
    assert.equal(retained.hard_delete_performed, false);
    assert.equal(retained.review_status, "retention_review_required");
  }

  const hardDeleteInput = validRequest({
    hard_delete: true
  });

  const hardDeleteResult = createGdprDeleteQueueRequest(hardDeleteInput);
  assert.equal(hardDeleteResult.ok, false);
  assert.equal(hardDeleteResult.code, "gdpr_delete_unknown_input_key");

  const nestedHardDelete = validRequest();
  nestedHardDelete.retention_records[0].hard_delete_performed = true;

  const nestedResult = createGdprDeleteQueueRequest(nestedHardDelete);
  assert.equal(nestedResult.ok, false);
  assert.equal(nestedResult.code, "gdpr_delete_blocked_payload_key");
  assert.equal(nestedResult.details.key, "hard_delete_performed");
});

test("S-V1-L-03 permission test blocks another target user", () => {
  const result = createGdprDeleteQueueRequest(validRequest({
    target_user_id: "user_002"
  }));

  assert.equal(result.ok, false);
  assert.equal(result.code, "gdpr_delete_permission_denied");
  assert.equal(result.request_recorded, false);
  assert.equal(result.hard_delete_performed, false);
  assert.equal(result.engine_truth_changed, false);
  assert.equal(result.product_permission_state_only, true);
});

test("S-V1-L-03 permission test blocks retention records owned by another user", () => {
  const input = validRequest();
  input.retention_records = [
    {
      record_id: "audit_other",
      record_type: "audit_record",
      user_id: "user_002",
      retention_reason: "audit_integrity_review_required"
    }
  ];

  const result = createGdprDeleteQueueRequest(input);

  assert.equal(result.ok, false);
  assert.equal(result.code, "gdpr_delete_retention_record_permission_denied");
  assert.equal(result.details.owner_user_id, "user_002");
});

test("S-V1-L-03 deterministic queue hash is stable and engine truth remains unchanged", () => {
  const input = validRequest();
  const result = createGdprDeleteQueueRequest(input);

  assert.equal(result.ok, true);
  assert.equal(
    result.deterministic_probe_hash,
    hashGdprDeleteQueueValue(input.deterministic_probe)
  );
  assert.equal(result.engine_visible, false);
  assert.equal(result.engine_truth_changed, false);
  assert.equal(result.retroactive_engine_mutation, false);

  const serialised = serializeGdprDeleteQueueRequest(input);
  const parsed = JSON.parse(serialised);
  assert.equal(parsed.request_hash, result.request_hash);
});

test("S-V1-L-03 API adapter queues request without engine mutation", () => {
  const response = handleGdprDeleteQueueApiRequest({
    method: "POST",
    body: validRequest()
  });

  assert.equal(response.status, 202);
  assert.equal(response.body.api_surface_id, "gdpr_delete_queue_api");
  assert.equal(response.body.ok, true);
  assert.equal(response.body.request_recorded, true);
  assert.equal(response.body.hard_delete_performed, false);
  assert.equal(response.body.engine_truth_changed, false);

  const blocked = handleGdprDeleteQueueApiRequest({
    method: "GET",
    body: validRequest()
  });

  assert.equal(blocked.status, 405);
  assert.equal(blocked.body.request_recorded, false);
  assert.equal(blocked.body.engine_truth_changed, false);
});

test("S-V1-L-03 copy entries stay neutral", () => {
  const copy = JSON.parse(readFileSync("copy/gdpr_delete_queue_copy.json", "utf8"));
  const serialised = JSON.stringify(copy);

  assert.equal(copy.surface_id, "gdpr_delete_queue");
  assert.equal(copy.entries["gdpr_delete_queue.request_queued"], "Deletion request queued.");
  assert.equal(copy.entries["gdpr_delete_queue.blocked"], "Deletion request blocked.");
  assert.doesNotMatch(serialised, /\brecommend/i);
  assert.doesNotMatch(serialised, /\boptimise\b/i);
  assert.doesNotMatch(serialised, /\boptimize\b/i);
  assert.doesNotMatch(serialised, /\bready\b/i);
  assert.doesNotMatch(serialised, /\bsafe\b/i);
});

test("S-V1-L-03 boundary object is explicit and closed for hard deletion", () => {
  assert.equal(GDPR_DELETE_QUEUE_BOUNDARY.legal_request_queue_only, true);
  assert.equal(GDPR_DELETE_QUEUE_BOUNDARY.request_recorded, true);
  assert.equal(GDPR_DELETE_QUEUE_BOUNDARY.permission_scoped, true);
  assert.equal(GDPR_DELETE_QUEUE_BOUNDARY.own_user_data_only, true);
  assert.equal(GDPR_DELETE_QUEUE_BOUNDARY.retention_review_required, true);
  assert.equal(GDPR_DELETE_QUEUE_BOUNDARY.hard_delete_performed, false);
  assert.equal(GDPR_DELETE_QUEUE_BOUNDARY.proof_or_audit_records_hard_deleted, false);
  assert.equal(GDPR_DELETE_QUEUE_BOUNDARY.engine_truth_changed, false);
  assert.equal(GDPR_DELETE_QUEUE_BOUNDARY.retroactive_engine_mutation, false);
  assert.equal(GDPR_DELETE_QUEUE_BOUNDARY.provider_call_performed, false);
});