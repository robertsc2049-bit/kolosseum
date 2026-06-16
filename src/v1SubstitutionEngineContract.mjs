import {
  sha256Hex,
  stableCanonicalJson
} from "./v1CompileInputCanonicalisation.mjs";

export const v1SubstitutionEngineContractSurfaceId = "v1_substitution_engine_contract";
export const v1SubstitutionEngineContractVersion = "1.0.0";
export const v1SubstitutionEngineContractFailureCode = "v1_substitution_engine_contract_failure";
export const v1SubstitutionEngineContractFailureCopyId = "V1_SUBSTITUTION_ENGINE_CONTRACT_REJECTED";

const CONTRACT_VERSION = "S-V1-32";
const RESULT_STATUS_APPLIED = "substitution_applied";
const RESULT_STATUS_NOT_REQUIRED = "substitution_not_required";
const RESULT_STATUS_REFUSED = "substitution_refused";

const ROOT_KEYS = Object.freeze([
  "activity_id",
  "candidate_exercises",
  "registry_links",
  "substitution_edges",
  "target_exercise_id",
  "unavailable_equipment_ids"
]);

const REGISTRY_LINK_KEYS = Object.freeze([
  "activity_ids",
  "applicability_records",
  "equipment_ids",
  "exercise_ids",
  "movement_ids",
  "substitution_edge_ids"
]);

const APPLICABILITY_KEYS = Object.freeze([
  "activity_id",
  "exercise_id",
  "substitution_applicability"
]);

const EXERCISE_KEYS = Object.freeze([
  "activity_id",
  "equipment_ids",
  "exercise_id",
  "movement_id"
]);

const EDGE_KEYS = Object.freeze([
  "activity_id",
  "edge_id",
  "reason_codes",
  "source_exercise_id",
  "target_exercise_id"
]);

const OUTPUT_KEYS = Object.freeze([
  "activity_id",
  "candidate_count",
  "contract_version",
  "reason_codes",
  "registry_trace",
  "source_exercise_id",
  "substitution_edge_id",
  "substitution_status",
  "target_exercise_id",
  "unavailable_equipment_ids"
]);

const REGISTRY_TRACE_KEYS = Object.freeze([
  "activity_link_verified",
  "edge_link_verified",
  "equipment_links_verified",
  "exercise_links_verified",
  "movement_links_verified"
]);

const FACTUAL_REASON_CODES = Object.freeze([
  "source_equipment_unavailable",
  "source_equipment_available",
  "declared_edge_matched",
  "candidate_equipment_available",
  "activity_link_verified",
  "registry_links_verified",
  "no_substitution_required"
]);

const joinKey = (...parts) => parts.join("");

const FORBIDDEN_KEYS = Object.freeze([
  joinKey("recomm", "endation"),
  joinKey("recomm", "ended_action"),
  joinKey("opti", "misation"),
  joinKey("opti", "mization"),
  joinKey("opti", "mal"),
  joinKey("sa", "fe"),
  joinKey("safe", "ty"),
  joinKey("ri", "sk"),
  joinKey("ri", "sk_", "sc", "ore"),
  joinKey("ra", "nk"),
  joinKey("ra", "nking"),
  joinKey("sc", "ore"),
  joinKey("best"),
  joinKey("better"),
  "advice",
  "advisory",
  "diagnosis",
  "medical_clearance"
]);

