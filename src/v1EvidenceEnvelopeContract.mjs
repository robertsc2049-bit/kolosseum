import crypto from "node:crypto";

const CONTRACT_ID = "s_v1_45_artefact_envelope_contract_v1";
const CONTRACT_VERSION = "v1";
const HASH_ALGORITHM = "sha256";
const HEX_SHA256_RE = /^[a-f0-9]{64}$/;

export const S_V1_45_ARTEFACT_ENVELOPE_COPY = Object.freeze({
  PROCESS_INTEGRITY_ONLY: "Evidence proves process integrity only.",
  NO_CORRECTNESS_CLAIM: "Evidence does not imply correctness.",
  SOURCE_BOUND: "Envelope is bound to the declared source."
});

export const S_V1_45_ARTEFACT_ENVELOPE_FAILURE_CODES = Object.freeze({
  INPUT_NOT_OBJECT: "s_v1_45_input_not_object",
  UNKNOWN_FIELD: "s_v1_45_unknown_field",
  SOURCE_BINDING_NOT_OBJECT: "s_v1_45_source_binding_not_object",
  REPLAY_BOUNDARY_NOT_OBJECT: "s_v1_45_replay_boundary_not_object",
  ARTEFACT_BINDING_NOT_OBJECT: "s_v1_45_artefact_binding_not_object",
  INVALID_SOURCE_ID: "s_v1_45_invalid_source_id",
  INVALID_SOURCE_TYPE: "s_v1_45_invalid_source_type",
  INVALID_SOURCE_HASH: "s_v1_45_invalid_source_hash",
  INVALID_REPLAY_ACCEPTANCE: "s_v1_45_invalid_replay_acceptance",
  INVALID_PROCESS_SCOPE: "s_v1_45_invalid_process_scope",
  CLAIM_BOUNDARY_BREACH: "s_v1_45_claim_boundary_breach",
  INVALID_ARTEFACT_ID: "s_v1_45_invalid_artefact_id",
  INVALID_ARTEFACT_TYPE: "s_v1_45_invalid_artefact_type",
  INVALID_ARTEFACT_HASH: "s_v1_45_invalid_artefact_hash",
  INVALID_ISSUED_AT: "s_v1_45_invalid_issued_at",
  INVALID_ENVELOPE_SHAPE: "s_v1_45_invalid_envelope_shape",
  MATERIAL_HASH_MISMATCH: "s_v1_45_material_hash_mismatch",
  SEAL_HASH_MISMATCH: "s_v1_45_seal_hash_mismatch"
});

const INPUT_KEYS = Object.freeze(["source_binding", "replay_boundary", "artefact_binding", "issued_at_iso8601"]);
const SOURCE_BINDING_KEYS = Object.freeze(["source_id", "source_type", "source_hash_sha256"]);
const REPLAY_BOUNDARY_KEYS = Object.freeze([
  "accepted_proof_available",
  "proof_scope",
  "source_bound",
  "external_approval",
  "correctness_claim",
  "training_value_claim"
]);
const ARTEFACT_BINDING_KEYS = Object.freeze(["artefact_id", "artefact_type", "artefact_hash_sha256"]);
const SOURCE_TYPES = Object.freeze(["runtime_event_log", "replay_boundary_record", "replay_vector"]);
const ARTEFACT_TYPES = Object.freeze(["replay_boundary_record", "session_execution_record"]);

/**
 * DEV NOTE:
 * Purpose: exposes the S-V1-45 artefact envelope contract for v1 proof-boundary callers.
 * Boundary: defines process-integrity artefact packaging only; it creates no engine
 * authority, user-status approval, coaching interpretation, or product recommendation.
 * Determinism: returns frozen constants and closed-world schema details only.
 * Failure: this function does not fail because the contract is static.
 */
