import fs from "node:fs";
import path from "node:path";

/**
 * DEV NOTE: S-REG-14 registry build-readiness start gate.
 * Purpose: records the final inert start gate before candidate registry content
 * production begins.
 * Boundary: this module creates no candidate records and performs no active
 * registry activation. It records dependency closure, build queue order, ready
 * build targets, blocked build targets, and the exact handoff into later S-REG
 * content batches.
 * Determinism: all registry targets, dependency states, batch ids, proof
 * commands, and non-scope boundaries are closed and validated in stable order.
 * Failure: throws CI_S_REG_14_REGISTRY_BUILD_READINESS_START_GATE.
 */

export const S_REG_14_FAILURE_TOKEN = "CI_S_REG_14_REGISTRY_BUILD_READINESS_START_GATE";
export const S_REG_14_SLICE_ID = "S-REG-14";
export const S_REG_14_RUNTIME_STATUS = "non_runtime";
export const S_REG_14_GATE_STATUS = "build_readiness_record_only";
export const S_REG_14_CONTENT_PRODUCTION_STATUS = "not_started";
export const S_REG_14_ACTIVATION_READY = false;

export const S_REG_14_COMPACT_ACTIVE_REGISTRY_ORDER = Object.freeze([
  "activity",
  "movement",
  "exercise",
  "program"
]);

export const S_REG_14_COMPLETED_FOUNDATION = Object.freeze([
  {
    slice_id: "S-REG-04",
    foundation: "legacy_to_canonical_registry_loader_bridge",
    status: "complete",
    runtime_status: "non_runtime_boundary",
    dependency_status: "closed"
  },
  {
    slice_id: "S-REG-05",
    foundation: "canonical_registry_contract_candidate_surface",
    status: "complete",
    runtime_status: "non_runtime",
    dependency_status: "closed"
  },
  {
    slice_id: "S-REG-06",
    foundation: "activity_movement_exercise_token_exercise_candidate_seeds",
    status: "complete",
    runtime_status: "non_runtime",
    dependency_status: "closed"
  },
  {
    slice_id: "S-REG-07",
    foundation: "equipment_candidate_seeds",
    status: "complete",
    runtime_status: "non_runtime",
    dependency_status: "closed"
  },
  {
    slice_id: "S-REG-08",
    foundation: "exercise_equipment_fk_closure",
    status: "complete",
    runtime_status: "non_runtime",
    dependency_status: "closed"
  },
  {
    slice_id: "S-REG-09",
    foundation: "exercise_activity_applicability_candidate_seeds",
    status: "complete",
    runtime_status: "non_runtime",
    dependency_status: "closed"
  },
  {
    slice_id: "S-REG-10",
    foundation: "sport_subdivision_and_sport_role_candidate_seeds",
    status: "complete",
    runtime_status: "non_runtime",
    dependency_status: "closed"
  },
  {
    slice_id: "S-REG-11",
    foundation: "sport_metric_candidate_seeds",
    status: "complete",
    runtime_status: "non_runtime",
    dependency_status: "closed"
  },
  {
    slice_id: "S-REG-12",
    foundation: "metric_exercise_link_candidate_seeds",
    status: "complete",
    runtime_status: "non_runtime",
    dependency_status: "closed"
  },
  {
    slice_id: "S-REG-13",
    foundation: "threshold_marker_candidate_boundary_contract",
    status: "complete",
    runtime_status: "non_runtime",
    dependency_status: "closed"
  }
]);

