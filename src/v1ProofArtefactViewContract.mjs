import { createHash } from "node:crypto";

export const S_V1_46_PROOF_ARTEFACT_VIEW_CONTRACT_ID = "s_v1_46_proof_artefact_view_contract";

export const S_V1_46_PROOF_ARTEFACT_VIEW_FAILURE_CODES = Object.freeze({
  INVALID_INPUT: "proof_artefact_view_invalid_input",
  PERMISSION_DENIED: "proof_artefact_view_permission_denied",
  MISSING_SOURCE: "proof_artefact_view_missing_source",
  SOURCE_NOT_BOUND: "proof_artefact_view_source_not_bound",
  ENVELOPE_MISMATCH: "proof_artefact_view_envelope_mismatch",
  DISALLOWED_FIELD: "proof_artefact_view_disallowed_field",
});

export const S_V1_46_PROOF_ARTEFACT_VIEW_COPY_IDS = Object.freeze({
  TITLE: "v1.proof_artefact_view.title",
  NOT_AVAILABLE: "v1.proof_artefact_view.not_available",
  PERMISSION_REQUIRED: "v1.proof_artefact_view.permission_required",
  SOURCE_RECORD: "v1.proof_artefact_view.source_record",
  REPLAY_VERDICT: "v1.proof_artefact_view.replay_verdict",
  ENVELOPE_STATE: "v1.proof_artefact_view.envelope_state",
  ARTEFACT_HASH: "v1.proof_artefact_view.artefact_hash",
  RECORDED_AT: "v1.proof_artefact_view.recorded_at",
});

const TOP_LEVEL_KEYS = new Set(["viewer", "relationship", "artefact", "viewed_at_utc"]);
const VIEWER_KEYS = new Set(["actor_id", "actor_type"]);
const RELATIONSHIP_KEYS = new Set(["relationship_id", "coach_id", "athlete_id", "status", "permitted_artefact_ids"]);
const ARTEFACT_KEYS = new Set(["artefact_id", "artefact_type", "athlete_id", "source"]);
const SOURCE_KEYS = new Set([
  "source_id",
  "source_type",
  "source_bound",
  "replay_verdict",
  "source_hash_sha256",
  "recorded_at_utc",
  "evidence_envelope",
]);
const ENVELOPE_KEYS = new Set([
  "envelope_id",
  "artefact_id",
  "source_id",
  "source_bound",
  "replay_verdict",
  "envelope_hash_sha256",
  "generated_at_utc",
  "failure_tokens",
]);

const ACTOR_TYPES = new Set(["athlete", "coach"]);
const RELATIONSHIP_STATUSES = new Set(["active", "pending", "revoked"]);
const SOURCE_TYPES = new Set(["replay_boundary_record", "evidence_envelope_record"]);
const REPLAY_VERDICTS = new Set(["ACCEPTED", "REJECTED"]);
const SHA256_HEX = /^[a-f0-9]{64}$/;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fail(code, message, path = null) {
  return deepFreeze({
    ok: false,
    error: {
      code,
      message,
      path,
    },
  });
}

function ok(value) {
  return deepFreeze({
    ok: true,
    ...value,
  });
}

function assertNoExtraKeys(value, allowed, code, path) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      return fail(code, `Disallowed field at ${path}.${key}`, `${path}.${key}`);
    }
  }

  return null;
}

function requireString(value, code, path) {
  if (typeof value !== "string" || value.length === 0) {
    return fail(code, `Required string at ${path}`, path);
  }

  return null;
}

function requireIsoUtc(value, code, path) {
  const stringFailure = requireString(value, code, path);
  if (stringFailure) return stringFailure;

  if (!ISO_UTC.test(value)) {
    return fail(code, `Required UTC timestamp at ${path}`, path);
  }

  return null;
}

function requireSha256(value, code, path) {
  const stringFailure = requireString(value, code, path);
  if (stringFailure) return stringFailure;

  if (!SHA256_HEX.test(value)) {
    return fail(code, `Required sha256 hex at ${path}`, path);
  }

  return null;
}

