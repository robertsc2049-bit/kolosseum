import { buildEngineTruthProbe as buildAssignmentEngineTruthProbe } from "./programmeAssignmentContract.mjs";

export const assignmentVisibilitySurfaceId = "programme_assignment_visibility";
export const assignmentVisibilityVersion = "1.0.0";
export const assignmentVisibilityFailureCode = "assignment_visibility_product_auth_failure";
export const assignmentVisibilityFailureCopyId = "ASSIGNMENT_VISIBILITY_ACCESS_DENIED";

const LOCKED_COMPILE_INPUT_STATUS = "not_consumed_until_declared_compile_input";

const REQUIRED_INPUT_KEYS = Object.freeze([
  "actor",
  "assignments",
  "relationships"
]);

const REQUIRED_ASSIGNMENT_KEYS = Object.freeze([
  "assignment_id",
  "relationship_id",
  "assigned_by_coach_id",
  "assigned_athlete_id",
  "template_id",
  "activity_id",
  "assignment_status",
  "assigned_at",
  "compile_input_status",
  "engine_visible"
]);

const FORBIDDEN_SCOPE_KEYS = Object.freeze([
  "billing_state",
  "payment_state",
  "marketplace_state",
  "marketplace_purchase",
  "coach_to_coach_sharing",
  "royalty_state",
  "team_assignment",
  "team_assignments",
  "organisation_assignment",
  "organisation_assignments",
  "organization_assignment",
  "organization_assignments",
  "unit_assignment",
  "unit_assignments",
  "gym_assignment",
  "gym_assignments",
  "federation_assignment",
  "federation_assignments",
  "enterprise_assignment",
  "engine_input",
  "canonical_engine_input",
  "compile_input",
  "engine_truth",
  "coach_note",
  "message_thread",
  "chat_thread"
]);

function fail(reason, message, details = {}) {
  const error = new Error(message);
  error.name = "AssignmentVisibilityError";
  error.code = assignmentVisibilityFailureCode;
  error.copy_id = assignmentVisibilityFailureCopyId;
  error.reason = reason;
  error.details = Object.freeze({ ...details });
  error.product_auth_failure = true;
  error.engine_decision = false;
  error.engine_visible = false;
  throw error;
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertPlainObject(value, reason, details = {}) {
  if (!isPlainObject(value)) {
    fail(reason, "assignment visibility input must be an object", details);
  }
}

function assertArray(value, reason, details = {}) {
  if (!Array.isArray(value)) {
    fail(reason, "assignment visibility input array is required", details);
  }
}

function assertNonEmptyString(value, reason, details = {}) {
  if (typeof value !== "string" || value.trim() === "") {
    fail(reason, "assignment visibility string field is required", details);
  }
}

function assertBoolean(value, reason, details = {}) {
  if (typeof value !== "boolean") {
    fail(reason, "assignment visibility boolean field is required", details);
  }
}

function assertKnownRootKeys(input) {
  const keys = Object.keys(input).sort();

  for (const key of REQUIRED_INPUT_KEYS) {
    if (!keys.includes(key)) {
      fail("assignment_visibility_missing_required_key", "assignment visibility input is missing required key", { key });
    }
  }

  for (const key of keys) {
    if (!REQUIRED_INPUT_KEYS.includes(key)) {
      fail("assignment_visibility_unknown_key", "assignment visibility input contains an unknown root key", { key });
    }
  }
}

function assertNoForbiddenKeysDeep(value, pathParts = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenKeysDeep(item, [...pathParts, String(index)]));
    return;
  }

  if (!isPlainObject(value)) {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    if (key === "engine_visible" && child === false) {
      continue;
    }

    if (FORBIDDEN_SCOPE_KEYS.includes(key)) {
      fail("assignment_visibility_forbidden_scope_field", "assignment visibility input contains a forbidden field", {
        path: [...pathParts, key].join(".")
      });
    }

    assertNoForbiddenKeysDeep(child, [...pathParts, key]);
  }
}