export const S_REG_14_READY_TO_BUILD_NOW = Object.freeze([
  {
    registry_id: "exercise_registry_3a",
    build_target: "candidate_exercise_registry_content_expansion",
    ready_status: "ready_to_build_candidate_content",
    dependency_inputs: ["S-REG-06", "S-REG-08", "S-REG-09"],
    activation_ready: false
  },
  {
    registry_id: "equipment_registry",
    build_target: "candidate_equipment_registry_content_expansion",
    ready_status: "ready_to_build_candidate_content",
    dependency_inputs: ["S-REG-07", "S-REG-08"],
    activation_ready: false
  },
  {
    registry_id: "exercise_equipment_fk_closure",
    build_target: "candidate_exercise_equipment_fk_closure_expansion",
    ready_status: "ready_to_build_candidate_content",
    dependency_inputs: ["S-REG-06", "S-REG-07", "S-REG-08"],
    activation_ready: false
  },
  {
    registry_id: "exercise_activity_applicability_registry",
    build_target: "candidate_exercise_activity_applicability_expansion",
    ready_status: "ready_to_build_candidate_content",
    dependency_inputs: ["S-REG-06", "S-REG-09", "S-REG-10"],
    activation_ready: false
  },
  {
    registry_id: "sport_metric_registry_1c",
    build_target: "candidate_sport_metric_content_expansion",
    ready_status: "ready_to_build_candidate_content",
    dependency_inputs: ["S-REG-10", "S-REG-11"],
    activation_ready: false
  },
  {
    registry_id: "metric_exercise_link_registry_1c_a",
    build_target: "candidate_metric_exercise_link_expansion",
    ready_status: "ready_to_build_candidate_content",
    dependency_inputs: ["S-REG-11", "S-REG-12"],
    activation_ready: false
  }
]);

export const S_REG_14_BLOCKED_UNTIL_LATER = Object.freeze([
  {
    registry_id: "threshold_marker_registry",
    blocked_status: "blocked_until_metric_and_link_foundation_strengthened",
    unblock_after: ["S-REG-19", "S-REG-20"],
    reason: "Threshold marker records require stronger sport metric and metric-exercise link candidate foundations before any threshold marker candidate records are created.",
    activation_ready: false
  },
  {
    registry_id: "canonical_registry_activation_gate",
    blocked_status: "blocked_until_candidate_content_reviewed_and_fk_closed",
    unblock_after: ["S-REG-22"],
    reason: "No activation gate can run until candidate content has been reviewed, FK-closed, and proven inert.",
    activation_ready: false
  }
]);

