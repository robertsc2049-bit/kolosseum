/**
 * DEV NOTE: S-V1-U-04 template assignment UI model.
 * Purpose: builds a product UI model and assignment submission envelope for an authorised coach assigning an existing v1 template to an assigned athlete.
 * Boundary: product UI only; it does not create templates, publish templates, expose hidden template internals, call compile, or call engine code.
 * Determinism: same explicit request returns the same frozen UI model or submission envelope.
 * Failure: malformed input, unassigned athlete access, unknown templates, and hidden-internal leakage fail closed.
 */

const SURFACE_ID = "v1_template_assignment_ui";
const COPY_SURFACE_ID = "template_assignment_ui";

const TEMPLATE_ALLOWED_KEYS = new Set([
  "template_id",
  "template_display_name",
  "template_version",
  "activity_id",
  "template_status",
  "assignable_by_coach_user_ids",
  "visible_summary"
]);

const HIDDEN_INTERNAL_KEYS = new Set([
  "formula",
  "formula_text",
  "formula_visible",
  "protected_formula",
  "protected_formulas",
  "progression_formula",
  "progression_logic",
  "template_internals",
  "hidden_internals",
  "internal_rules",
  "calculation_source"
]);

export class TemplateAssignmentUiError extends Error {
  constructor(reason, details = {}) {
    super(reason);
    this.name = "TemplateAssignmentUiError";
    this.reason = reason;
    this.details = Object.freeze({ ...details });
  }
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanString(value, field) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TemplateAssignmentUiError("template_assignment_ui_invalid_field", { field });
  }

  return value.trim();
}

function cleanOptionalString(value, field) {
  if (value === undefined || value === null) {
    return null;
  }

  return cleanString(value, field);
}

function assertRecord(value, reason, details = {}) {
  if (!isRecord(value)) {
    throw new TemplateAssignmentUiError(reason, details);
  }
}

function assertAllowedKeys(record, allowedKeys, path) {
  for (const key of Object.keys(record)) {
    if (!allowedKeys.has(key)) {
      throw new TemplateAssignmentUiError("template_assignment_ui_unknown_field", { path, field: key });
    }
  }
}

function assertNoHiddenInternalKeys(record, path) {
  for (const key of Object.keys(record)) {
    if (HIDDEN_INTERNAL_KEYS.has(key)) {
      throw new TemplateAssignmentUiError("template_assignment_ui_hidden_internal_present", { path, field: key });
    }
  }
}

function freezeArray(values) {
  return Object.freeze(values.map((value) => Object.freeze(value)));
}

function stableJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }

  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }

  return JSON.stringify(value);
}

function assertCoachActor(actor) {
  assertRecord(actor, "template_assignment_ui_actor_invalid");
  assertAllowedKeys(actor, new Set(["actor_type", "user_id"]), "actor");

  if (actor.actor_type !== "coach") {
    throw new TemplateAssignmentUiError("template_assignment_ui_actor_not_coach", {
      actor_type: actor.actor_type
    });
  }

  return cleanString(actor.user_id, "actor.user_id");
}

function isAcceptedCoachAthleteRelationship(relationship, coachUserId) {
  return (
    isRecord(relationship) &&
    relationship.relationship_scope === "individual" &&
    relationship.relationship_status === "accepted" &&
    relationship.coach_user_id === coachUserId &&
    typeof relationship.athlete_user_id === "string" &&
    relationship.athlete_user_id.trim().length > 0
  );
}

function buildAssignedAthleteMap(relationships, coachUserId) {
  const assigned = new Map();

  for (const relationship of relationships) {
    assertRecord(relationship, "template_assignment_ui_relationship_invalid");
    assertAllowedKeys(relationship, new Set([
      "relationship_id",
      "relationship_scope",
      "relationship_status",
      "coach_user_id",
      "athlete_user_id"
    ]), "relationships[]");

    if (!isAcceptedCoachAthleteRelationship(relationship, coachUserId)) {
      continue;
    }

    const athleteUserId = cleanString(relationship.athlete_user_id, "relationship.athlete_user_id");

    if (!assigned.has(athleteUserId)) {
      assigned.set(athleteUserId, Object.freeze({
        athlete_user_id: athleteUserId,
        relationship_id: cleanString(relationship.relationship_id, "relationship.relationship_id")
      }));
    }
  }

  return assigned;
}