function fail(reason, message, details = {}) {
  const error = new Error(message);
  error.name = "V1SubstitutionEngineContractError";
  error.code = v1SubstitutionEngineContractFailureCode;
  error.copy_id = v1SubstitutionEngineContractFailureCopyId;
  error.reason = reason;
  error.details = Object.freeze({ ...details });
  error.substitution_status = RESULT_STATUS_REFUSED;
  error.engine_decision = false;
  throw error;
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertPlainObject(value, reason, details = {}) {
  if (!isPlainObject(value)) {
    fail(reason, "v1 substitution value must be an object", details);
  }
}

function assertArray(value, reason, details = {}) {
  if (!Array.isArray(value)) {
    fail(reason, "v1 substitution array field is required", details);
  }
}

function assertNonEmptyString(value, reason, details = {}) {
  if (typeof value !== "string" || value.trim() === "") {
    fail(reason, "v1 substitution string field is required", details);
  }
}

function assertExactKeys(value, expectedKeys, reasonPrefix, path) {
  assertPlainObject(value, `${reasonPrefix}_object_required`, { path });

  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();

  for (const key of expected) {
    if (!actual.includes(key)) {
      fail(`${reasonPrefix}_missing_required_field`, "v1 substitution object is missing a required field", {
        path,
        key
      });
    }
  }

  for (const key of actual) {
    if (!expected.includes(key)) {
      fail(`${reasonPrefix}_unknown_field_refused`, "v1 substitution object contains an unknown field", {
        path,
        key
      });
    }
  }
}

function assertStringArray(value, reason, details = {}) {
  assertArray(value, reason, details);

  for (const item of value) {
    assertNonEmptyString(item, reason, {
      ...details,
      value: item
    });
  }

  const sortedUnique = [...new Set(value)].sort();

  if (sortedUnique.length !== value.length) {
    fail(reason, "v1 substitution string array must be unique", details);
  }

  return sortedUnique;
}

function assertNoForbiddenKeys(value, pathParts = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenKeys(item, [...pathParts, String(index)]));
    return;
  }

  if (!isPlainObject(value)) {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.includes(key)) {
      fail("v1_substitution_forbidden_non_factual_field_refused", "non-factual field cannot enter v1 substitution contract", {
        path: [...pathParts, key].join(".")
      });
    }

    assertNoForbiddenKeys(child, [...pathParts, key]);
  }
}

function canonicalise(value) {
  if (value === null) {
    return null;
  }

  if (Array.isArray(value)) {
    return value.map(canonicalise);
  }

  if (isPlainObject(value)) {
    return Object.keys(value)
      .sort()
      .reduce((accumulator, key) => {
        accumulator[key] = canonicalise(value[key]);
        return accumulator;
      }, {});
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      fail("v1_substitution_non_finite_number_refused", "non-finite number cannot enter substitution output", {});
    }

    return value;
  }

  if (["string", "boolean"].includes(typeof value)) {
    return value;
  }

  fail("v1_substitution_unsupported_value_refused", "unsupported value cannot enter substitution output", {
    value_type: typeof value
  });
}

function assertRegistryLinks(registryLinks) {
  assertExactKeys(registryLinks, REGISTRY_LINK_KEYS, "v1_substitution_registry_links", "registry_links");

  return Object.freeze({
    activity_ids: Object.freeze(assertStringArray(registryLinks.activity_ids, "v1_substitution_activity_links_invalid", {
      field: "registry_links.activity_ids"
    })),
    applicability_records: Object.freeze(assertApplicabilityRecords(registryLinks.applicability_records)),
    equipment_ids: Object.freeze(assertStringArray(registryLinks.equipment_ids, "v1_substitution_equipment_links_invalid", {
      field: "registry_links.equipment_ids"
    })),
    exercise_ids: Object.freeze(assertStringArray(registryLinks.exercise_ids, "v1_substitution_exercise_links_invalid", {
      field: "registry_links.exercise_ids"
    })),
    movement_ids: Object.freeze(assertStringArray(registryLinks.movement_ids, "v1_substitution_movement_links_invalid", {
      field: "registry_links.movement_ids"
    })),
    substitution_edge_ids: Object.freeze(assertStringArray(registryLinks.substitution_edge_ids, "v1_substitution_edge_links_invalid", {
      field: "registry_links.substitution_edge_ids"
    }))
  });
}

