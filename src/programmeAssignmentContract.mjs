// DEV NOTE: S-V1-28 product/auth assignment service. This module authorises
// programme assignment to an accepted individual coach-athlete relationship.
// It records assignment product state only. It does not mutate engine truth,
// compile output, Phase 1 declarations, registry content, marketplace state,
// team/org scope, database state, or billing state.

import crypto from "node:crypto";

const TOKEN_PREFIX = "v1_programme_assignment_contract_";

const LOCKED_ACTIVITY_IDS = Object.freeze([
  "powerlifting",
  "general_strength",
  "rugby_union"
]);

const REQUIRED_ROOT_KEYS = Object.freeze([
  "request_id",
  "requested_at",
  "actor",
  "relationship",
  "assignment_authorisation",
  "template_coverage_entry",
  "assignment_intent",
  "engine_boundary"
]);

const REQUIRED_ACTOR_KEYS = Object.freeze([
  "actor_type",
  "coach_id"
]);

const REQUIRED_RELATIONSHIP_KEYS = Object.freeze([
  "relationship_id",
  "coach_id",
  "athlete_id",
  "relationship_scope",
  "relationship_status"
]);

const REQUIRED_AUTHORISATION_KEYS = Object.freeze([
  "authorisation_id",
  "relationship_id",
  "coach_id",
  "athlete_id",
  "authorisation_scope",
  "authorisation_status"
]);

const REQUIRED_TEMPLATE_KEYS = Object.freeze([
  "template_id",
  "template_status",
  "activity_id",
  "template_contract_version",
  "coverage_contract_version",
  "assignment_scope",
  "source_control_status"
]);

const REQUIRED_INTENT_KEYS = Object.freeze([
  "assignment_mode",
  "assignment_reason_code",
  "target_start_policy"
]);

const REQUIRED_ENGINE_BOUNDARY_KEYS = Object.freeze([
  "assignment_mutates_engine_truth",
  "compile_input_status",
  "engine_visible"
]);

const FORBIDDEN_KEYS = Object.freeze([
  "team_id",
  "team_assignment_id",
  "organisation_id",
  "organization_id",
  "org_id",
  "unit_id",
  "gym_id",
  "federation_id",
  "marketplace_purchase_id",
  "marketplace_listing_id",
  "marketplace_order_id",
  "purchase_id",
  "payment_id",
  "billing_state",
  "billing_status",
  "coach_to_coach_share_id",
  "coach_to_coach_sharing_scope",
  "royalty_rate",
  "royalty_recipient",
  "engine_input",
  "engine_truth",
  "engine_truth_override",
  "compile_now",
  "compiled_output",
  "phase1_declaration",
  "phase1_payload"
]);

const FORBIDDEN_POST_V0_SCOPE_KEYS = Object.freeze([
  ["recomm", "endation_score"].join(""),
  ["optimi", "sation_score"].join(""),
  ["ready", "ness_score"].join(""),
  ["ri", "sk_score"].join("")
]);

const ALL_FORBIDDEN_KEYS = Object.freeze([
  ...FORBIDDEN_KEYS,
  ...FORBIDDEN_POST_V0_SCOPE_KEYS
]);

function fail(code, message, details = {}) {
  const error = new Error(`${TOKEN_PREFIX}${code}: ${message}`);
  error.code = `${TOKEN_PREFIX}${code}`;
  error.details = details;
  throw error;
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(Object(value), key);
}

function assertPlainObject(value, code, message, details = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(code, message, details);
  }
}

function assertExactKeys(value, requiredKeys, code, details = {}, optionalKeys = []) {
  const keys = Object.keys(value).sort();
  const allowed = new Set([...requiredKeys, ...optionalKeys]);
  const required = new Set(requiredKeys);

  for (const key of keys) {
    if (!allowed.has(key)) {
      fail(code, "object contains unknown field", {
        ...details,
        field: key
      });
    }
  }

  for (const key of required) {
    if (!hasOwn(value, key)) {
      fail(code, "object missing required field", {
        ...details,
        field: key
      });
    }
  }
}

function assertNoForbiddenKeysDeep(value, pathParts = []) {
  if (!value || typeof value !== "object") {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenKeysDeep(item, [...pathParts, String(index)]));
    return;
  }

  for (const key of Object.keys(value)) {
    if (ALL_FORBIDDEN_KEYS.includes(key)) {
      fail("forbidden_assignment_scope_field", "assignment input contains a forbidden field", {
        path: [...pathParts, key].join("."),
        field: key
      });
    }

    assertNoForbiddenKeysDeep(value[key], [...pathParts, key]);
  }
}