export const S_REG_14_BUILD_QUEUE = Object.freeze([
  {
    order: 1,
    slice_id: "S-REG-15",
    batch_id: "candidate_exercise_registry_content_expansion_batch_1",
    registry_target: "exercise_registry_3a",
    dependency_inputs: ["S-REG-06", "S-REG-08", "S-REG-09"],
    proof_command: "npm.cmd run proof:s-reg-15",
    non_scope_boundary: "No active registry activation, no programme templates, no substitution behaviour, no advice, no interpretation, no broad sports expansion.",
    content_status_after_slice: "candidate_content_expanded_inert"
  },
  {
    order: 2,
    slice_id: "S-REG-16",
    batch_id: "candidate_equipment_registry_content_expansion_batch_1",
    registry_target: "equipment_registry",
    dependency_inputs: ["S-REG-07", "S-REG-15"],
    proof_command: "npm.cmd run proof:s-reg-16",
    non_scope_boundary: "No active registry activation, no equipment recommendation, no facility/gym/organisation runtime, no marketplace equipment logic.",
    content_status_after_slice: "candidate_content_expanded_inert"
  },
  {
    order: 3,
    slice_id: "S-REG-17",
    batch_id: "candidate_exercise_equipment_fk_closure_expansion_batch_1",
    registry_target: "exercise_equipment_fk_closure",
    dependency_inputs: ["S-REG-15", "S-REG-16"],
    proof_command: "npm.cmd run proof:s-reg-17",
    non_scope_boundary: "No active registry activation, no substitution behaviour, no fallback logic, no equipment advice.",
    content_status_after_slice: "candidate_fk_closure_expanded_inert"
  },
  {
    order: 4,
    slice_id: "S-REG-18",
    batch_id: "candidate_exercise_activity_applicability_expansion_batch_1",
    registry_target: "exercise_activity_applicability_registry",
    dependency_inputs: ["S-REG-10", "S-REG-15", "S-REG-17"],
    proof_command: "npm.cmd run proof:s-reg-18",
    non_scope_boundary: "No recommendation, no ranking, no capability inference, no tactical interpretation, no active registry activation.",
    content_status_after_slice: "candidate_content_expanded_inert"
  },
  {
    order: 5,
    slice_id: "S-REG-19",
    batch_id: "candidate_sport_metric_expansion_batch_1",
    registry_target: "sport_metric_registry_1c",
    dependency_inputs: ["S-REG-10", "S-REG-11", "S-REG-18"],
    proof_command: "npm.cmd run proof:s-reg-19",
    non_scope_boundary: "Factual metrics only. No scoring, no readiness semantics, no safety semantics, no suitability semantics, no outcome inference.",
    content_status_after_slice: "candidate_content_expanded_inert"
  },
  {
    order: 6,
    slice_id: "S-REG-20",
    batch_id: "candidate_metric_exercise_link_expansion_batch_1",
    registry_target: "metric_exercise_link_registry_1c_a",
    dependency_inputs: ["S-REG-15", "S-REG-19"],
    proof_command: "npm.cmd run proof:s-reg-20",
    non_scope_boundary: "Factual metric-to-exercise links only. No evaluator, no threshold records, no comparison result, no advice.",
    content_status_after_slice: "candidate_content_expanded_inert"
  },
  {
    order: 7,
    slice_id: "S-REG-21",
    batch_id: "candidate_threshold_marker_records_batch_1",
    registry_target: "threshold_marker_registry",
    dependency_inputs: ["S-REG-13", "S-REG-19", "S-REG-20"],
    proof_command: "npm.cmd run proof:s-reg-21",
    non_scope_boundary: "Threshold marker candidate records only after stronger metric/link foundations. No marker evaluator, no real comparison, no advice, no outcome inference.",
    content_status_after_slice: "candidate_content_expanded_inert"
  },
  {
    order: 8,
    slice_id: "S-REG-22",
    batch_id: "candidate_registry_review_and_activation_gate",
    registry_target: "candidate_registry_review_gate",
    dependency_inputs: ["S-REG-15", "S-REG-16", "S-REG-17", "S-REG-18", "S-REG-19", "S-REG-20", "S-REG-21"],
    proof_command: "npm.cmd run proof:s-reg-22",
    non_scope_boundary: "Review gate only. No active registry activation unless a later explicit activation slice authorises it.",
    content_status_after_slice: "candidate_reviewed_fk_closed_pending_activation_decision"
  }
]);

export const S_REG_14_FORBIDDEN_FIELDS = Object.freeze([
  "records",
  "seed_records",
  "candidate_records_created",
  "active_registry_activation",
  "registry_bundle_mutation",
  "engine_runtime_change",
  "marker_evaluator",
  "programme_template_formula",
  "substitution_runtime_change",
  "recommendation",
  "ranking",
  "optimisation",
  "readiness_status",
  "safety_status",
  "suitability_status",
  "capability_score",
  "tactical_status",
  "return_to_play_status",
  "outcome_inference"
]);

export const S_REG_14_CONTRACT_PATHS = Object.freeze({
  manifest: "ci/registry/s_reg_14_registry_build_readiness_start_gate_manifest.json",
  doc: "docs/roadmap/S_REG_14_REGISTRY_BUILD_READINESS_START_GATE.md",
  registry_index: "registries/registry_index.json",
  registry_bundle: "registries/registry_bundle.json"
});

const requiredManifestKeys = Object.freeze([
  "slice_id",
  "gate_status",
  "runtime_status",
  "activation_ready",
  "content_production_status",
  "active_registry_surface",
  "completed_foundation",
  "dependency_closure_map",
  "ready_to_build_now",
  "blocked_until_later",
  "candidate_build_queue",
  "forbidden_fields",
  "non_scope",
  "proof"
]);

