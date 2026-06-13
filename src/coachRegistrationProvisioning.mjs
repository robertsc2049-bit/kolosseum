// DEV NOTE: Application source surface. This module binds the v1 coach
// registration/provisioning path as product/auth state only. It must not
// implement an auth provider, create routes, persist database records, read
// engine internals, or make coach identity visible to deterministic compile.

export const coachRegistrationProvisioningSurfaceId =
  "coach_registration_provisioning" ;

export const coachRegistrationProvisioningVersion = "1.0.0" ;

export const coachRegistrationProvisioningAllowedInputKeys = Object.freeze([
  "coach_user_id",
  "email",
  "display_name",
  "account_role",
  "account_state",
  "accepted_terms_version",
  "created_at_iso8601"
]);

export const coachRegistrationProvisioningAllowedAccountStates = Object.freeze([
  "invited",
  "active"
]);

export const coachRegistrationProvisioningCopyIds = Object.freeze([
  "COACH_REGISTRATION_FORM_TITLE",
  "COACH_REGISTRATION_CREATED",
  "COACH_REGISTRATION_REJECTED",
  "COACH_REGISTRATION_PRODUCT_AUTH_ONLY"
]);

const allowedInputKeySet = new Set(coachRegistrationProvisioningAllowedInputKeys);
const allowedAccountStateSet = new Set(coachRegistrationProvisioningAllowedAccountStates);

const forbiddenEngineVisibleKeys = new Set([
  "engine_input",
  "compile_input",
  "deterministic_compile_input",
  "canonical_engine_input",
  "registry_authority",
  "legality_authority",
  "substitution_truth",
  "progression_truth",
  "runtime_event_truth",
  "replay_truth",
  "proof_truth",
  "factual_history_truth",
  "programme_assignment_truth",
  "coach_athlete_relationship_truth",
  "engine_visible",
  "can_alter_engine_truth",
  "changes_compile_output"
]);

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stableSortValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => stableSortValue(item));
  }

  if (!isRecord(value)) {
    return value;
  }

  const sorted = {};
  for (const key of Object.keys(value).sort((left, right) => left.localeCompare(right))) {
    sorted[key] = stableSortValue(value[key]);
  }

  return sorted;
}

/**
 * FUNCTION NOTE:
 * Export: stableCoachProvisioningJson
 * Purpose: Provides a deterministic JSON helper for S-V1-12 tests and contract checks.
 * Inputs: Uses explicit caller-provided values only.
 * Output: Returns stable JSON bytes with object keys sorted.
 * Boundary: Must not call engine code, auth providers, clocks, databases, or network services.
 * Determinism: The same value produces the same string.
 * Failure: JSON serialization failure is allowed to throw rather than fabricate fallback output.
 */
export function stableCoachProvisioningJson(value) {
  return JSON.stringify(stableSortValue(value));
}

function hasForbiddenEngineVisibleKey(value, pathParts = []) {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = hasForbiddenEngineVisibleKey(value[index], pathParts.concat(String(index)));
      if (found) return found;
    }

    return null;
  }

  if (!isRecord(value)) {
    return null;
  }

  for (const [key, child] of Object.entries(value)) {
    if (forbiddenEngineVisibleKeys.has(key)) {
      return pathParts.concat(key).join(".");
    }

    const found = hasForbiddenEngineVisibleKey(child, pathParts.concat(key));
    if (found) return found;
  }

  return null;
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isIsoLike(value) {
  if (typeof value !== "string") return false;
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(value);
}

function isEmailLike(value) {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(trimmed);
}

function errorResponse(error, details = {}) {
  return Object.freeze({
    status: 400,
    body: Object.freeze({
      ok: false,
      surface_id: coachRegistrationProvisioningSurfaceId,
      version: coachRegistrationProvisioningVersion,
      error,
      copy_id: "COACH_REGISTRATION_REJECTED",
      details: Object.freeze({ ...details })
    })
  });
}

/**
 * FUNCTION NOTE:
 * Export: validateCoachRegistrationProvisioningInput
 * Purpose: Validates the closed-world v1 coach registration/provisioning input.
 * Inputs: Accepts explicit platform/auth identity fields only.
 * Output: Returns ok true or a stable validation error object.
 * Boundary: Must not grant permissions, create relationships, set billing, create sessions, or affect engine truth.
 * Determinism: The same input shape returns the same validation result.
 * Failure: Unknown fields and engine-visible fields fail closed.
 */
