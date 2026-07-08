/**
 * DEV NOTE: S-REG-22 candidate registry build review.
 * Purpose: records the final inert review gate after S-REG-15 through S-REG-21
 * candidate content batches have been created and proven.
 * Boundary: review gate only. This module must not activate registries, mutate
 * registry law, mutate the registry bundle, alter deterministic engine output,
 * add marker evaluator behaviour, compare recorded values, create advice, infer
 * outcomes, alter programme assignment, alter substitution runtime, or create UI
 * behaviour.
 * Determinism: validates fixed S-REG-14 queue order, fixed dependency inputs,
 * candidate batch record counts, active registry compactness, and false mutation
 * flags.
 * Failure: throws CI_S_REG_22_CANDIDATE_REGISTRY_BUILD_REVIEW.
 */

import fs from "node:fs";

export const S_REG_22_SLICE_ID = "S-REG-22";
export const S_REG_22_FAILURE_TOKEN = "CI_S_REG_22_CANDIDATE_REGISTRY_BUILD_REVIEW";
export const S_REG_22_BATCH_ID = "candidate_registry_review_and_activation_gate";
export const S_REG_22_REGISTRY_TARGET = "candidate_registry_review_gate";
export const S_REG_22_RUNTIME_STATUS = "non_runtime";
export const S_REG_22_REVIEW_STATUS = "candidate_reviewed_fk_closed_pending_activation_decision";

export const S_REG_22_DEPENDENCY_INPUTS = Object.freeze([
  "S-REG-15",
  "S-REG-16",
  "S-REG-17",
  "S-REG-18",
  "S-REG-19",
  "S-REG-20",
  "S-REG-21"
]);

export const S_REG_22_COMPACT_ACTIVE_REGISTRY_ORDER = Object.freeze([
  "activity",
  "movement",
  "exercise",
  "program"
]);

