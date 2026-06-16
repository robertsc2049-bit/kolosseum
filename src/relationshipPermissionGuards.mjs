// DEV NOTE: Application permission-guard surface. This module centralises
// fail-closed coach-athlete viewing permission for v1 product surfaces. It must
// not call engine code, mutate engine truth, implement broad RBAC, create
// organisation/team/gym/federation roles, or create assignment authority.

import {
  isAcceptedIndividualCoachAthleteRelationship,
  stableCoachAthleteRelationshipJson
} from "./coachAthleteRelationshipAcceptance.mjs";

export const relationshipPermissionGuardSurfaceId = "relationship_permission_guards";

export const relationshipPermissionGuardVersion = "1.0.0";

export const relationshipPermissionFailureCode =
  "relationship_permission_product_auth_failure";

export const relationshipPermissionFailureCopyId =
  "RELATIONSHIP_PERMISSION_ACCESS_DENIED";

export const relationshipPermissionAllowedSurfaceIds = Object.freeze([
  "coach_notes",
  "session_artefacts",
  "live_session_status",
  "session_readback",
  "factual_history"
]);

export const relationshipPermissionCopyIds = Object.freeze([
  "RELATIONSHIP_PERMISSION_ACCESS_GRANTED",
  "RELATIONSHIP_PERMISSION_ACCESS_DENIED",
  "RELATIONSHIP_PERMISSION_PRODUCT_AUTH_FAILURE",
  "RELATIONSHIP_PERMISSION_PRODUCT_AUTH_ONLY"
]);

export const relationshipPermissionFailureBoundary = Object.freeze({
  product_auth_failure: true,
  engine_decision: false,
  engine_visible: false
});

const allowedSurfaceSet = new Set(relationshipPermissionAllowedSurfaceIds);

const surfaceScopeKeys = Object.freeze({
  coach_notes: "coach_notes",
  session_artefacts: "session_artefacts",
  live_session_status: "live_session_status",
  session_readback: "session_readback",
  factual_history: "history_counts"
});

const forbiddenPermissionKeys = new Set([
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
  "compile_authority",
  "assignment_authority",
  "assignment_authority_granted",
  "programme_assignment_authority",
  "broad_rbac",
  "rbac",
  "organisation_role",
  "organization_role",
  "team_role",
  "gym_role",
  "unit_role",
  "federation_role",
  "enterprise_role",
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

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(Object(value), key);
}

function hasForbiddenPermissionKey(value, pathParts = []) {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = hasForbiddenPermissionKey(value[index], pathParts.concat(String(index)));
      if (found) return found;
    }

    return null;
  }

  if (!isRecord(value)) {
    return null;
  }

  for (const [key, child] of Object.entries(value)) {
    if (forbiddenPermissionKeys.has(key)) {
      // DEV NOTE: S-V1-14 relationship records deliberately carry
      // engine_visible:false to prove product permission state is not engine
      // truth. Treat only engine_visible:true or non-false values as forbidden.
      if (key === "engine_visible" && child === false) {
        continue;
      }

      return pathParts.concat(key).join(".");
    }

    const found = hasForbiddenPermissionKey(child, pathParts.concat(key));
    if (found) return found;
  }

  return null;
}

function isAcceptedRelationshipLike(record) {
  if (!isRecord(record)) return false;

  if (isAcceptedIndividualCoachAthleteRelationship(record)) {
    return true;
  }

  const status = cleanString(record.status);
  const relationshipState = cleanString(record.relationship_state);
  const accepted = status === "accepted" || relationshipState === "accepted";

  if (!accepted) return false;

  const coachUserId = cleanString(record.coach_user_id);
  const athleteUserId = cleanString(record.athlete_user_id);
  const relationshipId = cleanString(record.relationship_id || record.link_id);

  if (coachUserId.length === 0 || athleteUserId.length === 0 || relationshipId.length === 0) {
    return false;
  }

  if (hasOwn(record, "relationship_scope") && record.relationship_scope !== "individual_coach_athlete") {
    return false;
  }

  if (hasOwn(record, "revoked_at") && record.revoked_at !== null) {
    return false;
  }

  if (hasOwn(record, "revoked_at_iso8601") && record.revoked_at_iso8601 !== null) {
    return false;
  }

  if (hasOwn(record, "expires_at") && record.expires_at !== null) {
    return false;
  }

  if (hasOwn(record, "expires_at_iso8601") && record.expires_at_iso8601 !== null) {
    return false;
  }

  return true;
}

