export const S_V1_44_REPLAY_BOUNDARY_CONTRACT_ID = "s_v1_44_replay_boundary_contract_v1";

export const S_V1_44_ALLOWED_REPLAY_PHASES = Object.freeze(["phase2", "phase6"]);
export const S_V1_44_FORBIDDEN_REPLAY_PHASES = Object.freeze(["phase1", "phase3", "phase4", "phase5", "phase7", "phase8"]);
export const S_V1_44_REPLAY_VERDICTS = Object.freeze(["ACCEPTED", "REJECTED"]);

export const S_V1_44_REPLAY_BOUNDARY_COPY = Object.freeze({
  REPLAY_PROCESS_INTEGRITY_ONLY: "Replay records process integrity only.",
  REPLAY_REJECTED_NO_ACCEPTED_PROOF: "Replay rejected. Accepted proof is not available.",
  REPLAY_SOURCE_BOUND: "Replay output is bound to the declared source."
});

export const S_V1_44_FAILURE_CODES = Object.freeze({
  INPUT_NOT_OBJECT: "s_v1_44_input_not_object",
  UNKNOWN_FIELD: "s_v1_44_unknown_field",
  SOURCE_NOT_OBJECT: "s_v1_44_source_not_object",
  REPLAY_NOT_OBJECT: "s_v1_44_replay_not_object",
  INVALID_SOURCE_ID: "s_v1_44_invalid_source_id",
  INVALID_SOURCE_TYPE: "s_v1_44_invalid_source_type",
  INVALID_SOURCE_HASH: "s_v1_44_invalid_source_hash",
  INVALID_REPLAY_VERDICT: "s_v1_44_invalid_replay_verdict",
  INVALID_REPLAY_PHASES: "s_v1_44_invalid_replay_phases",
  FORBIDDEN_REPLAY_PHASE: "s_v1_44_forbidden_replay_phase",
  INVALID_OUTPUT_HASH: "s_v1_44_invalid_output_hash",
  INVALID_FAILURE_TOKENS: "s_v1_44_invalid_failure_tokens",
  REJECTED_REPLAY_HAS_OUTPUT_HASH: "s_v1_44_rejected_replay_has_output_hash",
  ACCEPTED_REPLAY_HAS_FAILURE_TOKENS: "s_v1_44_accepted_replay_has_failure_tokens",
  ACCEPTED_REPLAY_MISSING_OUTPUT_HASH: "s_v1_44_accepted_replay_missing_output_hash",
  REJECTED_REPLAY_MISSING_FAILURE_TOKEN: "s_v1_44_rejected_replay_missing_failure_token",
  SOURCE_BINDING_MISMATCH: "s_v1_44_source_binding_mismatch"
});

const INPUT_KEYS = Object.freeze(["source", "replay"]);
const SOURCE_KEYS = Object.freeze(["source_id", "source_type", "source_hash_sha256"]);
const REPLAY_KEYS = Object.freeze(["replay_verdict", "replayed_phases", "output_hash_sha256", "failure_tokens"]);
const SOURCE_TYPES = Object.freeze(["runtime_event_log", "replay_vector", "evidence_candidate"]);
const HASH_RE = /^[a-f0-9]{64}$/;

/**
 * DEV NOTE:
 * Purpose: returns the fixed replay boundary contract so proof-aware callers can
 * check the same closed-world replay rules without re-declaring them.
 * Boundary: declares replay scope and neutral copy ids only; it creates no engine
 * behaviour, no external approval surface, and no training interpretation.
 * Determinism: returns frozen arrays and strings with no runtime input.
 * Failure: this function does not fail because the contract is static.
 */