function normaliseAthlete(athlete) {
  assertRecord(athlete, "template_assignment_ui_athlete_invalid");
  assertAllowedKeys(athlete, new Set(["athlete_user_id", "athlete_display_id"]), "athletes[]");

  const athleteUserId = cleanString(athlete.athlete_user_id, "athlete.athlete_user_id");

  return Object.freeze({
    athlete_user_id: athleteUserId,
    athlete_display_id: cleanOptionalString(athlete.athlete_display_id, "athlete.athlete_display_id") ?? athleteUserId
  });
}

function normaliseTemplate(template, coachUserId) {
  assertRecord(template, "template_assignment_ui_template_invalid");
  assertNoHiddenInternalKeys(template, "templates[]");
  assertAllowedKeys(template, TEMPLATE_ALLOWED_KEYS, "templates[]");

  const assignableCoachIds = template.assignable_by_coach_user_ids;
  if (!Array.isArray(assignableCoachIds)) {
    throw new TemplateAssignmentUiError("template_assignment_ui_assignable_coaches_required", {
      field: "template.assignable_by_coach_user_ids"
    });
  }

  const cleanedCoachIds = assignableCoachIds.map((value, index) => cleanString(value, `template.assignable_by_coach_user_ids[${index}]`));

  return Object.freeze({
    template_id: cleanString(template.template_id, "template.template_id"),
    template_display_name: cleanString(template.template_display_name, "template.template_display_name"),
    template_version: cleanString(template.template_version, "template.template_version"),
    activity_id: cleanString(template.activity_id, "template.activity_id"),
    template_status: cleanString(template.template_status, "template.template_status"),
    visible_summary: cleanOptionalString(template.visible_summary, "template.visible_summary"),
    assignable_by_actor: cleanedCoachIds.includes(coachUserId)
  });
}

function buildAthleteRows(athletes, assignedAthletes) {
  const rows = [];

  for (const athlete of athletes.map(normaliseAthlete)) {
    const assignment = assignedAthletes.get(athlete.athlete_user_id);
    if (!assignment) {
      continue;
    }

    rows.push(Object.freeze({
      athlete_user_id: athlete.athlete_user_id,
      athlete_display_id: athlete.athlete_display_id,
      relationship_id: assignment.relationship_id
    }));
  }

  rows.sort((left, right) => (
    left.athlete_display_id.localeCompare(right.athlete_display_id) ||
    left.athlete_user_id.localeCompare(right.athlete_user_id)
  ));

  return rows;
}

function buildTemplateRows(templates, coachUserId) {
  const rows = templates
    .map((template) => normaliseTemplate(template, coachUserId))
    .filter((template) => template.template_status === "assignable" && template.assignable_by_actor)
    .map((template) => Object.freeze({
      template_id: template.template_id,
      template_display_name: template.template_display_name,
      template_version: template.template_version,
      activity_id: template.activity_id,
      visible_summary: template.visible_summary
    }));

  rows.sort((left, right) => (
    left.template_display_name.localeCompare(right.template_display_name) ||
    left.template_id.localeCompare(right.template_id)
  ));

  return rows;
}

function normaliseAssignmentRequest(request) {
  assertRecord(request, "template_assignment_ui_assignment_request_invalid");
  assertAllowedKeys(request, new Set([
    "assignment_request_id",
    "athlete_user_id",
    "template_id",
    "requested_at"
  ]), "assignment_request");

  return Object.freeze({
    assignment_request_id: cleanString(request.assignment_request_id, "assignment_request.assignment_request_id"),
    athlete_user_id: cleanString(request.athlete_user_id, "assignment_request.athlete_user_id"),
    template_id: cleanString(request.template_id, "assignment_request.template_id"),
    requested_at: cleanString(request.requested_at, "assignment_request.requested_at")
  });
}

