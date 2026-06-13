// DEV NOTE: Application source surface. This module binds the v1 athlete
// registration/invitation path as product/auth state only. It must not
// implement an auth provider, create routes, persist database records, create
// relationship authority, read engine internals, or make athlete identity
// visible to deterministic engine truth.

export const athleteRegistrationInvitationSurfaceId =
  "athlete_registration_invitation";

export const athleteRegistrationInvitationVersion = "1.0.0";

export const athleteRegistrationAllowedInputKeys = Object.freeze([
  "athlete_user_id",
  "email",
  "display_name",
  "account_role",
  "account_state",
  "accepted_terms_version",
  "created_at_iso8601"
]);

export const athleteInvitationAllowedInputKeys = Object.freeze([
  "invite_id",
  "invited_by_coach_user_id",
  "athlete_email",
  "athlete_display_name",
  "invitation_target_role",
  "invitation_scope",
  "invitation_state",
  "invited_at_iso8601",
  "expires_at_iso8601",
  "accepted_at_iso8601",
  "accepted_by_athlete_user_id"
]);

export const athleteRegistrationAllowedAccountStates = Object.freeze([
  "invited",
  "active"
]);

export const athleteInvitationAllowedStates = Object.freeze([
  "invited",
  "accepted",
  "rejected",
  "expired"
]);

export const athleteInvitationAllowedScopes = Object.freeze([
  "athlete_account_access"
]);

export const athleteRegistrationInvitationCopyIds = Object.freeze([
  "ATHLETE_REGISTRATION_FORM_TITLE",
  "ATHLETE_REGISTRATION_CREATED",
  "ATHLETE_REGISTRATION_REJECTED",
  "ATHLETE_INVITATION_CREATED",
  "ATHLETE_INVITATION_ACCEPTED",
  "ATHLETE_INVITATION_REJECTED",
  "ATHLETE_INVITATION_EXPIRED",
  "ATHLETE_INVITATION_PRODUCT_AUTH_ONLY"
]);

const registrationKeySet = new Set(athleteRegistrationAllowedInputKeys);
const invitationKeySet = new Set(athleteInvitationAllowedInputKeys);
const allowedAccountStateSet = new Set(athleteRegistrationAllowedAccountStates);
const allowedInvitationStateSet = new Set(athleteInvitationAllowedStates);
const allowedInvitationScopeSet = new Set(athleteInvitationAllowedScopes);

const forbiddenEngineOrRelationshipKeys = new Set([
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
  "relationship_truth",
  "relationship_created",
  "coach_visibility_granted",
  "assignment_authority_granted",
  "engine_visible",
  "can_alter_engine_truth",
  "changes_engine_truth",
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
 * Export: stableAthleteInvitationJson
 * Purpose: Provides deterministic JSON for S-V1-13 tests and guards.
 * Inputs: Uses explicit caller-provided values only.
 * Output: Returns stable JSON bytes with object keys sorted.
 * Boundary: Must not call engine code, auth providers, clocks, databases, or network services.
 * Determinism: The same value produces the same string.
 * Failure: JSON serialization failure is allowed to throw rather than fabricate fallback output.
 */
export function stableAthleteInvitationJson(value) {
  return JSON.stringify(stableSortValue(value));
}

function hasForbiddenEngineOrRelationshipKey(value, pathParts = []) {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = hasForbiddenEngineOrRelationshipKey(value[index], pathParts.concat(String(index)));
      if (found) return found;
    }

    return null;
  }

  if (!isRecord(value)) {
    return null;
  }

  for (const [key, child] of Object.entries(value)) {
    if (forbiddenEngineOrRelationshipKeys.has(key)) {
      return pathParts.concat(key).join(".");
    }

    const found = hasForbiddenEngineOrRelationshipKey(child, pathParts.concat(key));
    if (found) return found;
  }

  return null;
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanNullableString(value) {
  return typeof value === "string" ? value.trim() : null;
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
      surface_id: athleteRegistrationInvitationSurfaceId,
      version: athleteRegistrationInvitationVersion,
      error,
      copy_id: "ATHLETE_REGISTRATION_REJECTED",
      details: Object.freeze({ ...details })
    })
  });
}

