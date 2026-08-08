/**
 * DEV NOTE: S-REG-27 registry activation - sport_metric_registry.
 * Purpose: the third explicit activation slice authorised after S-REG-23's
 * hold and S-REG-24's contract design (S-REG-25 activated equipment,
 * S-REG-26 activated sport_subdivision first).
 * Activates exactly one candidate domain (sport_metric) into the active
 * registry surface, satisfying S-REG-24's contract for that target only.
 * Boundary: activates the `sport_metric` active registry domain only. Must
 * not touch any other candidate domain, mutate registry_law_guard.mjs or any
 * other CI script, alter engine/server/app/web source, create marker
 * evaluator behaviour, compare recorded values, create advice, infer
 * outcomes, alter programme assignment, alter substitution runtime, or
 * create UI behaviour. Nothing consumes the sport_metric registry, so
 * runtime_status remains non_runtime even though active_registry_activation
 * is now true.
 * Determinism: validates the S-REG-23 hold and S-REG-24 contract both
 * recorded this slice in their append-only supersession logs, the exact
 * activation target/decision identity, before/after registry hashes, the
 * rollback plan, and the runtime parity proof. The live active registry
 * order/bundle-key checks are prefix checks, not exact-match - a later,
 * separately-authorised activation slice may legitimately append further
 * domains after this one.
 * Failure: throws CI_S_REG_27_SPORT_METRIC_REGISTRY_ACTIVATION.
 */

import fs from "node:fs";

export const S_REG_27_SLICE_ID = "S-REG-27";
export const S_REG_27_FAILURE_TOKEN = "CI_S_REG_27_SPORT_METRIC_REGISTRY_ACTIVATION";
export const S_REG_27_ACTIVATION_ID = "sport_metric_registry_activation";
export const S_REG_27_RUNTIME_STATUS = "non_runtime";
export const S_REG_27_SOURCE_HOLD_SLICE_ID = "S-REG-23";
export const S_REG_27_SOURCE_CONTRACT_SLICE_ID = "S-REG-24";
export const S_REG_27_ACTIVATION_TARGET = "sport_metric_registry";
export const S_REG_27_ACTIVATED_REGISTRY_ID = "sport_metric";
export const S_REG_27_SOURCE_CANDIDATE_SLICE_ID = "S-REG-11";

export const S_REG_27_REQUIRED_TRUE_FLAGS = Object.freeze([
  "activation_authorised",
  "activation_ready",
  "active_registry_activation",
  "active_registry_mutation",
  "active_bundle_mutation",
  "registry_index_mutation",
  "registry_bundle_mutation",
  "registry_seal_mutation"
]);

