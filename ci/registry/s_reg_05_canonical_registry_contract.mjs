/**
 * DEV NOTE: S-REG-05 canonical registry contract boundary.
 * Purpose: declares the canonical registry IDs, candidate-only storage surface,
 * dependency order, and activation gates before registry content is added.
 * Boundary: this module is an inert CI/proof surface. It must not read active
 * registry files, write bundles, add registry rows, alter registry law, or affect
 * deterministic engine runtime behaviour.
 * Determinism: all exported collections are closed, ordered, cloned, and frozen.
 * Failure: invalid contract consumers fail closed with
 * CI_S_REG_05_CANONICAL_REGISTRY_CONTRACT_CANDIDATE_SURFACE.
 */
const S_REG_05_SLICE_ID = "S-REG-05";
const S_REG_05_CONTRACT_VERSION = "1.0.0";
const S_REG_05_FAILURE_TOKEN = "CI_S_REG_05_CANONICAL_REGISTRY_CONTRACT_CANDIDATE_SURFACE";

const S_REG_05_ACTIVE_COMPACT_REGISTRY_IDS = Object.freeze([
  "activity",
  "movement",
  "exercise",
  "program"
]);

const S_REG_05_CANONICAL_REGISTRY_IDS = Object.freeze([
  "activity_registry_1",
  "sport_subdivision_registry_1a",
  "sport_metric_registry_1c",
  "metric_exercise_link_registry_1c_a",
  "sport_role_registry_2",
  "movement_registry_3",
  "exercise_token_registry_3b",
  "exercise_registry_3a",
  "equipment_registry",
  "exercise_activity_applicability_registry",
  "sport_program_profile_registry_5d",
  "sport_event_model_registry_5e",
  "sport_program_template_registry_5f",
  "substitution_registry"
]);

const S_REG_05_DEPENDENCY_ORDER = Object.freeze([
  "activity_registry_1",
  "sport_subdivision_registry_1a",
  "sport_metric_registry_1c",
  "sport_role_registry_2",
  "movement_registry_3",
  "equipment_registry",
  "exercise_token_registry_3b",
  "exercise_registry_3a",
  "metric_exercise_link_registry_1c_a",
  "exercise_activity_applicability_registry",
  "sport_program_profile_registry_5d",
  "sport_event_model_registry_5e",
  "sport_program_template_registry_5f",
  "substitution_registry"
]);

const S_REG_05_ALLOWED_CANDIDATE_STATUSES = Object.freeze([
  "candidate_contract_only",
  "candidate_content_draft",
  "candidate_fk_ready",
  "candidate_activation_ready"
]);

const S_REG_05_FORBIDDEN_CLAIM_TERMS = Object.freeze([
  "safe",
  "readiness",
  "risk",
  "optimal",
  "optimise",
  "optimize",
  "recommend",
  "recommendation",
  "suitable",
  "suitability",
  "effective",
  "guarantee",
  "return to play",
  "return-to-play",
  "cleared",
  "fit for duty",
  "deployment ready"
]);

