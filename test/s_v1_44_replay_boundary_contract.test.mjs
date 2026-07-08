import assert from "node:assert/strict";
import test from "node:test";

import {
  S_V1_44_ALLOWED_REPLAY_PHASES,
  S_V1_44_FAILURE_CODES,
  S_V1_44_REPLAY_BOUNDARY_COPY,
  getReplayBoundaryContractV1,
  tryBuildReplayBoundaryRecordV1
} from "../src/v1ReplayBoundaryContract.mjs";

const SOURCE_HASH = "a".repeat(64);
const OUTPUT_HASH = "b".repeat(64);

function acceptedInput() {
  return {
    source: {
      source_id: "session_runtime_events_001",
      source_type: "runtime_event_log",
      source_hash_sha256: SOURCE_HASH
    },
    replay: {
      replay_verdict: "ACCEPTED",
      replayed_phases: [...S_V1_44_ALLOWED_REPLAY_PHASES],
      output_hash_sha256: OUTPUT_HASH,
      failure_tokens: []
    }
  };
}

test("S-V1-44 accepted replay records process integrity only", () => {
  const result = tryBuildReplayBoundaryRecordV1(acceptedInput());

  assert.equal(result.ok, true);
  assert.equal(result.record.proof_boundary.accepted_proof_available, true);
  assert.equal(result.record.proof_boundary.proof_scope, "process_integrity_only");
  assert.equal(result.record.proof_boundary.source_bound, true);
  assert.equal(result.record.proof_boundary.external_approval, false);
  assert.equal(result.record.proof_boundary.correctness_claim, false);
  assert.equal(result.record.proof_boundary.training_value_claim, false);
  assert.deepEqual(result.record.replay_result.replayed_phases, ["phase2", "phase6"]);
});

test("S-V1-44 rejected replay cannot produce accepted proof", () => {
  const input = acceptedInput();
  input.replay.replay_verdict = "REJECTED";
  input.replay.output_hash_sha256 = null;
  input.replay.failure_tokens = ["nondeterminism_detected"];

  const result = tryBuildReplayBoundaryRecordV1(input);

  assert.equal(result.ok, true);
  assert.equal(result.record.proof_boundary.accepted_proof_available, false);
  assert.equal(result.record.proof_boundary.proof_scope, "not_available");
  assert.deepEqual(result.record.copy_ids, ["REPLAY_REJECTED_NO_ACCEPTED_PROOF", "REPLAY_SOURCE_BOUND"]);
});

test("S-V1-44 rejected replay with output hash fails closed", () => {
  const input = acceptedInput();
  input.replay.replay_verdict = "REJECTED";
  input.replay.failure_tokens = ["canonical_hash_mismatch"];

  const result = tryBuildReplayBoundaryRecordV1(input);

  assert.equal(result.ok, false);
  assert.equal(result.error_code, S_V1_44_FAILURE_CODES.REJECTED_REPLAY_HAS_OUTPUT_HASH);
});

test("S-V1-44 accepted replay with failure token fails closed", () => {
  const input = acceptedInput();
  input.replay.failure_tokens = ["canonical_hash_mismatch"];

  const result = tryBuildReplayBoundaryRecordV1(input);

  assert.equal(result.ok, false);
  assert.equal(result.error_code, S_V1_44_FAILURE_CODES.ACCEPTED_REPLAY_HAS_FAILURE_TOKENS);
});

test("S-V1-44 replay output is source-bound", () => {
  const input = acceptedInput();
  input.source.source_id = "replay_vector_001";
  input.source.source_type = "replay_vector";
  input.source.source_hash_sha256 = "c".repeat(64);

  const result = tryBuildReplayBoundaryRecordV1(input);

  assert.equal(result.ok, true);
  assert.equal(result.record.source_binding.source_id, "replay_vector_001");
  assert.equal(result.record.source_binding.source_type, "replay_vector");
  assert.equal(result.record.source_binding.source_hash_sha256, "c".repeat(64));
});

test("S-V1-44 forbidden replay phase fails closed", () => {
  const input = acceptedInput();
  input.replay.replayed_phases = ["phase2", "phase7"];

  const result = tryBuildReplayBoundaryRecordV1(input);

  assert.equal(result.ok, false);
  assert.equal(result.error_code, S_V1_44_FAILURE_CODES.FORBIDDEN_REPLAY_PHASE);
});

test("S-V1-44 unknown top-level field fails closed", () => {
  const input = acceptedInput();
  input.extra = true;

  const result = tryBuildReplayBoundaryRecordV1(input);

  assert.equal(result.ok, false);
  assert.equal(result.error_code, S_V1_44_FAILURE_CODES.UNKNOWN_FIELD);
});

test("S-V1-44 claim wording remains neutral", () => {
  const contract = getReplayBoundaryContractV1();
  const rendered = Object.values(S_V1_44_REPLAY_BOUNDARY_COPY).join(" ") + " " + JSON.stringify(contract);

  const forbidden = [
    /certif/i,
    /approved/i,
    /endorsed/i,
    /correct training/i,
    /training value/i,
    /successful training/i,
    /external validation/i
  ];

  for (const pattern of forbidden) {
    assert.equal(pattern.test(rendered), false, `forbidden wording matched ${pattern}`);
  }

  assert.match(rendered, /process integrity only/);
  assert.match(rendered, /bound to the declared source/);
});