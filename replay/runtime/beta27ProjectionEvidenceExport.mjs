// DEV NOTE: BETA-27 byte-identical Phase 7 and sealed Phase 8 export.
// Export reads already stored bytes, verifies their hashes, applies an
// export-specific ownership/relationship policy, and returns the exact bytes.
// It never regenerates, reserialises, timestamps, or mutates exported truth.

import crypto from "node:crypto";

import {
  betaCanonicalHash,
  betaCanonicalJson
} from "../../engine/dist/src/phases/betaCanonical.js";

import {
  verifyBeta26EnvelopeBytes
} from "./beta26EvidenceImmutableStore.mjs";

export const BETA27_ARTIFACT_TYPES =
  Object.freeze([
    "phase7_projection_json",
    "phase8_evidence_envelope_json"
  ]);

export const BETA27_RELATIONSHIP_STATUSES =
  Object.freeze([
    "active",
    "archived",
    "pending",
    "revoked"
  ]);

export const BETA27_EXPORTABLE_COACH_STATUSES =
  Object.freeze([
    "active",
    "archived"
  ]);

export const BETA27_AUDIT_EVENT_TYPES =
  Object.freeze([
    "export_requested",
    "export_delivered",
    "export_denied"
  ]);

export const BETA27_FAILURE_TOKENS =
  Object.freeze([
    "beta27_input_invalid",
    "beta27_artifact_not_found",
    "beta27_access_denied",
    "beta27_revoked_coach_denied",
    "beta27_relationship_policy_denied",
    "beta27_hash_mismatch",
    "beta27_projection_invalid",
    "beta27_evidence_export_failed",
    "beta27_export_mutation_denied",
    "beta27_manifest_invalid"
  ]);

export const BETA27_PROJECTION_RECORD_KEYS =
  Object.freeze([
    "artifact_id",
    "owner_individual_user_id",
    "projection_hash",
    "stored_bytes",
    "stored_bytes_checksum_sha256"
  ]);

export const BETA27_SERVICE_API_KEYS =
  Object.freeze([
    "requestExport",
    "readAuditLog"
  ]);

export const beta27ProjectionEvidenceExportContract =
  Object.freeze({
    contract_id:
      "beta27_projection_evidence_export_contract",
    slice_id:
      "BETA-27",
    version:
      "1.0.0",
    artifact_types:
      BETA27_ARTIFACT_TYPES,
    projection_source:
      "stored_canonical_phase7_output_bytes",
    evidence_source:
      "beta26_exact_sealed_bytes",
    regeneration_on_export:
      false,
    export_timestamp_in_artifact_bytes:
      false,
    metadata_mutation:
      false,
    hash_verified_before_export:
      true,
    individual_export_scope:
      "own_artifacts_only",
    coach_export_relationship_statuses:
      BETA27_EXPORTABLE_COACH_STATUSES,
    revoked_coach_allowed:
      false,
    relationship_policy_required:
      true,
    audit_event_types:
      BETA27_AUDIT_EVENT_TYPES,
    service_api:
      BETA27_SERVICE_API_KEYS,
    api_adapter_added:
      true,
    live_route_wiring_added:
      false,
    ui_link_added:
      false,
    database_migration_added:
      false
  });

const PHASE7_OUTPUT_KEYS =
  Object.freeze([
    "phase7_projection_id",
    "canonical_input_hash",
    "selection_hash",
    "execution_status",
    "execution_state",
    "content_format",
    "rendered_output",
    "projection_hash"
  ]);

const SERVICE_CONFIG_KEYS =
  Object.freeze([
    "projection_records",
    "evidence_store",
    "evidence_owner_by_id"
  ]);

const REQUEST_KEYS =
  Object.freeze([
    "actor",
    "relationship",
    "artifact_type",
    "artifact_id"
  ]);

const ACTOR_KEYS =
  Object.freeze([
    "actor_id",
    "actor_type"
  ]);

const RELATIONSHIP_KEYS =
  Object.freeze([
    "relationship_id",
    "coach_id",
    "individual_user_id",
    "status",
    "permitted_export_types"
  ]);

const HASH_RE =
  /^[a-f0-9]{64}$/u;

