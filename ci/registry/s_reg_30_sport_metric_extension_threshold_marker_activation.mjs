/**
 * DEV NOTE: S-REG-30 registry extension + activation - sport_metric extension
 * and threshold_marker_registry activation.
 * Purpose: the sixth explicit activation slice authorised after S-REG-23's
 * hold and S-REG-24's contract design (S-REG-25 activated equipment,
 * S-REG-26 activated sport_subdivision, S-REG-27 activated sport_metric,
 * S-REG-28 activated sport_role, S-REG-29 activated metric_exercise_link
 * first).
 * Unlike every prior activation in this chain, this is the first slice that
 * mutates the CONTENT of an already-active, previously-merged registry
 * (`sport_metric`) rather than only ever adding new files. It also activates
 * a brand-new domain (`threshold_marker`) whose candidate content (S-REG-21)
 * needed that extension - all 5 threshold_marker candidate records reference
 * sport_metric_ids that did not exist in the live 6-entry sport_metric
 * registry. The 3 needed records (`powerlifting__attempt_count`,
 * `general_strength__set_count`, `general_strength__duration_seconds`) come
 * from S-REG-19's second, never-activated sport_metric expansion batch;
 * S-REG-27 only ever activated the original S-REG-11 seed batch of 6. The
 * other 3 records in that same S-REG-19 batch
 * (`powerlifting__body_mass_kg`, `rugby_union__jump_height_cm`,
 * `rugby_union__sprint_distance_m`) are unreferenced by anything and stay
 * inactive, mirroring the "activate only what's needed and verified"
 * principle from S-REG-29.
 * Boundary: extends the `sport_metric` active registry domain with exactly
 * 3 new entries, and activates the `threshold_marker` active registry
 * domain with all 5 of its candidate records. Must not touch any other
 * candidate domain, mutate registry_law_guard.mjs or any other CI script,
 * alter engine/server/app/web source, create marker evaluator behaviour,
 * compare recorded values, create advice, infer outcomes, alter programme
 * assignment, alter substitution runtime, or create UI behaviour. Nothing
 * consumes the threshold_marker registry, so runtime_status remains
 * non_runtime even though active_registry_activation is now true.
 * Determinism: validates the S-REG-23 hold and S-REG-24 contract both
 * recorded this slice in their append-only supersession logs, the exact
 * activation target/decision identity, before/after registry hashes, the
 * rollback plan, and the runtime parity proof. The live active registry
 * order/bundle-key checks are prefix checks, not exact-match - a later,
 * separately-authorised activation slice may legitimately append further
 * domains after this one. This module also independently validates every
 * threshold_marker record's sport_metric_id against the live (post-
 * extension) sport_metric registry and activity_id against the live
 * activity registry, mirroring S-REG-29's cross-registry validation pattern
 * since no generic guard covers threshold_marker's references.
 * Failure: throws CI_S_REG_30_SPORT_METRIC_EXTENSION_THRESHOLD_MARKER_ACTIVATION.
 */

import fs from "node:fs";

export const S_REG_30_SLICE_ID = "S-REG-30";
export const S_REG_30_FAILURE_TOKEN = "CI_S_REG_30_SPORT_METRIC_EXTENSION_THRESHOLD_MARKER_ACTIVATION";
export const S_REG_30_ACTIVATION_ID = "sport_metric_extension_threshold_marker_activation";
export const S_REG_30_RUNTIME_STATUS = "non_runtime";
export const S_REG_30_SOURCE_HOLD_SLICE_ID = "S-REG-23";
export const S_REG_30_SOURCE_CONTRACT_SLICE_ID = "S-REG-24";
export const S_REG_30_ACTIVATION_TARGET = "threshold_marker_registry";
export const S_REG_30_ACTIVATED_REGISTRY_ID = "threshold_marker";
export const S_REG_30_EXTENDED_REGISTRY_ID = "sport_metric";
export const S_REG_30_SOURCE_CANDIDATE_SLICE_ID_EXTENSION = "S-REG-19";
export const S_REG_30_SOURCE_CANDIDATE_SLICE_ID_ACTIVATION = "S-REG-21";