function validateViewer(viewer) {
  if (!isPlainObject(viewer)) {
    return fail(S_V1_46_PROOF_ARTEFACT_VIEW_FAILURE_CODES.INVALID_INPUT, "viewer must be an object", "viewer");
  }

  const extra = assertNoExtraKeys(
    viewer,
    VIEWER_KEYS,
    S_V1_46_PROOF_ARTEFACT_VIEW_FAILURE_CODES.DISALLOWED_FIELD,
    "viewer",
  );
  if (extra) return extra;

  const actorIdFailure = requireString(
    viewer.actor_id,
    S_V1_46_PROOF_ARTEFACT_VIEW_FAILURE_CODES.INVALID_INPUT,
    "viewer.actor_id",
  );
  if (actorIdFailure) return actorIdFailure;

  if (!ACTOR_TYPES.has(viewer.actor_type)) {
    return fail(
      S_V1_46_PROOF_ARTEFACT_VIEW_FAILURE_CODES.INVALID_INPUT,
      "viewer actor_type is not permitted",
      "viewer.actor_type",
    );
  }

  return null;
}

function validateRelationship(relationship, viewer) {
  if (viewer.actor_type === "athlete" && relationship === null) {
    return null;
  }

  if (!isPlainObject(relationship)) {
    return fail(
      S_V1_46_PROOF_ARTEFACT_VIEW_FAILURE_CODES.INVALID_INPUT,
      "relationship must be an object for coach view",
      "relationship",
    );
  }

  const extra = assertNoExtraKeys(
    relationship,
    RELATIONSHIP_KEYS,
    S_V1_46_PROOF_ARTEFACT_VIEW_FAILURE_CODES.DISALLOWED_FIELD,
    "relationship",
  );
  if (extra) return extra;

  for (const key of ["relationship_id", "coach_id", "athlete_id"]) {
    const failure = requireString(
      relationship[key],
      S_V1_46_PROOF_ARTEFACT_VIEW_FAILURE_CODES.INVALID_INPUT,
      `relationship.${key}`,
    );
    if (failure) return failure;
  }

  if (!RELATIONSHIP_STATUSES.has(relationship.status)) {
    return fail(
      S_V1_46_PROOF_ARTEFACT_VIEW_FAILURE_CODES.INVALID_INPUT,
      "relationship status is not permitted",
      "relationship.status",
    );
  }

  if (
    relationship.permitted_artefact_ids !== undefined &&
    !Array.isArray(relationship.permitted_artefact_ids)
  ) {
    return fail(
      S_V1_46_PROOF_ARTEFACT_VIEW_FAILURE_CODES.INVALID_INPUT,
      "permitted_artefact_ids must be an array when present",
      "relationship.permitted_artefact_ids",
    );
  }

  if (Array.isArray(relationship.permitted_artefact_ids)) {
    for (let index = 0; index < relationship.permitted_artefact_ids.length; index++) {
      const value = relationship.permitted_artefact_ids[index];
      if (typeof value !== "string" || value.length === 0) {
        return fail(
          S_V1_46_PROOF_ARTEFACT_VIEW_FAILURE_CODES.INVALID_INPUT,
          "permitted_artefact_ids entries must be strings",
          `relationship.permitted_artefact_ids[${index}]`,
        );
      }
    }
  }

  return null;
}