function isRecord(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
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

function projectionWithoutHash(
  phase7Output
) {
  return {
    phase7_projection_id:
      phase7Output
        .phase7_projection_id,
    canonical_input_hash:
      phase7Output
        .canonical_input_hash,
    selection_hash:
      phase7Output
        .selection_hash,
    execution_status:
      phase7Output
        .execution_status,
    execution_state:
      phase7Output
        .execution_state,
    content_format:
      phase7Output
        .content_format,
    rendered_output:
      phase7Output
        .rendered_output
  };
}

function validatePhase7Output(
  phase7Output
) {
  if (
    !exactKeys(
      phase7Output,
      PHASE7_OUTPUT_KEYS
    ) ||
    typeof phase7Output
      .phase7_projection_id !==
      "string" ||
    phase7Output
      .phase7_projection_id.length ===
      0 ||
    !HASH_RE.test(
      phase7Output
        .canonical_input_hash
    ) ||
    !HASH_RE.test(
      phase7Output.selection_hash
    ) ||
    !HASH_RE.test(
      phase7Output.projection_hash
    ) ||
    typeof phase7Output
      .execution_status !==
      "string" ||
    !isRecord(
      phase7Output.execution_state
    ) ||
    phase7Output.content_format !==
      "application/json" ||
    typeof phase7Output
      .rendered_output !==
      "string"
  ) {
    return failure(
      "beta27_projection_invalid"
    );
  }

  const expectedRenderedOutput =
    betaCanonicalJson({
      canonical_input_hash:
        phase7Output
          .canonical_input_hash,
      selection_hash:
        phase7Output
          .selection_hash,
      execution_status:
        phase7Output
          .execution_status,
      execution_state:
        phase7Output
          .execution_state
    });

  if (
    phase7Output.rendered_output !==
    expectedRenderedOutput
  ) {
    return failure(
      "beta27_hash_mismatch",
      {
        hash_scope:
          "phase7_rendered_output"
      }
    );
  }

  const expectedProjectionHash =
    betaCanonicalHash(
      projectionWithoutHash(
        phase7Output
      )
    );

  if (
    phase7Output.projection_hash !==
    expectedProjectionHash
  ) {
    return failure(
      "beta27_hash_mismatch",
      {
        hash_scope:
          "phase7_projection_hash"
      }
    );
  }

  return deepFreeze({
    ok: true
  });
}

export function createBeta27StoredProjectionRecord(
  ownerIndividualUserId,
  phase7Output
) {
  if (
    typeof ownerIndividualUserId !==
      "string" ||
    ownerIndividualUserId.length ===
      0
  ) {
    return failure(
      "beta27_input_invalid"
    );
  }

  const validation =
    validatePhase7Output(
      phase7Output
    );

  if (!validation.ok) {
    return validation;
  }

  const storedBytes =
    betaCanonicalJson(
      phase7Output
    );

  return deepFreeze({
    ok: true,
    projection_record:
      deepFreeze({
        artifact_id:
          phase7Output
            .phase7_projection_id,
        owner_individual_user_id:
          ownerIndividualUserId,
        projection_hash:
          phase7Output
            .projection_hash,
        stored_bytes:
          storedBytes,
        stored_bytes_checksum_sha256:
          sha256Utf8(
            storedBytes
          )
      })
  });
}

export function verifyBeta27StoredProjectionRecord(
  record
) {
  if (
    !exactKeys(
      record,
      BETA27_PROJECTION_RECORD_KEYS
    ) ||
    typeof record.artifact_id !==
      "string" ||
    record.artifact_id.length ===
      0 ||
    typeof record
      .owner_individual_user_id !==
      "string" ||
    record
      .owner_individual_user_id
      .length ===
      0 ||
    !HASH_RE.test(
      record.projection_hash
    ) ||
    typeof record.stored_bytes !==
      "string" ||
    !HASH_RE.test(
      record
        .stored_bytes_checksum_sha256
    )
  ) {
    return failure(
      "beta27_projection_invalid"
    );
  }

  if (
    sha256Utf8(
      record.stored_bytes
    ) !==
    record
      .stored_bytes_checksum_sha256
  ) {
    return failure(
      "beta27_hash_mismatch",
      {
        hash_scope:
          "phase7_stored_bytes"
      }
    );
  }

  let phase7Output;

  try {
    phase7Output =
      JSON.parse(
        record.stored_bytes
      );
  }
  catch {
    return failure(
      "beta27_projection_invalid"
    );
  }

  if (
    betaCanonicalJson(
      phase7Output
    ) !==
    record.stored_bytes
  ) {
    return failure(
      "beta27_hash_mismatch",
      {
        hash_scope:
          "phase7_canonical_bytes"
      }
    );
  }

  const validation =
    validatePhase7Output(
      phase7Output
    );

  if (!validation.ok) {
    return validation;
  }

  if (
    phase7Output
      .phase7_projection_id !==
      record.artifact_id ||
    phase7Output.projection_hash !==
      record.projection_hash
  ) {
    return failure(
      "beta27_hash_mismatch",
      {
        hash_scope:
          "phase7_record_binding"
      }
    );
  }

  return deepFreeze({
    ok: true,
    phase7_output:
      deepFreeze(
        clone(phase7Output)
      ),
    stored_bytes:
      record.stored_bytes,
    stored_bytes_checksum_sha256:
      record
        .stored_bytes_checksum_sha256
  });
}

function validateActor(actor) {
  return (
    exactKeys(
      actor,
      ACTOR_KEYS
    ) &&
    typeof actor.actor_id ===
      "string" &&
    actor.actor_id.length > 0 &&
    (
      actor.actor_type ===
        "individual_user" ||
      actor.actor_type ===
        "coach"
    )
  );
}

function validateRelationship(
  relationship,
  actor
) {
  if (
    actor.actor_type ===
    "individual_user"
  ) {
    return relationship === null;
  }

  return (
    exactKeys(
      relationship,
      RELATIONSHIP_KEYS
    ) &&
    typeof relationship
      .relationship_id ===
      "string" &&
    relationship
      .relationship_id.length > 0 &&
    typeof relationship.coach_id ===
      "string" &&
    relationship.coach_id.length > 0 &&
    typeof relationship
      .individual_user_id ===
      "string" &&
    relationship
      .individual_user_id.length > 0 &&
    BETA27_RELATIONSHIP_STATUSES
      .includes(
        relationship.status
      ) &&
    Array.isArray(
      relationship
        .permitted_export_types
    ) &&
    relationship
      .permitted_export_types
      .every(
        (value) =>
          BETA27_ARTIFACT_TYPES
            .includes(value)
      )
  );
}

function validateRequest(request) {
  if (
    !exactKeys(
      request,
      REQUEST_KEYS
    ) ||
    !validateActor(
      request.actor
    ) ||
    !BETA27_ARTIFACT_TYPES
      .includes(
        request.artifact_type
      ) ||
    typeof request.artifact_id !==
      "string" ||
    request.artifact_id.length ===
      0 ||
    !validateRelationship(
      request.relationship,
      request.actor
    )
  ) {
    return failure(
      "beta27_input_invalid"
    );
  }

  return deepFreeze({
    ok: true
  });
}

function resolveAccess(
  request,
  ownerIndividualUserId
) {
  if (
    request.actor.actor_type ===
    "individual_user"
  ) {
    if (
      request.actor.actor_id !==
      ownerIndividualUserId
    ) {
      return failure(
        "beta27_access_denied"
      );
    }

    return deepFreeze({
      ok: true,
      permission_scope:
        "own_artifact"
    });
  }

  const relationship =
    request.relationship;

  if (
    relationship.status ===
    "revoked"
  ) {
    return failure(
      "beta27_revoked_coach_denied"
    );
  }

  if (
    !BETA27_EXPORTABLE_COACH_STATUSES
      .includes(
        relationship.status
      ) ||
    relationship.coach_id !==
      request.actor.actor_id ||
    relationship
      .individual_user_id !==
      ownerIndividualUserId ||
    !relationship
      .permitted_export_types
      .includes(
        request.artifact_type
      )
  ) {
    return failure(
      "beta27_relationship_policy_denied"
    );
  }

  return deepFreeze({
    ok: true,
    permission_scope:
      relationship.status ===
        "archived"
        ? "archived_coach_relationship"
        : "active_coach_relationship"
  });
}

export function createBeta27ProjectionEvidenceExportService(
  config
) {
  if (
    !exactKeys(
      config,
      SERVICE_CONFIG_KEYS
    ) ||
    !Array.isArray(
      config.projection_records
    ) ||
    !isRecord(
      config.evidence_owner_by_id
    ) ||
    !isRecord(
      config.evidence_store
    ) ||
    typeof config
      .evidence_store
      .exportBytes !==
      "function"
  ) {
    throw new TypeError(
      "beta27_input_invalid"
    );
  }

  const projectionRecords =
    new Map();

  for (
    const record
    of config.projection_records
  ) {
    if (
      !isRecord(record) ||
      typeof record.artifact_id !==
        "string" ||
      projectionRecords.has(
        record.artifact_id
      )
    ) {
      throw new TypeError(
        "beta27_input_invalid"
      );
    }

    projectionRecords.set(
      record.artifact_id,
      deepFreeze(
        clone(record)
      )
    );
  }

  const evidenceOwnerById =
    new Map();

  for (
    const [
      evidenceEnvelopeId,
      ownerIndividualUserId
    ]
    of Object.entries(
      config.evidence_owner_by_id
    )
  ) {
    if (
      typeof ownerIndividualUserId !==
        "string" ||
      ownerIndividualUserId.length ===
        0
    ) {
      throw new TypeError(
        "beta27_input_invalid"
      );
    }

    evidenceOwnerById.set(
      evidenceEnvelopeId,
      ownerIndividualUserId
    );
  }

  const auditEvents = [];

  let auditSequence = 0;

  function appendAudit(
    eventType,
    request,
    reasonToken
  ) {
    auditSequence += 1;

    const actor =
      isRecord(request?.actor)
        ? request.actor
        : {};

    const event =
      deepFreeze({
        audit_event_id:
          "beta27_audit_" +
          String(auditSequence)
            .padStart(6, "0"),
        event_type:
          eventType,
        actor_id:
          typeof actor.actor_id ===
            "string"
            ? actor.actor_id
            : null,
        actor_type:
          typeof actor.actor_type ===
            "string"
            ? actor.actor_type
            : null,
        artifact_type:
          typeof request
            ?.artifact_type ===
            "string"
            ? request.artifact_type
            : null,
        artifact_id:
          typeof request
            ?.artifact_id ===
            "string"
            ? request.artifact_id
            : null,
        reason_token:
          reasonToken ??
          null
      });

    auditEvents.push(event);

    return event;
  }

  function deny(
    request,
    failureToken,
    details = {}
  ) {
    appendAudit(
      "export_denied",
      request,
      failureToken
    );

    return failure(
      failureToken,
      details
    );
  }

  function requestExport(request) {
    appendAudit(
      "export_requested",
      request,
      null
    );

    const validation =
      validateRequest(
        request
      );

    if (!validation.ok) {
      return deny(
        request,
        validation.failure_token
      );
    }

    let ownerIndividualUserId;

    if (
      request.artifact_type ===
      "phase7_projection_json"
    ) {
      const record =
        projectionRecords.get(
          request.artifact_id
        );

      if (!record) {
        return deny(
          request,
          "beta27_artifact_not_found"
        );
      }

      ownerIndividualUserId =
        record
          .owner_individual_user_id;
    }
    else {
      ownerIndividualUserId =
        evidenceOwnerById.get(
          request.artifact_id
        );

      if (
        typeof ownerIndividualUserId !==
        "string"
      ) {
        return deny(
          request,
          "beta27_artifact_not_found"
        );
      }
    }

    const access =
      resolveAccess(
        request,
        ownerIndividualUserId
      );

    if (!access.ok) {
      return deny(
        request,
        access.failure_token
      );
    }

    let jsonBytes;
    let byteChecksum;

    if (
      request.artifact_type ===
      "phase7_projection_json"
    ) {
      const verification =
        verifyBeta27StoredProjectionRecord(
          projectionRecords.get(
            request.artifact_id
          )
        );

      if (!verification.ok) {
        return deny(
          request,
          verification.failure_token,
          verification.details
        );
      }

      jsonBytes =
        verification.stored_bytes;

      byteChecksum =
        verification
          .stored_bytes_checksum_sha256;
    }
    else {
      const exported =
        config.evidence_store
          .exportBytes(
            request.artifact_id
          );

      if (
        !isRecord(exported) ||
        exported.ok !== true ||
        typeof exported.sealed_bytes !==
          "string" ||
        typeof exported
          .sealed_bytes_checksum_sha256 !==
          "string"
      ) {
        const upstreamToken =
          isRecord(exported)
            ? exported.failure_token
            : null;

        return deny(
          request,
          upstreamToken ===
            "beta26_checksum_mismatch"
            ? "beta27_hash_mismatch"
            : "beta27_evidence_export_failed",
          {
            upstream_failure_token:
              upstreamToken
          }
        );
      }

      if (
        sha256Utf8(
          exported.sealed_bytes
        ) !==
        exported
          .sealed_bytes_checksum_sha256
      ) {
        return deny(
          request,
          "beta27_hash_mismatch",
          {
            hash_scope:
              "phase8_stored_bytes"
          }
        );
      }

      const verification =
        verifyBeta26EnvelopeBytes(
          exported.sealed_bytes
        );

      if (
        !verification.ok ||
        verification
          .sealed_bytes_checksum_sha256 !==
          exported
            .sealed_bytes_checksum_sha256
      ) {
        return deny(
          request,
          "beta27_hash_mismatch",
          {
            hash_scope:
              "phase8_envelope"
          }
        );
      }

      jsonBytes =
        exported.sealed_bytes;

      byteChecksum =
        exported
          .sealed_bytes_checksum_sha256;
    }

    appendAudit(
      "export_delivered",
      request,
      null
    );

    return deepFreeze({
      ok: true,
      artifact_type:
        request.artifact_type,
      artifact_id:
        request.artifact_id,
      permission_scope:
        access.permission_scope,
      content_type:
        "application/json",
      filename:
        `${request.artifact_id}.json`,
      json_bytes:
        jsonBytes,
      byte_checksum_sha256:
        byteChecksum
    });
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
    requestExport,
    readAuditLog
  });
}

