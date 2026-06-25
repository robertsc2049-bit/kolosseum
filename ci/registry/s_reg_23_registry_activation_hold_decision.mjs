/**
 * DEV NOTE: S-REG-23 registry activation hold decision.
 * Purpose: records that the S-REG-15 through S-REG-22 candidate registry chain
 * remains held after review. This is a deliberate hold decision, not an
 * activation slice.
 * Boundary: decision record only. This module must not activate registries,
 * mutate active registry law, mutate registry_index.json, mutate
 * registry_bundle.json, alter deterministic engine output, create marker
 * evaluator behaviour, compare recorded values, create advice, infer outcomes,
 * alter programme assignment, alter substitution runtime, or create UI
 * behaviour.
 * Determinism: validates the S-REG-22 source review, fixed hold reasons,
 * fixed pre-activation requirements, compact active registry surface, and false
 * mutation flags.
 * Failure: throws CI_S_REG_23_REGISTRY_ACTIVATION_HOLD_DECISION.
 */

import fs from "node:fs";

export const S_REG_23_SLICE_ID = "S-REG-23";
export const S_REG_23_FAILURE_TOKEN = "CI_S_REG_23_REGISTRY_ACTIVATION_HOLD_DECISION";
export const S_REG_23_DECISION_ID = "registry_activation_hold_decision";
export const S_REG_23_RUNTIME_STATUS = "non_runtime";
export const S_REG_23_SOURCE_REVIEW_SLICE_ID = "S-REG-22";
export const S_REG_23_SOURCE_REVIEW_ID = "candidate_registry_review_and_activation_gate";
export const S_REG_23_SOURCE_REVIEW_STATUS = "candidate_reviewed_fk_closed_pending_activation_decision";

export const S_REG_23_REQUIRED_FALSE_FLAGS = Object.freeze([
  "activation_authorised",
  "activation_ready",
  "active_registry_activation",
  "active_registry_mutation",
  "active_bundle_mutation",
  "registry_law_mutation",
  "registry_index_mutation",
  "registry_bundle_mutation",
  "registry_seal_mutation",
  "engine_runtime_mutation",
  "phase1_runtime_schema_mutation",
  "marker_evaluator_mutation",
  "comparison_result_mutation",
  "recorded_value_input_mutation",
  "advice_mutation",
  "outcome_inference_mutation",
  "programme_assignment_mutation",
  "substitution_runtime_mutation",
  "ui_behaviour_mutation",
  "coach_interpretation_mutation"
]);

export const S_REG_23_HOLD_REASON_CODES = Object.freeze([
  "activation_contract_not_defined",
  "active_registry_mutation_contract_not_defined",
  "registry_bundle_promotion_plan_not_defined",
  "registry_loader_consumption_contract_not_defined",
  "registry_seal_lifecycle_enforced",
  "runtime_consumption_contract_not_defined",
  "rollback_plan_not_defined"
]);

export const S_REG_23_REQUIRED_BEFORE_ACTIVATION = Object.freeze([
  "explicit_activation_slice",
  "active_registry_mutation_contract",
  "registry_index_update_contract",
  "registry_bundle_promotion_plan",
  "registry_loader_contract",
  "active_registry_schema_plan",
  "fk_closure_replay_against_active_bundle",
  "registry_seal_freeze_and_gate_plan",
  "engine_consumption_boundary_decision",
  "runtime_no_behaviour_change_proof",
  "rollback_or_revert_plan"
]);

export const S_REG_23_CANDIDATE_CHAIN_REVIEWED = Object.freeze([
  "S-REG-15",
  "S-REG-16",
  "S-REG-17",
  "S-REG-18",
  "S-REG-19",
  "S-REG-20",
  "S-REG-21",
  "S-REG-22"
]);

export const S_REG_23_COMPACT_ACTIVE_REGISTRY_ORDER = Object.freeze([
  "activity",
  "movement",
  "exercise",
  "program"
]);