function assertActor(actor) {
  assertPlainObject(actor, "assignment_visibility_actor_invalid", { field: "actor" });

  assertNonEmptyString(actor.actor_type, "assignment_visibility_actor_type_required", { field: "actor.actor_type" });

  if (actor.actor_type === "coach") {
    assertNonEmptyString(actor.coach_id, "assignment_visibility_coach_id_required", { field: "actor.coach_id" });
    return;
  }

  if (actor.actor_type === "athlete") {
    assertNonEmptyString(actor.athlete_id, "assignment_visibility_athlete_id_required", { field: "actor.athlete_id" });
    return;
  }

  fail("assignment_visibility_actor_type_invalid", "assignment visibility actor type must be coach or athlete", {
    actor_type: actor.actor_type
  });
}

function assertAssignmentRecord(assignment, index) {
  assertPlainObject(assignment, "assignment_visibility_assignment_invalid", { index });

  const keys = Object.keys(assignment).sort();

  for (const key of REQUIRED_ASSIGNMENT_KEYS) {
    if (!keys.includes(key)) {
      fail("assignment_visibility_assignment_missing_key", "assignment visibility assignment is missing required key", {
        index,
        key
      });
    }
  }

  assertNonEmptyString(assignment.assignment_id, "assignment_visibility_assignment_id_required", { index });
  assertNonEmptyString(assignment.relationship_id, "assignment_visibility_relationship_id_required", { index });
  assertNonEmptyString(assignment.assigned_by_coach_id, "assignment_visibility_assigned_by_coach_id_required", { index });
  assertNonEmptyString(assignment.assigned_athlete_id, "assignment_visibility_assigned_athlete_id_required", { index });
  assertNonEmptyString(assignment.template_id, "assignment_visibility_template_id_required", { index });
  assertNonEmptyString(assignment.activity_id, "assignment_visibility_activity_id_required", { index });
  assertNonEmptyString(assignment.assignment_status, "assignment_visibility_assignment_status_required", { index });
  assertNonEmptyString(assignment.assigned_at, "assignment_visibility_assigned_at_required", { index });
  assertNonEmptyString(assignment.compile_input_status, "assignment_visibility_compile_status_required", { index });
  assertBoolean(assignment.engine_visible, "assignment_visibility_engine_visible_boolean_required", { index });

  if (assignment.compile_input_status !== LOCKED_COMPILE_INPUT_STATUS) {
    fail("assignment_visibility_compile_status_invalid", "assignment visibility compile state must remain not consumed", {
      index,
      compile_input_status: assignment.compile_input_status
    });
  }

  if (assignment.engine_visible !== false) {
    fail("assignment_visibility_engine_visible_refused", "assignment visibility cannot expose engine visible state", {
      index
    });
  }
}

function assertRelationshipRecord(relationship, index) {
  assertPlainObject(relationship, "assignment_visibility_relationship_invalid", { index });

  assertNonEmptyString(relationship.relationship_id, "assignment_visibility_relationship_id_required", { index });
  assertNonEmptyString(relationship.coach_id, "assignment_visibility_relationship_coach_id_required", { index });
  assertNonEmptyString(relationship.athlete_id, "assignment_visibility_relationship_athlete_id_required", { index });
  assertNonEmptyString(relationship.relationship_scope, "assignment_visibility_relationship_scope_required", { index });
  assertNonEmptyString(relationship.relationship_status, "assignment_visibility_relationship_status_required", { index });
}

function relationshipPermitsCoachAssignmentView(relationship, assignment, coachId) {
  return (
    relationship.relationship_id === assignment.relationship_id &&
    relationship.coach_id === coachId &&
    relationship.athlete_id === assignment.assigned_athlete_id &&
    relationship.relationship_scope === "individual_coach_athlete" &&
    relationship.relationship_status === "accepted" &&
    assignment.assigned_by_coach_id === coachId
  );
}

function buildVisibleAssignmentRecord(assignment, visibilityReason) {
  return Object.freeze({
    assignment_id: assignment.assignment_id,
    relationship_id: assignment.relationship_id,
    assigned_by_coach_id: assignment.assigned_by_coach_id,
    assigned_athlete_id: assignment.assigned_athlete_id,
    template_id: assignment.template_id,
    activity_id: assignment.activity_id,
    assignment_status: assignment.assignment_status,
    assigned_at: assignment.assigned_at,
    visibility_reason: visibilityReason,
    compile_input_status: LOCKED_COMPILE_INPUT_STATUS,
    engine_visible: false
  });
}