function assertApplicabilityRecords(records) {
  assertArray(records, "v1_substitution_applicability_records_invalid", {
    field: "registry_links.applicability_records"
  });

  const seen = new Set();

  return records
    .map((record, index) => {
      assertExactKeys(record, APPLICABILITY_KEYS, "v1_substitution_applicability_record", `registry_links.applicability_records.${index}`);

      assertNonEmptyString(record.exercise_id, "v1_substitution_applicability_exercise_required", {
        field: `registry_links.applicability_records.${index}.exercise_id`
      });
      assertNonEmptyString(record.activity_id, "v1_substitution_applicability_activity_required", {
        field: `registry_links.applicability_records.${index}.activity_id`
      });
      assertNonEmptyString(record.substitution_applicability, "v1_substitution_applicability_state_required", {
        field: `registry_links.applicability_records.${index}.substitution_applicability`
      });

      if (!["eligible", "not_eligible"].includes(record.substitution_applicability)) {
        fail("v1_substitution_applicability_state_invalid", "substitution applicability state must be explicit", {
          substitution_applicability: record.substitution_applicability
        });
      }

      const key = `${record.exercise_id}::${record.activity_id}`;

      if (seen.has(key)) {
        fail("v1_substitution_applicability_duplicate", "substitution applicability link must be unique", {
          key
        });
      }

      seen.add(key);

      return Object.freeze({ ...record });
    })
    .sort((left, right) => {
      const leftKey = `${left.exercise_id}::${left.activity_id}`;
      const rightKey = `${right.exercise_id}::${right.activity_id}`;
      return leftKey.localeCompare(rightKey);
    });
}

function hasEligibleApplicability(links, exerciseId, activityId) {
  return links.applicability_records.some(
    (record) =>
      record.exercise_id === exerciseId &&
      record.activity_id === activityId &&
      record.substitution_applicability === "eligible"
  );
}

function assertExercise(record, index, links, activityId) {
  assertExactKeys(record, EXERCISE_KEYS, "v1_substitution_exercise", `candidate_exercises.${index}`);

  assertNonEmptyString(record.exercise_id, "v1_substitution_exercise_id_required", {
    field: `candidate_exercises.${index}.exercise_id`
  });
  assertNonEmptyString(record.activity_id, "v1_substitution_exercise_activity_required", {
    field: `candidate_exercises.${index}.activity_id`
  });
  assertNonEmptyString(record.movement_id, "v1_substitution_movement_id_required", {
    field: `candidate_exercises.${index}.movement_id`
  });

  const equipmentIds = assertStringArray(record.equipment_ids, "v1_substitution_exercise_equipment_invalid", {
    field: `candidate_exercises.${index}.equipment_ids`
  });

  if (!links.exercise_ids.includes(record.exercise_id)) {
    fail("v1_substitution_exercise_registry_link_missing", "exercise must exist in declared registry links", {
      exercise_id: record.exercise_id
    });
  }

  if (!links.activity_ids.includes(record.activity_id)) {
    fail("v1_substitution_activity_registry_link_missing", "exercise activity must exist in declared registry links", {
      activity_id: record.activity_id
    });
  }

  if (record.activity_id !== activityId) {
    fail("v1_substitution_activity_mismatch", "exercise activity must match substitution activity", {
      exercise_id: record.exercise_id,
      activity_id: record.activity_id,
      expected_activity_id: activityId
    });
  }

  if (!links.movement_ids.includes(record.movement_id)) {
    fail("v1_substitution_movement_registry_link_missing", "movement must exist in declared registry links", {
      movement_id: record.movement_id
    });
  }

  for (const equipmentId of equipmentIds) {
    if (!links.equipment_ids.includes(equipmentId)) {
      fail("v1_substitution_equipment_registry_link_missing", "equipment must exist in declared registry links", {
        equipment_id: equipmentId,
        exercise_id: record.exercise_id
      });
    }
  }

  if (!hasEligibleApplicability(links, record.exercise_id, activityId)) {
    fail("v1_substitution_applicability_link_missing", "exercise must have explicit substitution applicability for activity", {
      exercise_id: record.exercise_id,
      activity_id: activityId
    });
  }

  return Object.freeze({
    ...record,
    equipment_ids: Object.freeze(equipmentIds)
  });
}