function invitationErrorResponse(error, details = {}) {
  return Object.freeze({
    status: 400,
    body: Object.freeze({
      ok: false,
      surface_id: athleteRegistrationInvitationSurfaceId,
      version: athleteRegistrationInvitationVersion,
      error,
      copy_id: "ATHLETE_INVITATION_REJECTED",
      details: Object.freeze({ ...details })
    })
  });
}

function validateClosedWorldKeys(input, allowedKeySet) {
  const unknownKeys = Object.keys(input)
    .filter((key) => !allowedKeySet.has(key))
    .sort((left, right) => left.localeCompare(right));

  if (unknownKeys.length > 0) {
    return Object.freeze({
      ok: false,
      error: "athlete_registration_unknown_field_refused",
      unknown_keys: Object.freeze(unknownKeys)
    });
  }

  return Object.freeze({ ok: true });
}

/**
 * FUNCTION NOTE:
 * Export: validateAthleteRegistrationInput
 * Purpose: Validates the closed-world v1 athlete registration/provisioning input.
 * Inputs: Accepts explicit platform/auth athlete identity fields only.
 * Output: Returns ok true or a stable validation error object.
 * Boundary: Must not grant permissions, create relationships, assign programmes, or affect engine truth.
 * Determinism: The same input shape returns the same validation result.
 * Failure: Unknown fields and engine-visible fields fail closed.
 */
export function validateAthleteRegistrationInput(input) {
  if (!isRecord(input)) {
    return Object.freeze({
      ok: false,
      error: "athlete_registration_input_invalid"
    });
  }

  const forbiddenPath = hasForbiddenEngineOrRelationshipKey(input);
  if (forbiddenPath) {
    return Object.freeze({
      ok: false,
      error: "athlete_registration_engine_or_relationship_field_refused",
      path: forbiddenPath
    });
  }

  const keys = validateClosedWorldKeys(input, registrationKeySet);
  if (!keys.ok) {
    return keys;
  }

  if (cleanString(input.athlete_user_id).length === 0) {
    return Object.freeze({
      ok: false,
      error: "athlete_registration_athlete_user_id_required"
    });
  }

  if (!isEmailLike(input.email)) {
    return Object.freeze({
      ok: false,
      error: "athlete_registration_email_invalid"
    });
  }

  if (cleanString(input.display_name).length === 0) {
    return Object.freeze({
      ok: false,
      error: "athlete_registration_display_name_required"
    });
  }

  if (input.account_role !== "athlete") {
    return Object.freeze({
      ok: false,
      error: "athlete_registration_role_not_athlete"
    });
  }

  if (!allowedAccountStateSet.has(input.account_state)) {
    return Object.freeze({
      ok: false,
      error: "athlete_registration_account_state_invalid"
    });
  }

  if (cleanString(input.accepted_terms_version).length === 0) {
    return Object.freeze({
      ok: false,
      error: "athlete_registration_terms_version_required"
    });
  }

  if (!isIsoLike(input.created_at_iso8601)) {
    return Object.freeze({
      ok: false,
      error: "athlete_registration_created_at_invalid"
    });
  }

  return Object.freeze({
    ok: true
  });
}

/**
 * FUNCTION NOTE:
 * Export: createAthleteRegistrationRecord
 * Purpose: Creates the deterministic v1 athlete platform identity record shape.
 * Inputs: Uses explicit caller-provided identity fields only.
 * Output: Returns a product/auth state response with engine_visible false.
 * Boundary: Does not persist data, create auth sessions, create relationships, assign programmes, or call engine code.
 * Determinism: The same valid input returns the same record bytes.
 * Failure: Refuses invalid, unknown, non-athlete, relationship, or engine-visible inputs without fallback.
 */