function relationshipIdOf(record) {
  return cleanString(record.relationship_id || record.link_id);
}

function surfacePermittedByRelationship(record, surfaceId) {
  if (!isRecord(record)) return false;

  const scope = record.scope;
  if (!isRecord(scope)) return true;

  const scopeKey = surfaceScopeKeys[surfaceId];
  if (!scopeKey) return false;

  if (scope[scopeKey] === true) return true;

  if (surfaceId === "factual_history" && scope.history_counts === true) return true;

  return false;
}

function buildPermissionDecision(allowed, reason, details = {}) {
  return Object.freeze({
    allowed,
    surface_id: relationshipPermissionGuardSurfaceId,
    version: relationshipPermissionGuardVersion,
    reason,
    product_auth_failure: allowed ? false : true,
    product_permission_state_only: true,
    engine_decision: false,
    engine_visible: false,
    copy_id: allowed
      ? "RELATIONSHIP_PERMISSION_ACCESS_GRANTED"
      : relationshipPermissionFailureCopyId,
    ...details
  });
}

export class RelationshipPermissionGuardError extends Error {
  constructor(reason, details = {}) {
    super(`${relationshipPermissionFailureCode}:${reason}`);
    this.name = "RelationshipPermissionGuardError";
    this.code = relationshipPermissionFailureCode;
    this.reason = reason;
    this.product_auth_failure = true;
    this.product_permission_state_only = true;
    this.engine_decision = false;
    this.engine_visible = false;
    this.copy_id = relationshipPermissionFailureCopyId;
    this.details = Object.freeze({ ...details });
  }
}

/**
 * FUNCTION NOTE:
 * Export: denyRelationshipPermission
 * Purpose: Creates the stable product/auth permission failure used by S-V1-15 guards.
 * Inputs: Explicit reason and optional factual details only.
 * Output: Throws RelationshipPermissionGuardError.
 * Boundary: Permission failure is not engine failure, compile failure, registry failure, replay failure, proof failure, substitution failure, legality failure, or assignment decision.
 * Determinism: The same reason and details produce the same error fields.
 * Failure: Always fails closed by throwing a stable product/auth error.
 */
export function denyRelationshipPermission(reason, details = {}) {
  throw new RelationshipPermissionGuardError(reason, details);
}

/**
 * FUNCTION NOTE:
 * Export: assertSurfaceCanUseRelationshipPermissionGuard
 * Purpose: Verifies that a product surface is allowed to consume S-V1-15 guards.
 * Inputs: Explicit surface id only.
 * Output: true or thrown product/auth permission failure.
 * Boundary: This function does not grant actor permission by itself and does not activate server rewiring.
 * Determinism: Same surface id returns same result.
 * Failure: Unknown surfaces fail closed.
 */
export function assertSurfaceCanUseRelationshipPermissionGuard(surfaceId) {
  if (!allowedSurfaceSet.has(surfaceId)) {
    denyRelationshipPermission("relationship_permission_surface_not_allowed", {
      surface_id: surfaceId
    });
  }

  return true;
}

/**
 * FUNCTION NOTE:
 * Export: assertRelationshipPermissionInput
 * Purpose: Performs closed-world fail-closed validation for permission guard inputs.
 * Inputs: Explicit actor/target/surface/relationship values only.
 * Output: true or thrown product/auth permission failure.
 * Boundary: Refuses engine-visible, assignment-authority, broad-RBAC, and post-v1 scope fields.
 * Determinism: Same input returns same result.
 * Failure: Missing or forbidden state fails closed.
 */