export function buildBeta27ProjectionEvidenceExportManifest(
  fileTexts
) {
  const required = [
    "contract",
    "failure_tokens",
    "runtime_export",
    "api_adapter",
    "phase7_source",
    "beta26_runtime",
    "beta26_contract",
    "proof_view_source",
    "legacy_export_source"
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
        "beta27_manifest_invalid",
        {
          source: key
        }
      );
    }
  }

  return deepFreeze({
    schema_version:
      "kolosseum.beta27.projection_evidence_export_manifest.v1.0.0",
    slice_id:
      "BETA-27",
    contract_version:
      beta27ProjectionEvidenceExportContract
        .version,
    artifact_type_count:
      BETA27_ARTIFACT_TYPES
        .length,
    coach_export_status_count:
      BETA27_EXPORTABLE_COACH_STATUSES
        .length,
    audit_event_type_count:
      BETA27_AUDIT_EVENT_TYPES
        .length,
    live_route_wiring_added:
      false,
    ui_link_added:
      false,
    database_migration_added:
      false,
    paths: {
      contract:
        "replay/contracts/beta27_projection_evidence_export_contract.json",
      failure_tokens:
        "replay/contracts/beta27_projection_evidence_export_failure_tokens.json",
      runtime_export:
        "replay/runtime/beta27ProjectionEvidenceExport.mjs",
      api_adapter:
        "src/api/beta27ProjectionEvidenceExportApi.mjs",
      phase7_source:
        "engine/src/phases/beta18Phase7SchemaBinding.ts",
      beta26_runtime:
        "replay/runtime/beta26EvidenceImmutableStore.mjs",
      beta26_contract:
        "replay/contracts/beta26_evidence_immutability_contract.json",
      proof_view_source:
        "src/v1ProofArtefactViewContract.mjs",
      legacy_export_source:
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

export function verifyBeta27ProjectionEvidenceExportManifest(
  manifest,
  fileTexts
) {
  const expected =
    buildBeta27ProjectionEvidenceExportManifest(
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
      "beta27_manifest_invalid"
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