function validateSource(source, artefactId) {
  if (!isPlainObject(source)) {
    return fail(S_V1_46_PROOF_ARTEFACT_VIEW_FAILURE_CODES.MISSING_SOURCE, "source must be an object", "artefact.source");
  }

  const extra = assertNoExtraKeys(
    source,
    SOURCE_KEYS,
    S_V1_46_PROOF_ARTEFACT_VIEW_FAILURE_CODES.DISALLOWED_FIELD,
    "artefact.source",
  );
  if (extra) return extra;

  for (const key of ["source_id", "source_type", "replay_verdict", "source_hash_sha256", "recorded_at_utc"]) {
    const failure = requireString(
      source[key],
      S_V1_46_PROOF_ARTEFACT_VIEW_FAILURE_CODES.MISSING_SOURCE,
      `artefact.source.${key}`,
    );
    if (failure) return failure;
  }

  if (!SOURCE_TYPES.has(source.source_type)) {
    return fail(
      S_V1_46_PROOF_ARTEFACT_VIEW_FAILURE_CODES.MISSING_SOURCE,
      "source_type is not permitted",
      "artefact.source.source_type",
    );
  }

  if (source.source_bound !== true) {
    return fail(
      S_V1_46_PROOF_ARTEFACT_VIEW_FAILURE_CODES.SOURCE_NOT_BOUND,
      "source_bound must be true",
      "artefact.source.source_bound",
    );
  }

  if (!REPLAY_VERDICTS.has(source.replay_verdict)) {
    return fail(
      S_V1_46_PROOF_ARTEFACT_VIEW_FAILURE_CODES.MISSING_SOURCE,
      "replay_verdict is not permitted",
      "artefact.source.replay_verdict",
    );
  }

  const hashFailure = requireSha256(
    source.source_hash_sha256,
    S_V1_46_PROOF_ARTEFACT_VIEW_FAILURE_CODES.MISSING_SOURCE,
    "artefact.source.source_hash_sha256",
  );
  if (hashFailure) return hashFailure;

  const timeFailure = requireIsoUtc(
    source.recorded_at_utc,
    S_V1_46_PROOF_ARTEFACT_VIEW_FAILURE_CODES.MISSING_SOURCE,
    "artefact.source.recorded_at_utc",
  );
  if (timeFailure) return timeFailure;

  if (source.evidence_envelope === null || source.evidence_envelope === undefined) {
    return null;
  }

  return validateEnvelope(source.evidence_envelope, artefactId, source.source_id);
}

function validateEnvelope(envelope, artefactId, sourceId) {
  if (!isPlainObject(envelope)) {
    return fail(
      S_V1_46_PROOF_ARTEFACT_VIEW_FAILURE_CODES.ENVELOPE_MISMATCH,
      "evidence_envelope must be an object when present",
      "artefact.source.evidence_envelope",
    );
  }

  const extra = assertNoExtraKeys(
    envelope,
    ENVELOPE_KEYS,
    S_V1_46_PROOF_ARTEFACT_VIEW_FAILURE_CODES.DISALLOWED_FIELD,
    "artefact.source.evidence_envelope",
  );
  if (extra) return extra;

  for (const key of ["envelope_id", "artefact_id", "source_id", "replay_verdict", "envelope_hash_sha256", "generated_at_utc"]) {
    const failure = requireString(
      envelope[key],
      S_V1_46_PROOF_ARTEFACT_VIEW_FAILURE_CODES.ENVELOPE_MISMATCH,
      `artefact.source.evidence_envelope.${key}`,
    );
    if (failure) return failure;
  }

  if (envelope.artefact_id !== artefactId) {
    return fail(
      S_V1_46_PROOF_ARTEFACT_VIEW_FAILURE_CODES.ENVELOPE_MISMATCH,
      "envelope artefact_id does not match artefact",
      "artefact.source.evidence_envelope.artefact_id",
    );
  }

  if (envelope.source_id !== sourceId) {
    return fail(
      S_V1_46_PROOF_ARTEFACT_VIEW_FAILURE_CODES.ENVELOPE_MISMATCH,
      "envelope source_id does not match source",
      "artefact.source.evidence_envelope.source_id",
    );
  }

  if (envelope.source_bound !== true) {
    return fail(
      S_V1_46_PROOF_ARTEFACT_VIEW_FAILURE_CODES.SOURCE_NOT_BOUND,
      "envelope source_bound must be true",
      "artefact.source.evidence_envelope.source_bound",
    );
  }

  if (!REPLAY_VERDICTS.has(envelope.replay_verdict)) {
    return fail(
      S_V1_46_PROOF_ARTEFACT_VIEW_FAILURE_CODES.ENVELOPE_MISMATCH,
      "envelope replay_verdict is not permitted",
      "artefact.source.evidence_envelope.replay_verdict",
    );
  }

  const hashFailure = requireSha256(
    envelope.envelope_hash_sha256,
    S_V1_46_PROOF_ARTEFACT_VIEW_FAILURE_CODES.ENVELOPE_MISMATCH,
    "artefact.source.evidence_envelope.envelope_hash_sha256",
  );
  if (hashFailure) return hashFailure;

  const timeFailure = requireIsoUtc(
    envelope.generated_at_utc,
    S_V1_46_PROOF_ARTEFACT_VIEW_FAILURE_CODES.ENVELOPE_MISMATCH,
    "artefact.source.evidence_envelope.generated_at_utc",
  );
  if (timeFailure) return timeFailure;

  if (envelope.failure_tokens !== undefined && !Array.isArray(envelope.failure_tokens)) {
    return fail(
      S_V1_46_PROOF_ARTEFACT_VIEW_FAILURE_CODES.ENVELOPE_MISMATCH,
      "failure_tokens must be an array when present",
      "artefact.source.evidence_envelope.failure_tokens",
    );
  }

  if (Array.isArray(envelope.failure_tokens)) {
    for (let index = 0; index < envelope.failure_tokens.length; index++) {
      if (typeof envelope.failure_tokens[index] !== "string") {
        return fail(
          S_V1_46_PROOF_ARTEFACT_VIEW_FAILURE_CODES.ENVELOPE_MISMATCH,
          "failure_tokens entries must be strings",
          `artefact.source.evidence_envelope.failure_tokens[${index}]`,
        );
      }
    }
  }

  return null;
}