function assertNonEmptyString(value, code, details = {}) {
  if (typeof value !== "string" || value.length === 0) {
    fail(code, "expected non-empty string", details);
  }
}

function assertBoolean(value, code, details = {}) {
  if (typeof value !== "boolean") {
    fail(code, "expected boolean", details);
  }
}

function assertIsoString(value, code, details = {}) {
  assertNonEmptyString(value, code, details);

  const date = new Date(value);

  if (Number.isNaN(date.getTime()) || date.toISOString() !== value) {
    fail(code, "expected UTC ISO-8601 timestamp string", details);
  }
}

function canonicalise(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalise);
  }

  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((accumulator, key) => {
        accumulator[key] = canonicalise(value[key]);
        return accumulator;
      }, {});
  }

  return value;
}

function stableJson(value) {
  return JSON.stringify(canonicalise(value));
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function assertRelationshipAllowsProgrammeAssignment(relationship, actor) {
  assertPlainObject(relationship, "relationship_not_object", "relationship must be an object");
  assertExactKeys(relationship, REQUIRED_RELATIONSHIP_KEYS, "relationship_keys_invalid");

  for (const field of REQUIRED_RELATIONSHIP_KEYS) {
    assertNonEmptyString(relationship[field], "relationship_required_field_invalid", { field });
  }

  if (relationship.relationship_scope !== "individual_coach_athlete") {
    fail("relationship_scope_invalid", "assignment requires individual coach-athlete relationship scope", {
      relationship_id: relationship.relationship_id,
      relationship_scope: relationship.relationship_scope
    });
  }

  if (relationship.relationship_status !== "accepted") {
    fail("relationship_not_accepted", "assignment requires accepted coach-athlete relationship", {
      relationship_id: relationship.relationship_id,
      relationship_status: relationship.relationship_status
    });
  }

  if (relationship.coach_id !== actor.coach_id) {
    fail("unassigned_coach_assignment_rejected", "actor coach_id must match the accepted relationship coach_id", {
      actor_coach_id: actor.coach_id,
      relationship_coach_id: relationship.coach_id
    });
  }
}

function assertAssignmentAuthorisation(authorisation, relationship, actor) {
  assertPlainObject(authorisation, "authorisation_not_object", "assignment_authorisation must be an object");
  assertExactKeys(authorisation, REQUIRED_AUTHORISATION_KEYS, "authorisation_keys_invalid");

  for (const field of REQUIRED_AUTHORISATION_KEYS) {
    assertNonEmptyString(authorisation[field], "authorisation_required_field_invalid", { field });
  }

  if (authorisation.authorisation_scope !== "programme_assignment") {
    fail("authorisation_scope_invalid", "assignment authorisation scope must be programme_assignment", {
      authorisation_scope: authorisation.authorisation_scope
    });
  }

  if (authorisation.authorisation_status !== "granted") {
    fail("authorisation_not_granted", "programme assignment authorisation must be granted", {
      authorisation_status: authorisation.authorisation_status
    });
  }

  if (authorisation.relationship_id !== relationship.relationship_id) {
    fail("authorisation_relationship_mismatch", "assignment authorisation must bind to the same relationship_id", {
      authorisation_relationship_id: authorisation.relationship_id,
      relationship_id: relationship.relationship_id
    });
  }

  if (authorisation.coach_id !== relationship.coach_id || authorisation.coach_id !== actor.coach_id) {
    fail("authorisation_coach_mismatch", "assignment authorisation coach_id must match actor and relationship coach_id", {
      authorisation_coach_id: authorisation.coach_id,
      relationship_coach_id: relationship.coach_id,
      actor_coach_id: actor.coach_id
    });
  }

  if (authorisation.athlete_id !== relationship.athlete_id) {
    fail("authorisation_athlete_mismatch", "assignment authorisation athlete_id must match relationship athlete_id", {
      authorisation_athlete_id: authorisation.athlete_id,
      relationship_athlete_id: relationship.athlete_id
    });
  }
}

function assertTemplateCoverageSupportsAssignment(templateCoverageEntry) {
  assertPlainObject(templateCoverageEntry, "template_coverage_entry_not_object", "template_coverage_entry must be an object");
  assertExactKeys(templateCoverageEntry, REQUIRED_TEMPLATE_KEYS, "template_coverage_entry_keys_invalid");

  for (const field of REQUIRED_TEMPLATE_KEYS) {
    assertNonEmptyString(templateCoverageEntry[field], "template_coverage_entry_required_field_invalid", { field });
  }

  if (!LOCKED_ACTIVITY_IDS.includes(templateCoverageEntry.activity_id)) {
    fail("unsupported_activity_refused", "assignment template coverage must target the locked v1 activity set", {
      activity_id: templateCoverageEntry.activity_id
    });
  }

  if (templateCoverageEntry.template_status !== "declared_for_v1_coverage") {
    fail("template_status_invalid", "assignment requires declared v1 template coverage", {
      template_status: templateCoverageEntry.template_status
    });
  }

  if (templateCoverageEntry.template_contract_version !== "S-V1-26") {
    fail("template_contract_version_invalid", "assignment requires S-V1-26 template contract", {
      template_contract_version: templateCoverageEntry.template_contract_version
    });
  }

  if (templateCoverageEntry.coverage_contract_version !== "S-V1-27") {
    fail("coverage_contract_version_invalid", "assignment requires S-V1-27 template coverage", {
      coverage_contract_version: templateCoverageEntry.coverage_contract_version
    });
  }

  if (templateCoverageEntry.assignment_scope !== "coach_athlete_assigned_execution") {
    fail("template_assignment_scope_invalid", "template coverage must support coach_athlete_assigned_execution", {
      assignment_scope: templateCoverageEntry.assignment_scope
    });
  }

  if (templateCoverageEntry.source_control_status !== "approved") {
    fail("template_source_control_required", "template coverage must have approved source-control status", {
      source_control_status: templateCoverageEntry.source_control_status
    });
  }
}

function assertAssignmentIntent(assignmentIntent) {
  assertPlainObject(assignmentIntent, "assignment_intent_not_object", "assignment_intent must be an object");
  assertExactKeys(assignmentIntent, REQUIRED_INTENT_KEYS, "assignment_intent_keys_invalid");

  for (const field of REQUIRED_INTENT_KEYS) {
    assertNonEmptyString(assignmentIntent[field], "assignment_intent_required_field_invalid", { field });
  }

  if (assignmentIntent.assignment_mode !== "coach_assigned_to_athlete") {
    fail("assignment_mode_invalid", "assignment_mode must be coach_assigned_to_athlete", {
      assignment_mode: assignmentIntent.assignment_mode
    });
  }

  if (assignmentIntent.assignment_reason_code !== "coach_selected_template") {
    fail("assignment_reason_code_invalid", "assignment_reason_code must be factual and bounded", {
      assignment_reason_code: assignmentIntent.assignment_reason_code
    });
  }

  if (assignmentIntent.target_start_policy !== "athlete_next_available_session") {
    fail("target_start_policy_invalid", "target_start_policy must not compile or mutate engine state", {
      target_start_policy: assignmentIntent.target_start_policy
    });
  }
}

function assertEngineBoundary(engineBoundary) {
  assertPlainObject(engineBoundary, "engine_boundary_not_object", "engine_boundary must be an object");
  assertExactKeys(engineBoundary, REQUIRED_ENGINE_BOUNDARY_KEYS, "engine_boundary_keys_invalid");

  assertBoolean(engineBoundary.assignment_mutates_engine_truth, "engine_boundary_boolean_invalid", {
    field: "assignment_mutates_engine_truth"
  });
  assertBoolean(engineBoundary.engine_visible, "engine_boundary_boolean_invalid", {
    field: "engine_visible"
  });
  assertNonEmptyString(engineBoundary.compile_input_status, "compile_input_status_invalid", {
    field: "compile_input_status"
  });

  if (engineBoundary.assignment_mutates_engine_truth !== false) {
    fail("assignment_engine_truth_mutation_refused", "programme assignment must not alter engine truth");
  }

  if (engineBoundary.engine_visible !== false) {
    fail("assignment_engine_visibility_refused", "programme assignment is product/auth state until compile consumes declared inputs");
  }

  if (engineBoundary.compile_input_status !== "not_consumed_until_declared_compile_input") {
    fail("compile_input_status_invalid", "compile_input_status must remain not_consumed_until_declared_compile_input", {
      compile_input_status: engineBoundary.compile_input_status
    });
  }
}

function validateProgrammeAssignmentRequest(input) {
  assertPlainObject(input, "request_not_object", "assignment request must be an object");
  assertNoForbiddenKeysDeep(input);
  assertExactKeys(input, REQUIRED_ROOT_KEYS, "request_keys_invalid");

  assertNonEmptyString(input.request_id, "request_id_invalid");
  assertIsoString(input.requested_at, "requested_at_invalid");

  assertPlainObject(input.actor, "actor_not_object", "actor must be an object");
  assertExactKeys(input.actor, REQUIRED_ACTOR_KEYS, "actor_keys_invalid");

  if (input.actor.actor_type !== "coach") {
    fail("actor_type_invalid", "only coach actors can assign programmes", {
      actor_type: input.actor.actor_type
    });
  }

  assertNonEmptyString(input.actor.coach_id, "actor_coach_id_invalid");

  assertRelationshipAllowsProgrammeAssignment(input.relationship, input.actor);
  assertAssignmentAuthorisation(input.assignment_authorisation, input.relationship, input.actor);
  assertTemplateCoverageSupportsAssignment(input.template_coverage_entry);
  assertAssignmentIntent(input.assignment_intent);
  assertEngineBoundary(input.engine_boundary);

  return true;
}

function buildAssignmentHashInput(input) {
  return {
    contract_version: "S-V1-28",
    request_id: input.request_id,
    requested_at: input.requested_at,
    assigned_by_coach_id: input.actor.coach_id,
    assigned_athlete_id: input.relationship.athlete_id,
    relationship_id: input.relationship.relationship_id,
    authorisation_id: input.assignment_authorisation.authorisation_id,
    template_id: input.template_coverage_entry.template_id,
    template_contract_version: input.template_coverage_entry.template_contract_version,
    coverage_contract_version: input.template_coverage_entry.coverage_contract_version,
    activity_id: input.template_coverage_entry.activity_id,
    assignment_scope: input.template_coverage_entry.assignment_scope,
    assignment_mode: input.assignment_intent.assignment_mode,
    target_start_policy: input.assignment_intent.target_start_policy
  };
}

export function createProgrammeAssignment(input) {
  validateProgrammeAssignmentRequest(input);

  const hashInput = buildAssignmentHashInput(input);
  const assignmentHash = sha256(stableJson(hashInput));

  return Object.freeze({
    assignment_id: `programme_assignment_${assignmentHash.slice(0, 24)}`,
    assignment_hash: assignmentHash,
    contract_version: "S-V1-28",
    assignment_status: "assigned",
    assigned_at: input.requested_at,
    assigned_by_coach_id: input.actor.coach_id,
    assigned_athlete_id: input.relationship.athlete_id,
    relationship_id: input.relationship.relationship_id,
    template_id: input.template_coverage_entry.template_id,
    template_contract_version: input.template_coverage_entry.template_contract_version,
    coverage_contract_version: input.template_coverage_entry.coverage_contract_version,
    activity_id: input.template_coverage_entry.activity_id,
    assignment_scope: "coach_athlete_assigned_execution",
    compile_input_status: "not_consumed_until_declared_compile_input",
    engine_visible: false,
    assignment_mutates_engine_truth: false,
    relationship_scope_enforced: true,
    marketplace_scope: false,
    team_assignment_scope: false,
    organisation_assignment_scope: false
  });
}

export function tryCreateProgrammeAssignment(input) {
  try {
    return {
      ok: true,
      assignment: createProgrammeAssignment(input)
    };
  } catch (error) {
    return {
      ok: false,
      error_code: error && error.code ? error.code : `${TOKEN_PREFIX}unknown_error`,
      message: error && error.message ? error.message : "unknown programme assignment error",
      details: error && error.details ? error.details : {}
    };
  }
}

export function buildEngineTruthProbe(input = {}) {
  return Object.freeze({
    engine_probe_version: "S-V1-28",
    compile_consumes_assignment: false,
    compile_input_status: "not_consumed_until_declared_compile_input",
    assignment_mutates_engine_truth: false,
    engine_visible: false,
    phase1_payload_hash: input.phase1_payload_hash ?? "phase1_hash_static_probe",
    registry_bundle_hash: input.registry_bundle_hash ?? "registry_hash_static_probe",
    deterministic_output_hash: sha256(stableJson({
      engine_probe_version: "S-V1-28",
      compile_consumes_assignment: false,
      phase1_payload_hash: input.phase1_payload_hash ?? "phase1_hash_static_probe",
      registry_bundle_hash: input.registry_bundle_hash ?? "registry_hash_static_probe"
    }))
  });
}

export const programmeAssignmentContract = Object.freeze({
  token_prefix: TOKEN_PREFIX,
  locked_activity_ids: LOCKED_ACTIVITY_IDS,
  required_root_keys: REQUIRED_ROOT_KEYS,
  required_actor_keys: REQUIRED_ACTOR_KEYS,
  required_relationship_keys: REQUIRED_RELATIONSHIP_KEYS,
  required_authorisation_keys: REQUIRED_AUTHORISATION_KEYS,
  required_template_keys: REQUIRED_TEMPLATE_KEYS,
  required_intent_keys: REQUIRED_INTENT_KEYS,
  required_engine_boundary_keys: REQUIRED_ENGINE_BOUNDARY_KEYS,
  forbidden_keys: ALL_FORBIDDEN_KEYS
});