export function getV1ArtefactEnvelopeContract() {
  return deepFreeze({
    contract_id: CONTRACT_ID,
    contract_version: CONTRACT_VERSION,
    hash_algorithm: HASH_ALGORITHM,
    required_input_keys: [...INPUT_KEYS],
    source_types: [...SOURCE_TYPES],
    artefact_types: [...ARTEFACT_TYPES],
    integrity_boundary: {
      process_integrity_only: true,
      external_approval: false,
      correctness_claim: false,
      training_value_claim: false,
      medical_approval: false,
      suitability_approval: false
    },
    copy: { ...S_V1_45_ARTEFACT_ENVELOPE_COPY }
  });
}

/**
 * DEV NOTE:
 * Purpose: builds a deterministic artefact envelope from explicit source, replay
 * boundary, artefact binding, and issued timestamp input.
 * Boundary: records process-integrity packaging only; it must not alter runtime
 * events, replay output, registry data, coach notes, or compile output.
 * Determinism: every byte of the hash and seal comes from canonical sorted JSON
 * and the explicit input object.
 * Failure: invalid or non-accepted replay-boundary input fails closed and returns
 * no sealed envelope.
 */
export function tryBuildV1ArtefactEnvelope(input) {
  const validation = validateInput(input);
  if (!validation.ok) {
    return validation;
  }

  const material = deepFreeze({
    contract_id: CONTRACT_ID,
    contract_version: CONTRACT_VERSION,
    source_binding: cloneJson(input.source_binding),
    replay_boundary: cloneJson(input.replay_boundary),
    artefact_binding: cloneJson(input.artefact_binding),
    integrity_boundary: {
      process_integrity_only: true,
      external_approval: false,
      correctness_claim: false,
      training_value_claim: false,
      medical_approval: false,
      suitability_approval: false
    },
    issued_at_iso8601: input.issued_at_iso8601,
    copy_ids: [
      "PROCESS_INTEGRITY_ONLY",
      "NO_CORRECTNESS_CLAIM",
      "SOURCE_BOUND"
    ]
  });

  const materialHash = sha256Hex(canonicalJson(material));
  const sealHash = sha256Hex(`${CONTRACT_ID}\n${materialHash}\n`);

  return {
    ok: true,
    envelope: deepFreeze({
      ...material,
      material_hash_sha256: materialHash,
      seal: {
        algorithm: HASH_ALGORITHM,
        material_hash_sha256: materialHash,
        seal_hash_sha256: sealHash
      }
    })
  };
}

/**
 * DEV NOTE:
 * Purpose: verifies that a previously built artefact envelope still matches its
 * canonical material hash and seal hash.
 * Boundary: verifies recorded bytes only; it does not re-run replay, inspect
 * training content, approve a user status, or infer correctness.
 * Determinism: recomputes hashes from canonical sorted JSON and fixed seal
 * material.
 * Failure: any shape, material, or seal mismatch fails closed.
 */