export function getReplayBoundaryContractV1() {
  return deepFreeze({
    contract_id: S_V1_44_REPLAY_BOUNDARY_CONTRACT_ID,
    replay_scope: {
      allowed_replay_phases: [...S_V1_44_ALLOWED_REPLAY_PHASES],
      forbidden_replay_phases: [...S_V1_44_FORBIDDEN_REPLAY_PHASES]
    },
    interpretation: {
      process_integrity_only: true,
      external_approval: false,
      correctness_claim: false,
      training_value_claim: false
    },
    copy: { ...S_V1_44_REPLAY_BOUNDARY_COPY }
  });
}

/**
 * DEV NOTE:
 * Purpose: materialises a source-bound replay boundary record from an explicit
 * source identity and explicit replay verdict.
 * Boundary: records replay status only; it must not alter sessions, runtime
 * events, evidence artefacts, coach notes, registry data, or compile output.
 * Determinism: output is derived only from the supplied object after strict
 * closed-world validation.
 * Failure: returns a failure object and never emits an accepted proof state when
 * replay is rejected or structurally invalid.
 */
export function tryBuildReplayBoundaryRecordV1(input) {
  const validation = validateReplayBoundaryInputV1(input);
  if (!validation.ok) {
    return validation;
  }

  const source = input.source;
  const replay = input.replay;
  const accepted = replay.replay_verdict === "ACCEPTED";

  const record = deepFreeze({
    contract_id: S_V1_44_REPLAY_BOUNDARY_CONTRACT_ID,
    source_binding: {
      source_id: source.source_id,
      source_type: source.source_type,
      source_hash_sha256: source.source_hash_sha256
    },
    replay_result: {
      replay_verdict: replay.replay_verdict,
      replayed_phases: [...replay.replayed_phases],
      output_hash_sha256: replay.output_hash_sha256,
      failure_tokens: [...replay.failure_tokens]
    },
    proof_boundary: {
      accepted_proof_available: accepted,
      proof_scope: accepted ? "process_integrity_only" : "not_available",
      source_bound: true,
      external_approval: false,
      correctness_claim: false,
      training_value_claim: false
    },
    copy_ids: accepted
      ? ["REPLAY_PROCESS_INTEGRITY_ONLY", "REPLAY_SOURCE_BOUND"]
      : ["REPLAY_REJECTED_NO_ACCEPTED_PROOF", "REPLAY_SOURCE_BOUND"]
  });

  if (record.source_binding.source_hash_sha256 !== source.source_hash_sha256) {
    return fail(S_V1_44_FAILURE_CODES.SOURCE_BINDING_MISMATCH);
  }

  return Object.freeze({ ok: true, record });
}

/**
 * DEV NOTE:
 * Purpose: validates the replay boundary input before any proof-aware surface may
 * read the replay result.
 * Boundary: this is a contract gate, not a replay runner and not an evidence
 * generator.
 * Determinism: validation uses fixed key sets, fixed enum lists, and fixed hash
 * format checks.
 * Failure: invalid or rejected inputs fail closed or emit a record with no
 * accepted proof availability.
 */