const S_REG_05_CANONICAL_REGISTRY_CONTRACT = Object.freeze({
  activity_registry_1: Object.freeze({
    registry_id: "activity_registry_1",
    registry_kind: "activity",
    candidate_status: "candidate_contract_only",
    candidate_surface: "ci/registry/candidates/activity_registry_1/activity_registry_1.candidate.registry.json",
    future_active_path: "registries/activity_registry_1/activity_registry_1.registry.json",
    depends_on: Object.freeze([]),
    required_fk_fields: Object.freeze([]),
    activation_gate: "requires_non_empty_records_and_registry_law_activation"
  }),
  sport_subdivision_registry_1a: Object.freeze({
    registry_id: "sport_subdivision_registry_1a",
    registry_kind: "sport_subdivision",
    candidate_status: "candidate_contract_only",
    candidate_surface: "ci/registry/candidates/sport_subdivision_registry_1a/sport_subdivision_registry_1a.candidate.registry.json",
    future_active_path: "registries/sport_subdivision_registry_1a/sport_subdivision_registry_1a.registry.json",
    depends_on: Object.freeze(["activity_registry_1"]),
    required_fk_fields: Object.freeze(["activity_id"]),
    activation_gate: "requires_activity_fk_closure"
  }),
  sport_metric_registry_1c: Object.freeze({
    registry_id: "sport_metric_registry_1c",
    registry_kind: "sport_metric",
    candidate_status: "candidate_contract_only",
    candidate_surface: "ci/registry/candidates/sport_metric_registry_1c/sport_metric_registry_1c.candidate.registry.json",
    future_active_path: "registries/sport_metric_registry_1c/sport_metric_registry_1c.registry.json",
    depends_on: Object.freeze(["activity_registry_1", "sport_subdivision_registry_1a"]),
    required_fk_fields: Object.freeze(["activity_id", "sport_subdivision_id"]),
    activation_gate: "requires_activity_and_subdivision_fk_closure"
  }),
  metric_exercise_link_registry_1c_a: Object.freeze({
    registry_id: "metric_exercise_link_registry_1c_a",
    registry_kind: "metric_exercise_link",
    candidate_status: "candidate_contract_only",
    candidate_surface: "ci/registry/candidates/metric_exercise_link_registry_1c_a/metric_exercise_link_registry_1c_a.candidate.registry.json",
    future_active_path: "registries/metric_exercise_link_registry_1c_a/metric_exercise_link_registry_1c_a.registry.json",
    depends_on: Object.freeze(["activity_registry_1", "sport_metric_registry_1c", "exercise_registry_3a"]),
    required_fk_fields: Object.freeze(["activity_id", "sport_metric_id", "exercise_id"]),
    activation_gate: "requires_metric_and_exercise_fk_closure"
  }),
  sport_role_registry_2: Object.freeze({
    registry_id: "sport_role_registry_2",
    registry_kind: "sport_role",
    candidate_status: "candidate_contract_only",
    candidate_surface: "ci/registry/candidates/sport_role_registry_2/sport_role_registry_2.candidate.registry.json",
    future_active_path: "registries/sport_role_registry_2/sport_role_registry_2.registry.json",
    depends_on: Object.freeze(["activity_registry_1", "sport_subdivision_registry_1a"]),
    required_fk_fields: Object.freeze(["activity_id", "sport_subdivision_id"]),
    activation_gate: "requires_activity_and_subdivision_fk_closure"
  }),
  movement_registry_3: Object.freeze({
    registry_id: "movement_registry_3",
    registry_kind: "movement",
    candidate_status: "candidate_contract_only",
    candidate_surface: "ci/registry/candidates/movement_registry_3/movement_registry_3.candidate.registry.json",
    future_active_path: "registries/movement_registry_3/movement_registry_3.registry.json",
    depends_on: Object.freeze(["activity_registry_1"]),
    required_fk_fields: Object.freeze(["activity_id"]),
    activation_gate: "requires_activity_fk_closure"
  }),
  exercise_token_registry_3b: Object.freeze({
    registry_id: "exercise_token_registry_3b",
    registry_kind: "exercise_token",
    candidate_status: "candidate_contract_only",
    candidate_surface: "ci/registry/candidates/exercise_token_registry_3b/exercise_token_registry_3b.candidate.registry.json",
    future_active_path: "registries/exercise_token_registry_3b/exercise_token_registry_3b.registry.json",
    depends_on: Object.freeze(["activity_registry_1", "movement_registry_3"]),
    required_fk_fields: Object.freeze(["activity_id", "movement_id"]),
    activation_gate: "requires_activity_and_movement_fk_closure"
  }),
  exercise_registry_3a: Object.freeze({
    registry_id: "exercise_registry_3a",
    registry_kind: "exercise",
    candidate_status: "candidate_contract_only",
    candidate_surface: "ci/registry/candidates/exercise_registry_3a/exercise_registry_3a.candidate.registry.json",
    future_active_path: "registries/exercise_registry_3a/exercise_registry_3a.registry.json",
    depends_on: Object.freeze(["activity_registry_1", "movement_registry_3", "exercise_token_registry_3b", "equipment_registry"]),
    required_fk_fields: Object.freeze(["activity_id", "movement_id", "exercise_token_id", "equipment_ids"]),
    activation_gate: "requires_activity_movement_token_and_equipment_fk_closure"
  }),
  equipment_registry: Object.freeze({
    registry_id: "equipment_registry",
    registry_kind: "equipment",
    candidate_status: "candidate_contract_only",
    candidate_surface: "ci/registry/candidates/equipment_registry/equipment_registry.candidate.registry.json",
    future_active_path: "registries/equipment_registry/equipment_registry.registry.json",
    depends_on: Object.freeze(["activity_registry_1", "movement_registry_3"]),
    required_fk_fields: Object.freeze(["activity_id", "movement_id"]),
    activation_gate: "requires_activity_and_movement_fk_closure"
  }),
  exercise_activity_applicability_registry: Object.freeze({
    registry_id: "exercise_activity_applicability_registry",
    registry_kind: "exercise_activity_applicability",
    candidate_status: "candidate_contract_only",
    candidate_surface: "ci/registry/candidates/exercise_activity_applicability_registry/exercise_activity_applicability_registry.candidate.registry.json",
    future_active_path: "registries/exercise_activity_applicability_registry/exercise_activity_applicability_registry.registry.json",
    depends_on: Object.freeze(["activity_registry_1", "exercise_registry_3a"]),
    required_fk_fields: Object.freeze(["activity_id", "exercise_id"]),
    activation_gate: "requires_activity_and_exercise_fk_closure"
  }),
  sport_program_profile_registry_5d: Object.freeze({
    registry_id: "sport_program_profile_registry_5d",
    registry_kind: "sport_program_profile",
    candidate_status: "candidate_contract_only",
    candidate_surface: "ci/registry/candidates/sport_program_profile_registry_5d/sport_program_profile_registry_5d.candidate.registry.json",
    future_active_path: "registries/sport_program_profile_registry_5d/sport_program_profile_registry_5d.registry.json",
    depends_on: Object.freeze(["activity_registry_1", "sport_role_registry_2"]),
    required_fk_fields: Object.freeze(["activity_id", "sport_role_id"]),
    activation_gate: "requires_activity_and_role_fk_closure_without_template_formula_visibility"
  }),
  sport_event_model_registry_5e: Object.freeze({
    registry_id: "sport_event_model_registry_5e",
    registry_kind: "sport_event_model",
    candidate_status: "candidate_contract_only",
    candidate_surface: "ci/registry/candidates/sport_event_model_registry_5e/sport_event_model_registry_5e.candidate.registry.json",
    future_active_path: "registries/sport_event_model_registry_5e/sport_event_model_registry_5e.registry.json",
    depends_on: Object.freeze(["activity_registry_1", "sport_subdivision_registry_1a", "sport_metric_registry_1c", "sport_role_registry_2"]),
    required_fk_fields: Object.freeze(["activity_id", "sport_subdivision_id", "sport_metric_id", "sport_role_id"]),
    activation_gate: "requires_sport_context_fk_closure"
  }),
  sport_program_template_registry_5f: Object.freeze({
    registry_id: "sport_program_template_registry_5f",
    registry_kind: "sport_program_template",
    candidate_status: "candidate_contract_only",
    candidate_surface: "ci/registry/candidates/sport_program_template_registry_5f/sport_program_template_registry_5f.candidate.registry.json",
    future_active_path: "registries/sport_program_template_registry_5f/sport_program_template_registry_5f.registry.json",
    depends_on: Object.freeze(["activity_registry_1", "exercise_registry_3a", "equipment_registry", "exercise_activity_applicability_registry", "sport_program_profile_registry_5d"]),
    required_fk_fields: Object.freeze(["activity_id", "exercise_id", "equipment_id", "applicability_id", "sport_program_profile_id"]),
    activation_gate: "requires_template_contract_and_hidden_formula_boundary"
  }),
  substitution_registry: Object.freeze({
    registry_id: "substitution_registry",
    registry_kind: "substitution",
    candidate_status: "candidate_contract_only",
    candidate_surface: "ci/registry/candidates/substitution_registry/substitution_registry.candidate.registry.json",
    future_active_path: "registries/substitution_registry/substitution_registry.registry.json",
    depends_on: Object.freeze(["activity_registry_1", "movement_registry_3", "exercise_registry_3a", "equipment_registry", "exercise_activity_applicability_registry"]),
    required_fk_fields: Object.freeze(["activity_id", "movement_id", "source_exercise_id", "target_exercise_id", "equipment_id", "applicability_id"]),
    activation_gate: "requires_substitution_fk_closure_and_no_recommendation_claims"
  })
});

function isPlainRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(reason, message, details = {}) {
  const error = new Error(message);
  error.name = "SReg05CanonicalRegistryContractError";
  error.code = S_REG_05_FAILURE_TOKEN;
  error.reason = reason;
  error.details = Object.freeze({ ...details });
  throw error;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!isPlainRecord(value) && !Array.isArray(value)) {
    return value;
  }

  for (const key of Object.keys(value)) {
    deepFreeze(value[key]);
  }

  return Object.freeze(value);
}

function sReg05CanonicalRegistryContract() {
  return deepFreeze(cloneJson(S_REG_05_CANONICAL_REGISTRY_CONTRACT));
}

function sReg05CanonicalRegistryIds() {
  return Object.freeze([...S_REG_05_CANONICAL_REGISTRY_IDS]);
}

function sReg05DependencyOrder() {
  return Object.freeze([...S_REG_05_DEPENDENCY_ORDER]);
}

function sReg05CandidateSurfaceManifest() {
  return deepFreeze({
    slice_id: S_REG_05_SLICE_ID,
    contract_version: S_REG_05_CONTRACT_VERSION,
    surface_status: "candidate_contract_only",
    runtime_status: "non_runtime",
    active_registry_mutation: false,
    active_bundle_mutation: false,
    registry_law_mutation: false,
    engine_runtime_mutation: false,
    high_volume_content_added: false,
    candidate_surface_root: "ci/registry/candidates",
    future_active_surface_root: "registries",
    active_compact_registry_ids: [...S_REG_05_ACTIVE_COMPACT_REGISTRY_IDS],
    canonical_registry_ids: [...S_REG_05_CANONICAL_REGISTRY_IDS],
    dependency_order: [...S_REG_05_DEPENDENCY_ORDER],
    allowed_candidate_statuses: [...S_REG_05_ALLOWED_CANDIDATE_STATUSES],
    forbidden_claim_terms: [...S_REG_05_FORBIDDEN_CLAIM_TERMS],
    registries: cloneJson(S_REG_05_CANONICAL_REGISTRY_CONTRACT)
  });
}