export function verifyV1ArtefactEnvelope(envelope) {
  if (!isPlainObject(envelope)) {
    return fail(S_V1_45_ARTEFACT_ENVELOPE_FAILURE_CODES.INVALID_ENVELOPE_SHAPE, "envelope must be an object");
  }

  if (!isPlainObject(envelope.seal)) {
    return fail(S_V1_45_ARTEFACT_ENVELOPE_FAILURE_CODES.INVALID_ENVELOPE_SHAPE, "seal must be an object");
  }

  if (envelope.contract_id !== CONTRACT_ID || envelope.contract_version !== CONTRACT_VERSION) {
    return fail(S_V1_45_ARTEFACT_ENVELOPE_FAILURE_CODES.INVALID_ENVELOPE_SHAPE, "contract identity mismatch");
  }

  if (!isHash(envelope.material_hash_sha256)) {
    return fail(S_V1_45_ARTEFACT_ENVELOPE_FAILURE_CODES.INVALID_ENVELOPE_SHAPE, "material hash invalid");
  }

  if (envelope.seal.algorithm !== HASH_ALGORITHM || !isHash(envelope.seal.material_hash_sha256) || !isHash(envelope.seal.seal_hash_sha256)) {
    return fail(S_V1_45_ARTEFACT_ENVELOPE_FAILURE_CODES.INVALID_ENVELOPE_SHAPE, "seal shape invalid");
  }

  const material = {
    contract_id: envelope.contract_id,
    contract_version: envelope.contract_version,
    source_binding: envelope.source_binding,
    replay_boundary: envelope.replay_boundary,
    artefact_binding: envelope.artefact_binding,
    integrity_boundary: envelope.integrity_boundary,
    issued_at_iso8601: envelope.issued_at_iso8601,
    copy_ids: envelope.copy_ids
  };

  const validation = validateInput({
    source_binding: material.source_binding,
    replay_boundary: material.replay_boundary,
    artefact_binding: material.artefact_binding,
    issued_at_iso8601: material.issued_at_iso8601
  });

  if (!validation.ok) {
    return validation;
  }

  const expectedMaterialHash = sha256Hex(canonicalJson(material));
  if (expectedMaterialHash !== envelope.material_hash_sha256 || expectedMaterialHash !== envelope.seal.material_hash_sha256) {
    return fail(S_V1_45_ARTEFACT_ENVELOPE_FAILURE_CODES.MATERIAL_HASH_MISMATCH, "material hash mismatch");
  }

  const expectedSealHash = sha256Hex(`${CONTRACT_ID}\n${expectedMaterialHash}\n`);
  if (expectedSealHash !== envelope.seal.seal_hash_sha256) {
    return fail(S_V1_45_ARTEFACT_ENVELOPE_FAILURE_CODES.SEAL_HASH_MISMATCH, "seal hash mismatch");
  }

  return {
    ok: true,
    material_hash_sha256: expectedMaterialHash,
    seal_hash_sha256: expectedSealHash
  };
}

function validateInput(input) {
  if (!isPlainObject(input)) {
    return fail(S_V1_45_ARTEFACT_ENVELOPE_FAILURE_CODES.INPUT_NOT_OBJECT, "input must be an object");
  }

  const unknown = firstUnknownKey(input, INPUT_KEYS);
  if (unknown) {
    return fail(S_V1_45_ARTEFACT_ENVELOPE_FAILURE_CODES.UNKNOWN_FIELD, `unknown input field: ${unknown}`);
  }

  const sourceResult = validateSourceBinding(input.source_binding);
  if (!sourceResult.ok) return sourceResult;

  const replayResult = validateReplayBoundary(input.replay_boundary);
  if (!replayResult.ok) return replayResult;

  const artefactResult = validateArtefactBinding(input.artefact_binding);
  if (!artefactResult.ok) return artefactResult;

  if (!isIsoInstant(input.issued_at_iso8601)) {
    return fail(S_V1_45_ARTEFACT_ENVELOPE_FAILURE_CODES.INVALID_ISSUED_AT, "issued_at_iso8601 must be an ISO instant");
  }

  return { ok: true };
}

function validateSourceBinding(value) {
  if (!isPlainObject(value)) {
    return fail(S_V1_45_ARTEFACT_ENVELOPE_FAILURE_CODES.SOURCE_BINDING_NOT_OBJECT, "source_binding must be an object");
  }

  const unknown = firstUnknownKey(value, SOURCE_BINDING_KEYS);
  if (unknown) {
    return fail(S_V1_45_ARTEFACT_ENVELOPE_FAILURE_CODES.UNKNOWN_FIELD, `unknown source_binding field: ${unknown}`);
  }

  if (!isNonEmptyString(value.source_id)) {
    return fail(S_V1_45_ARTEFACT_ENVELOPE_FAILURE_CODES.INVALID_SOURCE_ID, "source_id must be a non-empty string");
  }

  if (!SOURCE_TYPES.includes(value.source_type)) {
    return fail(S_V1_45_ARTEFACT_ENVELOPE_FAILURE_CODES.INVALID_SOURCE_TYPE, "source_type is not allowed");
  }

  if (!isHash(value.source_hash_sha256)) {
    return fail(S_V1_45_ARTEFACT_ENVELOPE_FAILURE_CODES.INVALID_SOURCE_HASH, "source_hash_sha256 must be sha256 hex");
  }

  return { ok: true };
}