function fail(reason, details = {}) {
  const error = new Error(reason);
  error.code = S_REG_14_FAILURE_TOKEN;
  error.reason = reason;
  error.details = details;
  throw error;
}

function repoPath(relativePath) {
  return path.join(process.cwd(), relativePath);
}

function readJson(relativePath) {
  try {
    return JSON.parse(fs.readFileSync(repoPath(relativePath), "utf8"));
  } catch (error) {
    fail("json_read_failed", { path: relativePath, error: error?.message ?? String(error) });
  }
}

function assertExactArray(actual, expected, reason) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(reason, { actual, expected });
  }
}

function assertNoForbiddenKeys(object, forbiddenKeys, context) {
  for (const key of Object.keys(object)) {
    if (forbiddenKeys.includes(key)) {
      fail("forbidden_key_present", { context, key });
    }

    const value = object[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      assertNoForbiddenKeys(value, forbiddenKeys, `${context}.${key}`);
    }

    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (item && typeof item === "object") {
          assertNoForbiddenKeys(item, forbiddenKeys, `${context}.${key}[${index}]`);
        }
      });
    }
  }
}

function assertActiveRegistrySurfaceUnchanged() {
  const registryIndex = readJson(S_REG_14_CONTRACT_PATHS.registry_index);
  const registryBundle = readJson(S_REG_14_CONTRACT_PATHS.registry_bundle);
  const bundleIds = Object.keys(registryBundle.registries ?? {});

  assertExactArray(
    registryIndex.order.slice(0, S_REG_14_COMPACT_ACTIVE_REGISTRY_ORDER.length),
    S_REG_14_COMPACT_ACTIVE_REGISTRY_ORDER,
    "active_registry_order_changed"
  );
  assertExactArray(
    bundleIds.slice(0, S_REG_14_COMPACT_ACTIVE_REGISTRY_ORDER.length),
    S_REG_14_COMPACT_ACTIVE_REGISTRY_ORDER,
    "active_registry_bundle_changed"
  );
}

function assertFoundationClosed(manifest) {
  const expectedSliceIds = S_REG_14_COMPLETED_FOUNDATION.map((entry) => entry.slice_id);
  const manifestSliceIds = manifest.completed_foundation.map((entry) => entry.slice_id);

  assertExactArray(manifestSliceIds, expectedSliceIds, "completed_foundation_slice_order_changed");

  for (const entry of manifest.completed_foundation) {
    if (entry.status !== "complete") {
      fail("foundation_status_not_complete", { entry });
    }

    if (!["closed", "contract_closed"].includes(entry.dependency_status)) {
      fail("foundation_dependency_not_closed", { entry });
    }

    if (!String(entry.runtime_status).includes("non_runtime")) {
      fail("foundation_runtime_status_not_inert", { entry });
    }
  }
}

function assertReadyAndBlockedLists(manifest) {
  assertExactArray(
    manifest.ready_to_build_now.map((entry) => entry.registry_id),
    S_REG_14_READY_TO_BUILD_NOW.map((entry) => entry.registry_id),
    "ready_to_build_now_order_changed"
  );

  assertExactArray(
    manifest.blocked_until_later.map((entry) => entry.registry_id),
    S_REG_14_BLOCKED_UNTIL_LATER.map((entry) => entry.registry_id),
    "blocked_until_later_order_changed"
  );

  for (const entry of [...manifest.ready_to_build_now, ...manifest.blocked_until_later]) {
    if (entry.activation_ready !== false) {
      fail("candidate_registry_activation_ready_invalid", { entry });
    }
  }
}

export function sReg14LoadRegistryBuildReadinessManifest() {
  return readJson(S_REG_14_CONTRACT_PATHS.manifest);
}