export function validateReplayBoundaryInputV1(input) {
  if (!isPlainObject(input)) {
    return fail(S_V1_44_FAILURE_CODES.INPUT_NOT_OBJECT);
  }

  const inputKeyFailure = assertExactKeys(input, INPUT_KEYS);
  if (inputKeyFailure) return inputKeyFailure;

  if (!isPlainObject(input.source)) {
    return fail(S_V1_44_FAILURE_CODES.SOURCE_NOT_OBJECT);
  }

  const sourceKeyFailure = assertExactKeys(input.source, SOURCE_KEYS);
  if (sourceKeyFailure) return sourceKeyFailure;

  if (!isPlainObject(input.replay)) {
    return fail(S_V1_44_FAILURE_CODES.REPLAY_NOT_OBJECT);
  }

  const replayKeyFailure = assertExactKeys(input.replay, REPLAY_KEYS);
  if (replayKeyFailure) return replayKeyFailure;

  const source = input.source;
  const replay = input.replay;

  if (!nonEmptyString(source.source_id)) {
    return fail(S_V1_44_FAILURE_CODES.INVALID_SOURCE_ID);
  }

  if (!SOURCE_TYPES.includes(source.source_type)) {
    return fail(S_V1_44_FAILURE_CODES.INVALID_SOURCE_TYPE);
  }

  if (!HASH_RE.test(source.source_hash_sha256)) {
    return fail(S_V1_44_FAILURE_CODES.INVALID_SOURCE_HASH);
  }

  if (!S_V1_44_REPLAY_VERDICTS.includes(replay.replay_verdict)) {
    return fail(S_V1_44_FAILURE_CODES.INVALID_REPLAY_VERDICT);
  }

  if (!Array.isArray(replay.replayed_phases)) {
    return fail(S_V1_44_FAILURE_CODES.INVALID_REPLAY_PHASES);
  }

  if (replay.replayed_phases.length !== S_V1_44_ALLOWED_REPLAY_PHASES.length) {
    return fail(S_V1_44_FAILURE_CODES.INVALID_REPLAY_PHASES);
  }

  for (let i = 0; i < S_V1_44_ALLOWED_REPLAY_PHASES.length; i += 1) {
    if (replay.replayed_phases[i] !== S_V1_44_ALLOWED_REPLAY_PHASES[i]) {
      if (S_V1_44_FORBIDDEN_REPLAY_PHASES.includes(replay.replayed_phases[i])) {
        return fail(S_V1_44_FAILURE_CODES.FORBIDDEN_REPLAY_PHASE);
      }

      return fail(S_V1_44_FAILURE_CODES.INVALID_REPLAY_PHASES);
    }
  }

  if (replay.output_hash_sha256 !== null && !HASH_RE.test(replay.output_hash_sha256)) {
    return fail(S_V1_44_FAILURE_CODES.INVALID_OUTPUT_HASH);
  }

  if (!Array.isArray(replay.failure_tokens)) {
    return fail(S_V1_44_FAILURE_CODES.INVALID_FAILURE_TOKENS);
  }

  for (const token of replay.failure_tokens) {
    if (!nonEmptyString(token)) {
      return fail(S_V1_44_FAILURE_CODES.INVALID_FAILURE_TOKENS);
    }
  }

  if (replay.replay_verdict === "ACCEPTED") {
    if (replay.output_hash_sha256 === null) {
      return fail(S_V1_44_FAILURE_CODES.ACCEPTED_REPLAY_MISSING_OUTPUT_HASH);
    }

    if (replay.failure_tokens.length > 0) {
      return fail(S_V1_44_FAILURE_CODES.ACCEPTED_REPLAY_HAS_FAILURE_TOKENS);
    }
  }

  if (replay.replay_verdict === "REJECTED") {
    if (replay.output_hash_sha256 !== null) {
      return fail(S_V1_44_FAILURE_CODES.REJECTED_REPLAY_HAS_OUTPUT_HASH);
    }

    if (replay.failure_tokens.length === 0) {
      return fail(S_V1_44_FAILURE_CODES.REJECTED_REPLAY_MISSING_FAILURE_TOKEN);
    }
  }

  return Object.freeze({ ok: true });
}

function assertExactKeys(value, expectedKeys) {
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();

  if (actual.length !== expected.length) {
    return fail(S_V1_44_FAILURE_CODES.UNKNOWN_FIELD);
  }

  for (let i = 0; i < expected.length; i += 1) {
    if (actual[i] !== expected[i]) {
      return fail(S_V1_44_FAILURE_CODES.UNKNOWN_FIELD);
    }
  }

  return null;
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fail(error_code) {
  return Object.freeze({ ok: false, error_code });
}

function deepFreeze(value) {
  if (!isPlainObject(value) && !Array.isArray(value)) {
    return value;
  }

  for (const key of Object.keys(value)) {
    deepFreeze(value[key]);
  }

  return Object.freeze(value);
}