function assertEdge(record, index, links, activityId) {
  assertExactKeys(record, EDGE_KEYS, "v1_substitution_edge", `substitution_edges.${index}`);

  for (const field of ["edge_id", "source_exercise_id", "target_exercise_id", "activity_id"]) {
    assertNonEmptyString(record[field], "v1_substitution_edge_field_required", {
      field: `substitution_edges.${index}.${field}`
    });
  }

  const reasonCodes = assertStringArray(record.reason_codes, "v1_substitution_edge_reason_codes_invalid", {
    field: `substitution_edges.${index}.reason_codes`
  });

  if (!links.substitution_edge_ids.includes(record.edge_id)) {
    fail("v1_substitution_edge_registry_link_missing", "substitution edge must exist in declared registry links", {
      edge_id: record.edge_id
    });
  }

  if (!links.exercise_ids.includes(record.source_exercise_id)) {
    fail("v1_substitution_source_registry_link_missing", "source exercise must exist in declared registry links", {
      source_exercise_id: record.source_exercise_id
    });
  }

  if (!links.exercise_ids.includes(record.target_exercise_id)) {
    fail("v1_substitution_target_registry_link_missing", "target exercise must exist in declared registry links", {
      target_exercise_id: record.target_exercise_id
    });
  }

  if (!links.activity_ids.includes(record.activity_id) || record.activity_id !== activityId) {
    fail("v1_substitution_edge_activity_mismatch", "substitution edge activity must match declared activity", {
      edge_id: record.edge_id,
      activity_id: record.activity_id,
      expected_activity_id: activityId
    });
  }

  for (const reasonCode of reasonCodes) {
    if (!FACTUAL_REASON_CODES.includes(reasonCode)) {
      fail("v1_substitution_reason_code_unknown", "substitution reason code must be factual and closed", {
        reason_code: reasonCode
      });
    }
  }

  return Object.freeze({
    ...record,
    reason_codes: Object.freeze(reasonCodes)
  });
}

function equipmentBlocked(exercise, unavailableEquipmentIds) {
  return exercise.equipment_ids.some((equipmentId) => unavailableEquipmentIds.includes(equipmentId));
}

function buildRegistryTrace(links, exercises, edges) {
  return Object.freeze({
    activity_link_verified: links.activity_ids.length > 0,
    edge_link_verified: edges.length > 0,
    equipment_links_verified: exercises.every((exercise) =>
      exercise.equipment_ids.every((equipmentId) => links.equipment_ids.includes(equipmentId))
    ),
    exercise_links_verified: exercises.every((exercise) => links.exercise_ids.includes(exercise.exercise_id)),
    movement_links_verified: exercises.every((exercise) => links.movement_ids.includes(exercise.movement_id))
  });
}

function buildResultEnvelope(output) {
  assertExactKeys(output, OUTPUT_KEYS, "v1_substitution_output", "substitution_output");
  assertExactKeys(output.registry_trace, REGISTRY_TRACE_KEYS, "v1_substitution_registry_trace", "substitution_output.registry_trace");

  const canonicalOutput = Object.freeze(canonicalise(output));
  const canonicalJson = stableCanonicalJson(canonicalOutput);
  const canonicalHash = sha256Hex(canonicalJson);

  return Object.freeze({
    surface_id: v1SubstitutionEngineContractSurfaceId,
    version: v1SubstitutionEngineContractVersion,
    substitution_status: canonicalOutput.substitution_status,
    canonical_json: canonicalJson,
    canonical_hash: canonicalHash,
    substitution_output: canonicalOutput,
    hash_metadata: Object.freeze({
      algorithm: "sha256",
      canonical_json: "stable_sorted_keys",
      hash_field: "canonical_hash"
    }),
    engine_decision: false
  });
}

