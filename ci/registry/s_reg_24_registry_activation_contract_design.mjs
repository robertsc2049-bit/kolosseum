/**
 * DEV NOTE: S-REG-24 registry activation contract design.
 * Purpose: defines the contract a future explicit activation slice must satisfy
 * after S-REG-23 recorded a HOLD decision.
 * Boundary: contract design only. This module must not activate registries,
 * mutate registry_index.json, mutate registry_bundle.json, mutate active
 * registry law, alter deterministic engine output, create marker evaluator
 * behaviour, compare recorded values, create advice, infer outcomes, alter
 * programme assignment, alter substitution runtime, or create UI behaviour.
 * Determinism: validates the S-REG-23 source hold, fixed contract checklist,
 * fixed future activation constraints, compact active registry surface, and
 * false mutation flags.
 * Failure: throws CI_S_REG_24_REGISTRY_ACTIVATION_CONTRACT_DESIGN.
 */

import fs from "node:fs";

export const S_REG_24_SLICE_ID = "S-REG-24";
export const S_REG_24_FAILURE_TOKEN = "CI_S_REG_24_REGISTRY_ACTIVATION_CONTRACT_DESIGN";
export const S_REG_24_CONTRACT_ID = "registry_activation_contract_design";
export const S_REG_24_CONTRACT_TYPE = "design_only";
export const S_REG_24_RUNTIME_STATUS = "non_runtime";
export const S_REG_24_SOURCE_HOLD_SLICE_ID = "S-REG-23";
export const S_REG_24_SOURCE_HOLD_DECISION_ID = "registry_activation_hold_decision";