export function createAthleteRegistrationRecord(input) {
  const validation = validateAthleteRegistrationInput(input);
  if (!validation.ok) {
    return errorResponse(validation.error, validation);
  }

  return Object.freeze({
    status: 201,
    body: Object.freeze({
      ok: true,
      surface_id: athleteRegistrationInvitationSurfaceId,
      version: athleteRegistrationInvitationVersion,
      athlete: Object.freeze({
        athlete_user_id: cleanString(input.athlete_user_id),
        email: cleanString(input.email).toLowerCase(),
        display_name: cleanString(input.display_name),
        account_role: "athlete",
        account_state: input.account_state,
        accepted_terms_version: cleanString(input.accepted_terms_version),
        created_at_iso8601: input.created_at_iso8601,
        product_auth_state_only: true,
        engine_visible: false,
        copy_ids: Object.freeze([
          "ATHLETE_REGISTRATION_CREATED"
        ])
      })
    })
  });
}

/**
 * FUNCTION NOTE:
 * Export: validateAthleteInvitationInput
 * Purpose: Validates the closed-world v1 athlete account invitation input.
 * Inputs: Accepts explicit athlete account invitation fields only.
 * Output: Returns ok true or a stable validation error object.
 * Boundary: Must not create relationship authority, social/team/org invitations, coach visibility, assignment authority, or engine truth.
 * Determinism: The same input shape returns the same validation result.
 * Failure: Unknown fields, non-athlete target roles, non-account scopes, relationship-created fields, and engine-visible fields fail closed.
 */
export function validateAthleteInvitationInput(input) {
  if (!isRecord(input)) {
    return Object.freeze({
      ok: false,
      error: "athlete_invitation_input_invalid"
    });
  }

  const forbiddenPath = hasForbiddenEngineOrRelationshipKey(input);
  if (forbiddenPath) {
    return Object.freeze({
      ok: false,
      error: "athlete_invitation_engine_or_relationship_field_refused",
      path: forbiddenPath
    });
  }

  const unknownKeys = Object.keys(input)
    .filter((key) => !invitationKeySet.has(key))
    .sort((left, right) => left.localeCompare(right));

  if (unknownKeys.length > 0) {
    return Object.freeze({
      ok: false,
      error: "athlete_invitation_unknown_field_refused",
      unknown_keys: Object.freeze(unknownKeys)
    });
  }

  if (cleanString(input.invite_id).length === 0) {
    return Object.freeze({
      ok: false,
      error: "athlete_invitation_invite_id_required"
    });
  }

  if (cleanString(input.invited_by_coach_user_id).length === 0) {
    return Object.freeze({
      ok: false,
      error: "athlete_invitation_coach_user_id_required"
    });
  }

  if (!isEmailLike(input.athlete_email)) {
    return Object.freeze({
      ok: false,
      error: "athlete_invitation_email_invalid"
    });
  }

  if (cleanString(input.athlete_display_name).length === 0) {
    return Object.freeze({
      ok: false,
      error: "athlete_invitation_display_name_required"
    });
  }

  if (input.invitation_target_role !== "athlete") {
    return Object.freeze({
      ok: false,
      error: "athlete_invitation_target_not_athlete"
    });
  }

  if (!allowedInvitationScopeSet.has(input.invitation_scope)) {
    return Object.freeze({
      ok: false,
      error: "athlete_invitation_scope_invalid"
    });
  }

  if (!allowedInvitationStateSet.has(input.invitation_state)) {
    return Object.freeze({
      ok: false,
      error: "athlete_invitation_state_invalid"
    });
  }

  if (!isIsoLike(input.invited_at_iso8601)) {
    return Object.freeze({
      ok: false,
      error: "athlete_invitation_invited_at_invalid"
    });
  }

  if (!isIsoLike(input.expires_at_iso8601)) {
    return Object.freeze({
      ok: false,
      error: "athlete_invitation_expires_at_invalid"
    });
  }

  if (input.invitation_state === "accepted") {
    if (!isIsoLike(input.accepted_at_iso8601)) {
      return Object.freeze({
        ok: false,
        error: "athlete_invitation_accepted_at_required"
      });
    }

    if (cleanString(input.accepted_by_athlete_user_id).length === 0) {
      return Object.freeze({
        ok: false,
        error: "athlete_invitation_accepted_by_required"
      });
    }
  }

  if (input.invitation_state !== "accepted") {
    const acceptedAt = cleanNullableString(input.accepted_at_iso8601);
    const acceptedBy = cleanNullableString(input.accepted_by_athlete_user_id);

    if (acceptedAt !== null && acceptedAt.length > 0) {
      return Object.freeze({
        ok: false,
        error: "athlete_invitation_unaccepted_has_accepted_at"
      });
    }

    if (acceptedBy !== null && acceptedBy.length > 0) {
      return Object.freeze({
        ok: false,
        error: "athlete_invitation_unaccepted_has_accepted_by"
      });
    }
  }

  return Object.freeze({
    ok: true
  });
}