export const S_REG_27_REQUIRED_FALSE_FLAGS = Object.freeze([
  "registry_law_mutation",
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

export const S_REG_27_COVERED_REQUIRED_BEFORE_ACTIVATION = Object.freeze([
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

export const S_REG_27_ACTIVE_REGISTRY_ORDER_AFTER = Object.freeze([
  "activity",
  "movement",
  "exercise",
  "program",
  "equipment",
  "sport_subdivision",
  "sport_metric"
]);

export const S_REG_27_EXPECTED_DOCUMENT_KEYS = Object.freeze([
  "slice_id",
  "activation_id",
  "decision_type",
  "source_hold_slice_id",
  "source_contract_slice_id",
  "source_candidate_slice_id",
  "runtime_status",
  "activation_decision",
  "activation_target",
  "activated_registry_id",
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
  "covered_required_before_activation",
  "active_registry_order_after",
  "activated_record_count",
  "human_authorisation",
  "active_registry_hashes_before",
  "active_registry_hashes_after",
  "rollback_plan",
  "runtime_parity_proof"
]);

export const S_REG_27_PATHS = Object.freeze({
  activation: "ci/registry/s_reg_27_sport_metric_registry_activation.json",
  source_hold: "ci/registry/s_reg_23_registry_activation_hold_decision.json",
  source_contract: "ci/registry/s_reg_24_registry_activation_contract_design.json",
  registry_index: "registries/registry_index.json",
  registry_bundle: "registries/registry_bundle.json",
  sport_metric_registry: "registries/sport_metric/sport_metric.registry.json"
});

export const S_REG_27_FORBIDDEN_KEYS = Object.freeze([
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
  error.code = S_REG_27_FAILURE_TOKEN;
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

function assertArrayStartsWith(actual, prefix, reason) {
  if (!Array.isArray(actual)) {
    fail(reason, { actual });
  }

  if (JSON.stringify(actual.slice(0, prefix.length)) !== JSON.stringify(prefix)) {
    fail(reason, { actual, expected_prefix: prefix });
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
    if (S_REG_27_FORBIDDEN_KEYS.includes(key)) {
      fail("s_reg_27_forbidden_key_present", { key, path });
    }

    assertNoForbiddenKeys(value[key], `${path}.${key}`);
  }
}

function assertSourceHoldRecordsThisSupersession() {
  const hold = readJson(S_REG_27_PATHS.source_hold);
  assertPlainObject(hold, "s_reg_27_source_hold_invalid");

  if (hold.slice_id !== S_REG_27_SOURCE_HOLD_SLICE_ID || hold.decision_type !== "hold") {
    fail("s_reg_27_source_hold_identity_invalid", { slice_id: hold.slice_id, decision_type: hold.decision_type });
  }

  if (!Array.isArray(hold.superseded_by_slice_ids) || !hold.superseded_by_slice_ids.includes(S_REG_27_SLICE_ID)) {
    fail("s_reg_27_source_hold_missing_supersession_record", { actual: hold.superseded_by_slice_ids });
  }
}

function assertSourceContractRecordsThisSupersession() {
  const contract = readJson(S_REG_27_PATHS.source_contract);
  assertPlainObject(contract, "s_reg_27_source_contract_invalid");

  if (contract.slice_id !== S_REG_27_SOURCE_CONTRACT_SLICE_ID || contract.contract_type !== "design_only") {
    fail("s_reg_27_source_contract_identity_invalid", {
      slice_id: contract.slice_id,
      contract_type: contract.contract_type
    });
  }

  if (!Array.isArray(contract.superseded_by_slice_ids) || !contract.superseded_by_slice_ids.includes(S_REG_27_SLICE_ID)) {
    fail("s_reg_27_source_contract_missing_supersession_record", { actual: contract.superseded_by_slice_ids });
  }
}

function assertActiveRegistrySurfaceExtendedCorrectly() {
  const registryIndex = readJson(S_REG_27_PATHS.registry_index);
  const registryBundle = readJson(S_REG_27_PATHS.registry_bundle);
  const sportMetricRegistry = readJson(S_REG_27_PATHS.sport_metric_registry);

  assertArrayStartsWith(
    registryIndex.order,
    S_REG_27_ACTIVE_REGISTRY_ORDER_AFTER,
    "s_reg_27_active_registry_index_order_invalid"
  );

  assertArrayStartsWith(
    Object.keys(registryBundle.registries),
    S_REG_27_ACTIVE_REGISTRY_ORDER_AFTER,
    "s_reg_27_active_registry_bundle_keys_invalid"
  );

  if (sportMetricRegistry.registry_id !== S_REG_27_ACTIVATED_REGISTRY_ID) {
    fail("s_reg_27_sport_metric_registry_id_invalid", { actual: sportMetricRegistry.registry_id });
  }

  if (!sportMetricRegistry.entries || typeof sportMetricRegistry.entries !== "object") {
    fail("s_reg_27_sport_metric_registry_entries_invalid", { actual: sportMetricRegistry.entries });
  }

  return Object.keys(sportMetricRegistry.entries).length;
}

export function sReg27LoadSportMetricRegistryActivation() {
  return readJson(S_REG_27_PATHS.activation);
}

export function sReg27ValidateSportMetricRegistryActivation({
  activationDocument = sReg27LoadSportMetricRegistryActivation()
} = {}) {
  assertPlainObject(activationDocument, "s_reg_27_activation_document_invalid");
  assertNoForbiddenKeys(activationDocument);
  assertExactArray(
    Object.keys(activationDocument).sort(),
    [...S_REG_27_EXPECTED_DOCUMENT_KEYS].sort(),
    "s_reg_27_activation_document_keys_invalid"
  );

  assertSourceHoldRecordsThisSupersession();
  assertSourceContractRecordsThisSupersession();
  const activatedRecordCount = assertActiveRegistrySurfaceExtendedCorrectly();

  if (activationDocument.slice_id !== S_REG_27_SLICE_ID) {
    fail("s_reg_27_slice_id_invalid", { actual: activationDocument.slice_id });
  }

  if (activationDocument.activation_id !== S_REG_27_ACTIVATION_ID || activationDocument.decision_type !== "activation") {
    fail("s_reg_27_activation_identity_invalid", {
      activation_id: activationDocument.activation_id,
      decision_type: activationDocument.decision_type
    });
  }

  if (
    activationDocument.source_hold_slice_id !== S_REG_27_SOURCE_HOLD_SLICE_ID ||
    activationDocument.source_contract_slice_id !== S_REG_27_SOURCE_CONTRACT_SLICE_ID ||
    activationDocument.source_candidate_slice_id !== S_REG_27_SOURCE_CANDIDATE_SLICE_ID
  ) {
    fail("s_reg_27_source_reference_invalid", {
      source_hold_slice_id: activationDocument.source_hold_slice_id,
      source_contract_slice_id: activationDocument.source_contract_slice_id,
      source_candidate_slice_id: activationDocument.source_candidate_slice_id
    });
  }

  if (activationDocument.runtime_status !== S_REG_27_RUNTIME_STATUS) {
    fail("s_reg_27_runtime_status_invalid", { actual: activationDocument.runtime_status });
  }

  if (activationDocument.activation_decision !== "authorised") {
    fail("s_reg_27_activation_decision_invalid", { actual: activationDocument.activation_decision });
  }

  if (
    activationDocument.activation_target !== S_REG_27_ACTIVATION_TARGET ||
    activationDocument.activated_registry_id !== S_REG_27_ACTIVATED_REGISTRY_ID
  ) {
    fail("s_reg_27_activation_target_invalid", {
      activation_target: activationDocument.activation_target,
      activated_registry_id: activationDocument.activated_registry_id
    });
  }

  for (const flag of S_REG_27_REQUIRED_TRUE_FLAGS) {
    if (activationDocument[flag] !== true) {
      fail("s_reg_27_true_flag_invalid", { flag, actual: activationDocument[flag] });
    }
  }

  for (const flag of S_REG_27_REQUIRED_FALSE_FLAGS) {
    if (activationDocument[flag] !== false) {
      fail("s_reg_27_false_flag_invalid", { flag, actual: activationDocument[flag] });
    }
  }

  assertExactArray(
    activationDocument.covered_required_before_activation,
    S_REG_27_COVERED_REQUIRED_BEFORE_ACTIVATION,
    "s_reg_27_covered_required_before_activation_invalid"
  );

  assertExactArray(
    activationDocument.active_registry_order_after,
    S_REG_27_ACTIVE_REGISTRY_ORDER_AFTER,
    "s_reg_27_active_registry_order_after_invalid"
  );

  if (activationDocument.activated_record_count !== activatedRecordCount) {
    fail("s_reg_27_activated_record_count_invalid", {
      declared: activationDocument.activated_record_count,
      actual: activatedRecordCount
    });
  }

  assertPlainObject(activationDocument.human_authorisation, "s_reg_27_human_authorisation_invalid");
  if (
    typeof activationDocument.human_authorisation.authorised_by !== "string" ||
    activationDocument.human_authorisation.authorised_by.trim() === "" ||
    typeof activationDocument.human_authorisation.authorisation_method !== "string" ||
    activationDocument.human_authorisation.authorisation_method.trim() === "" ||
    typeof activationDocument.human_authorisation.authorised_at_iso8601_date !== "string" ||
    activationDocument.human_authorisation.authorised_at_iso8601_date.trim() === ""
  ) {
    fail("s_reg_27_human_authorisation_invalid", { actual: activationDocument.human_authorisation });
  }

  assertPlainObject(activationDocument.active_registry_hashes_before, "s_reg_27_hashes_before_invalid");
  assertPlainObject(activationDocument.active_registry_hashes_after, "s_reg_27_hashes_after_invalid");
  for (const key of ["registry_index", "registry_bundle"]) {
    if (
      typeof activationDocument.active_registry_hashes_before[key] !== "string" ||
      typeof activationDocument.active_registry_hashes_after[key] !== "string" ||
      activationDocument.active_registry_hashes_before[key] === activationDocument.active_registry_hashes_after[key]
    ) {
      fail("s_reg_27_hashes_invalid", { key });
    }
  }

  assertPlainObject(activationDocument.rollback_plan, "s_reg_27_rollback_plan_invalid");
  if (
    typeof activationDocument.rollback_plan.primary !== "string" ||
    activationDocument.rollback_plan.primary.trim() === "" ||
    typeof activationDocument.rollback_plan.fallback !== "string" ||
    activationDocument.rollback_plan.fallback.trim() === ""
  ) {
    fail("s_reg_27_rollback_plan_invalid", { actual: activationDocument.rollback_plan });
  }

  assertPlainObject(activationDocument.runtime_parity_proof, "s_reg_27_runtime_parity_proof_invalid");
  const parity = activationDocument.runtime_parity_proof;
  if (
    parity.identical !== true ||
    typeof parity.fixture_count !== "number" ||
    parity.fixture_count < 1 ||
    typeof parity.byte_identical_fixture_count !== "number" ||
    !Array.isArray(parity.changed_fixtures) ||
    parity.byte_identical_fixture_count + parity.changed_fixtures.length !== parity.fixture_count
  ) {
    fail("s_reg_27_runtime_parity_proof_invalid", { actual: parity });
  }
  // "identical: true" means no decision/content/compile-output field
  // changed - it does NOT mean every fixture was byte-identical. Any
  // fixture named in changed_fixtures must have an honest, specific reason
  // recorded, not a bare claim.
  if (parity.changed_fixtures.length > 0 && (typeof parity.changed_field !== "string" || parity.changed_field.trim() === "")) {
    fail("s_reg_27_runtime_parity_proof_invalid", { actual: parity });
  }

  return Object.freeze({
    ok: true,
    token: S_REG_27_FAILURE_TOKEN,
    slice_id: S_REG_27_SLICE_ID,
    activation_id: activationDocument.activation_id,
    decision_type: activationDocument.decision_type,
    activation_decision: activationDocument.activation_decision,
    activation_target: activationDocument.activation_target,
    activated_registry_id: activationDocument.activated_registry_id,
    activation_authorised: true,
    activation_ready: true,
    active_registry_activation: true,
    runtime_status: S_REG_27_RUNTIME_STATUS,
    activated_record_count: activatedRecordCount,
    active_registry_order_after: [...activationDocument.active_registry_order_after],
    covered_required_before_activation: [...activationDocument.covered_required_before_activation]
  });
}
