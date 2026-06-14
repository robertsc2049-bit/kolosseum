// DEV NOTE: Application service surface. This module binds the v1
// coach-athlete relationship acceptance path as product permission state only.
// It must not implement auth providers, create routes, persist database records,
// create teams/orgs/gyms/federations/social connections, assign programmes,
// read engine internals, or make relationship state visible to engine truth.

export const coachAthleteRelationshipAcceptanceSurfaceId =
  "coach_athlete_relationship_acceptance";

export const coachAthleteRelationshipAcceptanceVersion = "1.0.0";

export const coachAthleteRelationshipAllowedInputKeys = Object.freeze([
  "relationship_id",
  "coach_user_id",
  "athlete_user_id",
  "relationship_state",
  "relationship_scope",
  "accepted_at_iso8601",
  "created_at_iso8601",
  "updated_at_iso8601",
  "revoked_at_iso8601",
  "expires_at_iso8601"
]);

export const coachAthleteRelationshipAllowedStates = Object.freeze([
  "invited",
  "accepted",
  "rejected",
  "revoked",
  "expired"
]);

export const coachAthleteRelationshipAllowedScopes = Object.freeze([
  "individual_coach_athlete"
]);

export const coachAthleteRelationshipCopyIds = Object.freeze([
  "COACH_ATHLETE_RELATIONSHIP_CREATED",
  "COACH_ATHLETE_RELATIONSHIP_ACCEPTED",
  "COACH_ATHLETE_RELATIONSHIP_REJECTED",
  "COACH_ATHLETE_RELATIONSHIP_REVOKED",
  "COACH_ATHLETE_RELATIONSHIP_EXPIRED",
  "COACH_ATHLETE_RELATIONSHIP_ACCESS_GRANTED",
  "COACH_ATHLETE_RELATIONSHIP_ACCESS_DENIED",
  "COACH_ATHLETE_RELATIONSHIP_PRODUCT_PERMISSION_ONLY"
]);

const relationshipKeySet = new Set(coachAthleteRelationshipAllowedInputKeys);
const allowedStateSet = new Set(coachAthleteRelationshipAllowedStates);
const allowedScopeSet = new Set(coachAthleteRelationshipAllowedScopes);