export function assertRelationshipPermissionInput(input) {
  if (!isRecord(input)) {
    denyRelationshipPermission("relationship_permission_input_invalid");
  }

  const forbiddenPath = hasForbiddenPermissionKey(input);
  if (forbiddenPath) {
    denyRelationshipPermission("relationship_permission_forbidden_field_refused", {
      path: forbiddenPath
    });
  }

  assertSurfaceCanUseRelationshipPermissionGuard(input.surface_id);

  if (!isRecord(input.actor)) {
    denyRelationshipPermission("relationship_permission_actor_required");
  }

  const actorType = cleanString(input.actor.actor_type);
  const actorUserId = cleanString(input.actor.user_id);
  const targetAthleteUserId = cleanString(input.target_athlete_user_id);

  if (actorUserId.length === 0) {
    denyRelationshipPermission("relationship_permission_actor_user_id_required");
  }

  if (targetAthleteUserId.length === 0) {
    denyRelationshipPermission("relationship_permission_target_athlete_required");
  }

  if (actorType !== "coach" && actorType !== "athlete") {
    denyRelationshipPermission("relationship_permission_actor_type_invalid", {
      actor_type: actorType
    });
  }

  return true;
}

function decideCoachPermission(input) {
  assertRelationshipPermissionInput(input);

  const coachUserId = cleanString(input.actor.user_id);
  const athleteUserId = cleanString(input.target_athlete_user_id);
  const relationships = Array.isArray(input.relationships) ? input.relationships : [];

  const acceptedRelationship = relationships.find((candidate) =>
    isAcceptedRelationshipLike(candidate) &&
    cleanString(candidate.coach_user_id) === coachUserId &&
    cleanString(candidate.athlete_user_id) === athleteUserId &&
    surfacePermittedByRelationship(candidate, input.surface_id)
  );

  if (!acceptedRelationship) {
    return buildPermissionDecision(false, "coach_not_assigned_to_athlete", {
      actor_type: "coach",
      coach_user_id: coachUserId,
      athlete_user_id: athleteUserId,
      requested_surface_id: input.surface_id
    });
  }

  return buildPermissionDecision(true, "coach_assigned_to_athlete", {
    actor_type: "coach",
    coach_user_id: coachUserId,
    athlete_user_id: athleteUserId,
    requested_surface_id: input.surface_id,
    relationship_id: relationshipIdOf(acceptedRelationship)
  });
}

function decideAthletePermission(input) {
  assertRelationshipPermissionInput(input);

  const requesterAthleteUserId = cleanString(input.actor.user_id);
  const targetAthleteUserId = cleanString(input.target_athlete_user_id);

  if (requesterAthleteUserId !== targetAthleteUserId) {
    return buildPermissionDecision(false, "athlete_not_own_data", {
      actor_type: "athlete",
      athlete_user_id: requesterAthleteUserId,
      target_athlete_user_id: targetAthleteUserId,
      requested_surface_id: input.surface_id
    });
  }

  return buildPermissionDecision(true, "athlete_own_data", {
    actor_type: "athlete",
    athlete_user_id: targetAthleteUserId,
    requested_surface_id: input.surface_id
  });
}

/**
 * FUNCTION NOTE:
 * Export: canCoachAthleteAccess
 * Purpose: Returns a non-throwing permission decision for callers that need response mapping.
 * Inputs: Explicit actor, target athlete, surface id, and relationship records only.
 * Output: Stable allowed/denied decision object.
 * Boundary: Product/auth permission only; never engine decision or assignment authority.
 * Determinism: Same explicit input returns same decision.
 * Failure: Invalid input is returned as product/auth denial rather than fallback permission.
 */