export function validateCoachRegistrationProvisioningInput(input) {
  if (!isRecord(input)) {
    return Object.freeze({
      ok: false,
      error: "coach_registration_input_invalid"
    });
  }

  const forbiddenEnginePath = hasForbiddenEngineVisibleKey(input);
  if (forbiddenEnginePath) {
    return Object.freeze({
      ok: false,
      error: "coach_registration_engine_visible_field_refused",
      path: forbiddenEnginePath
    });
  }

  const unknownKeys = Object.keys(input)
    .filter((key) => !allowedInputKeySet.has(key))
    .sort((left, right) => left.localeCompare(right));

  if (unknownKeys.length > 0) {
    return Object.freeze({
      ok: false,
      error: "coach_registration_unknown_field_refused",
      unknown_keys: Object.freeze(unknownKeys)
    });
  }

  if (cleanString(input.coach_user_id).length === 0) {
    return Object.freeze({
      ok: false,
      error: "coach_registration_coach_user_id_required"
    });
  }

  if (!isEmailLike(input.email)) {
    return Object.freeze({
      ok: false,
      error: "coach_registration_email_invalid"
    });
  }

  if (cleanString(input.display_name).length === 0) {
    return Object.freeze({
      ok: false,
      error: "coach_registration_display_name_required"
    });
  }

  if (input.account_role !== "coach") {
    return Object.freeze({
      ok: false,
      error: "coach_registration_role_not_coach"
    });
  }

  if (!allowedAccountStateSet.has(input.account_state)) {
    return Object.freeze({
      ok: false,
      error: "coach_registration_account_state_invalid"
    });
  }

  if (cleanString(input.accepted_terms_version).length === 0) {
    return Object.freeze({
      ok: false,
      error: "coach_registration_terms_version_required"
    });
  }

  if (!isIsoLike(input.created_at_iso8601)) {
    return Object.freeze({
      ok: false,
      error: "coach_registration_created_at_invalid"
    });
  }

  return Object.freeze({
    ok: true
  });
}

/**
 * FUNCTION NOTE:
 * Export: createCoachRegistrationProvisioningRecord
 * Purpose: Creates the deterministic v1 coach platform identity record shape.
 * Inputs: Uses explicit caller-provided identity fields only.
 * Output: Returns a product/auth state response with engine_visible false.
 * Boundary: Does not persist data, create auth sessions, create relationships, assign programmes, or call engine code.
 * Determinism: The same valid input returns the same record bytes.
 * Failure: Refuses invalid, unknown, non-coach, or engine-visible inputs without fallback.
 */
export function createCoachRegistrationProvisioningRecord(input) {
  const validation = validateCoachRegistrationProvisioningInput(input);
  if (!validation.ok) {
    return errorResponse(validation.error, validation);
  }

  return Object.freeze({
    status: 201,
    body: Object.freeze({
      ok: true,
      surface_id: coachRegistrationProvisioningSurfaceId,
      version: coachRegistrationProvisioningVersion,
      coach: Object.freeze({
        coach_user_id: cleanString(input.coach_user_id),
        email: cleanString(input.email).toLowerCase(),
        display_name: cleanString(input.display_name),
        account_role: "coach",
        account_state: input.account_state,
        accepted_terms_version: cleanString(input.accepted_terms_version),
        created_at_iso8601: input.created_at_iso8601,
        product_auth_state_only: true,
        engine_visible: false,
        copy_ids: Object.freeze([
          "COACH_REGISTRATION_CREATED",
          "COACH_REGISTRATION_PRODUCT_AUTH_ONLY"
        ])
      })
    })
  });
}

/**
 * FUNCTION NOTE:
 * Export: compileIgnoringCoachRegistrationProvisioning
 * Purpose: Test helper proving coach registration/provisioning data is not compile input.
 * Inputs: Accepts a phase-like input and any number of coach provisioning records.
 * Output: Returns stable JSON for the phase-like input only.
 * Boundary: This is not the real engine compiler and must not call or mimic engine internals.
 * Determinism: The same phase-like input returns the same string regardless of coach provisioning records.
 * Failure: Serialization failure is allowed to throw rather than fabricate fallback output.
 */
export function compileIgnoringCoachRegistrationProvisioning(phaseLikeInput, coachProvisioningRecords = []) {
  void coachProvisioningRecords;
  return stableCoachProvisioningJson(phaseLikeInput);
}
