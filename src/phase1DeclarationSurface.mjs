// DEV NOTE: Application declaration surface. This module records explicit
// user-declared Phase 1 product state and keeps it outside engine execution.
// Do not import engine/server/shared code, add clocks, add persistence, add UI,
// or turn this surface into decision authority or
// assignment authority.

import crypto from "node:crypto";

export const phase1DeclarationSurfaceId = "phase_1_declaration_surface";

export const phase1DeclarationSurfaceVersion = "1.0.0";

export const phase1DeclarationPins = Object.freeze({
  phase1_schema_version: "1.0.0",
  engine_compatibility: "EB2-1.0.0",
  enum_bundle_version: "EB2-1.0.0"
});

export const phase1DeclarationCopyIds = Object.freeze([
  "PHASE_1_DECLARATION_ACCEPTED",
  "PHASE_1_DECLARATION_REJECTED",
  "PHASE_1_DECLARATION_REQUIRED",
  "PHASE_1_DECLARATION_USER_DECLARED_FACTUAL",
  "PHASE_1_DECLARATION_PRODUCT_STATE_ONLY"
]);

export const phase1DeclarationCopyText = Object.freeze({
  PHASE_1_DECLARATION_ACCEPTED: "Phase 1 declaration recorded.",
  PHASE_1_DECLARATION_REJECTED: "Phase 1 declaration could not be recorded.",
  PHASE_1_DECLARATION_REQUIRED: "Phase 1 declaration is required before compile admission.",
  PHASE_1_DECLARATION_USER_DECLARED_FACTUAL: "Declaration is user-declared factual state.",
  PHASE_1_DECLARATION_PRODUCT_STATE_ONLY: "Declaration surface is product state only."
});

export const phase1DeclarationErrorIds = Object.freeze([
  "phase1_declaration_unknown_field_refused",
  "phase1_declaration_payload_unknown_field_refused",
  "phase1_declaration_payload_consent_not_declared",
  "phase1_declaration_payload_jurisdiction_not_declared",
  "phase1_declaration_required_before_compile",
  "phase1_declaration_hash_mismatch"
]);

const allowedTopLevelKeys = new Set([
  "declaration_id",
  "declared_by_user_id",
  "subject_user_id",
  "declaration_source",
  "declaration_scope",
  "declaration_state",
  "declaration_payload",
  "declared_at_iso8601",
  "accepted_terms_version",
  "copy_acknowledgement_id"
]);

const allowedPayloadKeys = new Set([
  "actor_type",
  "execution_scope",
  "activity_id",
  "phase1_schema_version",
  "engine_compatibility",
  "enum_bundle_version",
  "consent_granted",
  "jurisdiction_acknowledged"
]);

const allowedActorTypes = new Set(["individual_user", "coach"]);
const allowedExecutionScopes = new Set(["individual", "coach_managed"]);
const allowedActivityIds = new Set(["powerlifting", "rugby_union", "general_strength"]);

