import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  GDPR_EXPORT_BOUNDARY,
  createGdprExportHandling,
  hashGdprExportValue,
  serializeGdprExportHandling
} from "../src/v1GdprExportHandling.mjs";
import {
  handleGdprExportHandlingApiRequest
} from "../src/api/v1GdprExportHandlingApi.mjs";

function validRequest(overrides = {}) {
  return {
    request_id: "gdpr_req_001",
    actor_user_id: "user_001",
    actor_type: "athlete",
    target_user_id: "user_001",
    requested_export_type: "subject_data_access_json",
    requested_at: "2026-06-17T12:00:00.000Z",
    deterministic_probe: {
      canonical_input_hash: "a".repeat(64),
      output_hash: "b".repeat(64)
    },
    data_sources: {
      account: {
        user_id: "user_001",
        email: "athlete@example.test",
        created_at: "2026-06-01T00:00:00.000Z"
      },
      phase1_declarations: [
        {
          user_id: "user_001",
          declaration_id: "decl_001",
          accepted_at: "2026-06-10T00:00:00.000Z"
        }
      ],
      relationships: [
        {
          user_id: "user_001",
          relationship_id: "rel_001",
          relationship_state: "accepted",
          created_at: "2026-06-11T00:00:00.000Z"
        }
      ],
      programme_assignments: [
        {
          user_id: "user_001",
          assignment_id: "assign_001",
          created_at: "2026-06-12T00:00:00.000Z"
        }
      ],
      session_records: [
        {
          user_id: "user_001",
          session_id: "session_001",
          started_at: "2026-06-13T00:00:00.000Z"
        }
      ],
      runtime_events: [
        {
          user_id: "user_001",
          event_id: "event_002",
          recorded_at: "2026-06-13T00:02:00.000Z"
        },
        {
          user_id: "user_001",
          event_id: "event_001",
          recorded_at: "2026-06-13T00:01:00.000Z"
        }
      ],
      coach_notes_authored: [],
      legal_document_acknowledgements: [
        {
          user_id: "user_001",
          document_key: "controlled_launch_privacy",
          accepted_at: "2026-06-14T00:00:00.000Z"
        }
      ],
      billing_records: [
        {
          user_id: "user_001",
          billing_record_id: "bill_001",
          created_at: "2026-06-15T00:00:00.000Z"
        }
      ]
    },
    ...overrides
  };
}

test("S-V1-L-02 allowed path exports own user data only", () => {
  const result = createGdprExportHandling(validRequest());

  assert.equal(result.ok, true);
  assert.equal(result.surface_id, "gdpr_export_handling");
  assert.equal(result.request.requested_export_type, "subject_data_access_json");
  assert.equal(result.permission.permission_scoped, true);
  assert.equal(result.permission.permission_scope, "own_user_data_only");
  assert.equal(result.boundary.legal_data_access_only, true);
  assert.equal(result.boundary.proof_layer_export, false);
  assert.equal(result.boundary.organisation_export, false);
  assert.equal(result.boundary.broad_analytics_export, false);
  assert.equal(result.boundary.engine_truth_changed, false);
  assert.equal(result.boundary.coaching_correctness_claim, false);
  assert.equal(result.engine_truth_changed, false);
  assert.equal(result.subject_data.runtime_events[0].event_id, "event_001");
  assert.equal(result.subject_data.runtime_events[1].event_id, "event_002");
  assert.match(result.export_payload_hash, /^[a-f0-9]{64}$/);
});

test("S-V1-L-02 permission test blocks another target user", () => {
  const result = createGdprExportHandling(validRequest({
    target_user_id: "user_002"
  }));

  assert.equal(result.ok, false);
  assert.equal(result.code, "gdpr_export_permission_denied");
  assert.equal(result.engine_truth_changed, false);
  assert.equal(result.product_permission_state_only, true);
});