export function sReg14BuildDependencyClosureMap() {
  const closedFoundation = S_REG_14_COMPLETED_FOUNDATION.map((entry) => entry.slice_id);

  return Object.freeze({
    closed_foundation: closedFoundation,
    open_content_batches: S_REG_14_BUILD_QUEUE.map((entry) => entry.slice_id),
    activation_gate_blocked_until: "S-REG-22",
    active_registry_activation_status: "not_authorised",
    content_production_status: S_REG_14_CONTENT_PRODUCTION_STATUS
  });
}

export function sReg14ValidateBuildQueueOrder(queue = S_REG_14_BUILD_QUEUE) {
  const seen = new Set(S_REG_14_COMPLETED_FOUNDATION.map((entry) => entry.slice_id));
  const expectedOrder = Array.from({ length: queue.length }, (_, index) => index + 1);

  assertExactArray(queue.map((entry) => entry.order), expectedOrder, "build_queue_order_not_contiguous");

  for (const entry of queue) {
    if (!entry.slice_id || !entry.batch_id || !entry.registry_target || !entry.proof_command || !entry.non_scope_boundary) {
      fail("build_queue_required_field_missing", { entry });
    }

    if (!entry.proof_command.startsWith("npm.cmd run proof:s-reg-")) {
      fail("build_queue_proof_command_invalid", { entry });
    }

    for (const dependency of entry.dependency_inputs) {
      if (!seen.has(dependency)) {
        fail("build_queue_dependency_not_closed_before_use", { slice_id: entry.slice_id, dependency });
      }
    }

    seen.add(entry.slice_id);
  }

  return {
    ok: true,
    queue_length: queue.length,
    first_content_slice: queue[0].slice_id,
    final_review_slice: queue[queue.length - 1].slice_id
  };
}

export function sReg14ValidateRegistryBuildReadinessStartGate(manifest = sReg14LoadRegistryBuildReadinessManifest()) {
  for (const key of requiredManifestKeys) {
    if (!Object.hasOwn(manifest, key)) {
      fail("manifest_required_key_missing", { key });
    }
  }

  assertNoForbiddenKeys(manifest, S_REG_14_FORBIDDEN_FIELDS, "s_reg_14_manifest");
  assertActiveRegistrySurfaceUnchanged();

  if (manifest.slice_id !== S_REG_14_SLICE_ID) {
    fail("manifest_slice_id_invalid", { actual: manifest.slice_id });
  }

  if (manifest.gate_status !== S_REG_14_GATE_STATUS) {
    fail("manifest_gate_status_invalid", { actual: manifest.gate_status });
  }

  if (manifest.runtime_status !== S_REG_14_RUNTIME_STATUS) {
    fail("manifest_runtime_status_invalid", { actual: manifest.runtime_status });
  }

  if (manifest.activation_ready !== false) {
    fail("manifest_activation_ready_invalid", { actual: manifest.activation_ready });
  }

  if (manifest.content_production_status !== S_REG_14_CONTENT_PRODUCTION_STATUS) {
    fail("manifest_content_production_status_invalid", { actual: manifest.content_production_status });
  }

  assertExactArray(manifest.active_registry_surface.order, S_REG_14_COMPACT_ACTIVE_REGISTRY_ORDER, "manifest_active_registry_surface_changed");
  assertFoundationClosed(manifest);
  assertReadyAndBlockedLists(manifest);

  const queueResult = sReg14ValidateBuildQueueOrder(manifest.candidate_build_queue);

  return {
    ok: true,
    token: S_REG_14_FAILURE_TOKEN,
    slice_id: manifest.slice_id,
    gate_status: manifest.gate_status,
    runtime_status: manifest.runtime_status,
    activation_ready: manifest.activation_ready,
    content_production_status: manifest.content_production_status,
    ready_to_build_count: manifest.ready_to_build_now.length,
    blocked_until_later_count: manifest.blocked_until_later.length,
    build_queue_length: queueResult.queue_length,
    first_content_slice: queueResult.first_content_slice,
    final_review_slice: queueResult.final_review_slice
  };
}