export function canCoachAthleteAccess(input) {
  try {
    if (!isRecord(input) || !isRecord(input.actor)) {
      return buildPermissionDecision(false, "relationship_permission_input_invalid");
    }

    if (input.actor.actor_type === "coach") {
      return decideCoachPermission(input);
    }

    if (input.actor.actor_type === "athlete") {
      return decideAthletePermission(input);
    }

    assertRelationshipPermissionInput(input);
    return buildPermissionDecision(false, "relationship_permission_actor_type_invalid");
  } catch (error) {
    if (error instanceof RelationshipPermissionGuardError) {
      return buildPermissionDecision(false, error.reason, {
        details: error.details
      });
    }

    return buildPermissionDecision(false, "relationship_permission_unknown_failure");
  }
}

/**
 * FUNCTION NOTE:
 * Export: assertCoachCanViewAthlete
 * Purpose: Enforces assigned-only coach visibility for reusable product surfaces.
 * Inputs: Explicit coach id, target athlete id, surface id, and relationship records.
 * Output: true or thrown product/auth permission failure.
 * Boundary: Does not grant assignment authority, create relationship authority, or call engine code.
 * Determinism: Same explicit relationships return same result.
 * Failure: Missing, unassigned, non-accepted, revoked, expired, scoped-out, or forbidden input fails closed.
 */
export function assertCoachCanViewAthlete(input) {
  if (!isRecord(input)) {
    denyRelationshipPermission("relationship_permission_input_invalid");
  }

  const decision = canCoachAthleteAccess({
    actor: {
      actor_type: "coach",
      user_id: input.coach_user_id
    },
    target_athlete_user_id: input.athlete_user_id,
    surface_id: input.surface_id,
    relationships: input.relationships
  });

  if (!decision.allowed) {
    denyRelationshipPermission(decision.reason, decision);
  }

  return true;
}

/**
 * FUNCTION NOTE:
 * Export: assertAthleteCanViewOwnData
 * Purpose: Enforces athlete own-data visibility for reusable product surfaces.
 * Inputs: Explicit requester athlete id, target athlete id, and surface id.
 * Output: true or thrown product/auth permission failure.
 * Boundary: S-V1-15 does not activate athlete-to-athlete permission.
 * Determinism: Same explicit ids return same result.
 * Failure: Missing or mismatched ids fail closed.
 */
export function assertAthleteCanViewOwnData(input) {
  if (!isRecord(input)) {
    denyRelationshipPermission("relationship_permission_input_invalid");
  }

  const decision = canCoachAthleteAccess({
    actor: {
      actor_type: "athlete",
      user_id: input.requester_athlete_user_id
    },
    target_athlete_user_id: input.target_athlete_user_id,
    surface_id: input.surface_id,
    relationships: []
  });

  if (!decision.allowed) {
    denyRelationshipPermission(decision.reason, decision);
  }

  return true;
}

/**
 * FUNCTION NOTE:
 * Export: assertCoachAthleteAccess
 * Purpose: Routes reusable product permission checks for coach and athlete actors.
 * Inputs: Explicit actor, target athlete, surface id, and relationship records.
 * Output: true or thrown product/auth permission failure.
 * Boundary: Permission failure is product/auth failure and must not be treated as engine decision.
 * Determinism: Same explicit input returns same result.
 * Failure: Unknown actor, unassigned coach, or non-own athlete access fails closed.
 */
export function assertCoachAthleteAccess(input) {
  const decision = canCoachAthleteAccess(input);

  if (!decision.allowed) {
    denyRelationshipPermission(decision.reason, decision);
  }

  return true;
}

/**
 * FUNCTION NOTE:
 * Export: compileIgnoringRelationshipPermissionGuards
 * Purpose: Test helper proving permission guard data is not engine truth.
 * Inputs: Accepts a phase-like input and any number of product permission records.
 * Output: Stable JSON for the phase-like input only.
 * Boundary: This is not the real engine compiler and must not call or mimic engine internals.
 * Determinism: Same phase-like input returns same string regardless of permission guard state.
 * Failure: Serialization failure is allowed to throw rather than fabricate fallback output.
 */
export function compileIgnoringRelationshipPermissionGuards(phaseLikeInput, permissionRecords = []) {
  void permissionRecords;
  return stableCoachAthleteRelationshipJson(phaseLikeInput);
}