function validateArtefact(artefact) {
  if (!isPlainObject(artefact)) {
    return fail(S_V1_46_PROOF_ARTEFACT_VIEW_FAILURE_CODES.INVALID_INPUT, "artefact must be an object", "artefact");
  }

  const extra = assertNoExtraKeys(
    artefact,
    ARTEFACT_KEYS,
    S_V1_46_PROOF_ARTEFACT_VIEW_FAILURE_CODES.DISALLOWED_FIELD,
    "artefact",
  );
  if (extra) return extra;

  for (const key of ["artefact_id", "artefact_type", "athlete_id"]) {
    const failure = requireString(
      artefact[key],
      S_V1_46_PROOF_ARTEFACT_VIEW_FAILURE_CODES.INVALID_INPUT,
      `artefact.${key}`,
    );
    if (failure) return failure;
  }

  if (!SOURCE_TYPES.has(artefact.artefact_type)) {
    return fail(
      S_V1_46_PROOF_ARTEFACT_VIEW_FAILURE_CODES.INVALID_INPUT,
      "artefact_type is not permitted",
      "artefact.artefact_type",
    );
  }

  return validateSource(artefact.source, artefact.artefact_id);
}

function resolvePermissionScope(viewer, relationship, artefact) {
  if (viewer.actor_type === "athlete") {
    if (viewer.actor_id === artefact.athlete_id) {
      return { ok: true, permission_scope: "self" };
    }

    return fail(
      S_V1_46_PROOF_ARTEFACT_VIEW_FAILURE_CODES.PERMISSION_DENIED,
      "athlete may view only own artefact",
      "viewer.actor_id",
    );
  }

  if (!relationship || relationship.status !== "active") {
    return fail(
      S_V1_46_PROOF_ARTEFACT_VIEW_FAILURE_CODES.PERMISSION_DENIED,
      "active relationship required",
      "relationship.status",
    );
  }

  if (relationship.coach_id !== viewer.actor_id || relationship.athlete_id !== artefact.athlete_id) {
    return fail(
      S_V1_46_PROOF_ARTEFACT_VIEW_FAILURE_CODES.PERMISSION_DENIED,
      "relationship does not cover artefact",
      "relationship",
    );
  }

  if (
    Array.isArray(relationship.permitted_artefact_ids) &&
    !relationship.permitted_artefact_ids.includes(artefact.artefact_id)
  ) {
    return fail(
      S_V1_46_PROOF_ARTEFACT_VIEW_FAILURE_CODES.PERMISSION_DENIED,
      "artefact is outside relationship permission scope",
      "relationship.permitted_artefact_ids",
    );
  }

  return { ok: true, permission_scope: "assigned_coach" };
}

