// DEV NOTE: BETA-26 append-only EvidenceEnvelope byte storage.
// The only lawful creation path is a successful BETA-25 seal-gate evaluation.
// Stored canonical bytes are never replaced, regenerated, deleted, or mutated
// during export. No database, route, timestamp, user copy, or product state is
// introduced by this proof-layer reference store.

import crypto from "node:crypto";

import {
  betaCanonicalHash,
  betaCanonicalJson
} from "../../engine/dist/src/phases/betaCanonical.js";

import {
  BETA24_EVIDENCE_ENVELOPE_KEYS,
  BETA24_LIMITATIONS
} from "../../ci/lib/beta24_phase8_evidence_schema_lib.mjs";

import {
  evaluateBeta25Phase8ChainSealGates
} from "../../ci/lib/beta25_phase8_chain_seal_gates_lib.mjs";

export const BETA26_AUDIT_EVENT_TYPES =
  Object.freeze([
    "evidence_seal_attempt",
    "evidence_seal_success",
    "evidence_seal_denial",
    "evidence_mutation_denial"
  ]);

export const BETA26_STORE_API_KEYS =
  Object.freeze([
    "seal",
    "read",
    "exportBytes",
    "attemptUpdate",
    "attemptDelete",
    "attemptManualCreation",
    "attemptRegeneration",
    "readAuditLog"
  ]);

export const BETA26_STORED_RECORD_KEYS =
  Object.freeze([
    "evidence_envelope_id",
    "sealed_bytes",
    "sealed_bytes_checksum_sha256"
  ]);

export const BETA26_FAILURE_TOKENS =
  Object.freeze([
    "beta26_input_invalid",
    "beta26_seal_denied",
    "beta26_partial_envelope_denied",
    "beta26_manual_creation_denied",
    "beta26_update_denied",
    "beta26_delete_denied",
    "beta26_regeneration_denied",
    "beta26_export_mutation_denied",
    "beta26_checksum_mismatch",
    "beta26_evidence_not_found",
    "beta26_manifest_invalid"
  ]);

export const beta26EvidenceImmutabilityContract =
  Object.freeze({
    contract_id:
      "beta26_evidence_immutability_contract",
    slice_id:
      "BETA-26",
    version:
      "1.0.0",
    storage_mode:
      "append_only_canonical_envelope_bytes",
    lawful_creation_path:
      "beta25_seal_gate_only",
    canonical_byte_format:
      "beta_canonical_json_utf8",
    envelope_checksum_policy:
      "sha256_canonical_envelope_without_checksum_field",
    stored_byte_checksum_policy:
      "sha256_exact_stored_utf8_bytes",
    checksum_verified_on_read:
      true,
    update_after_seal_allowed:
      false,
    delete_after_seal_allowed:
      false,
    legal_admin_delete_path_present:
      false,
    manual_creation_allowed:
      false,
    partial_envelope_allowed:
      false,
    regeneration_after_failure_allowed:
      false,
    export_time_mutation_allowed:
      false,
    audit_event_types:
      BETA26_AUDIT_EVENT_TYPES,
    store_api:
      BETA26_STORE_API_KEYS,
    database_migration_added:
      false,
    api_route_added:
      false
  });

const HASH_RE =
  /^[a-f0-9]{64}$/u;

const ENVELOPE_ID_RE =
  /^beta24_evidence_envelope_[a-f0-9]{24}$/u;

const RUNNER_ID_RE =
  /^beta23_runner_verdict_[a-f0-9]{24}$/u;