export const S_REG_24_REQUIRED_FALSE_FLAGS = Object.freeze([
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

export const S_REG_24_REQUIRED_TRUE_FLAGS = Object.freeze([
  "activation_contract_defined",
  "active_registry_mutation_contract_defined",
  "registry_index_update_contract_defined",
  "registry_bundle_promotion_plan_defined",
  "registry_loader_contract_defined",
  "active_registry_schema_plan_defined",
  "fk_closure_replay_contract_defined",
  "registry_seal_freeze_and_gate_plan_defined",
  "engine_consumption_boundary_decision_defined",
  "runtime_no_behaviour_change_proof_defined",
  "rollback_or_revert_plan_defined"
]);

export const S_REG_24_COVERED_S_REG_23_REQUIREMENTS = Object.freeze([
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

export const S_REG_24_COMPACT_ACTIVE_REGISTRY_ORDER = Object.freeze([
  "activity",
  "movement",
  "exercise",
  "program"
]);

export const S_REG_24_FUTURE_ALLOWED_ACTIVATION_MUTATIONS = Object.freeze([
  "registries/registry_index.json",
  "registries/registry_bundle.json",
  "registries/<registry_id>/<registry_id>.registry.json",
  "ci/evidence/registry_seal_manifest.v1.json",
  "ci/evidence/registry_seal_live_surface.v1.json",
  "ci/evidence/registry_seal.v1.json",
  "ci/evidence/registry_seal_snapshot.v1.json",
  "ci/evidence/registry_seal_lifecycle.v1.json",
  "docs/roadmap/<future_activation_slice>.md",
  "test/<future_activation_slice>.test.mjs",
  "ci/guards/<future_activation_slice>_guard.mjs",
  "package.json",
  "generated_indexes_and_checksums"
]);

export const S_REG_24_FUTURE_FORBIDDEN_ACTIVATION_SHORTCUTS = Object.freeze([
  "activate_without_separate_slice",
  "mutate_registry_index_without_bundle_regeneration",
  "mutate_registry_bundle_without_registry_source_files",
  "mutate_registry_files_without_schema_plan",
  "consume_candidate_records_directly_at_runtime",
  "add_marker_evaluator_runtime",
  "compare_recorded_values",
  "emit_advice_or_outcome_inference",
  "alter_programme_assignment",
  "alter_substitution_runtime",
  "expose_candidate_records_in_ui",
  "skip_registry_seal_gate",
  "skip_rollback_or_revert_plan"
]);

export const S_REG_24_FUTURE_REGISTRY_LOAD_ORDER_EDGES = Object.freeze([
  Object.freeze({ upstream: "activity", downstream: "exercise" }),
  Object.freeze({ upstream: "movement", downstream: "exercise" }),
  Object.freeze({ upstream: "equipment", downstream: "exercise_equipment_compatibility" }),
  Object.freeze({ upstream: "exercise", downstream: "exercise_equipment_compatibility" }),
  Object.freeze({ upstream: "activity", downstream: "exercise_activity_applicability" }),
  Object.freeze({ upstream: "exercise", downstream: "exercise_activity_applicability" }),
  Object.freeze({ upstream: "sport_metric", downstream: "metric_exercise_link" }),
  Object.freeze({ upstream: "exercise", downstream: "metric_exercise_link" }),
  Object.freeze({ upstream: "sport_metric", downstream: "threshold_marker" }),
  Object.freeze({ upstream: "metric_exercise_link", downstream: "threshold_marker" })
]);

export const S_REG_24_FUTURE_REQUIRED_PROOF_COMMANDS = Object.freeze([
  "node ci/guards/registry_bundle_guard.mjs",
  "node ci/guards/registry_law_guard.mjs",
  "node ci/guards/registry_schema_presence_guard.mjs",
  "node ci/guards/s_v1_24_registry_load_order_fk_closure_guard.mjs",
  "node ci/scripts/run_registry_seal_gate.mjs",
  "node ci/scripts/run_failure_token_index_guard.mjs",
  "node ci/guards/guards_index_guard.mjs",
  "node ci/guards/guards_entrypoint_coverage_guard.mjs",
  "npm.cmd run lint:fast"
]);

export const S_REG_24_EXPECTED_DOCUMENT_KEYS = Object.freeze([
  "slice_id",
  "contract_id",
  "contract_type",
  "source_hold_slice_id",
  "source_hold_decision_id",
  "source_hold_decision",
  "runtime_status",
  "contract_design_status",
  "activation_contract_defined",
  "active_registry_mutation_contract_defined",
  "registry_index_update_contract_defined",
  "registry_bundle_promotion_plan_defined",
  "registry_loader_contract_defined",
  "active_registry_schema_plan_defined",
  "fk_closure_replay_contract_defined",
  "registry_seal_freeze_and_gate_plan_defined",
  "engine_consumption_boundary_decision_defined",
  "runtime_no_behaviour_change_proof_defined",
  "rollback_or_revert_plan_defined",
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
  "covered_s_reg_23_requirements",
  "current_active_registry_surface_observed",
  "future_activation_contract",
  "future_allowed_activation_mutations",
  "future_forbidden_activation_shortcuts",
  "future_registry_load_order_edges",
  "future_required_proof_commands",
  "next_allowed_slice_categories",
  "next_disallowed_actions"
]);

export const S_REG_24_PATHS = Object.freeze({
  contract: "ci/registry/s_reg_24_registry_activation_contract_design.json",
  source_hold: "ci/registry/s_reg_23_registry_activation_hold_decision.json",
  source_review: "ci/registry/s_reg_22_candidate_registry_build_review.json",
  registry_index: "registries/registry_index.json",
  registry_bundle: "registries/registry_bundle.json"
});

export const S_REG_24_FORBIDDEN_PAYLOAD_KEYS = Object.freeze([
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
  "programme_assignment_payload",
  "substitution_rule",
  "ui_route",
  "ranking",
  "outcome"
]);

function fail(reason, details = {}) {
  const error = new Error(reason);
  error.code = S_REG_24_FAILURE_TOKEN;
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

function assertNoForbiddenPayloadKeys(value, path = "root") {
  if (!value || typeof value !== "object") {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenPayloadKeys(item, `${path}[${index}]`));
    return;
  }

  for (const key of Object.keys(value)) {
    if (S_REG_24_FORBIDDEN_PAYLOAD_KEYS.includes(key)) {
      fail("s_reg_24_forbidden_payload_key_present", { key, path });
    }

    assertNoForbiddenPayloadKeys(value[key], `${path}.${key}`);
  }
}

function assertSourceHoldStillBlocksActivation() {
  const hold = readJson(S_REG_24_PATHS.source_hold);
  assertPlainObject(hold, "s_reg_24_source_hold_invalid");

  if (hold.slice_id !== S_REG_24_SOURCE_HOLD_SLICE_ID) {
    fail("s_reg_24_source_hold_slice_invalid", { actual: hold.slice_id });
  }

  if (hold.decision_id !== S_REG_24_SOURCE_HOLD_DECISION_ID || hold.decision_type !== "hold") {
    fail("s_reg_24_source_hold_identity_invalid", {
      decision_id: hold.decision_id,
      decision_type: hold.decision_type
    });
  }

  if (hold.activation_decision !== "hold") {
    fail("s_reg_24_source_hold_decision_invalid", { actual: hold.activation_decision });
  }

  if (hold.activation_authorised !== false || hold.activation_ready !== false || hold.active_registry_activation !== false) {
    fail("s_reg_24_source_hold_activation_flags_invalid", {
      activation_authorised: hold.activation_authorised,
      activation_ready: hold.activation_ready,
      active_registry_activation: hold.active_registry_activation
    });
  }

  assertExactArray(
    hold.required_before_activation,
    S_REG_24_COVERED_S_REG_23_REQUIREMENTS,
    "s_reg_24_source_hold_required_before_activation_invalid"
  );

  const review = readJson(S_REG_24_PATHS.source_review);
  if (
    review.slice_id !== "S-REG-22" ||
    review.activation_decision !== "not_authorised_pending_later_explicit_activation_slice" ||
    review.active_registry_activation !== false ||
    review.activation_ready !== false
  ) {
    fail("s_reg_24_source_review_activation_state_invalid", {
      slice_id: review.slice_id,
      activation_decision: review.activation_decision,
      active_registry_activation: review.active_registry_activation,
      activation_ready: review.activation_ready
    });
  }
}

function assertActiveRegistrySurfaceUnchanged(contractDocument) {
  const registryIndex = readJson(S_REG_24_PATHS.registry_index);
  const registryBundle = readJson(S_REG_24_PATHS.registry_bundle);

  assertExactArray(
    registryIndex.order,
    S_REG_24_COMPACT_ACTIVE_REGISTRY_ORDER,
    "s_reg_24_active_registry_index_order_changed"
  );

  assertExactArray(
    Object.keys(registryBundle.registries),
    S_REG_24_COMPACT_ACTIVE_REGISTRY_ORDER,
    "s_reg_24_active_registry_bundle_keys_changed"
  );

  assertPlainObject(
    contractDocument.current_active_registry_surface_observed,
    "s_reg_24_current_active_registry_surface_observed_invalid"
  );

  assertExactArray(
    contractDocument.current_active_registry_surface_observed.registry_index_order,
    S_REG_24_COMPACT_ACTIVE_REGISTRY_ORDER,
    "s_reg_24_observed_registry_index_order_invalid"
  );

  assertExactArray(
    contractDocument.current_active_registry_surface_observed.registry_bundle_keys,
    S_REG_24_COMPACT_ACTIVE_REGISTRY_ORDER,
    "s_reg_24_observed_registry_bundle_keys_invalid"
  );
}

function assertFutureActivationContract(contractDocument) {
  assertPlainObject(contractDocument.future_activation_contract, "s_reg_24_future_activation_contract_invalid");

  for (const [key, value] of Object.entries(contractDocument.future_activation_contract)) {
    if (value !== true) {
      fail("s_reg_24_future_activation_contract_flag_invalid", { key, value });
    }
  }

  assertExactArray(
    contractDocument.future_allowed_activation_mutations,
    S_REG_24_FUTURE_ALLOWED_ACTIVATION_MUTATIONS,
    "s_reg_24_future_allowed_activation_mutations_invalid"
  );

  assertExactArray(
    contractDocument.future_forbidden_activation_shortcuts,
    S_REG_24_FUTURE_FORBIDDEN_ACTIVATION_SHORTCUTS,
    "s_reg_24_future_forbidden_activation_shortcuts_invalid"
  );

  assertExactArray(
    contractDocument.future_registry_load_order_edges,
    S_REG_24_FUTURE_REGISTRY_LOAD_ORDER_EDGES,
    "s_reg_24_future_registry_load_order_edges_invalid"
  );

  assertExactArray(
    contractDocument.future_required_proof_commands,
    S_REG_24_FUTURE_REQUIRED_PROOF_COMMANDS,
    "s_reg_24_future_required_proof_commands_invalid"
  );
}

export function sReg24LoadRegistryActivationContractDesign() {
  return readJson(S_REG_24_PATHS.contract);
}

export function sReg24ValidateRegistryActivationContractDesign({
  contractDocument = sReg24LoadRegistryActivationContractDesign()
} = {}) {
  assertPlainObject(contractDocument, "s_reg_24_contract_document_invalid");
  assertNoForbiddenPayloadKeys(contractDocument);
  assertExactKeys(contractDocument, S_REG_24_EXPECTED_DOCUMENT_KEYS, "s_reg_24_contract_document_keys_invalid");
  assertSourceHoldStillBlocksActivation();
  assertActiveRegistrySurfaceUnchanged(contractDocument);

  if (contractDocument.slice_id !== S_REG_24_SLICE_ID) {
    fail("s_reg_24_slice_id_invalid", { actual: contractDocument.slice_id });
  }

  if (contractDocument.contract_id !== S_REG_24_CONTRACT_ID || contractDocument.contract_type !== S_REG_24_CONTRACT_TYPE) {
    fail("s_reg_24_contract_identity_invalid", {
      contract_id: contractDocument.contract_id,
      contract_type: contractDocument.contract_type
    });
  }

  if (
    contractDocument.source_hold_slice_id !== S_REG_24_SOURCE_HOLD_SLICE_ID ||
    contractDocument.source_hold_decision_id !== S_REG_24_SOURCE_HOLD_DECISION_ID ||
    contractDocument.source_hold_decision !== "hold"
  ) {
    fail("s_reg_24_source_hold_reference_invalid", {
      source_hold_slice_id: contractDocument.source_hold_slice_id,
      source_hold_decision_id: contractDocument.source_hold_decision_id,
      source_hold_decision: contractDocument.source_hold_decision
    });
  }

  if (contractDocument.runtime_status !== S_REG_24_RUNTIME_STATUS) {
    fail("s_reg_24_runtime_status_invalid", { actual: contractDocument.runtime_status });
  }

  if (contractDocument.contract_design_status !== "defined_for_future_explicit_activation_slice_only") {
    fail("s_reg_24_contract_design_status_invalid", { actual: contractDocument.contract_design_status });
  }

  for (const flag of S_REG_24_REQUIRED_TRUE_FLAGS) {
    if (contractDocument[flag] !== true) {
      fail("s_reg_24_true_flag_invalid", { flag, actual: contractDocument[flag] });
    }
  }

  for (const flag of S_REG_24_REQUIRED_FALSE_FLAGS) {
    if (contractDocument[flag] !== false) {
      fail("s_reg_24_false_flag_invalid", { flag, actual: contractDocument[flag] });
    }
  }

  assertExactArray(
    contractDocument.covered_s_reg_23_requirements,
    S_REG_24_COVERED_S_REG_23_REQUIREMENTS,
    "s_reg_24_covered_s_reg_23_requirements_invalid"
  );

  assertFutureActivationContract(contractDocument);

  return Object.freeze({
    ok: true,
    token: S_REG_24_FAILURE_TOKEN,
    slice_id: S_REG_24_SLICE_ID,
    contract_id: contractDocument.contract_id,
    contract_type: contractDocument.contract_type,
    runtime_status: S_REG_24_RUNTIME_STATUS,
    contract_design_status: contractDocument.contract_design_status,
    source_hold_slice_id: contractDocument.source_hold_slice_id,
    activation_authorised: false,
    activation_ready: false,
    active_registry_activation: false,
    covered_requirement_count: contractDocument.covered_s_reg_23_requirements.length,
    future_allowed_activation_mutation_count: contractDocument.future_allowed_activation_mutations.length,
    future_forbidden_activation_shortcut_count: contractDocument.future_forbidden_activation_shortcuts.length,
    future_registry_load_order_edge_count: contractDocument.future_registry_load_order_edges.length,
    future_required_proof_command_count: contractDocument.future_required_proof_commands.length
  });
}