const forbiddenTopLevelKeys = new Set([
  "engine_input",
  "compile_input",
  "canonical_engine_input",
  "assignment_authority",
  "proof_authority",
  "registry_authority",
  "relationship_authority",
  "broad_rbac",
  "team_role",
  "organisation_role",
  "organization_role",
  "gym_role",
  "unit_role",
  "federation_role",
  "enterprise_role"
]);

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isIso8601(value) {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

export function stablePhase1DeclarationJson(value) {
  if (value === null) return "null";

  if (Array.isArray(value)) {
    return "[" + value.map((item) => stablePhase1DeclarationJson(item)).join(",") + "]";
  }

  if (typeof value === "object") {
    return "{" + Object.keys(value).sort().map((key) => {
      return JSON.stringify(key) + ":" + stablePhase1DeclarationJson(value[key]);
    }).join(",") + "}";
  }

  return JSON.stringify(value);
}

export function phase1DeclarationSha256(value) {
  return crypto
    .createHash("sha256")
    .update(stablePhase1DeclarationJson(value), "utf8")
    .digest("hex");
}

function reject(error) {
  return Object.freeze({
    ok: false,
    error,
    copy_id: "PHASE_1_DECLARATION_REJECTED",
    product_declaration_state_only: true,
    engine_visible: false
  });
}

function validateClosedWorldKeys(input, allowedKeys, location) {
  for (const key of Object.keys(input)) {
    if (forbiddenTopLevelKeys.has(key)) {
      return `${location}_forbidden_claim_or_authority_field_refused`;
    }

    if (!allowedKeys.has(key)) {
      return `${location}_unknown_field_refused`;
    }
  }

  return null;
}

/**
 * FUNCTION NOTE:
 * Export: validatePhase1DeclarationInput
 * Purpose: Validates factual user-declared Phase 1 declaration input.
 * Inputs: Closed-world declaration record with a closed-world declaration payload.
 * Output: ok object or stable rejection object.
 * Boundary: Validation does not create decision authority, persist, call engine code, or create assignment authority.
 * Determinism: Same explicit input returns same validation result.
 * Failure: Missing, unknown, false acknowledgement, version mismatch, or forbidden authority field fails closed.
 */
export function validatePhase1DeclarationInput(input) {
  if (!isRecord(input)) {
    return reject("phase1_declaration_input_invalid");
  }

  const topLevelKeyFailure = validateClosedWorldKeys(input, allowedTopLevelKeys, "phase1_declaration");
  if (topLevelKeyFailure) {
    return reject(topLevelKeyFailure);
  }

  for (const required of allowedTopLevelKeys) {
    if (!(required in input)) {
      return reject(`phase1_declaration_${required}_required`);
    }
  }

  const declarationId = cleanString(input.declaration_id);
  const declaredByUserId = cleanString(input.declared_by_user_id);
  const subjectUserId = cleanString(input.subject_user_id);
  const declaredAt = cleanString(input.declared_at_iso8601);
  const acceptedTermsVersion = cleanString(input.accepted_terms_version);
  const copyAcknowledgementId = cleanString(input.copy_acknowledgement_id);

  if (declarationId.length === 0) return reject("phase1_declaration_id_required");
  if (declaredByUserId.length === 0) return reject("phase1_declaration_declared_by_user_id_required");
  if (subjectUserId.length === 0) return reject("phase1_declaration_subject_user_id_required");
  if (input.declaration_source !== "user_declared") return reject("phase1_declaration_source_invalid");
  if (input.declaration_scope !== "phase1_compile_prerequisite") return reject("phase1_declaration_scope_invalid");
  if (input.declaration_state !== "accepted") return reject("phase1_declaration_state_invalid");
  if (!isIso8601(declaredAt)) return reject("phase1_declaration_declared_at_invalid");
  if (acceptedTermsVersion.length === 0) return reject("phase1_declaration_terms_version_required");
  if (copyAcknowledgementId !== "PHASE_1_DECLARATION_USER_DECLARED_FACTUAL") {
    return reject("phase1_declaration_copy_acknowledgement_invalid");
  }

  if (!isRecord(input.declaration_payload)) {
    return reject("phase1_declaration_payload_invalid");
  }

  const payloadKeyFailure = validateClosedWorldKeys(input.declaration_payload, allowedPayloadKeys, "phase1_declaration_payload");
  if (payloadKeyFailure) {
    return reject(payloadKeyFailure);
  }

  for (const required of allowedPayloadKeys) {
    if (!(required in input.declaration_payload)) {
      return reject(`phase1_declaration_payload_${required}_required`);
    }
  }

  const payload = input.declaration_payload;

  if (!allowedActorTypes.has(payload.actor_type)) {
    return reject("phase1_declaration_payload_actor_type_invalid");
  }

  if (!allowedExecutionScopes.has(payload.execution_scope)) {
    return reject("phase1_declaration_payload_execution_scope_invalid");
  }

  if (!allowedActivityIds.has(payload.activity_id)) {
    return reject("phase1_declaration_payload_activity_id_invalid");
  }

  if (payload.phase1_schema_version !== phase1DeclarationPins.phase1_schema_version) {
    return reject("phase1_declaration_payload_phase1_schema_version_mismatch");
  }

  if (payload.engine_compatibility !== phase1DeclarationPins.engine_compatibility) {
    return reject("phase1_declaration_payload_engine_compatibility_mismatch");
  }

  if (payload.enum_bundle_version !== phase1DeclarationPins.enum_bundle_version) {
    return reject("phase1_declaration_payload_enum_bundle_version_mismatch");
  }

  if (payload.consent_granted !== true) {
    return reject("phase1_declaration_payload_consent_not_declared");
  }

  if (payload.jurisdiction_acknowledged !== true) {
    return reject("phase1_declaration_payload_jurisdiction_not_declared");
  }

  return Object.freeze({
    ok: true,
    canonical_payload: Object.freeze({
      actor_type: payload.actor_type,
      execution_scope: payload.execution_scope,
      activity_id: payload.activity_id,
      phase1_schema_version: payload.phase1_schema_version,
      engine_compatibility: payload.engine_compatibility,
      enum_bundle_version: payload.enum_bundle_version,
      consent_granted: payload.consent_granted,
      jurisdiction_acknowledged: payload.jurisdiction_acknowledged
    })
  });
}

/**
 * FUNCTION NOTE:
 * Export: createPhase1DeclarationRecord
 * Purpose: Creates an immutable factual declaration record from valid user-declared input.
 * Inputs: Validated declaration input only.
 * Output: HTTP-like result with accepted record or closed failure.
 * Boundary: Product declaration state only; does not persist, call engine code, or compile.
 * Determinism: Same input returns same canonical record and hash.
 * Failure: Validation failure returns stable 400 body rather than defaulting or inferring.
 */
export function createPhase1DeclarationRecord(input) {
  const validation = validatePhase1DeclarationInput(input);

  if (!validation.ok) {
    return Object.freeze({
      status: 400,
      body: Object.freeze({
        ok: false,
        surface_id: phase1DeclarationSurfaceId,
        version: phase1DeclarationSurfaceVersion,
        error: validation.error,
        copy_id: validation.copy_id,
        product_declaration_state_only: true,
        engine_visible: false
      })
    });
  }

  const record = Object.freeze({
    declaration_id: input.declaration_id,
    declared_by_user_id: input.declared_by_user_id,
    subject_user_id: input.subject_user_id,
    declaration_source: input.declaration_source,
    declaration_scope: input.declaration_scope,
    declaration_state: input.declaration_state,
    declaration_payload: validation.canonical_payload,
    declaration_payload_sha256: phase1DeclarationSha256(validation.canonical_payload),
    phase1_schema_version: validation.canonical_payload.phase1_schema_version,
    engine_compatibility: validation.canonical_payload.engine_compatibility,
    enum_bundle_version: validation.canonical_payload.enum_bundle_version,
    consent_granted: validation.canonical_payload.consent_granted,
    jurisdiction_acknowledged: validation.canonical_payload.jurisdiction_acknowledged,
    declared_at_iso8601: input.declared_at_iso8601,
    accepted_terms_version: input.accepted_terms_version,
    copy_acknowledgement_id: input.copy_acknowledgement_id,
    user_declared_factual_state: true,
    product_declaration_state_only: true,
    engine_visible: false,
    superseded_at_iso8601: null,
    immutable: true,
    copy_ids: phase1DeclarationCopyIds
  });

  return Object.freeze({
    status: 201,
    body: Object.freeze({
      ok: true,
      surface_id: phase1DeclarationSurfaceId,
      version: phase1DeclarationSurfaceVersion,
      declaration: record
    })
  });
}

/**
 * FUNCTION NOTE:
 * Export: assertPhase1DeclarationAcceptedBeforeCompile
 * Purpose: Product/app precondition guard for compile admission.
 * Inputs: Previously created declaration record.
 * Output: true or thrown product precondition error.
 * Boundary: Does not run or change engine compile behaviour.
 * Determinism: Same record returns same result.
 * Failure: Missing, unaccepted, superseded, mutable, or invalid hash declaration fails closed.
 */
export function assertPhase1DeclarationAcceptedBeforeCompile(record) {
  if (!isRecord(record)) {
    const error = new Error("phase1_declaration_required_before_compile");
    error.code = "phase1_declaration_required_before_compile";
    error.product_declaration_state_only = true;
    error.engine_visible = false;
    throw error;
  }

  if (record.declaration_state !== "accepted") {
    const error = new Error("phase1_declaration_not_accepted");
    error.code = "phase1_declaration_not_accepted";
    error.product_declaration_state_only = true;
    error.engine_visible = false;
    throw error;
  }

  if (record.superseded_at_iso8601 !== null) {
    const error = new Error("phase1_declaration_superseded");
    error.code = "phase1_declaration_superseded";
    error.product_declaration_state_only = true;
    error.engine_visible = false;
    throw error;
  }

  if (record.immutable !== true) {
    const error = new Error("phase1_declaration_not_immutable");
    error.code = "phase1_declaration_not_immutable";
    error.product_declaration_state_only = true;
    error.engine_visible = false;
    throw error;
  }

  if (record.declaration_payload_sha256 !== phase1DeclarationSha256(record.declaration_payload)) {
    const error = new Error("phase1_declaration_hash_mismatch");
    error.code = "phase1_declaration_hash_mismatch";
    error.product_declaration_state_only = true;
    error.engine_visible = false;
    throw error;
  }

  return true;
}

/**
 * FUNCTION NOTE:
 * Export: compileIgnoringPhase1DeclarationSurface
 * Purpose: Test helper proving declaration surface state is not engine truth.
 * Inputs: Phase-like object and any declaration surface records.
 * Output: Stable JSON for the phase-like object only.
 * Boundary: This is not the real engine compiler and must not call or mimic engine internals.
 * Determinism: Same phase-like object returns same string regardless of declaration surface state.
 * Failure: Serialization failure is allowed to throw rather than fabricate fallback output.
 */
export function compileIgnoringPhase1DeclarationSurface(phaseLikeInput, declarationRecords = []) {
  void declarationRecords;
  return stablePhase1DeclarationJson(phaseLikeInput);
}