function validateReplayBoundary(value) {
  if (!isPlainObject(value)) {
    return fail(S_V1_45_ARTEFACT_ENVELOPE_FAILURE_CODES.REPLAY_BOUNDARY_NOT_OBJECT, "replay_boundary must be an object");
  }

  const unknown = firstUnknownKey(value, REPLAY_BOUNDARY_KEYS);
  if (unknown) {
    return fail(S_V1_45_ARTEFACT_ENVELOPE_FAILURE_CODES.UNKNOWN_FIELD, `unknown replay_boundary field: ${unknown}`);
  }

  if (value.accepted_proof_available !== true || value.source_bound !== true) {
    return fail(S_V1_45_ARTEFACT_ENVELOPE_FAILURE_CODES.INVALID_REPLAY_ACCEPTANCE, "accepted source-bound replay boundary is required");
  }

  if (value.proof_scope !== "process_integrity_only") {
    return fail(S_V1_45_ARTEFACT_ENVELOPE_FAILURE_CODES.INVALID_PROCESS_SCOPE, "proof_scope must be process_integrity_only");
  }

  if (value.external_approval !== false || value.correctness_claim !== false || value.training_value_claim !== false) {
    return fail(S_V1_45_ARTEFACT_ENVELOPE_FAILURE_CODES.CLAIM_BOUNDARY_BREACH, "claim boundary must remain false");
  }

  return { ok: true };
}

function validateArtefactBinding(value) {
  if (!isPlainObject(value)) {
    return fail(S_V1_45_ARTEFACT_ENVELOPE_FAILURE_CODES.ARTEFACT_BINDING_NOT_OBJECT, "artefact_binding must be an object");
  }

  const unknown = firstUnknownKey(value, ARTEFACT_BINDING_KEYS);
  if (unknown) {
    return fail(S_V1_45_ARTEFACT_ENVELOPE_FAILURE_CODES.UNKNOWN_FIELD, `unknown artefact_binding field: ${unknown}`);
  }

  if (!isNonEmptyString(value.artefact_id)) {
    return fail(S_V1_45_ARTEFACT_ENVELOPE_FAILURE_CODES.INVALID_ARTEFACT_ID, "artefact_id must be a non-empty string");
  }

  if (!ARTEFACT_TYPES.includes(value.artefact_type)) {
    return fail(S_V1_45_ARTEFACT_ENVELOPE_FAILURE_CODES.INVALID_ARTEFACT_TYPE, "artefact_type is not allowed");
  }

  if (!isHash(value.artefact_hash_sha256)) {
    return fail(S_V1_45_ARTEFACT_ENVELOPE_FAILURE_CODES.INVALID_ARTEFACT_HASH, "artefact_hash_sha256 must be sha256 hex");
  }

  return { ok: true };
}

function fail(errorCode, message, details = {}) {
  return {
    ok: false,
    error_code: errorCode,
    message,
    details: deepFreeze({ ...details })
  };
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

function isHash(value) {
  return typeof value === "string" && HEX_SHA256_RE.test(value);
}

function isIsoInstant(value) {
  if (!isNonEmptyString(value)) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && value.endsWith("Z");
}

function firstUnknownKey(value, allowedKeys) {
  const allowed = new Set(allowedKeys);
  return Object.keys(value).find((key) => !allowed.has(key)) || null;
}

function canonicalJson(value) {
  return JSON.stringify(sortForJson(value));
}

function sortForJson(value) {
  if (Array.isArray(value)) {
    return value.map(sortForJson);
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortForJson(value[key])])
    );
  }

  return value;
}

function sha256Hex(value) {
  return crypto.createHash(HASH_ALGORITHM).update(value, "utf8").digest("hex");
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object") return value;

  for (const nested of Object.values(value)) {
    deepFreeze(nested);
  }

  return Object.freeze(value);
}