function proofStateFor(source) {
  const envelope = source.evidence_envelope;

  if (!envelope) {
    return {
      proof_state: "not_available",
      envelope_state: "not_available",
      evidence_envelope: null,
    };
  }

  return {
    proof_state: envelope.replay_verdict === "ACCEPTED" ? "accepted" : "rejected",
    envelope_state: "recorded",
    evidence_envelope: {
      envelope_id: envelope.envelope_id,
      source_id: envelope.source_id,
      source_bound: true,
      replay_verdict: envelope.replay_verdict,
      envelope_hash_sha256: envelope.envelope_hash_sha256,
      generated_at_utc: envelope.generated_at_utc,
      failure_tokens: Array.isArray(envelope.failure_tokens) ? [...envelope.failure_tokens] : [],
    },
  };
}

function stableViewId(input) {
  const material = JSON.stringify({
    contract_id: S_V1_46_PROOF_ARTEFACT_VIEW_CONTRACT_ID,
    viewer_id: input.viewer.actor_id,
    artefact_id: input.artefact.artefact_id,
    source_id: input.artefact.source.source_id,
    source_hash_sha256: input.artefact.source.source_hash_sha256,
    viewed_at_utc: input.viewed_at_utc,
  });

  return `proof_view_${createHash("sha256").update(material).digest("hex")}`;
}

export function buildProofArtefactView(input) {
  if (!isPlainObject(input)) {
    return fail(S_V1_46_PROOF_ARTEFACT_VIEW_FAILURE_CODES.INVALID_INPUT, "input must be an object", "input");
  }

  const extra = assertNoExtraKeys(
    input,
    TOP_LEVEL_KEYS,
    S_V1_46_PROOF_ARTEFACT_VIEW_FAILURE_CODES.DISALLOWED_FIELD,
    "input",
  );
  if (extra) return extra;

  const viewerFailure = validateViewer(input.viewer);
  if (viewerFailure) return viewerFailure;

  const relationshipValue = input.relationship === undefined ? null : input.relationship;
  const relationshipFailure = validateRelationship(relationshipValue, input.viewer);
  if (relationshipFailure) return relationshipFailure;

  const artefactFailure = validateArtefact(input.artefact);
  if (artefactFailure) return artefactFailure;

  const timeFailure = requireIsoUtc(
    input.viewed_at_utc,
    S_V1_46_PROOF_ARTEFACT_VIEW_FAILURE_CODES.INVALID_INPUT,
    "viewed_at_utc",
  );
  if (timeFailure) return timeFailure;

  const permission = resolvePermissionScope(input.viewer, relationshipValue, input.artefact);
  if (!permission.ok) return permission;

  const proofState = proofStateFor(input.artefact.source);

  return ok({
    view: {
      contract_id: S_V1_46_PROOF_ARTEFACT_VIEW_CONTRACT_ID,
      view_id: stableViewId(input),
      viewed_at_utc: input.viewed_at_utc,
      viewed_by_actor_id: input.viewer.actor_id,
      viewed_by_actor_type: input.viewer.actor_type,
      permission_scope: permission.permission_scope,
      artefact: {
        artefact_id: input.artefact.artefact_id,
        artefact_type: input.artefact.artefact_type,
        athlete_id: input.artefact.athlete_id,
      },
      source: {
        source_id: input.artefact.source.source_id,
        source_type: input.artefact.source.source_type,
        source_bound: true,
        replay_verdict: input.artefact.source.replay_verdict,
        source_hash_sha256: input.artefact.source.source_hash_sha256,
        recorded_at_utc: input.artefact.source.recorded_at_utc,
      },
      proof_state: proofState.proof_state,
      envelope_state: proofState.envelope_state,
      evidence_envelope: proofState.evidence_envelope,
      copy_ids: [
        S_V1_46_PROOF_ARTEFACT_VIEW_COPY_IDS.TITLE,
        S_V1_46_PROOF_ARTEFACT_VIEW_COPY_IDS.SOURCE_RECORD,
        S_V1_46_PROOF_ARTEFACT_VIEW_COPY_IDS.REPLAY_VERDICT,
        S_V1_46_PROOF_ARTEFACT_VIEW_COPY_IDS.ENVELOPE_STATE,
        S_V1_46_PROOF_ARTEFACT_VIEW_COPY_IDS.ARTEFACT_HASH,
        S_V1_46_PROOF_ARTEFACT_VIEW_COPY_IDS.RECORDED_AT,
      ],
    },
  });
}

