import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  S_V1_45_ARTEFACT_ENVELOPE_COPY,
  S_V1_45_ARTEFACT_ENVELOPE_FAILURE_CODES,
  getV1ArtefactEnvelopeContract,
  tryBuildV1ArtefactEnvelope,
  verifyV1ArtefactEnvelope
} from "../src/v1EvidenceEnvelopeContract.mjs";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const HASH_C = "c".repeat(64);

function validInput() {
  return {
    source_binding: {
      source_id: "runtime_event_log_001",
      source_type: "runtime_event_log",
      source_hash_sha256: HASH_A
    },
    replay_boundary: {
      accepted_proof_available: true,
      proof_scope: "process_integrity_only",
      source_bound: true,
      external_approval: false,
      correctness_claim: false,
      training_value_claim: false
    },
    artefact_binding: {
      artefact_id: "replay_boundary_record_001",
      artefact_type: "replay_boundary_record",
      artefact_hash_sha256: HASH_B
    },
    issued_at_iso8601: "2026-06-16T00:00:00.000Z"
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test("S-V1-45 exposes a closed artefact envelope contract", () => {
  const contract = getV1ArtefactEnvelopeContract();

  assert.equal(contract.contract_id, "s_v1_45_artefact_envelope_contract_v1");
  assert.equal(contract.contract_version, "v1");
  assert.equal(contract.hash_algorithm, "sha256");
  assert.equal(contract.integrity_boundary.process_integrity_only, true);
  assert.equal(contract.integrity_boundary.external_approval, false);
  assert.equal(contract.integrity_boundary.correctness_claim, false);
  assert.equal(contract.integrity_boundary.training_value_claim, false);
  assert.equal(contract.integrity_boundary.medical_approval, false);
  assert.equal(contract.integrity_boundary.suitability_approval, false);
});

test("S-V1-45 builds an envelope that records process integrity only", () => {
  const result = tryBuildV1ArtefactEnvelope(validInput());

  assert.equal(result.ok, true);
  assert.equal(result.envelope.integrity_boundary.process_integrity_only, true);
  assert.equal(result.envelope.integrity_boundary.external_approval, false);
  assert.equal(result.envelope.integrity_boundary.correctness_claim, false);
  assert.equal(result.envelope.integrity_boundary.training_value_claim, false);
  assert.equal(result.envelope.copy_ids.includes("PROCESS_INTEGRITY_ONLY"), true);
  assert.equal(result.envelope.copy_ids.includes("NO_CORRECTNESS_CLAIM"), true);
  assert.match(result.envelope.material_hash_sha256, /^[a-f0-9]{64}$/);
  assert.match(result.envelope.seal.seal_hash_sha256, /^[a-f0-9]{64}$/);
});

test("S-V1-45 does not imply correctness", () => {
  assert.equal(S_V1_45_ARTEFACT_ENVELOPE_COPY.PROCESS_INTEGRITY_ONLY, "Evidence proves process integrity only.");
  assert.equal(S_V1_45_ARTEFACT_ENVELOPE_COPY.NO_CORRECTNESS_CLAIM, "Evidence does not imply correctness.");

  const input = validInput();
  input.replay_boundary.correctness_claim = true;

  const result = tryBuildV1ArtefactEnvelope(input);

  assert.equal(result.ok, false);
  assert.equal(result.error_code, S_V1_45_ARTEFACT_ENVELOPE_FAILURE_CODES.CLAIM_BOUNDARY_BREACH);
});

test("S-V1-45 seal and material hashes are stable", () => {
  const first = tryBuildV1ArtefactEnvelope(validInput());
  const second = tryBuildV1ArtefactEnvelope(validInput());

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.deepEqual(first.envelope, second.envelope);

  const verified = verifyV1ArtefactEnvelope(first.envelope);

  assert.equal(verified.ok, true);
  assert.equal(verified.material_hash_sha256, first.envelope.material_hash_sha256);
  assert.equal(verified.seal_hash_sha256, first.envelope.seal.seal_hash_sha256);
});

test("S-V1-45 negative tamper fixture fails material hash verification", () => {
  const fixture = JSON.parse(fs.readFileSync("ci/fixtures/s_v1_45_evidence_envelope_tamper_negative.json", "utf8"));
  const built = tryBuildV1ArtefactEnvelope(validInput());

  assert.equal(built.ok, true);

  const tampered = clone(built.envelope);
  tampered.source_binding.source_hash_sha256 = fixture.mutation.replacement;

  const verified = verifyV1ArtefactEnvelope(tampered);

  assert.equal(verified.ok, false);
  assert.equal(verified.error_code, fixture.expected_error_code);
});

test("S-V1-45 rejected replay boundary cannot produce an envelope", () => {
  const input = validInput();
  input.replay_boundary.accepted_proof_available = false;

  const result = tryBuildV1ArtefactEnvelope(input);

  assert.equal(result.ok, false);
  assert.equal(result.error_code, S_V1_45_ARTEFACT_ENVELOPE_FAILURE_CODES.INVALID_REPLAY_ACCEPTANCE);
});

test("S-V1-45 unknown input field fails closed", () => {
  const input = validInput();
  input.extra_field = true;

  const result = tryBuildV1ArtefactEnvelope(input);

  assert.equal(result.ok, false);
  assert.equal(result.error_code, S_V1_45_ARTEFACT_ENVELOPE_FAILURE_CODES.UNKNOWN_FIELD);
});

test("S-V1-45 changed artefact hash changes the stable seal", () => {
  const firstInput = validInput();
  const secondInput = validInput();
  secondInput.artefact_binding.artefact_hash_sha256 = HASH_C;

  const first = tryBuildV1ArtefactEnvelope(firstInput);
  const second = tryBuildV1ArtefactEnvelope(secondInput);

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.notEqual(first.envelope.material_hash_sha256, second.envelope.material_hash_sha256);
  assert.notEqual(first.envelope.seal.seal_hash_sha256, second.envelope.seal.seal_hash_sha256);
});