export const S_REG_23_EXPECTED_DOCUMENT_KEYS = Object.freeze([
  "slice_id",
  "decision_id",
  "decision_type",
  "source_review_slice_id",
  "source_review_id",
  "source_review_status",
  "runtime_status",
  "activation_decision",
  "activation_authorised",
  "activation_ready",
  "active_registry_activation",
  "active_registry_mutation",
  "active_bundle_mutation",
  "registry_law_mutation",
  "registry_index_mutation",
  "registry_bundle_mutation",
  "registry_seal_mutation",
  "engine_runtime_mutation",
  "phase1_runtime_schema_mutation",
  "marker_evaluator_mutation",
  "comparison_result_mutation",
  "recorded_value_input_mutation",
  "advice_mutation",
  "outcome_inference_mutation",
  "programme_assignment_mutation",
  "substitution_runtime_mutation",
  "ui_behaviour_mutation",
  "coach_interpretation_mutation",
  "hold_reason_codes",
  "required_before_activation",
  "active_registry_hashes_observed",
  "active_registry_surface_observed",
  "candidate_chain_reviewed",
  "next_allowed_slice_categories",
  "next_disallowed_actions"
]);

export const S_REG_23_PATHS = Object.freeze({
  decision: "ci/registry/s_reg_23_registry_activation_hold_decision.json",
  source_review: "ci/registry/s_reg_22_candidate_registry_build_review.json",
  registry_index: "registries/registry_index.json",
  registry_bundle: "registries/registry_bundle.json"
});

export const S_REG_23_FORBIDDEN_KEYS = Object.freeze([
  "records",
  "seed_records",
  "active_registry_records",
  "registry_bundle_payload",
  "registry_index_payload",
  "engine_output",
  "phase1_runtime_schema",
  "marker_evaluator",
  "comparison_result",
  "recorded_value",
  "coach_action",
  "athlete_instruction",
  "programme_assignment",
  "substitution_rule",
  "ui_route",
  "recommendation",
  "optimisation",
  "optimization",
  "ranking",
  "outcome"
]);

function fail(reason, details = {}) {
  const error = new Error(reason);
  error.code = S_REG_23_FAILURE_TOKEN;
  error.reason = reason;
  error.details = details;
  throw error;
}

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function assertPlainObject(value, reason) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(reason, { actual: value });
  }
}

function assertExactArray(actual, expected, reason) {
  if (!Array.isArray(actual)) {
    fail(reason, { actual });
  }

  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(reason, { actual, expected });
  }
}

function assertExactKeys(object, expectedKeys, reason) {
  const actual = Object.keys(object).sort();
  const expected = [...expectedKeys].sort();

  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(reason, { actual, expected });
  }
}

function assertNoForbiddenKeys(value, path = "root") {
  if (!value || typeof value !== "object") {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenKeys(item, `${path}[${index}]`));
    return;
  }

  for (const key of Object.keys(value)) {
    if (S_REG_23_FORBIDDEN_KEYS.includes(key)) {
      fail("s_reg_23_forbidden_key_present", { key, path });
    }

    assertNoForbiddenKeys(value[key], `${path}.${key}`);
  }
}

function assertActiveRegistrySurfaceUnchanged(decisionDocument) {
  const registryIndex = readJson(S_REG_23_PATHS.registry_index);
  const registryBundle = readJson(S_REG_23_PATHS.registry_bundle);

  assertExactArray(
    registryIndex.order,
    S_REG_23_COMPACT_ACTIVE_REGISTRY_ORDER,
    "s_reg_23_active_registry_index_order_changed"
  );

  assertExactArray(
    Object.keys(registryBundle.registries),
    S_REG_23_COMPACT_ACTIVE_REGISTRY_ORDER,
    "s_reg_23_active_registry_bundle_keys_changed"
  );

  assertExactArray(
    decisionDocument.active_registry_surface_observed.registry_index_order,
    S_REG_23_COMPACT_ACTIVE_REGISTRY_ORDER,
    "s_reg_23_observed_registry_index_order_invalid"
  );

  assertExactArray(
    decisionDocument.active_registry_surface_observed.registry_bundle_keys,
    S_REG_23_COMPACT_ACTIVE_REGISTRY_ORDER,
    "s_reg_23_observed_registry_bundle_keys_invalid"
  );
}