/**
 * FUNCTION NOTE:
 * Export: createAthleteInvitationRecord
 * Purpose: Creates the deterministic v1 athlete account invitation record shape.
 * Inputs: Uses explicit caller-provided invitation fields only.
 * Output: Returns product/auth invitation state with engine_visible false and relationship_created false.
 * Boundary: Does not persist data, create social/team/org invites, create relationships, grant coach visibility, assign programmes, or call engine code.
 * Determinism: The same valid input returns the same record bytes.
 * Failure: Refuses invalid, unknown, non-athlete, relationship, or engine-visible inputs without fallback.
 */
export function createAthleteInvitationRecord(input) {
  const validation = validateAthleteInvitationInput(input);
  if (!validation.ok) {
    return invitationErrorResponse(validation.error, validation);
  }

  const copyIdByState = {
    invited: "ATHLETE_INVITATION_CREATED",
    accepted: "ATHLETE_INVITATION_ACCEPTED",
    rejected: "ATHLETE_INVITATION_REJECTED",
    expired: "ATHLETE_INVITATION_EXPIRED"
  };

  return Object.freeze({
    status: 201,
    body: Object.freeze({
      ok: true,
      surface_id: athleteRegistrationInvitationSurfaceId,
      version: athleteRegistrationInvitationVersion,
      invitation: Object.freeze({
        invite_id: cleanString(input.invite_id),
        invited_by_coach_user_id: cleanString(input.invited_by_coach_user_id),
        athlete_email: cleanString(input.athlete_email).toLowerCase(),
        athlete_display_name: cleanString(input.athlete_display_name),
        invitation_target_role: "athlete",
        invitation_scope: "athlete_account_access",
        invitation_state: input.invitation_state,
        invited_at_iso8601: input.invited_at_iso8601,
        expires_at_iso8601: input.expires_at_iso8601,
        accepted_at_iso8601: cleanNullableString(input.accepted_at_iso8601),
        accepted_by_athlete_user_id: cleanNullableString(input.accepted_by_athlete_user_id),
        product_auth_state_only: true,
        engine_visible: false,
        relationship_created: false,
        copy_ids: Object.freeze([
          copyIdByState[input.invitation_state],
          "ATHLETE_INVITATION_PRODUCT_AUTH_ONLY"
        ])
      })
    })
  });
}

/**
 * FUNCTION NOTE:
 * Export: compileIgnoringAthleteRegistrationInvitation
 * Purpose: Test helper proving athlete registration/invitation data is not engine truth.
 * Inputs: Accepts a phase-like input and any number of athlete account or invitation records.
 * Output: Returns stable JSON for the phase-like input only.
 * Boundary: This is not the real engine compiler and must not call or mimic engine internals.
 * Determinism: The same phase-like input returns the same string regardless of athlete registration/invitation records.
 * Failure: Serialization failure is allowed to throw rather than fabricate fallback output.
 */
export function compileIgnoringAthleteRegistrationInvitation(phaseLikeInput, athleteOrInvitationRecords = []) {
  void athleteOrInvitationRecords;
  return stableAthleteInvitationJson(phaseLikeInput);
}