function sReg05ValidateCandidateContract(candidate) {
  if (!isPlainRecord(candidate)) {
    fail("candidate_contract_invalid", "S-REG-05 candidate contract must be a plain object.");
  }

  const ids = Object.keys(candidate);
  const expectedIds = [...S_REG_05_CANONICAL_REGISTRY_IDS];

  if (JSON.stringify(ids) !== JSON.stringify(expectedIds)) {
    fail("canonical_registry_order_invalid", "S-REG-05 canonical registry ids must match the declared order.", {
      actual: ids,
      expected: expectedIds
    });
  }

  for (const registryId of expectedIds) {
    const record = candidate[registryId];

    if (!isPlainRecord(record)) {
      fail("registry_contract_record_invalid", "S-REG-05 registry contract record must be a plain object.", {
        registry_id: registryId
      });
    }

    if (record.registry_id !== registryId) {
      fail("registry_id_mismatch", "S-REG-05 registry contract record id mismatch.", {
        registry_id: registryId,
        actual: record.registry_id
      });
    }

    if (!S_REG_05_ALLOWED_CANDIDATE_STATUSES.includes(record.candidate_status)) {
      fail("candidate_status_invalid", "S-REG-05 candidate status is not allowed.", {
        registry_id: registryId,
        candidate_status: record.candidate_status
      });
    }

    if (typeof record.candidate_surface !== "string" || !record.candidate_surface.startsWith("ci/registry/candidates/")) {
      fail("candidate_surface_path_invalid", "S-REG-05 candidate surface must be under ci/registry/candidates.", {
        registry_id: registryId,
        candidate_surface: record.candidate_surface
      });
    }

    if (typeof record.future_active_path !== "string" || record.future_active_path !== `registries/${registryId}/${registryId}.registry.json`) {
      fail("future_active_path_invalid", "S-REG-05 future active path must match bundle-writer convention.", {
        registry_id: registryId,
        future_active_path: record.future_active_path
      });
    }

    if (!Array.isArray(record.depends_on)) {
      fail("depends_on_invalid", "S-REG-05 depends_on must be an array.", {
        registry_id: registryId
      });
    }

    for (const dependency of record.depends_on) {
      if (!expectedIds.includes(dependency)) {
        fail("unknown_dependency", "S-REG-05 dependency must reference a declared canonical registry id.", {
          registry_id: registryId,
          dependency
        });
      }
    }

    if (!Array.isArray(record.required_fk_fields)) {
      fail("required_fk_fields_invalid", "S-REG-05 required_fk_fields must be an array.", {
        registry_id: registryId
      });
    }

    if (typeof record.activation_gate !== "string" || record.activation_gate.length === 0) {
      fail("activation_gate_invalid", "S-REG-05 activation gate must be a non-empty string.", {
        registry_id: registryId
      });
    }
  }

  return deepFreeze({
    ok: true,
    slice_id: S_REG_05_SLICE_ID,
    canonical_registry_count: expectedIds.length,
    dependency_order_count: S_REG_05_DEPENDENCY_ORDER.length,
    candidate_status: "candidate_contract_only"
  });
}

export {
  S_REG_05_ACTIVE_COMPACT_REGISTRY_IDS,
  S_REG_05_ALLOWED_CANDIDATE_STATUSES,
  S_REG_05_CANONICAL_REGISTRY_CONTRACT,
  S_REG_05_CANONICAL_REGISTRY_IDS,
  S_REG_05_CONTRACT_VERSION,
  S_REG_05_DEPENDENCY_ORDER,
  S_REG_05_FAILURE_TOKEN,
  S_REG_05_FORBIDDEN_CLAIM_TERMS,
  S_REG_05_SLICE_ID,
  sReg05CandidateSurfaceManifest,
  sReg05CanonicalRegistryContract,
  sReg05CanonicalRegistryIds,
  sReg05DependencyOrder,
  sReg05ValidateCandidateContract
};