function assertSourceReviewRequiresLaterActivation() {
  const review = readJson(S_REG_23_PATHS.source_review);
  assertPlainObject(review, "s_reg_23_source_review_invalid");

  if (review.slice_id !== S_REG_23_SOURCE_REVIEW_SLICE_ID) {
    fail("s_reg_23_source_review_slice_invalid", { actual: review.slice_id });
  }

  if (review.review_id !== S_REG_23_SOURCE_REVIEW_ID) {
    fail("s_reg_23_source_review_id_invalid", { actual: review.review_id });
  }

  if (review.candidate_review_status !== S_REG_23_SOURCE_REVIEW_STATUS) {
    fail("s_reg_23_source_review_status_invalid", { actual: review.candidate_review_status });
  }

  if (review.activation_decision !== "not_authorised_pending_later_explicit_activation_slice") {
    fail("s_reg_23_source_review_activation_decision_invalid", { actual: review.activation_decision });
  }

  if (review.later_activation_requirement !== "separate_explicit_activation_slice_required") {
    fail("s_reg_23_source_review_later_activation_requirement_invalid", {
      actual: review.later_activation_requirement
    });
  }

  if (review.active_registry_activation !== false || review.activation_ready !== false) {
    fail("s_reg_23_source_review_activation_flags_invalid", {
      active_registry_activation: review.active_registry_activation,
      activation_ready: review.activation_ready
    });
  }
}

export function sReg23LoadRegistryActivationHoldDecision() {
  return readJson(S_REG_23_PATHS.decision);
}

export function sReg23ValidateRegistryActivationHoldDecision({
  decisionDocument = sReg23LoadRegistryActivationHoldDecision()
} = {}) {
  assertPlainObject(decisionDocument, "s_reg_23_decision_document_invalid");
  assertNoForbiddenKeys(decisionDocument);
  assertExactKeys(decisionDocument, S_REG_23_EXPECTED_DOCUMENT_KEYS, "s_reg_23_decision_document_keys_invalid");
  assertSourceReviewRequiresLaterActivation();
  assertActiveRegistrySurfaceUnchanged(decisionDocument);

  if (decisionDocument.slice_id !== S_REG_23_SLICE_ID) {
    fail("s_reg_23_slice_id_invalid", { actual: decisionDocument.slice_id });
  }

  if (decisionDocument.decision_id !== S_REG_23_DECISION_ID || decisionDocument.decision_type !== "hold") {
    fail("s_reg_23_decision_identity_invalid", {
      decision_id: decisionDocument.decision_id,
      decision_type: decisionDocument.decision_type
    });
  }

  if (
    decisionDocument.source_review_slice_id !== S_REG_23_SOURCE_REVIEW_SLICE_ID ||
    decisionDocument.source_review_id !== S_REG_23_SOURCE_REVIEW_ID ||
    decisionDocument.source_review_status !== S_REG_23_SOURCE_REVIEW_STATUS
  ) {
    fail("s_reg_23_source_review_reference_invalid", {
      source_review_slice_id: decisionDocument.source_review_slice_id,
      source_review_id: decisionDocument.source_review_id,
      source_review_status: decisionDocument.source_review_status
    });
  }

  if (decisionDocument.runtime_status !== S_REG_23_RUNTIME_STATUS) {
    fail("s_reg_23_runtime_status_invalid", { actual: decisionDocument.runtime_status });
  }

  if (decisionDocument.activation_decision !== "hold") {
    fail("s_reg_23_activation_decision_invalid", { actual: decisionDocument.activation_decision });
  }

  for (const flag of S_REG_23_REQUIRED_FALSE_FLAGS) {
    if (decisionDocument[flag] !== false) {
      fail("s_reg_23_false_flag_invalid", { flag, actual: decisionDocument[flag] });
    }
  }

  assertExactArray(
    decisionDocument.hold_reason_codes,
    S_REG_23_HOLD_REASON_CODES,
    "s_reg_23_hold_reason_codes_invalid"
  );

  assertExactArray(
    decisionDocument.required_before_activation,
    S_REG_23_REQUIRED_BEFORE_ACTIVATION,
    "s_reg_23_required_before_activation_invalid"
  );

  assertExactArray(
    decisionDocument.candidate_chain_reviewed,
    S_REG_23_CANDIDATE_CHAIN_REVIEWED,
    "s_reg_23_candidate_chain_reviewed_invalid"
  );

  return Object.freeze({
    ok: true,
    token: S_REG_23_FAILURE_TOKEN,
    slice_id: S_REG_23_SLICE_ID,
    decision_id: decisionDocument.decision_id,
    decision_type: decisionDocument.decision_type,
    activation_decision: decisionDocument.activation_decision,
    activation_authorised: false,
    activation_ready: false,
    active_registry_activation: false,
    runtime_status: S_REG_23_RUNTIME_STATUS,
    source_review_slice_id: decisionDocument.source_review_slice_id,
    hold_reason_codes: [...decisionDocument.hold_reason_codes],
    required_before_activation: [...decisionDocument.required_before_activation],
    candidate_chain_reviewed: [...decisionDocument.candidate_chain_reviewed]
  });
}