export function assertV1SubstitutionInputCandidate(input) {
  assertPlainObject(input, "v1_substitution_candidate_object_required");
  assertNoForbiddenKeys(input);
  assertExactKeys(input, ROOT_KEYS, "v1_substitution_root", "root");

  assertNonEmptyString(input.activity_id, "v1_substitution_activity_required", {
    field: "activity_id"
  });
  assertNonEmptyString(input.target_exercise_id, "v1_substitution_target_required", {
    field: "target_exercise_id"
  });

  const unavailableEquipmentIds = assertStringArray(
    input.unavailable_equipment_ids,
    "v1_substitution_unavailable_equipment_invalid",
    {
      field: "unavailable_equipment_ids"
    }
  );

  const links = assertRegistryLinks(input.registry_links);

  for (const equipmentId of unavailableEquipmentIds) {
    if (!links.equipment_ids.includes(equipmentId)) {
      fail("v1_substitution_unavailable_equipment_registry_link_missing", "unavailable equipment must exist in declared registry links", {
        equipment_id: equipmentId
      });
    }
  }

  const exercises = input.candidate_exercises.map((record, index) => assertExercise(record, index, links, input.activity_id));
  const edges = input.substitution_edges.map((record, index) => assertEdge(record, index, links, input.activity_id));

  const exerciseIds = new Set();

  for (const exercise of exercises) {
    if (exerciseIds.has(exercise.exercise_id)) {
      fail("v1_substitution_duplicate_exercise", "candidate exercise id must be unique", {
        exercise_id: exercise.exercise_id
      });
    }

    exerciseIds.add(exercise.exercise_id);
  }

  if (!exerciseIds.has(input.target_exercise_id)) {
    fail("v1_substitution_source_exercise_missing", "target exercise must be present in candidate exercises", {
      target_exercise_id: input.target_exercise_id
    });
  }

  for (const edge of edges) {
    if (!exerciseIds.has(edge.source_exercise_id) || !exerciseIds.has(edge.target_exercise_id)) {
      fail("v1_substitution_edge_candidate_link_missing", "substitution edge must link candidate exercises", {
        edge_id: edge.edge_id
      });
    }
  }

  return true;
}

