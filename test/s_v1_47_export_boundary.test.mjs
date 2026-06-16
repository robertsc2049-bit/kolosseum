import test from "node:test";
import assert from "node:assert/strict";

import {
  createV1ExportBoundary,
  serializeV1Export,
  assertV1ExportBoundary,
  EXPORT_REASON_CODES
} from "../src/v1ExportBoundaryContract.mjs";

import {
  handleV1ExportBoundaryApiRequest
} from "../src/api/v1ExportBoundaryApi.mjs";

const acceptedProofArtefact = Object.freeze({
  proof_artefact_id: "proof_artifact_s_v1_46_alpha",
  artefact_kind: "proof_artefact_view",
  view_status: "view_allowed",
  evidence_envelope: {
    envelope_id: "env_s_v1_45_alpha",
    replay_verdict: "ACCEPTED",
    immutable: true,
    envelope_hash_sha256: "a".repeat(64)
  }
});

test("S-V1-47 allowed path exports one immutable proof artefact envelope reference", () => {
  const result = createV1ExportBoundary({
    requester_id: "coach_001",
    requested_export_type: "proof_artefact_json",
    requested_scope: "single_proof_artefact",
    requested_at: "2026-06-16T16:00:00.000Z",
    proof_artefact: acceptedProofArtefact
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, "export_allowed");
  assert.equal(result.reason_code, EXPORT_REASON_CODES.ALLOWED);
  assert.equal(result.immutable, true);
  assert.equal(result.payload.evidence_envelope_id, "env_s_v1_45_alpha");
  assert.equal(result.payload.replay_verdict, "accepted");
  assert.equal(result.boundary.broad_export, "not_permitted");
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.payload), true);

  const serialisedA = serializeV1Export(result);
  const serialisedB = serializeV1Export(result);
  assert.equal(serialisedA, serialisedB);
});

test("S-V1-47 forbidden path blocks broad export scope", () => {
  const result = createV1ExportBoundary({
    requester_id: "coach_001",
    requested_export_type: "proof_artefact_json",
    requested_scope: "entity_wide",
    requested_at: "2026-06-16T16:00:00.000Z",
    proof_artefact: acceptedProofArtefact
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, "export_blocked");
  assert.equal(result.reason_code, EXPORT_REASON_CODES.SCOPE_NOT_PERMITTED);
});

test("S-V1-47 forbidden path blocks broad export type", () => {
  const result = createV1ExportBoundary({
    requester_id: "coach_001",
    requested_export_type: "bulk_data_export",
    requested_scope: "single_proof_artefact",
    requested_at: "2026-06-16T16:00:00.000Z",
    proof_artefact: acceptedProofArtefact
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason_code, EXPORT_REASON_CODES.TYPE_NOT_PERMITTED);
});

test("S-V1-47 forbidden path blocks mutable source envelope", () => {
  const result = createV1ExportBoundary({
    requester_id: "coach_001",
    requested_export_type: "proof_artefact_json",
    requested_scope: "single_proof_artefact",
    requested_at: "2026-06-16T16:00:00.000Z",
    proof_artefact: {
      ...acceptedProofArtefact,
      evidence_envelope: {
        envelope_id: "env_mutable",
        replay_verdict: "ACCEPTED",
        immutable: false,
        envelope_hash_sha256: "b".repeat(64)
      }
    }
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason_code, EXPORT_REASON_CODES.SOURCE_ENVELOPE_NOT_IMMUTABLE);
});

test("S-V1-47 API adapter returns JSON without broad payload fields", () => {
  const response = handleV1ExportBoundaryApiRequest({
    body: {
      requester_id: "coach_001",
      requested_export_type: "evidence_envelope_json",
      requested_scope: "single_proof_artefact",
      requested_at: "2026-06-16T16:00:00.000Z",
      proof_artefact: acceptedProofArtefact
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["content-type"], "application/json");

  const body = JSON.parse(response.body);
  assert.equal(body.ok, true);
  assert.equal(body.payload.evidence_envelope_id, "env_s_v1_45_alpha");
  assert.equal("coach_notes" in body.payload, false);
  assert.equal("raw_runtime_events" in body.payload, false);

  assertV1ExportBoundary(body);
});

test("S-V1-47 copy entries stay neutral", async () => {
  const copy = (await import("../copy/export_boundary_copy.json", {
    with: { type: "json" }
  })).default;

  const text = JSON.stringify(copy).toLowerCase();

  assert.equal(copy.slice, "S-V1-47");
  assert.equal(text.includes("recommended"), false);
  assert.equal(text.includes("optim"), false);
  assert.equal(text.includes("readiness"), false);
  assert.equal(text.includes("injur"), false);
  assert.equal(text.includes("medical"), false);
});