export function handleProofArtefactViewApiRequest(request) {
  if (!isPlainObject(request)) {
    return deepFreeze({
      status: 400,
      body: fail(S_V1_46_PROOF_ARTEFACT_VIEW_FAILURE_CODES.INVALID_INPUT, "request must be an object", "request"),
    });
  }

  const result = buildProofArtefactView(request);

  if (!result.ok) {
    const status =
      result.error.code === S_V1_46_PROOF_ARTEFACT_VIEW_FAILURE_CODES.PERMISSION_DENIED ? 403 : 400;

    return deepFreeze({
      status,
      body: result,
    });
  }

  return deepFreeze({
    status: 200,
    body: result,
  });
}

export function renderProofArtefactView(view) {
  if (!isPlainObject(view) || view.contract_id !== S_V1_46_PROOF_ARTEFACT_VIEW_CONTRACT_ID) {
    return fail(
      S_V1_46_PROOF_ARTEFACT_VIEW_FAILURE_CODES.INVALID_INPUT,
      "view must be a proof artefact view",
      "view",
    );
  }

  const stateCopyId =
    view.proof_state === "not_available"
      ? S_V1_46_PROOF_ARTEFACT_VIEW_COPY_IDS.NOT_AVAILABLE
      : S_V1_46_PROOF_ARTEFACT_VIEW_COPY_IDS.ENVELOPE_STATE;

  return ok({
    rendered: {
      surface_id: "v1.proof_artefact_view",
      title_copy_id: S_V1_46_PROOF_ARTEFACT_VIEW_COPY_IDS.TITLE,
      state_copy_id: stateCopyId,
      rows: [
        {
          label_copy_id: S_V1_46_PROOF_ARTEFACT_VIEW_COPY_IDS.SOURCE_RECORD,
          value: view.source.source_id,
        },
        {
          label_copy_id: S_V1_46_PROOF_ARTEFACT_VIEW_COPY_IDS.REPLAY_VERDICT,
          value: view.source.replay_verdict,
        },
        {
          label_copy_id: S_V1_46_PROOF_ARTEFACT_VIEW_COPY_IDS.ENVELOPE_STATE,
          value: view.envelope_state,
        },
        {
          label_copy_id: S_V1_46_PROOF_ARTEFACT_VIEW_COPY_IDS.ARTEFACT_HASH,
          value: view.source.source_hash_sha256,
        },
        {
          label_copy_id: S_V1_46_PROOF_ARTEFACT_VIEW_COPY_IDS.RECORDED_AT,
          value: view.source.recorded_at_utc,
        },
      ],
    },
  });
}

/**
 * FUNCTION NOTE
 * Purpose: recursively freezes the proof artefact view result so callers cannot mutate
 * returned source, permission, envelope, or render records after construction.
 * Boundary: this helper is local to the read-model contract and does not freeze engine,
 * replay, storage, or registry objects.
 * Determinism: identical input objects produce identical frozen output structures.
 * Failure: non-object values are returned as-is; object values are frozen after children.
 */
function deepFreeze(value) {
  if (!isPlainObject(value) && !Array.isArray(value)) {
    return value;
  }

  for (const key of Object.keys(value)) {
    deepFreeze(value[key]);
  }

  return Object.freeze(value);
}