test("S-V1-L-02 permission test blocks records owned by another user", () => {
  const input = validRequest();
  input.data_sources.session_records = [
    {
      user_id: "user_002",
      session_id: "session_other",
      started_at: "2026-06-13T00:00:00.000Z"
    }
  ];

  const result = createGdprExportHandling(input);

  assert.equal(result.ok, false);
  assert.equal(result.code, "gdpr_export_record_permission_denied");
  assert.equal(result.details.category, "session_records");
});

test("S-V1-L-02 blocks proof evidence organisation analytics and broad export scope", () => {
  const evidenceKey = validRequest();
  evidenceKey.data_sources.account.evidence_envelope = { id: "env_001" };

  const evidenceResult = createGdprExportHandling(evidenceKey);
  assert.equal(evidenceResult.ok, false);
  assert.equal(evidenceResult.code, "gdpr_export_blocked_payload_key");

  const broadType = createGdprExportHandling(validRequest({
    requested_export_type: "bulk_data_export"
  }));

  assert.equal(broadType.ok, false);
  assert.equal(broadType.code, "gdpr_export_type_not_allowed");

  const unknownCategory = validRequest();
  unknownCategory.data_sources.organisation_export = [];

  const unknownResult = createGdprExportHandling(unknownCategory);
  assert.equal(unknownResult.ok, false);
  assert.equal(unknownResult.code, "gdpr_export_blocked_payload_key");
  assert.equal(unknownResult.details.key, "organisation_export");
});

test("S-V1-L-02 deterministic probe is hashed and engine truth remains unchanged", () => {
  const input = validRequest();
  const result = createGdprExportHandling(input);

  assert.equal(result.ok, true);
  assert.equal(
    result.deterministic_probe_hash,
    hashGdprExportValue(input.deterministic_probe)
  );
  assert.equal(result.engine_visible, false);
  assert.equal(result.engine_truth_changed, false);

  const serialised = serializeGdprExportHandling(input);
  const parsed = JSON.parse(serialised);
  assert.equal(parsed.export_payload_hash, result.export_payload_hash);
});

test("S-V1-L-02 API adapter maps GDPR export handling without engine mutation", () => {
  const response = handleGdprExportHandlingApiRequest({
    method: "POST",
    body: validRequest()
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.api_surface_id, "gdpr_export_handling_api");
  assert.equal(response.body.ok, true);
  assert.equal(response.body.engine_truth_changed, false);

  const blocked = handleGdprExportHandlingApiRequest({
    method: "GET",
    body: validRequest()
  });

  assert.equal(blocked.status, 405);
  assert.equal(blocked.body.engine_truth_changed, false);
});

test("S-V1-L-02 copy entries stay neutral", () => {
  const copy = JSON.parse(readFileSync("copy/gdpr_export_copy.json", "utf8"));
  const serialised = JSON.stringify(copy);

  assert.equal(copy.surface_id, "gdpr_export_handling");
  assert.equal(copy.entries["gdpr_export.available"], "Export prepared.");
  assert.equal(copy.entries["gdpr_export.blocked"], "Export request blocked.");
  assert.doesNotMatch(serialised, /\brecommend/i);
  assert.doesNotMatch(serialised, /\boptimise\b/i);
  assert.doesNotMatch(serialised, /\bready\b/i);
});

test("S-V1-L-02 boundary object is explicit and closed for excluded surfaces", () => {
  assert.equal(GDPR_EXPORT_BOUNDARY.legal_data_access_only, true);
  assert.equal(GDPR_EXPORT_BOUNDARY.permission_scoped, true);
  assert.equal(GDPR_EXPORT_BOUNDARY.own_user_data_only, true);
  assert.equal(GDPR_EXPORT_BOUNDARY.proof_layer_export, false);
  assert.equal(GDPR_EXPORT_BOUNDARY.organisation_export, false);
  assert.equal(GDPR_EXPORT_BOUNDARY.broad_analytics_export, false);
  assert.equal(GDPR_EXPORT_BOUNDARY.engine_truth_changed, false);
});