const forbiddenEngineOrScopeKeys = new Set([
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
  "compile_authority",
  "assignment_authority",
  "assignment_authority_granted",
  "programme_assignment_authority",
  "team_id",
  "organisation_id",
  "organization_id",
  "gym_id",
  "unit_id",
  "federation_id",
  "enterprise_id",
  "friend_connection_id",
  "social_connection_id",
  "social_graph_id",
  "message_thread_id",
  "chat_thread_id",
  "marketplace_connection_id",
  "coach_discovery_id",
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
 * Export: stableCoachAthleteRelationshipJson
 * Purpose: Provides deterministic JSON for S-V1-14 tests and guards.
 * Inputs: Uses explicit caller-provided values only.
 * Output: Returns stable JSON bytes with object keys sorted.
 * Boundary: Must not call engine code, auth providers, clocks, databases, or network services.
 * Determinism: The same value produces the same string.
 * Failure: JSON serialization failure is allowed to throw rather than fabricate fallback output.
 */
export function stableCoachAthleteRelationshipJson(value) {
  return JSON.stringify(stableSortValue(value));
}

function hasForbiddenEngineOrScopeKey(value, pathParts = []) {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = hasForbiddenEngineOrScopeKey(value[index], pathParts.concat(String(index)));
      if (found) return found;
    }

    return null;
  }

  if (!isRecord(value)) {
    return null;
  }

  for (const [key, child] of Object.entries(value)) {
    if (forbiddenEngineOrScopeKeys.has(key)) {
      return pathParts.concat(key).join(".");
    }

    const found = hasForbiddenEngineOrScopeKey(child, pathParts.concat(key));
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

function relationshipErrorResponse(error, details = {}) {
  return Object.freeze({
    status: 400,
    body: Object.freeze({
      ok: false,
      surface_id: coachAthleteRelationshipAcceptanceSurfaceId,
      version: coachAthleteRelationshipAcceptanceVersion,
      error,
      copy_id: "COACH_ATHLETE_RELATIONSHIP_ACCESS_DENIED",
      details: Object.freeze({ ...details })
    })
  });
}

function accessResponse(allowed, reason, details = {}) {
  return Object.freeze({
    allowed,
    surface_id: coachAthleteRelationshipAcceptanceSurfaceId,
    version: coachAthleteRelationshipAcceptanceVersion,
    reason,
    copy_id: allowed
      ? "COACH_ATHLETE_RELATIONSHIP_ACCESS_GRANTED"
      : "COACH_ATHLETE_RELATIONSHIP_ACCESS_DENIED",
    product_permission_state_only: true,
    engine_visible: false,
    ...details
  });
}

/**
 * FUNCTION NOTE:
 * Export: validateCoachAthleteRelationshipInput
 * Purpose: Validates the closed-world v1 coach-athlete relationship input.
 * Inputs: Accepts explicit individual relationship fields only.
 * Output: Returns ok true or a stable validation error object.
 * Boundary: Must not create teams/orgs/gyms/federations/social links, grant assignment authority, or affect engine truth.
 * Determinism: The same input shape returns the same validation result.
 * Failure: Unknown fields, forbidden scope fields, and engine-visible fields fail closed.
 */
export function validateCoachAthleteRelationshipInput(input) {
  if (!isRecord(input)) {
    return Object.freeze({
      ok: false,
      error: "coach_athlete_relationship_input_invalid"
    });
  }

  const forbiddenPath = hasForbiddenEngineOrScopeKey(input);
  if (forbiddenPath) {
    return Object.freeze({
      ok: false,
      error: "coach_athlete_relationship_engine_or_scope_field_refused",
      path: forbiddenPath
    });
  }

  const unknownKeys = Object.keys(input)
    .filter((key) => !relationshipKeySet.has(key))
    .sort((left, right) => left.localeCompare(right));

  if (unknownKeys.length > 0) {
    return Object.freeze({
      ok: false,
      error: "coach_athlete_relationship_unknown_field_refused",
      unknown_keys: Object.freeze(unknownKeys)
    });
  }

  if (cleanString(input.relationship_id).length === 0) {
    return Object.freeze({
      ok: false,
      error: "coach_athlete_relationship_id_required"
    });
  }

  if (cleanString(input.coach_user_id).length === 0) {
    return Object.freeze({
      ok: false,
      error: "coach_athlete_relationship_coach_user_id_required"
    });
  }

  if (cleanString(input.athlete_user_id).length === 0) {
    return Object.freeze({
      ok: false,
      error: "coach_athlete_relationship_athlete_user_id_required"
    });
  }

  if (!allowedStateSet.has(input.relationship_state)) {
    return Object.freeze({
      ok: false,
      error: "coach_athlete_relationship_state_invalid"
    });
  }

  if (!allowedScopeSet.has(input.relationship_scope)) {
    return Object.freeze({
      ok: false,
      error: "coach_athlete_relationship_scope_invalid"
    });
  }

  if (!isIsoLike(input.created_at_iso8601)) {
    return Object.freeze({
      ok: false,
      error: "coach_athlete_relationship_created_at_invalid"
    });
  }

  if (!isIsoLike(input.updated_at_iso8601)) {
    return Object.freeze({
      ok: false,
      error: "coach_athlete_relationship_updated_at_invalid"
    });
  }

  if (input.relationship_state === "accepted" && !isIsoLike(input.accepted_at_iso8601)) {
    return Object.freeze({
      ok: false,
      error: "coach_athlete_relationship_accepted_at_required"
    });
  }

  if (input.relationship_state === "revoked" && !isIsoLike(input.revoked_at_iso8601)) {
    return Object.freeze({
      ok: false,
      error: "coach_athlete_relationship_revoked_at_required"
    });
  }

  if (input.relationship_state === "expired" && !isIsoLike(input.expires_at_iso8601)) {
    return Object.freeze({
      ok: false,
      error: "coach_athlete_relationship_expires_at_required"
    });
  }

  if (input.relationship_state !== "accepted") {
    const acceptedAt = cleanNullableString(input.accepted_at_iso8601);
    if (acceptedAt !== null && acceptedAt.length > 0) {
      return Object.freeze({
        ok: false,
        error: "coach_athlete_relationship_unaccepted_has_accepted_at"
      });
    }
  }

  if (input.relationship_state !== "revoked") {
    const revokedAt = cleanNullableString(input.revoked_at_iso8601);
    if (revokedAt !== null && revokedAt.length > 0) {
      return Object.freeze({
        ok: false,
        error: "coach_athlete_relationship_unrevoked_has_revoked_at"
      });
    }
  }

  return Object.freeze({
    ok: true
  });
}

/**
 * FUNCTION NOTE:
 * Export: createCoachAthleteRelationshipRecord
 * Purpose: Creates the deterministic v1 individual coach-athlete relationship record shape.
 * Inputs: Uses explicit caller-provided relationship fields only.
 * Output: Returns product permission state with engine_visible false.
 * Boundary: Does not persist data, create auth sessions, create teams/orgs/gyms/federations/social links, assign programmes, or call engine code.
 * Determinism: The same valid input returns the same record bytes.
 * Failure: Refuses invalid, unknown, forbidden scope, or engine-visible inputs without fallback.
 */
export function createCoachAthleteRelationshipRecord(input) {
  const validation = validateCoachAthleteRelationshipInput(input);
  if (!validation.ok) {
    return relationshipErrorResponse(validation.error, validation);
  }

  const copyIdByState = {
    invited: "COACH_ATHLETE_RELATIONSHIP_CREATED",
    accepted: "COACH_ATHLETE_RELATIONSHIP_ACCEPTED",
    rejected: "COACH_ATHLETE_RELATIONSHIP_REJECTED",
    revoked: "COACH_ATHLETE_RELATIONSHIP_REVOKED",
    expired: "COACH_ATHLETE_RELATIONSHIP_EXPIRED"
  };

  return Object.freeze({
    status: 201,
    body: Object.freeze({
      ok: true,
      surface_id: coachAthleteRelationshipAcceptanceSurfaceId,
      version: coachAthleteRelationshipAcceptanceVersion,
      relationship: Object.freeze({
        relationship_id: cleanString(input.relationship_id),
        coach_user_id: cleanString(input.coach_user_id),
        athlete_user_id: cleanString(input.athlete_user_id),
        relationship_state: input.relationship_state,
        relationship_scope: "individual_coach_athlete",
        accepted_at_iso8601: cleanNullableString(input.accepted_at_iso8601),
        created_at_iso8601: input.created_at_iso8601,
        updated_at_iso8601: input.updated_at_iso8601,
        revoked_at_iso8601: cleanNullableString(input.revoked_at_iso8601),
        expires_at_iso8601: cleanNullableString(input.expires_at_iso8601),
        product_permission_state_only: true,
        engine_visible: false,
        copy_ids: Object.freeze([
          copyIdByState[input.relationship_state],
          "COACH_ATHLETE_RELATIONSHIP_PRODUCT_PERMISSION_ONLY"
        ])
      })
    })
  });
}

/**
 * FUNCTION NOTE:
 * Export: isAcceptedIndividualCoachAthleteRelationship
 * Purpose: Checks whether a relationship record is accepted individual coach-athlete permission state.
 * Inputs: Uses explicit caller-provided relationship record only.
 * Output: Returns boolean.
 * Boundary: Must not infer missing acceptance, relationship scope, or identity from account/invite state.
 * Determinism: The same record returns the same boolean.
 * Failure: Invalid or incomplete values return false rather than fabricated permission.
 */
export function isAcceptedIndividualCoachAthleteRelationship(relationship) {
  return (
    isRecord(relationship) &&
    relationship.relationship_state === "accepted" &&
    relationship.relationship_scope === "individual_coach_athlete" &&
    cleanString(relationship.relationship_id).length > 0 &&
    cleanString(relationship.coach_user_id).length > 0 &&
    cleanString(relationship.athlete_user_id).length > 0 &&
    isIsoLike(relationship.accepted_at_iso8601) &&
    cleanNullableString(relationship.revoked_at_iso8601) === null
  );
}

/**
 * FUNCTION NOTE:
 * Export: canCoachViewAssignedAthlete
 * Purpose: Enforces assigned-only coach visibility for one athlete.
 * Inputs: Uses explicit coach id, athlete id, and relationship records.
 * Output: Returns an access decision object.
 * Boundary: Must not grant team/org/gym/federation/social/marketplace visibility or assignment authority.
 * Determinism: The same relationship list returns the same decision.
 * Failure: Missing or non-accepted relationship state denies access.
 */
export function canCoachViewAssignedAthlete(input) {
  if (!isRecord(input)) {
    return accessResponse(false, "invalid_request");
  }

  const coachUserId = cleanString(input.coach_user_id);
  const athleteUserId = cleanString(input.athlete_user_id);
  const relationships = Array.isArray(input.relationships) ? input.relationships : [];

  if (coachUserId.length === 0 || athleteUserId.length === 0) {
    return accessResponse(false, "identity_required");
  }

  const relationship = relationships.find((candidate) =>
    isAcceptedIndividualCoachAthleteRelationship(candidate) &&
    candidate.coach_user_id === coachUserId &&
    candidate.athlete_user_id === athleteUserId
  );

  if (!relationship) {
    return accessResponse(false, "coach_not_assigned_to_athlete");
  }

  return accessResponse(true, "coach_assigned_to_athlete", {
    coach_user_id: coachUserId,
    athlete_user_id: athleteUserId,
    relationship_id: relationship.relationship_id
  });
}

/**
 * FUNCTION NOTE:
 * Export: canAthleteViewAthleteData
 * Purpose: Enforces athlete own-data visibility.
 * Inputs: Uses explicit requester athlete id and target athlete id.
 * Output: Returns an access decision object.
 * Boundary: S-V1-14 does not activate athlete-to-athlete permissions.
 * Determinism: The same explicit ids return the same decision.
 * Failure: Non-matching athlete ids deny access.
 */
export function canAthleteViewAthleteData(input) {
  if (!isRecord(input)) {
    return accessResponse(false, "invalid_request");
  }

  const requesterAthleteUserId = cleanString(input.requester_athlete_user_id);
  const targetAthleteUserId = cleanString(input.target_athlete_user_id);

  if (requesterAthleteUserId.length === 0 || targetAthleteUserId.length === 0) {
    return accessResponse(false, "identity_required");
  }

  if (requesterAthleteUserId !== targetAthleteUserId) {
    return accessResponse(false, "athlete_not_own_data");
  }

  return accessResponse(true, "athlete_own_data", {
    athlete_user_id: targetAthleteUserId
  });
}

/**
 * FUNCTION NOTE:
 * Export: decideCoachAthleteRelationshipAccess
 * Purpose: Routes v1 relationship access decisions for coach and athlete actors.
 * Inputs: Uses explicit actor, target athlete id, and relationship records.
 * Output: Returns an access decision object.
 * Boundary: Viewing permission only; no engine mutation, assignment authority, messaging, social, team, org, or marketplace scope.
 * Determinism: The same explicit input returns the same decision.
 * Failure: Unknown actor types deny access.
 */
export function decideCoachAthleteRelationshipAccess(input) {
  if (!isRecord(input) || !isRecord(input.actor)) {
    return accessResponse(false, "invalid_request");
  }

  const targetAthleteUserId = cleanString(input.target_athlete_user_id);

  if (input.actor.actor_type === "coach") {
    return canCoachViewAssignedAthlete({
      coach_user_id: input.actor.user_id,
      athlete_user_id: targetAthleteUserId,
      relationships: input.relationships
    });
  }

  if (input.actor.actor_type === "athlete") {
    return canAthleteViewAthleteData({
      requester_athlete_user_id: input.actor.user_id,
      target_athlete_user_id: targetAthleteUserId
    });
  }

  return accessResponse(false, "unknown_actor_type");
}

/**
 * FUNCTION NOTE:
 * Export: compileIgnoringCoachAthleteRelationship
 * Purpose: Test helper proving relationship changes are not engine truth.
 * Inputs: Accepts a phase-like input and any number of relationship/access records.
 * Output: Returns stable JSON for the phase-like input only.
 * Boundary: This is not the real engine compiler and must not call or mimic engine internals.
 * Determinism: The same phase-like input returns the same string regardless of relationship records.
 * Failure: Serialization failure is allowed to throw rather than fabricate fallback output.
 */
export function compileIgnoringCoachAthleteRelationship(phaseLikeInput, relationshipRecords = []) {
  void relationshipRecords;
  return stableCoachAthleteRelationshipJson(phaseLikeInput);
}