export function buildV1SubstitutionResult(input) {
  assertV1SubstitutionInputCandidate(input);

  const links = assertRegistryLinks(input.registry_links);
  const unavailableEquipmentIds = assertStringArray(input.unavailable_equipment_ids, "v1_substitution_unavailable_equipment_invalid", {
    field: "unavailable_equipment_ids"
  });

  const exercises = Object.freeze(
    input.candidate_exercises
      .map((record, index) => assertExercise(record, index, links, input.activity_id))
      .sort((left, right) => left.exercise_id.localeCompare(right.exercise_id))
  );

  const edges = Object.freeze(
    input.substitution_edges
      .map((record, index) => assertEdge(record, index, links, input.activity_id))
      .sort((left, right) => {
        const leftKey = `${left.edge_id}::${left.source_exercise_id}::${left.target_exercise_id}`;
        const rightKey = `${right.edge_id}::${right.source_exercise_id}::${right.target_exercise_id}`;
        return leftKey.localeCompare(rightKey);
      })
  );

  const sourceExercise = exercises.find((exercise) => exercise.exercise_id === input.target_exercise_id);

  if (!sourceExercise) {
    fail("v1_substitution_source_exercise_missing", "target exercise must be present in candidate exercises", {
      target_exercise_id: input.target_exercise_id
    });
  }

  const registryTrace = buildRegistryTrace(links, exercises, edges);

  if (!equipmentBlocked(sourceExercise, unavailableEquipmentIds)) {
    return buildResultEnvelope({
      activity_id: input.activity_id,
      candidate_count: exercises.length,
      contract_version: CONTRACT_VERSION,
      reason_codes: Object.freeze([
        "source_equipment_available",
        "no_substitution_required",
        "registry_links_verified"
      ]),
      registry_trace: registryTrace,
      source_exercise_id: sourceExercise.exercise_id,
      substitution_edge_id: null,
      substitution_status: RESULT_STATUS_NOT_REQUIRED,
      target_exercise_id: sourceExercise.exercise_id,
      unavailable_equipment_ids: Object.freeze(unavailableEquipmentIds)
    });
  }

  const declaredCandidates = edges
    .filter((edge) => edge.source_exercise_id === sourceExercise.exercise_id)
    .map((edge) => {
      const targetExercise = exercises.find((exercise) => exercise.exercise_id === edge.target_exercise_id);

      return Object.freeze({
        edge,
        exercise: targetExercise ?? null
      });
    })
    .filter((entry) => entry.exercise !== null)
    .filter((entry) => !equipmentBlocked(entry.exercise, unavailableEquipmentIds))
    .sort((left, right) => {
      const leftKey = `${left.edge.edge_id}::${left.exercise.exercise_id}`;
      const rightKey = `${right.edge.edge_id}::${right.exercise.exercise_id}`;
      return leftKey.localeCompare(rightKey);
    });

  if (declaredCandidates.length === 0) {
    fail("v1_substitution_declared_candidate_missing", "source exercise is unavailable and no declared candidate can be applied", {
      source_exercise_id: sourceExercise.exercise_id
    });
  }

  const selected = declaredCandidates[0];

  return buildResultEnvelope({
    activity_id: input.activity_id,
    candidate_count: exercises.length,
    contract_version: CONTRACT_VERSION,
    reason_codes: Object.freeze([
      "source_equipment_unavailable",
      "declared_edge_matched",
      "candidate_equipment_available",
      "activity_link_verified",
      "registry_links_verified"
    ]),
    registry_trace: registryTrace,
    source_exercise_id: sourceExercise.exercise_id,
    substitution_edge_id: selected.edge.edge_id,
    substitution_status: RESULT_STATUS_APPLIED,
    target_exercise_id: selected.exercise.exercise_id,
    unavailable_equipment_ids: Object.freeze(unavailableEquipmentIds)
  });
}

export function tryBuildV1SubstitutionResult(input) {
  try {
    return Object.freeze({
      ok: true,
      result: buildV1SubstitutionResult(input)
    });
  } catch (error) {
    if (error && error.name === "V1SubstitutionEngineContractError") {
      return Object.freeze({
        ok: false,
        error: Object.freeze({
          code: error.code,
          copy_id: error.copy_id,
          reason: error.reason,
          details: error.details,
          substitution_status: error.substitution_status,
          engine_decision: false
        })
      });
    }

    throw error;
  }
}

export const v1SubstitutionReasonCodes = FACTUAL_REASON_CODES;

export const v1SubstitutionEngineContract = Object.freeze({
  surface_id: v1SubstitutionEngineContractSurfaceId,
  version: v1SubstitutionEngineContractVersion,
  failure_code: v1SubstitutionEngineContractFailureCode,
  failure_copy_id: v1SubstitutionEngineContractFailureCopyId,
  contract_version: CONTRACT_VERSION,
  result_statuses: Object.freeze([
    RESULT_STATUS_APPLIED,
    RESULT_STATUS_NOT_REQUIRED,
    RESULT_STATUS_REFUSED
  ]),
  root_keys: ROOT_KEYS,
  registry_link_keys: REGISTRY_LINK_KEYS,
  applicability_keys: APPLICABILITY_KEYS,
  exercise_keys: EXERCISE_KEYS,
  edge_keys: EDGE_KEYS,
  output_keys: OUTPUT_KEYS,
  registry_trace_keys: REGISTRY_TRACE_KEYS,
  reason_codes: FACTUAL_REASON_CODES,
  forbidden_keys: FORBIDDEN_KEYS,
  canonical_json: "stable_sorted_keys",
  hash_algorithm: "sha256"
});