function isRecord(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function clone(value) {
  return JSON.parse(
    JSON.stringify(value)
  );
}

function deepFreeze(value) {
  if (
    value === null ||
    (
      typeof value !== "object" &&
      typeof value !== "function"
    )
  ) {
    return value;
  }

  if (Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);

  for (
    const child
    of Object.values(value)
  ) {
    deepFreeze(child);
  }

  return value;
}

function exactKeys(
  value,
  expectedKeys
) {
  return (
    isRecord(value) &&
    Object.keys(value)
      .sort()
      .join("\u0000") ===
    [...expectedKeys]
      .sort()
      .join("\u0000")
  );
}

function sha256Utf8(value) {
  return crypto
    .createHash("sha256")
    .update(
      value,
      "utf8"
    )
    .digest("hex");
}

function failure(
  failureToken,
  details = {}
) {
  return deepFreeze({
    ok: false,
    failure_token:
      failureToken,
    details:
      clone(details)
  });
}

function candidateEnvelopeId(
  phase8Input
) {
  if (!isRecord(phase8Input)) {
    return null;
  }

  const phase5 =
    phase8Input.phase5_output;
  const phase6 =
    phase8Input.phase6_output;
  const phase7 =
    phase8Input.phase7_output;
  const runner =
    phase8Input.runner_verdict;

  if (
    !isRecord(phase5) ||
    !isRecord(phase6) ||
    !isRecord(phase7) ||
    !isRecord(runner) ||
    typeof phase6
      .canonical_input_hash !==
      "string" ||
    typeof phase5.selection_hash !==
      "string" ||
    typeof phase7.projection_hash !==
      "string" ||
    typeof runner.runner_verdict_id !==
      "string"
  ) {
    return null;
  }

  const seed = {
    canonical_input_hash:
      phase6.canonical_input_hash,
    selection_hash:
      phase5.selection_hash,
    projection_hash:
      phase7.projection_hash,
    runner_verdict_id:
      runner.runner_verdict_id
  };

  return (
    "beta24_evidence_envelope_" +
    betaCanonicalHash(seed)
      .slice(0, 24)
  );
}

function envelopeWithoutChecksum(
  envelope
) {
  const {
    evidence_envelope_checksum_sha256:
      ignored,
    ...withoutChecksum
  } = envelope;

  void ignored;

  return withoutChecksum;
}

function validateEnvelopeObject(
  envelope
) {
  if (
    !exactKeys(
      envelope,
      BETA24_EVIDENCE_ENVELOPE_KEYS
    )
  ) {
    return failure(
      "beta26_partial_envelope_denied"
    );
  }

  const hashFields = [
    "canonical_input_hash",
    "selection_hash",
    "execution_trace_hash",
    "projection_hash",
    "runner_verdict_checksum_sha256",
    "phase5_output_checksum_sha256",
    "phase6_output_checksum_sha256",
    "phase7_output_checksum_sha256",
    "evidence_envelope_checksum_sha256"
  ];

  if (
    !ENVELOPE_ID_RE.test(
      envelope.evidence_envelope_id
    ) ||
    !RUNNER_ID_RE.test(
      envelope.runner_verdict_id
    ) ||
    envelope.engine_version !==
      "EB2-1.0.0" ||
    envelope.enum_bundle_version !==
      "EB2-1.0.0" ||
    envelope.replay_suite_version !==
      "1.0.0" ||
    envelope.runner_verdict !==
      "ACCEPTED" ||
    envelope.evidence_scope !==
      "process_verification_only" ||
    JSON.stringify(
      envelope.limitations
    ) !==
      JSON.stringify(
        BETA24_LIMITATIONS
      ) ||
    JSON.stringify(
      envelope.failure_tokens
    ) !==
      JSON.stringify([])
  ) {
    return failure(
      "beta26_input_invalid"
    );
  }

  for (
    const field
    of hashFields
  ) {
    if (
      typeof envelope[field] !==
        "string" ||
      !HASH_RE.test(
        envelope[field]
      )
    ) {
      return failure(
        "beta26_input_invalid",
        {
          field
        }
      );
    }
  }

  const expectedChecksum =
    betaCanonicalHash(
      envelopeWithoutChecksum(
        envelope
      )
    );

  if (
    envelope
      .evidence_envelope_checksum_sha256 !==
    expectedChecksum
  ) {
    return failure(
      "beta26_checksum_mismatch",
      {
        checksum_scope:
          "evidence_envelope"
      }
    );
  }

  return deepFreeze({
    ok: true
  });
}

function materialiseEnvelope(
  phase8Input
) {
  const phase5 =
    phase8Input.phase5_output;
  const phase6 =
    phase8Input.phase6_output;
  const phase7 =
    phase8Input.phase7_output;
  const runner =
    phase8Input.runner_verdict;

  const evidenceEnvelopeId =
    candidateEnvelopeId(
      phase8Input
    );

  const withoutChecksum = {
    evidence_envelope_id:
      evidenceEnvelopeId,
    engine_version:
      runner.engine_version,
    enum_bundle_version:
      runner.enum_bundle_version,
    replay_suite_version:
      runner.replay_suite_version,
    canonical_input_hash:
      phase6.canonical_input_hash,
    selection_hash:
      phase5.selection_hash,
    execution_trace_hash:
      betaCanonicalHash(
        phase6.execution_state
      ),
    projection_hash:
      phase7.projection_hash,
    runner_verdict_id:
      runner.runner_verdict_id,
    runner_verdict_checksum_sha256:
      runner
        .runner_verdict_checksum_sha256,
    runner_verdict:
      runner.verdict,
    phase5_output_checksum_sha256:
      betaCanonicalHash(phase5),
    phase6_output_checksum_sha256:
      betaCanonicalHash(phase6),
    phase7_output_checksum_sha256:
      betaCanonicalHash(phase7),
    evidence_scope:
      "process_verification_only",
    limitations:
      [...BETA24_LIMITATIONS],
    failure_tokens: []
  };

  const envelope = {
    evidence_envelope_id:
      withoutChecksum
        .evidence_envelope_id,
    engine_version:
      withoutChecksum
        .engine_version,
    enum_bundle_version:
      withoutChecksum
        .enum_bundle_version,
    replay_suite_version:
      withoutChecksum
        .replay_suite_version,
    canonical_input_hash:
      withoutChecksum
        .canonical_input_hash,
    selection_hash:
      withoutChecksum
        .selection_hash,
    execution_trace_hash:
      withoutChecksum
        .execution_trace_hash,
    projection_hash:
      withoutChecksum
        .projection_hash,
    runner_verdict_id:
      withoutChecksum
        .runner_verdict_id,
    runner_verdict_checksum_sha256:
      withoutChecksum
        .runner_verdict_checksum_sha256,
    runner_verdict:
      withoutChecksum
        .runner_verdict,
    phase5_output_checksum_sha256:
      withoutChecksum
        .phase5_output_checksum_sha256,
    phase6_output_checksum_sha256:
      withoutChecksum
        .phase6_output_checksum_sha256,
    phase7_output_checksum_sha256:
      withoutChecksum
        .phase7_output_checksum_sha256,
    evidence_envelope_checksum_sha256:
      betaCanonicalHash(
        withoutChecksum
      ),
    evidence_scope:
      withoutChecksum
        .evidence_scope,
    limitations:
      withoutChecksum
        .limitations,
    failure_tokens:
      withoutChecksum
        .failure_tokens
  };

  return deepFreeze(envelope);
}

export function verifyBeta26EnvelopeBytes(
  sealedBytes
) {
  if (
    typeof sealedBytes !== "string" ||
    sealedBytes.length === 0
  ) {
    return failure(
      "beta26_input_invalid"
    );
  }

  let envelope;

  try {
    envelope =
      JSON.parse(sealedBytes);
  }
  catch {
    return failure(
      "beta26_input_invalid"
    );
  }

  const validation =
    validateEnvelopeObject(
      envelope
    );

  if (!validation.ok) {
    return validation;
  }

  if (
    betaCanonicalJson(envelope) !==
    sealedBytes
  ) {
    return failure(
      "beta26_checksum_mismatch",
      {
        checksum_scope:
          "canonical_envelope_bytes"
      }
    );
  }

  return deepFreeze({
    ok: true,
    evidence_envelope:
      deepFreeze(
        clone(envelope)
      ),
    sealed_bytes_checksum_sha256:
      sha256Utf8(sealedBytes)
  });
}

export function verifyBeta26StoredEvidenceRecord(
  record
) {
  if (
    !exactKeys(
      record,
      BETA26_STORED_RECORD_KEYS
    ) ||
    !ENVELOPE_ID_RE.test(
      record.evidence_envelope_id
    ) ||
    typeof record.sealed_bytes !==
      "string" ||
    !HASH_RE.test(
      record
        .sealed_bytes_checksum_sha256
    )
  ) {
    return failure(
      "beta26_input_invalid"
    );
  }

  if (
    sha256Utf8(
      record.sealed_bytes
    ) !==
    record
      .sealed_bytes_checksum_sha256
  ) {
    return failure(
      "beta26_checksum_mismatch",
      {
        checksum_scope:
          "stored_bytes"
      }
    );
  }

  const verification =
    verifyBeta26EnvelopeBytes(
      record.sealed_bytes
    );

  if (!verification.ok) {
    return verification;
  }

  if (
    verification
      .evidence_envelope
      .evidence_envelope_id !==
    record.evidence_envelope_id
  ) {
    return failure(
      "beta26_checksum_mismatch",
      {
        checksum_scope:
          "record_envelope_id"
      }
    );
  }

  return deepFreeze({
    ok: true,
    evidence_envelope:
      verification
        .evidence_envelope,
    sealed_bytes:
      record.sealed_bytes,
    sealed_bytes_checksum_sha256:
      record
        .sealed_bytes_checksum_sha256
  });
}

function readCandidateIdFromRawBytes(
  sealedBytes
) {
  if (typeof sealedBytes !== "string") {
    return null;
  }

  try {
    const parsed =
      JSON.parse(sealedBytes);

    if (
      isRecord(parsed) &&
      typeof parsed
        .evidence_envelope_id ===
        "string"
    ) {
      return parsed
        .evidence_envelope_id;
    }
  }
  catch {
    return null;
  }

  return null;
}

function rawEnvelopeIsPartial(
  sealedBytes
) {
  if (typeof sealedBytes !== "string") {
    return false;
  }

  try {
    const parsed =
      JSON.parse(sealedBytes);

    if (!isRecord(parsed)) {
      return false;
    }

    const presentCount =
      BETA24_EVIDENCE_ENVELOPE_KEYS
        .filter(
          (key) =>
            Object.prototype
              .hasOwnProperty.call(
                parsed,
                key
              )
        )
        .length;

    return (
      presentCount > 0 &&
      presentCount <
        BETA24_EVIDENCE_ENVELOPE_KEYS
          .length
    );
  }
  catch {
    return false;
  }
}

export function createBeta26EvidenceImmutableStore() {
  const records =
    new Map();

  const failedEnvelopeIds =
    new Set();

  const auditEvents = [];

  let auditSequence = 0;

  function appendAudit(
    eventType,
    evidenceEnvelopeId,
    reasonToken
  ) {
    auditSequence += 1;

    const event =
      deepFreeze({
        audit_event_id:
          "beta26_audit_" +
          String(auditSequence)
            .padStart(6, "0"),
        event_type:
          eventType,
        evidence_envelope_id:
          evidenceEnvelopeId ??
          null,
        reason_token:
          reasonToken ??
          null
      });

    auditEvents.push(event);

    return event;
  }

  function denySeal(
    evidenceEnvelopeId,
    failureToken,
    details = {}
  ) {
    if (
      typeof evidenceEnvelopeId ===
        "string" &&
      evidenceEnvelopeId.length > 0
    ) {
      failedEnvelopeIds.add(
        evidenceEnvelopeId
      );
    }

    appendAudit(
      "evidence_seal_denial",
      evidenceEnvelopeId,
      failureToken
    );

    return failure(
      failureToken,
      details
    );
  }

  function denyMutation(
    evidenceEnvelopeId,
    failureToken
  ) {
    appendAudit(
      "evidence_mutation_denial",
      evidenceEnvelopeId,
      failureToken
    );

    return failure(
      failureToken
    );
  }

  function seal(request) {
    const phase8Input =
      isRecord(request)
        ? request.phase8_input
        : null;

    const candidateId =
      candidateEnvelopeId(
        phase8Input
      );

    appendAudit(
      "evidence_seal_attempt",
      candidateId,
      null
    );

    if (
      !exactKeys(
        request,
        [
          "phase8_input",
          "gate_state"
        ]
      )
    ) {
      return denySeal(
        candidateId,
        "beta26_input_invalid"
      );
    }

    if (
      candidateId !== null &&
      (
        failedEnvelopeIds.has(
          candidateId
        ) ||
        records.has(
          candidateId
        )
      )
    ) {
      return denySeal(
        candidateId,
        "beta26_regeneration_denied"
      );
    }

    const gateResult =
      evaluateBeta25Phase8ChainSealGates(
        request.phase8_input,
        request.gate_state
      );

    if (!gateResult.ok) {
      return denySeal(
        candidateId,
        "beta26_seal_denied",
        {
          upstream_failure_token:
            gateResult.failure_token
        }
      );
    }

    const envelope =
      materialiseEnvelope(
        request.phase8_input
      );

    const sealedBytes =
      betaCanonicalJson(
        envelope
      );

    const verification =
      verifyBeta26EnvelopeBytes(
        sealedBytes
      );

    if (!verification.ok) {
      return denySeal(
        candidateId,
        verification.failure_token,
        verification.details
      );
    }

    const record =
      deepFreeze({
        evidence_envelope_id:
          envelope
            .evidence_envelope_id,
        sealed_bytes:
          sealedBytes,
        sealed_bytes_checksum_sha256:
          verification
            .sealed_bytes_checksum_sha256
      });

    records.set(
      envelope.evidence_envelope_id,
      record
    );

    appendAudit(
      "evidence_seal_success",
      envelope.evidence_envelope_id,
      null
    );

    return deepFreeze({
      ok: true,
      evidence_envelope_id:
        envelope
          .evidence_envelope_id,
      sealed_bytes_checksum_sha256:
        record
          .sealed_bytes_checksum_sha256
    });
  }

  function read(
    evidenceEnvelopeId
  ) {
    const record =
      records.get(
        evidenceEnvelopeId
      );

    if (!record) {
      return failure(
        "beta26_evidence_not_found"
      );
    }

    const verification =
      verifyBeta26StoredEvidenceRecord(
        record
      );

    if (!verification.ok) {
      appendAudit(
        "evidence_mutation_denial",
        evidenceEnvelopeId,
        verification
          .failure_token
      );

      return verification;
    }

    return verification;
  }

  function exportBytes(
    evidenceEnvelopeId,
    options
  ) {
    if (options !== undefined) {
      return denyMutation(
        evidenceEnvelopeId,
        "beta26_export_mutation_denied"
      );
    }

    const readResult =
      read(
        evidenceEnvelopeId
      );

    if (!readResult.ok) {
      return readResult;
    }

    return deepFreeze({
      ok: true,
      evidence_envelope_id:
        evidenceEnvelopeId,
      export_format:
        "application/json",
      sealed_bytes:
        readResult.sealed_bytes,
      sealed_bytes_checksum_sha256:
        readResult
          .sealed_bytes_checksum_sha256
    });
  }

  function attemptUpdate(
    evidenceEnvelopeId
  ) {
    return denyMutation(
      evidenceEnvelopeId,
      "beta26_update_denied"
    );
  }

  function attemptDelete(
    evidenceEnvelopeId
  ) {
    return denyMutation(
      evidenceEnvelopeId,
      "beta26_delete_denied"
    );
  }

  function attemptManualCreation(
    sealedBytes
  ) {
    const evidenceEnvelopeId =
      readCandidateIdFromRawBytes(
        sealedBytes
      );

    appendAudit(
      "evidence_seal_attempt",
      evidenceEnvelopeId,
      null
    );

    if (
      rawEnvelopeIsPartial(
        sealedBytes
      )
    ) {
      return denySeal(
        evidenceEnvelopeId,
        "beta26_partial_envelope_denied"
      );
    }

    return denySeal(
      evidenceEnvelopeId,
      "beta26_manual_creation_denied"
    );
  }

  function attemptRegeneration(
    evidenceEnvelopeId
  ) {
    appendAudit(
      "evidence_seal_attempt",
      evidenceEnvelopeId,
      null
    );

    return denySeal(
      evidenceEnvelopeId,
      "beta26_regeneration_denied"
    );
  }

  function readAuditLog() {
    return deepFreeze(
      auditEvents.map(
        (event) =>
          deepFreeze(
            clone(event)
          )
      )
    );
  }

  return deepFreeze({
    seal,
    read,
    exportBytes,
    attemptUpdate,
    attemptDelete,
    attemptManualCreation,
    attemptRegeneration,
    readAuditLog
  });
}

export function buildBeta26EvidenceImmutabilityManifest(
  fileTexts
) {
  const required = [
    "contract",
    "failure_tokens",
    "runtime_store",
    "beta24_contract",
    "beta24_schema",
    "beta24_manifest",
    "beta25_contract",
    "beta25_manifest",
    "activation_source",
    "export_source"
  ];

  for (
    const key
    of required
  ) {
    if (
      typeof fileTexts?.[key] !==
      "string"
    ) {
      return failure(
        "beta26_manifest_invalid",
        {
          source: key
        }
      );
    }
  }

  return deepFreeze({
    schema_version:
      "kolosseum.beta26.evidence_immutability_manifest.v1.0.0",
    slice_id:
      "BETA-26",
    contract_version:
      beta26EvidenceImmutabilityContract
        .version,
    storage_mode:
      beta26EvidenceImmutabilityContract
        .storage_mode,
    audit_event_type_count:
      BETA26_AUDIT_EVENT_TYPES
        .length,
    store_api_count:
      BETA26_STORE_API_KEYS
        .length,
    database_migration_added:
      false,
    api_route_added:
      false,
    paths: {
      contract:
        "replay/contracts/beta26_evidence_immutability_contract.json",
      failure_tokens:
        "replay/contracts/beta26_evidence_immutability_failure_tokens.json",
      runtime_store:
        "replay/runtime/beta26EvidenceImmutableStore.mjs",
      beta24_contract:
        "replay/contracts/beta24_phase8_evidence_schema_contract.json",
      beta24_schema:
        "replay/contracts/beta24_phase8_evidence_envelope.schema.json",
      beta24_manifest:
        "replay/suite/beta_phase1_8/evidence_schema_manifest.json",
      beta25_contract:
        "replay/contracts/beta25_phase8_chain_seal_gates_contract.json",
      beta25_manifest:
        "replay/suite/beta_phase1_8/chain_seal_gates_manifest.json",
      activation_source:
        "src/api/evidence_activation_v1.ts",
      export_source:
        "src/v1ExportBoundaryContract.mjs"
    },
    sha256:
      Object.fromEntries(
        required.map(
          (key) => [
            key,
            sha256Utf8(
              fileTexts[key]
            )
          ]
        )
      )
  });
}

export function verifyBeta26EvidenceImmutabilityManifest(
  manifest,
  fileTexts
) {
  const expected =
    buildBeta26EvidenceImmutabilityManifest(
      fileTexts
    );

  if (expected?.ok === false) {
    return expected;
  }

  if (
    betaCanonicalJson(manifest) !==
    betaCanonicalJson(expected)
  ) {
    return failure(
      "beta26_manifest_invalid"
    );
  }

  return deepFreeze({
    ok: true,
    manifest_sha256:
      sha256Utf8(
        betaCanonicalJson(
          manifest
        )
      )
  });
}