export const S_REG_22_REQUIRED_FALSE_FLAGS = Object.freeze([
  "activation_ready",
  "active_registry_activation",
  "active_registry_mutation",
  "active_bundle_mutation",
  "registry_law_mutation",
  "engine_runtime_mutation",
  "phase1_runtime_schema_mutation",
  "high_volume_content_added",
  "complete_registry_claim",
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

export const S_REG_22_EXPECTED_DOCUMENT_KEYS = Object.freeze([
  "slice_id",
  "review_id",
  "batch_id",
  "registry_target",
  "source_queue_slice_id",
  "source_queue_order",
  "dependency_inputs",
  "candidate_review_status",
  "runtime_status",
  "activation_ready",
  "active_registry_activation",
  "active_registry_mutation",
  "active_bundle_mutation",
  "registry_law_mutation",
  "engine_runtime_mutation",
  "phase1_runtime_schema_mutation",
  "high_volume_content_added",
  "complete_registry_claim",
  "marker_evaluator_mutation",
  "comparison_result_mutation",
  "recorded_value_input_mutation",
  "advice_mutation",
  "outcome_inference_mutation",
  "programme_assignment_mutation",
  "substitution_runtime_mutation",
  "ui_behaviour_mutation",
  "coach_interpretation_mutation",
  "activation_decision",
  "later_activation_requirement",
  "active_registry_hashes_observed",
  "reviewed_candidate_batches",
  "review_findings",
  "next_step_after_review"
]);

export const S_REG_22_EXPECTED_CANDIDATE_BATCHES = Object.freeze([
  {
    slice_id: "S-REG-15",
    registry_id: "exercise_registry_3a",
    batch_id: "candidate_exercise_registry_content_expansion_batch_1",
    path: "ci/registry/s_reg_15_candidate_exercise_registry_content_batch_1.json",
    record_count: 6
  },
  {
    slice_id: "S-REG-16",
    registry_id: "equipment_registry",
    batch_id: "candidate_equipment_registry_content_expansion_batch_1",
    path: "ci/registry/s_reg_16_candidate_equipment_registry_content_batch_1.json",
    record_count: 6
  },
  {
    slice_id: "S-REG-17",
    registry_id: "exercise_equipment_fk_closure",
    batch_id: "candidate_exercise_equipment_fk_closure_expansion_batch_1",
    path: "ci/registry/s_reg_17_exercise_equipment_candidate_fk_closure_expansion.json",
    record_count: 20
  },
  {
    slice_id: "S-REG-18",
    registry_id: "exercise_activity_applicability_registry",
    batch_id: "candidate_exercise_activity_applicability_expansion_batch_1",
    path: "ci/registry/s_reg_18_exercise_activity_applicability_candidate_expansion.json",
    record_count: 18
  },
  {
    slice_id: "S-REG-19",
    registry_id: "sport_metric_registry_1c",
    batch_id: "candidate_sport_metric_expansion_batch_1",
    path: "ci/registry/s_reg_19_sport_metric_candidate_expansion.json",
    record_count: 6
  },
  {
    slice_id: "S-REG-20",
    registry_id: "metric_exercise_link_registry_1c_a",
    batch_id: "candidate_metric_exercise_link_expansion_batch_1",
    path: "ci/registry/s_reg_20_metric_exercise_link_candidate_expansion.json",
    record_count: 8
  },
  {
    slice_id: "S-REG-21",
    registry_id: "threshold_marker_registry",
    batch_id: "candidate_threshold_marker_records_batch_1",
    path: "ci/registry/s_reg_21_threshold_marker_candidate_records.json",
    record_count: 5
  }
]);

export const S_REG_22_PATHS = Object.freeze({
  review: "ci/registry/s_reg_22_candidate_registry_build_review.json",
  s_reg_14_manifest: "ci/registry/s_reg_14_registry_build_readiness_start_gate_manifest.json",
  registry_index: "registries/registry_index.json",
  registry_bundle: "registries/registry_bundle.json"
});

export const S_REG_22_FORBIDDEN_REVIEW_KEYS = Object.freeze([
  "records",
  "seed_records",
  "active_registry_records",
  "registry_bundle",
  "registry_index",
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
  "readiness",
  "safety",
  "suitability",
  "capability",
  "tactical",
  "recommendation",
  "optimisation",
  "optimization",
  "ranking",
  "outcome"
]);

function fail(reason, details = {}) {
  const error = new Error(reason);
  error.code = S_REG_22_FAILURE_TOKEN;
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
    if (S_REG_22_FORBIDDEN_REVIEW_KEYS.includes(key)) {
      fail("s_reg_22_forbidden_review_key_present", { key, path });
    }

    assertNoForbiddenKeys(value[key], `${path}.${key}`);
  }
}

function assertActiveRegistrySurfaceUnchanged() {
  const registryIndex = readJson(S_REG_22_PATHS.registry_index);
  const registryBundle = readJson(S_REG_22_PATHS.registry_bundle);

  assertExactArray(
    registryIndex.order,
    S_REG_22_COMPACT_ACTIVE_REGISTRY_ORDER,
    "s_reg_22_active_registry_index_order_changed"
  );

  assertExactArray(
    Object.keys(registryBundle.registries),
    S_REG_22_COMPACT_ACTIVE_REGISTRY_ORDER,
    "s_reg_22_active_registry_bundle_keys_changed"
  );
}

function assertQueueAlignment() {
  const manifest = readJson(S_REG_22_PATHS.s_reg_14_manifest);
  assertPlainObject(manifest, "s_reg_22_s_reg_14_manifest_invalid");

  if (!Array.isArray(manifest.candidate_build_queue)) {
    fail("s_reg_22_s_reg_14_queue_missing");
  }

  const queueEntry = manifest.candidate_build_queue.find((entry) => entry.slice_id === S_REG_22_SLICE_ID);

  if (!queueEntry) {
    fail("s_reg_22_queue_entry_missing");
  }

  if (queueEntry.order !== 8) {
    fail("s_reg_22_queue_order_invalid", { order: queueEntry.order });
  }

  if (queueEntry.batch_id !== S_REG_22_BATCH_ID) {
    fail("s_reg_22_queue_batch_id_invalid", { batch_id: queueEntry.batch_id });
  }

  if (queueEntry.registry_target !== S_REG_22_REGISTRY_TARGET) {
    fail("s_reg_22_queue_registry_target_invalid", { registry_target: queueEntry.registry_target });
  }

  assertExactArray(
    queueEntry.dependency_inputs,
    S_REG_22_DEPENDENCY_INPUTS,
    "s_reg_22_queue_dependency_inputs_invalid"
  );

  if (queueEntry.proof_command !== "npm.cmd run proof:s-reg-22") {
    fail("s_reg_22_queue_proof_command_invalid", { proof_command: queueEntry.proof_command });
  }

  if (queueEntry.content_status_after_slice !== S_REG_22_REVIEW_STATUS) {
    fail("s_reg_22_queue_content_status_invalid", { content_status_after_slice: queueEntry.content_status_after_slice });
  }
}

function assertCandidateDocumentMatchesExpected(expected) {
  const document = readJson(expected.path);

  assertPlainObject(document, "s_reg_22_candidate_document_invalid");

  if (document.slice_id !== expected.slice_id) {
    fail("s_reg_22_candidate_slice_id_invalid", { expected, actual: document.slice_id });
  }

  if (document.registry_id !== expected.registry_id) {
    fail("s_reg_22_candidate_registry_id_invalid", { expected, actual: document.registry_id });
  }

  if (document.batch_id !== expected.batch_id) {
    fail("s_reg_22_candidate_batch_id_invalid", { expected, actual: document.batch_id });
  }

  if (document.runtime_status !== S_REG_22_RUNTIME_STATUS) {
    fail("s_reg_22_candidate_runtime_status_invalid", { expected, actual: document.runtime_status });
  }

  if (document.activation_ready !== false) {
    fail("s_reg_22_candidate_activation_ready_invalid", { expected, actual: document.activation_ready });
  }

  if (document.active_registry_mutation !== false) {
    fail("s_reg_22_candidate_active_registry_mutation_invalid", { expected, actual: document.active_registry_mutation });
  }

  if (document.active_bundle_mutation !== false) {
    fail("s_reg_22_candidate_active_bundle_mutation_invalid", { expected, actual: document.active_bundle_mutation });
  }

  if (document.registry_law_mutation !== false) {
    fail("s_reg_22_candidate_registry_law_mutation_invalid", { expected, actual: document.registry_law_mutation });
  }

  if (!Array.isArray(document.records)) {
    fail("s_reg_22_candidate_records_missing", { expected });
  }

  if (document.record_count !== expected.record_count || document.records.length !== expected.record_count) {
    fail("s_reg_22_candidate_record_count_invalid", {
      expected,
      record_count: document.record_count,
      records_length: document.records.length
    });
  }

  return Object.freeze({
    slice_id: document.slice_id,
    registry_id: document.registry_id,
    batch_id: document.batch_id,
    record_count: document.record_count,
    runtime_status: document.runtime_status,
    activation_ready: document.activation_ready
  });
}

function assertReviewBatchMatchesCandidate(reviewBatch, expected, candidateSummary) {
  assertPlainObject(reviewBatch, "s_reg_22_review_batch_invalid");

  if (reviewBatch.slice_id !== expected.slice_id) {
    fail("s_reg_22_review_batch_slice_id_invalid", { reviewBatch, expected });
  }

  if (reviewBatch.registry_id !== expected.registry_id) {
    fail("s_reg_22_review_batch_registry_id_invalid", { reviewBatch, expected });
  }

  if (reviewBatch.batch_id !== expected.batch_id) {
    fail("s_reg_22_review_batch_batch_id_invalid", { reviewBatch, expected });
  }

  if (reviewBatch.record_count !== expected.record_count || reviewBatch.record_count !== candidateSummary.record_count) {
    fail("s_reg_22_review_batch_record_count_invalid", { reviewBatch, expected, candidateSummary });
  }

  if (reviewBatch.review_status !== "reviewed_inert_fk_closed") {
    fail("s_reg_22_review_batch_status_invalid", { reviewBatch });
  }

  if (reviewBatch.activation_ready !== false) {
    fail("s_reg_22_review_batch_activation_ready_invalid", { reviewBatch });
  }

  if (reviewBatch.runtime_status !== S_REG_22_RUNTIME_STATUS) {
    fail("s_reg_22_review_batch_runtime_status_invalid", { reviewBatch });
  }
}

function assertReviewFindings(document) {
  const requiredTrueFindings = Object.freeze([
    "candidate_batches_present",
    "candidate_batch_order_matches_s_reg_14",
    "dependency_inputs_present",
    "candidate_docs_runtime_inert",
    "candidate_docs_activation_ready_false",
    "candidate_docs_record_counts_match_records",
    "active_registry_index_unchanged",
    "active_registry_bundle_unchanged",
    "activation_gate_remains_blocked_pending_later_slice"
  ]);

  assertPlainObject(document.review_findings, "s_reg_22_review_findings_invalid");

  for (const finding of requiredTrueFindings) {
    if (document.review_findings[finding] !== true) {
      fail("s_reg_22_review_required_true_finding_invalid", { finding, actual: document.review_findings[finding] });
    }
  }

  if (document.review_findings.active_registry_activation_authorised !== false) {
    fail("s_reg_22_review_activation_authorised_invalid", {
      actual: document.review_findings.active_registry_activation_authorised
    });
  }
}

export function sReg22LoadCandidateRegistryBuildReview() {
  return readJson(S_REG_22_PATHS.review);
}

export function sReg22ValidateCandidateRegistryBuildReview({
  reviewDocument = sReg22LoadCandidateRegistryBuildReview()
} = {}) {
  assertPlainObject(reviewDocument, "s_reg_22_review_document_invalid");
  assertNoForbiddenKeys(reviewDocument);
  assertExactKeys(reviewDocument, S_REG_22_EXPECTED_DOCUMENT_KEYS, "s_reg_22_review_document_keys_invalid");
  assertActiveRegistrySurfaceUnchanged();
  assertQueueAlignment();

  if (reviewDocument.slice_id !== S_REG_22_SLICE_ID) {
    fail("s_reg_22_slice_id_invalid", { actual: reviewDocument.slice_id });
  }

  if (reviewDocument.review_id !== S_REG_22_BATCH_ID || reviewDocument.batch_id !== S_REG_22_BATCH_ID) {
    fail("s_reg_22_review_or_batch_id_invalid", {
      review_id: reviewDocument.review_id,
      batch_id: reviewDocument.batch_id
    });
  }

  if (reviewDocument.registry_target !== S_REG_22_REGISTRY_TARGET) {
    fail("s_reg_22_registry_target_invalid", { actual: reviewDocument.registry_target });
  }

  if (reviewDocument.source_queue_slice_id !== "S-REG-14" || reviewDocument.source_queue_order !== 8) {
    fail("s_reg_22_queue_reference_invalid", {
      source_queue_slice_id: reviewDocument.source_queue_slice_id,
      source_queue_order: reviewDocument.source_queue_order
    });
  }

  assertExactArray(
    reviewDocument.dependency_inputs,
    S_REG_22_DEPENDENCY_INPUTS,
    "s_reg_22_dependency_inputs_invalid"
  );

  if (reviewDocument.candidate_review_status !== S_REG_22_REVIEW_STATUS) {
    fail("s_reg_22_review_status_invalid", { actual: reviewDocument.candidate_review_status });
  }

  if (reviewDocument.runtime_status !== S_REG_22_RUNTIME_STATUS) {
    fail("s_reg_22_runtime_status_invalid", { actual: reviewDocument.runtime_status });
  }

  for (const flag of S_REG_22_REQUIRED_FALSE_FLAGS) {
    if (reviewDocument[flag] !== false) {
      fail("s_reg_22_false_flag_invalid", { flag, actual: reviewDocument[flag] });
    }
  }

  if (reviewDocument.activation_decision !== "not_authorised_pending_later_explicit_activation_slice") {
    fail("s_reg_22_activation_decision_invalid", { actual: reviewDocument.activation_decision });
  }

  if (reviewDocument.later_activation_requirement !== "separate_explicit_activation_slice_required") {
    fail("s_reg_22_later_activation_requirement_invalid", { actual: reviewDocument.later_activation_requirement });
  }

  if (!Array.isArray(reviewDocument.reviewed_candidate_batches)) {
    fail("s_reg_22_reviewed_candidate_batches_invalid");
  }

  assertExactArray(
    reviewDocument.reviewed_candidate_batches.map((batch) => batch.slice_id),
    S_REG_22_DEPENDENCY_INPUTS,
    "s_reg_22_reviewed_candidate_batch_order_invalid"
  );

  const candidateSummaries = S_REG_22_EXPECTED_CANDIDATE_BATCHES.map((expected, index) => {
    const summary = assertCandidateDocumentMatchesExpected(expected);
    assertReviewBatchMatchesCandidate(reviewDocument.reviewed_candidate_batches[index], expected, summary);
    return summary;
  });

  assertReviewFindings(reviewDocument);

  return Object.freeze({
    ok: true,
    token: S_REG_22_FAILURE_TOKEN,
    slice_id: S_REG_22_SLICE_ID,
    review_id: reviewDocument.review_id,
    batch_id: reviewDocument.batch_id,
    registry_target: reviewDocument.registry_target,
    dependency_inputs: [...reviewDocument.dependency_inputs],
    reviewed_candidate_batch_count: reviewDocument.reviewed_candidate_batches.length,
    reviewed_candidate_record_count: reviewDocument.reviewed_candidate_batches.reduce((sum, batch) => sum + batch.record_count, 0),
    candidate_summaries: candidateSummaries,
    candidate_review_status: reviewDocument.candidate_review_status,
    activation_ready: false,
    active_registry_activation: false,
    runtime_status: S_REG_22_RUNTIME_STATUS,
    activation_decision: reviewDocument.activation_decision,
    later_activation_requirement: reviewDocument.later_activation_requirement
  });
}