/**
 * FUNCTION NOTE:
 * Export: buildTemplateAssignmentUi
 * Purpose: Builds a copy-id-backed UI model showing only assigned athletes and assignable template metadata.
 * Inputs: explicit coach actor, relationships, athlete display rows, and assignable template metadata.
 * Output: frozen product UI model with no hidden template internals and no engine-facing payload.
 * Boundary: UI visibility only; no assignment write, compile, engine call, or template creation.
 * Determinism: output is sorted by stable display fields and ids.
 * Failure: non-coach actor, hidden internals, unknown fields, or malformed inputs fail closed.
 */
export function buildTemplateAssignmentUi(input) {
  assertRecord(input, "template_assignment_ui_input_invalid");
  assertAllowedKeys(input, new Set(["actor", "relationships", "athletes", "templates"]), "input");

  const coachUserId = assertCoachActor(input.actor);

  for (const [field, value] of Object.entries({
    relationships: input.relationships,
    athletes: input.athletes,
    templates: input.templates
  })) {
    if (!Array.isArray(value)) {
      throw new TemplateAssignmentUiError("template_assignment_ui_array_required", { field });
    }
  }

  const assignedAthletes = buildAssignedAthleteMap(input.relationships, coachUserId);
  const athlete_rows = buildAthleteRows(input.athletes, assignedAthletes);
  const template_rows = buildTemplateRows(input.templates, coachUserId);

  return Object.freeze({
    surface_id: SURFACE_ID,
    copy_surface_id: COPY_SURFACE_ID,
    coach_user_id: coachUserId,
    athlete_rows: freezeArray(athlete_rows),
    template_rows: freezeArray(template_rows),
    can_submit_assignment: athlete_rows.length > 0 && template_rows.length > 0,
    engine_visible: false
  });
}

/**
 * FUNCTION NOTE:
 * Export: submitTemplateAssignmentFromUi
 * Purpose: Builds a product-layer assignment submission envelope for an authorised coach and assigned athlete.
 * Inputs: the same explicit UI input plus an assignment request.
 * Output: frozen assignment envelope for product persistence/compile orchestration outside this slice.
 * Boundary: no database write, no compile, no engine call, no template internals, and no template sharing.
 * Determinism: same input and request returns the same assignment envelope.
 * Failure: unassigned athlete, unavailable template, malformed request, or hidden internals fail closed.
 */
export function submitTemplateAssignmentFromUi(input) {
  assertRecord(input, "template_assignment_ui_submit_input_invalid");
  assertAllowedKeys(input, new Set(["actor", "relationships", "athletes", "templates", "assignment_request"]), "input");

  const assignmentRequest = normaliseAssignmentRequest(input.assignment_request);

  const ui = buildTemplateAssignmentUi({
    actor: input.actor,
    relationships: input.relationships,
    athletes: input.athletes,
    templates: input.templates
  });

  const athlete = ui.athlete_rows.find((row) => row.athlete_user_id === assignmentRequest.athlete_user_id);
  if (!athlete) {
    throw new TemplateAssignmentUiError("template_assignment_ui_athlete_not_assigned", {
      athlete_user_id: assignmentRequest.athlete_user_id
    });
  }

  const template = ui.template_rows.find((row) => row.template_id === assignmentRequest.template_id);
  if (!template) {
    throw new TemplateAssignmentUiError("template_assignment_ui_template_not_assignable", {
      template_id: assignmentRequest.template_id
    });
  }

  return Object.freeze({
    surface_id: SURFACE_ID,
    assignment_request_id: assignmentRequest.assignment_request_id,
    assignment_status: "recorded",
    coach_user_id: ui.coach_user_id,
    athlete_user_id: athlete.athlete_user_id,
    relationship_id: athlete.relationship_id,
    template_id: template.template_id,
    template_version: template.template_version,
    activity_id: template.activity_id,
    requested_at: assignmentRequest.requested_at,
    declared_compile_path_required: true,
    hidden_template_internals_exposed: false,
    engine_visible: false
  });
}

export function serialiseTemplateAssignmentUiProbe(value) {
  return stableJson(value);
}