export const S_REG_30_EXTENDED_RECORD_IDS = Object.freeze([
  "powerlifting__attempt_count",
  "general_strength__set_count",
  "general_strength__duration_seconds"
]);

export const S_REG_30_REQUIRED_TRUE_FLAGS = Object.freeze([
  "activation_authorised",
  "activation_ready",
  "active_registry_activation",
  "active_registry_extension_mutation",
  "active_registry_mutation",
  "active_bundle_mutation",
  "registry_index_mutation",
  "registry_bundle_mutation",
  "registry_seal_mutation"
]);

export const S_REG_30_REQUIRED_FALSE_FLAGS = Object.freeze([
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

export const S_REG_30_COVERED_REQUIRED_BEFORE_ACTIVATION = Object.freeze([
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

export const S_REG_30_ACTIVE_REGISTRY_ORDER_AFTER = Object.freeze([
  "activity",
  "movement",
  "exercise",
  "program",
  "equipment",
  "sport_subdivision",
  "sport_metric",
  "sport_role",
  "metric_exercise_link",
  "threshold_marker"
]);

export const S_REG_30_EXPECTED_DOCUMENT_KEYS = Object.freeze([
  "slice_id",
  "activation_id",
  "decision_type",
  "source_hold_slice_id",
  "source_contract_slice_id",
  "source_candidate_slice_id_extension",
  "source_candidate_slice_id_activation",
  "runtime_status",
  "activation_decision",
  "activation_target",
  "activated_registry_id",
  "extended_registry_id",
  "activation_authorised",
  "activation_ready",
  "active_registry_activation",
  "active_registry_extension_mutation",
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
  "extended_record_count",
  "extended_record_ids",
  "human_authorisation",
  "active_registry_hashes_before",
  "active_registry_hashes_after",
  "rollback_plan",
  "runtime_parity_proof"
]);

export const S_REG_30_PATHS = Object.freeze({
  activation: "ci/registry/s_reg_30_sport_metric_extension_threshold_marker_activation.json",
  source_hold: "ci/registry/s_reg_23_registry_activation_hold_decision.json",
  source_contract: "ci/registry/s_reg_24_registry_activation_contract_design.json",
  registry_index: "registries/registry_index.json",
  registry_bundle: "registries/registry_bundle.json",
  sport_metric_registry: "registries/sport_metric/sport_metric.registry.json",
  threshold_marker_registry: "registries/threshold_marker/threshold_marker.registry.json",
  activity_registry: "registries/activity/activity.registry.json"
});

export const S_REG_30_FORBIDDEN_KEYS = Object.freeze([
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
  error.code = S_REG_30_FAILURE_TOKEN;
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
    if (S_REG_30_FORBIDDEN_KEYS.includes(key)) {
      fail("s_reg_30_forbidden_key_present", { key, path });
    }

    assertNoForbiddenKeys(value[key], `${path}.${key}`);
  }
}

function assertSourceHoldRecordsThisSupersession() {
  const hold = readJson(S_REG_30_PATHS.source_hold);
  assertPlainObject(hold, "s_reg_30_source_hold_invalid");

  if (hold.slice_id !== S_REG_30_SOURCE_HOLD_SLICE_ID || hold.decision_type !== "hold") {
    fail("s_reg_30_source_hold_identity_invalid", { slice_id: hold.slice_id, decision_type: hold.decision_type });
  }

  if (!Array.isArray(hold.superseded_by_slice_ids) || !hold.superseded_by_slice_ids.includes(S_REG_30_SLICE_ID)) {
    fail("s_reg_30_source_hold_missing_supersession_record", { actual: hold.superseded_by_slice_ids });
  }
}

function assertSourceContractRecordsThisSupersession() {
  const contract = readJson(S_REG_30_PATHS.source_contract);
  assertPlainObject(contract, "s_reg_30_source_contract_invalid");

  if (contract.slice_id !== S_REG_30_SOURCE_CONTRACT_SLICE_ID || contract.contract_type !== "design_only") {
    fail("s_reg_30_source_contract_identity_invalid", {
      slice_id: contract.slice_id,
      contract_type: contract.contract_type
    });
  }

  if (!Array.isArray(contract.superseded_by_slice_ids) || !contract.superseded_by_slice_ids.includes(S_REG_30_SLICE_ID)) {
    fail("s_reg_30_source_contract_missing_supersession_record", { actual: contract.superseded_by_slice_ids });
  }
}

function assertSportMetricExtendedCorrectly() {
  const sportMetricRegistry = readJson(S_REG_30_PATHS.sport_metric_registry);

  if (sportMetricRegistry.registry_id !== S_REG_30_EXTENDED_REGISTRY_ID) {
    fail("s_reg_30_sport_metric_registry_id_invalid", { actual: sportMetricRegistry.registry_id });
  }

  for (const sportMetricId of S_REG_30_EXTENDED_RECORD_IDS) {
    if (!(sportMetricId in sportMetricRegistry.entries)) {
      fail("s_reg_30_extended_record_missing", { sport_metric_id: sportMetricId });
    }
  }
}

function assertThresholdMarkerActivatedCorrectly() {
  const registryIndex = readJson(S_REG_30_PATHS.registry_index);
  const registryBundle = readJson(S_REG_30_PATHS.registry_bundle);
  const thresholdMarkerRegistry = readJson(S_REG_30_PATHS.threshold_marker_registry);

  assertArrayStartsWith(
    registryIndex.order,
    S_REG_30_ACTIVE_REGISTRY_ORDER_AFTER,
    "s_reg_30_active_registry_index_order_invalid"
  );

  assertArrayStartsWith(
    Object.keys(registryBundle.registries),
    S_REG_30_ACTIVE_REGISTRY_ORDER_AFTER,
    "s_reg_30_active_registry_bundle_keys_invalid"
  );

  if (thresholdMarkerRegistry.registry_id !== S_REG_30_ACTIVATED_REGISTRY_ID) {
    fail("s_reg_30_threshold_marker_registry_id_invalid", { actual: thresholdMarkerRegistry.registry_id });
  }

  if (!thresholdMarkerRegistry.entries || typeof thresholdMarkerRegistry.entries !== "object") {
    fail("s_reg_30_threshold_marker_registry_entries_invalid", { actual: thresholdMarkerRegistry.entries });
  }

  // REG-FULL-05 supersession-safe historical membership: 5
  const historicalIds = [
    "threshold_marker__powerlifting__attempt_count__gte_1",
    "threshold_marker__powerlifting__attempt_count__lte_3",
    "threshold_marker__general_strength__set_count__gte_1",
    "threshold_marker__general_strength__duration_seconds__gte_60",
    "threshold_marker__general_strength__duration_seconds__lte_3600"
  ];
  for (const id of historicalIds) {
    if (!thresholdMarkerRegistry.entries[id]) fail("s_reg_30_historical_threshold_marker_missing", { id });
  }
  return historicalIds.length;
}

function assertNoDanglingCrossRegistryReferences() {
  const thresholdMarkerRegistry = readJson(S_REG_30_PATHS.threshold_marker_registry);
  const sportMetricRegistry = readJson(S_REG_30_PATHS.sport_metric_registry);
  const activityRegistry = readJson(S_REG_30_PATHS.activity_registry);

  for (const [id, record] of Object.entries(thresholdMarkerRegistry.entries)) {
    if (!(record.sport_metric_id in sportMetricRegistry.entries)) {
      fail("s_reg_30_dangling_sport_metric_reference", { id, sport_metric_id: record.sport_metric_id });
    }

    if (!(record.activity_id in activityRegistry.entries)) {
      fail("s_reg_30_dangling_activity_reference", { id, activity_id: record.activity_id });
    }
  }
}

export function sReg30LoadSportMetricExtensionThresholdMarkerActivation() {
  return readJson(S_REG_30_PATHS.activation);
}

export function sReg30ValidateSportMetricExtensionThresholdMarkerActivation({
  activationDocument = sReg30LoadSportMetricExtensionThresholdMarkerActivation()
} = {}) {
  assertPlainObject(activationDocument, "s_reg_30_activation_document_invalid");
  assertNoForbiddenKeys(activationDocument);
  assertExactArray(
    Object.keys(activationDocument).sort(),
    [...S_REG_30_EXPECTED_DOCUMENT_KEYS].sort(),
    "s_reg_30_activation_document_keys_invalid"
  );

  assertSourceHoldRecordsThisSupersession();
  assertSourceContractRecordsThisSupersession();
  assertSportMetricExtendedCorrectly();
  const activatedRecordCount = assertThresholdMarkerActivatedCorrectly();
  assertNoDanglingCrossRegistryReferences();

  if (activationDocument.slice_id !== S_REG_30_SLICE_ID) {
    fail("s_reg_30_slice_id_invalid", { actual: activationDocument.slice_id });
  }

  if (activationDocument.activation_id !== S_REG_30_ACTIVATION_ID || activationDocument.decision_type !== "activation") {
    fail("s_reg_30_activation_identity_invalid", {
      activation_id: activationDocument.activation_id,
      decision_type: activationDocument.decision_type
    });
  }

  if (
    activationDocument.source_hold_slice_id !== S_REG_30_SOURCE_HOLD_SLICE_ID ||
    activationDocument.source_contract_slice_id !== S_REG_30_SOURCE_CONTRACT_SLICE_ID ||
    activationDocument.source_candidate_slice_id_extension !== S_REG_30_SOURCE_CANDIDATE_SLICE_ID_EXTENSION ||
    activationDocument.source_candidate_slice_id_activation !== S_REG_30_SOURCE_CANDIDATE_SLICE_ID_ACTIVATION
  ) {
    fail("s_reg_30_source_reference_invalid", {
      source_hold_slice_id: activationDocument.source_hold_slice_id,
      source_contract_slice_id: activationDocument.source_contract_slice_id,
      source_candidate_slice_id_extension: activationDocument.source_candidate_slice_id_extension,
      source_candidate_slice_id_activation: activationDocument.source_candidate_slice_id_activation
    });
  }

  if (activationDocument.runtime_status !== S_REG_30_RUNTIME_STATUS) {
    fail("s_reg_30_runtime_status_invalid", { actual: activationDocument.runtime_status });
  }

  if (activationDocument.activation_decision !== "authorised") {
    fail("s_reg_30_activation_decision_invalid", { actual: activationDocument.activation_decision });
  }

  if (
    activationDocument.activation_target !== S_REG_30_ACTIVATION_TARGET ||
    activationDocument.activated_registry_id !== S_REG_30_ACTIVATED_REGISTRY_ID ||
    activationDocument.extended_registry_id !== S_REG_30_EXTENDED_REGISTRY_ID
  ) {
    fail("s_reg_30_activation_target_invalid", {
      activation_target: activationDocument.activation_target,
      activated_registry_id: activationDocument.activated_registry_id,
      extended_registry_id: activationDocument.extended_registry_id
    });
  }

  for (const flag of S_REG_30_REQUIRED_TRUE_FLAGS) {
    if (activationDocument[flag] !== true) {
      fail("s_reg_30_true_flag_invalid", { flag, actual: activationDocument[flag] });
    }
  }

  for (const flag of S_REG_30_REQUIRED_FALSE_FLAGS) {
    if (activationDocument[flag] !== false) {
      fail("s_reg_30_false_flag_invalid", { flag, actual: activationDocument[flag] });
    }
  }

  assertExactArray(
    activationDocument.covered_required_before_activation,
    S_REG_30_COVERED_REQUIRED_BEFORE_ACTIVATION,
    "s_reg_30_covered_required_before_activation_invalid"
  );

  assertExactArray(
    activationDocument.active_registry_order_after,
    S_REG_30_ACTIVE_REGISTRY_ORDER_AFTER,
    "s_reg_30_active_registry_order_after_invalid"
  );

  assertExactArray(
    activationDocument.extended_record_ids,
    S_REG_30_EXTENDED_RECORD_IDS,
    "s_reg_30_extended_record_ids_invalid"
  );

  if (activationDocument.extended_record_count !== S_REG_30_EXTENDED_RECORD_IDS.length) {
    fail("s_reg_30_extended_record_count_invalid", {
      declared: activationDocument.extended_record_count,
      expected: S_REG_30_EXTENDED_RECORD_IDS.length
    });
  }

  if (activationDocument.activated_record_count !== activatedRecordCount) {
    fail("s_reg_30_activated_record_count_invalid", {
      declared: activationDocument.activated_record_count,
      actual: activatedRecordCount
    });
  }

  assertPlainObject(activationDocument.human_authorisation, "s_reg_30_human_authorisation_invalid");
  if (
    typeof activationDocument.human_authorisation.authorised_by !== "string" ||
    activationDocument.human_authorisation.authorised_by.trim() === "" ||
    typeof activationDocument.human_authorisation.authorisation_method !== "string" ||
    activationDocument.human_authorisation.authorisation_method.trim() === "" ||
    typeof activationDocument.human_authorisation.authorised_at_iso8601_date !== "string" ||
    activationDocument.human_authorisation.authorised_at_iso8601_date.trim() === ""
  ) {
    fail("s_reg_30_human_authorisation_invalid", { actual: activationDocument.human_authorisation });
  }

  assertPlainObject(activationDocument.active_registry_hashes_before, "s_reg_30_hashes_before_invalid");
  assertPlainObject(activationDocument.active_registry_hashes_after, "s_reg_30_hashes_after_invalid");
  for (const key of ["registry_index", "registry_bundle"]) {
    if (
      typeof activationDocument.active_registry_hashes_before[key] !== "string" ||
      typeof activationDocument.active_registry_hashes_after[key] !== "string" ||
      activationDocument.active_registry_hashes_before[key] === activationDocument.active_registry_hashes_after[key]
    ) {
      fail("s_reg_30_hashes_invalid", { key });
    }
  }

  assertPlainObject(activationDocument.rollback_plan, "s_reg_30_rollback_plan_invalid");
  if (
    typeof activationDocument.rollback_plan.primary !== "string" ||
    activationDocument.rollback_plan.primary.trim() === "" ||
    typeof activationDocument.rollback_plan.fallback !== "string" ||
    activationDocument.rollback_plan.fallback.trim() === ""
  ) {
    fail("s_reg_30_rollback_plan_invalid", { actual: activationDocument.rollback_plan });
  }

  assertPlainObject(activationDocument.runtime_parity_proof, "s_reg_30_runtime_parity_proof_invalid");
  const parity = activationDocument.runtime_parity_proof;
  if (
    parity.identical !== true ||
    typeof parity.fixture_count !== "number" ||
    parity.fixture_count < 1 ||
    typeof parity.byte_identical_fixture_count !== "number" ||
    !Array.isArray(parity.changed_fixtures) ||
    parity.byte_identical_fixture_count + parity.changed_fixtures.length !== parity.fixture_count
  ) {
    fail("s_reg_30_runtime_parity_proof_invalid", { actual: parity });
  }
  // "identical: true" means no decision/content/compile-output field
  // changed - it does NOT mean every fixture was byte-identical. Any
  // fixture named in changed_fixtures must have an honest, specific reason
  // recorded, not a bare claim.
  if (parity.changed_fixtures.length > 0 && (typeof parity.changed_field !== "string" || parity.changed_field.trim() === "")) {
    fail("s_reg_30_runtime_parity_proof_invalid", { actual: parity });
  }

  return Object.freeze({
    ok: true,
    token: S_REG_30_FAILURE_TOKEN,
    slice_id: S_REG_30_SLICE_ID,
    activation_id: activationDocument.activation_id,
    decision_type: activationDocument.decision_type,
    activation_decision: activationDocument.activation_decision,
    activation_target: activationDocument.activation_target,
    activated_registry_id: activationDocument.activated_registry_id,
    extended_registry_id: activationDocument.extended_registry_id,
    activation_authorised: true,
    activation_ready: true,
    active_registry_activation: true,
    runtime_status: S_REG_30_RUNTIME_STATUS,
    activated_record_count: activatedRecordCount,
    extended_record_count: activationDocument.extended_record_count,
    extended_record_ids: [...activationDocument.extended_record_ids],
    active_registry_order_after: [...activationDocument.active_registry_order_after],
    covered_required_before_activation: [...activationDocument.covered_required_before_activation]
  });
}