function sortVisibleAssignments(assignments) {
  return [...assignments].sort((left, right) => {
    const leftKey = `${left.assigned_athlete_id}:${left.assignment_id}`;
    const rightKey = `${right.assigned_athlete_id}:${right.assignment_id}`;
    return leftKey.localeCompare(rightKey);
  });
}

export function assertAssignmentVisibilityInput(input) {
  assertPlainObject(input, "assignment_visibility_input_invalid");

  assertKnownRootKeys(input);
  assertNoForbiddenKeysDeep(input);
  assertActor(input.actor);

  assertArray(input.assignments, "assignment_visibility_assignments_array_required", { field: "assignments" });
  assertArray(input.relationships, "assignment_visibility_relationships_array_required", { field: "relationships" });

  input.assignments.forEach((assignment, index) => assertAssignmentRecord(assignment, index));
  input.relationships.forEach((relationship, index) => assertRelationshipRecord(relationship, index));

  return true;
}

export function buildAssignmentVisibilityReadModel(input) {
  assertAssignmentVisibilityInput(input);

  const actor = input.actor;
  let visibleAssignments = [];

  if (actor.actor_type === "coach") {
    visibleAssignments = input.assignments.filter((assignment) => {
      return input.relationships.some((relationship) => {
        return relationshipPermitsCoachAssignmentView(relationship, assignment, actor.coach_id);
      });
    }).map((assignment) => buildVisibleAssignmentRecord(assignment, "coach_assigned_athlete"));
  }

  if (actor.actor_type === "athlete") {
    visibleAssignments = input.assignments
      .filter((assignment) => assignment.assigned_athlete_id === actor.athlete_id)
      .map((assignment) => buildVisibleAssignmentRecord(assignment, "athlete_own_assignment"));
  }

  const sortedAssignments = sortVisibleAssignments(visibleAssignments);

  return Object.freeze({
    read_model_id: assignmentVisibilitySurfaceId,
    read_model_version: assignmentVisibilityVersion,
    actor_type: actor.actor_type,
    actor_id: actor.actor_type === "coach" ? actor.coach_id : actor.athlete_id,
    visible_assignment_count: sortedAssignments.length,
    assignments: Object.freeze(sortedAssignments),
    compile_input_status: LOCKED_COMPILE_INPUT_STATUS,
    engine_visible: false
  });
}

export function tryBuildAssignmentVisibilityReadModel(input) {
  try {
    return Object.freeze({
      ok: true,
      read_model: buildAssignmentVisibilityReadModel(input)
    });
  } catch (error) {
    if (error && error.name === "AssignmentVisibilityError") {
      return Object.freeze({
        ok: false,
        error: Object.freeze({
          code: error.code,
          copy_id: error.copy_id,
          reason: error.reason,
          details: error.details,
          product_auth_failure: true,
          engine_decision: false,
          engine_visible: false
        })
      });
    }

    throw error;
  }
}

export function buildAssignmentVisibilityEngineTruthProbe(input = {}) {
  const assignmentProbe = buildAssignmentEngineTruthProbe(input);

  return Object.freeze({
    probe_id: "assignment_visibility_engine_truth_probe",
    assignment_probe: assignmentProbe,
    compile_input_status: LOCKED_COMPILE_INPUT_STATUS,
    engine_visible: false
  });
}

export const assignmentVisibilityContract = Object.freeze({
  surface_id: assignmentVisibilitySurfaceId,
  version: assignmentVisibilityVersion,
  failure_code: assignmentVisibilityFailureCode,
  failure_copy_id: assignmentVisibilityFailureCopyId,
  required_input_keys: REQUIRED_INPUT_KEYS,
  required_assignment_keys: REQUIRED_ASSIGNMENT_KEYS,
  forbidden_scope_keys: FORBIDDEN_SCOPE_KEYS,
  compile_input_status: LOCKED_COMPILE_INPUT_STATUS
});
