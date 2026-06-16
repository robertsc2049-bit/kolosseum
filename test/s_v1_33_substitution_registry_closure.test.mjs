import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  buildV1SubstitutionResult,
  tryBuildV1SubstitutionResult
} from "../src/v1SubstitutionEngineContract.mjs";

const fixture = JSON.parse(
  fs.readFileSync("ci/fixtures/v1_substitution_registry_closure/s_v1_33_substitution_registry_closure_cases.json", "utf8")
);

const negativeFixture = JSON.parse(
  fs.readFileSync("ci/fixtures/v1_substitution_registry_closure_negative/s_v1_33_substitution_registry_closure_negative.json", "utf8")
);

const LOCKED_SUPPORTED_ACTIVITY_IDS = Object.freeze([
  "general_strength",
  "powerlifting",
  "rugby_union"
]);

const ROOT_KEYS = Object.freeze([
  "closure_version",
  "registry_records",
  "substitution_cases",
  "supported_activity_ids"
]);

const REGISTRY_RECORD_KEYS = Object.freeze([
  "activities",
  "applicability_records",
  "equipment",
  "exercises",
  "movements",
  "substitution_edges"
]);

const NON_REGISTRY_AUTHORITY_KEYS = Object.freeze([
  "ad_hoc_substitutions",
  "fallback_substitutions",
  "ui_only_substitution_authority",
  "ui_substitution_authority"
]);

function fail(reason, details = {}) {
  const error = new Error(reason);
  error.reason = reason;
  error.details = Object.freeze({ ...details });
  throw error;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function setPath(target, dottedPath, value) {
  const parts = dottedPath.split(".");
  let current = target;

  for (const part of parts.slice(0, -1)) {
    if (!current[part] || typeof current[part] !== "object") {
      current[part] = {};
    }

    current = current[part];
  }

  current[parts[parts.length - 1]] = value;
}

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertObject(value, reason) {
  if (!isObject(value)) {
    fail(reason);
  }
}

function assertExactKeys(value, expectedKeys, reason) {
  assertObject(value, reason);

  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();

  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    fail(reason, { actual, expected });
  }
}

function assertString(value, reason) {
  if (typeof value !== "string" || value.length === 0) {
    fail(reason);
  }
}

function assertArray(value, reason) {
  if (!Array.isArray(value)) {
    fail(reason);
  }
}

function assertNoNonRegistryAuthority(value, pathParts = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoNonRegistryAuthority(item, [...pathParts, String(index)]));
    return;
  }

  if (!isObject(value)) {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    if (NON_REGISTRY_AUTHORITY_KEYS.includes(key)) {
      fail("substitution_non_registry_authority_refused", {
        path: [...pathParts, key].join(".")
      });
    }

    assertNoNonRegistryAuthority(child, [...pathParts, key]);
  }
}

function sortedUnique(values, reason) {
  assertArray(values, reason);

  for (const value of values) {
    assertString(value, reason);
  }

  const sorted = [...new Set(values)].sort();

  if (sorted.length !== values.length) {
    fail(reason);
  }

  return sorted;
}

function hasEligibleApplicability(records, exerciseId, activityId) {
  return records.some(
    (record) =>
      record.exercise_id === exerciseId &&
      record.activity_id === activityId &&
      record.substitution_applicability === "eligible"
  );
}

function validateClosure(candidate) {
  assertNoNonRegistryAuthority(candidate);
  assertExactKeys(candidate, ROOT_KEYS, "closure_root_keys_invalid");

  if (candidate.closure_version !== "S-V1-33") {
    fail("closure_version_invalid");
  }

  const supportedActivityIds = sortedUnique(candidate.supported_activity_ids, "supported_activity_ids_invalid");

  if (JSON.stringify(supportedActivityIds) !== JSON.stringify(LOCKED_SUPPORTED_ACTIVITY_IDS)) {
    fail("supported_activity_set_invalid", { supportedActivityIds });
  }

  assertExactKeys(candidate.registry_records, REGISTRY_RECORD_KEYS, "registry_records_keys_invalid");

  const activities = candidate.registry_records.activities;
  const movements = candidate.registry_records.movements;
  const equipment = candidate.registry_records.equipment;
  const exercises = candidate.registry_records.exercises;
  const applicabilityRecords = candidate.registry_records.applicability_records;
  const edges = candidate.registry_records.substitution_edges;

  for (const collection of [activities, movements, equipment, exercises, applicabilityRecords, edges, candidate.substitution_cases]) {
    assertArray(collection, "registry_collection_not_array");
  }

  const activityIds = new Set();
  const movementIds = new Set();
  const equipmentIds = new Set();
  const exerciseIds = new Set();
  const edgeIds = new Set();

  for (const activity of activities) {
    assertObject(activity, "activity_record_not_object");
    assertString(activity.activity_id, "activity_id_invalid");

    if (!LOCKED_SUPPORTED_ACTIVITY_IDS.includes(activity.activity_id)) {
      fail("unsupported_activity_refused", { activity_id: activity.activity_id });
    }

    activityIds.add(activity.activity_id);
  }

  for (const requiredActivityId of LOCKED_SUPPORTED_ACTIVITY_IDS) {
    if (!activityIds.has(requiredActivityId)) {
      fail("supported_activity_missing", { activity_id: requiredActivityId });
    }
  }

  for (const movement of movements) {
    assertObject(movement, "movement_record_not_object");
    assertString(movement.movement_id, "movement_id_invalid");
    movementIds.add(movement.movement_id);
  }

  for (const item of equipment) {
    assertObject(item, "equipment_record_not_object");
    assertString(item.equipment_id, "equipment_id_invalid");
    equipmentIds.add(item.equipment_id);
  }

  for (const exercise of exercises) {
    assertObject(exercise, "exercise_record_not_object");
    assertString(exercise.exercise_id, "exercise_id_invalid");
    assertString(exercise.activity_id, "exercise_activity_id_invalid");
    assertString(exercise.movement_id, "exercise_movement_id_invalid");
    assertArray(exercise.equipment_ids, "exercise_equipment_ids_invalid");

    if (!activityIds.has(exercise.activity_id)) {
      fail("exercise_activity_missing", { exercise_id: exercise.exercise_id, activity_id: exercise.activity_id });
    }

    if (!movementIds.has(exercise.movement_id)) {
      fail("exercise_movement_missing", { exercise_id: exercise.exercise_id, movement_id: exercise.movement_id });
    }

    for (const equipmentId of exercise.equipment_ids) {
      if (!equipmentIds.has(equipmentId)) {
        fail("exercise_equipment_missing", { exercise_id: exercise.exercise_id, equipment_id: equipmentId });
      }
    }

    if (exerciseIds.has(exercise.exercise_id)) {
      fail("duplicate_exercise_id", { exercise_id: exercise.exercise_id });
    }

    exerciseIds.add(exercise.exercise_id);
  }

  for (const record of applicabilityRecords) {
    assertObject(record, "applicability_record_not_object");
    assertString(record.exercise_id, "applicability_exercise_id_invalid");
    assertString(record.activity_id, "applicability_activity_id_invalid");
    assertString(record.substitution_applicability, "applicability_state_invalid");

    if (!exerciseIds.has(record.exercise_id)) {
      fail("applicability_exercise_missing", { exercise_id: record.exercise_id });
    }

    if (!activityIds.has(record.activity_id)) {
      fail("applicability_activity_missing", { activity_id: record.activity_id });
    }

    if (!["eligible", "not_eligible"].includes(record.substitution_applicability)) {
      fail("applicability_state_invalid", { substitution_applicability: record.substitution_applicability });
    }
  }

  for (const edge of edges) {
    assertObject(edge, "substitution_edge_record_not_object");
    assertString(edge.edge_id, "substitution_edge_id_invalid");
    assertString(edge.source_exercise_id, "substitution_source_exercise_id_invalid");
    assertString(edge.target_exercise_id, "substitution_target_exercise_id_invalid");
    assertString(edge.activity_id, "substitution_activity_id_invalid");
    assertArray(edge.reason_codes, "substitution_reason_codes_invalid");

    if (edgeIds.has(edge.edge_id)) {
      fail("duplicate_substitution_edge_id", { edge_id: edge.edge_id });
    }

    edgeIds.add(edge.edge_id);

    if (!activityIds.has(edge.activity_id) || !LOCKED_SUPPORTED_ACTIVITY_IDS.includes(edge.activity_id)) {
      fail("unsupported_activity_refused", { activity_id: edge.activity_id });
    }

    const sourceExercise = exercises.find((exercise) => exercise.exercise_id === edge.source_exercise_id);
    const targetExercise = exercises.find((exercise) => exercise.exercise_id === edge.target_exercise_id);

    if (!sourceExercise) {
      fail("substitution_edge_source_missing", { edge_id: edge.edge_id, source_exercise_id: edge.source_exercise_id });
    }

    if (!targetExercise) {
      fail("substitution_edge_target_missing", { edge_id: edge.edge_id, target_exercise_id: edge.target_exercise_id });
    }

    if (sourceExercise.activity_id !== edge.activity_id || targetExercise.activity_id !== edge.activity_id) {
      fail("substitution_edge_activity_mismatch", { edge_id: edge.edge_id });
    }

    if (!hasEligibleApplicability(applicabilityRecords, edge.source_exercise_id, edge.activity_id)) {
      fail("substitution_source_applicability_missing", { edge_id: edge.edge_id });
    }

    if (!hasEligibleApplicability(applicabilityRecords, edge.target_exercise_id, edge.activity_id)) {
      fail("substitution_target_applicability_missing", { edge_id: edge.edge_id });
    }
  }

  const contractCaseEdgeIds = new Set();

  for (const substitutionCase of candidate.substitution_cases) {
    if (!LOCKED_SUPPORTED_ACTIVITY_IDS.includes(substitutionCase.activity_id)) {
      fail("unsupported_activity_refused", { activity_id: substitutionCase.activity_id });
    }

    for (const edge of substitutionCase.substitution_edges) {
      contractCaseEdgeIds.add(edge.edge_id);
    }

    const result = tryBuildV1SubstitutionResult(substitutionCase);

    if (!result.ok) {
      fail(result.error.reason, result.error.details);
    }

    if (result.result.substitution_output.substitution_status !== "substitution_applied") {
      fail("substitution_case_not_applied", { activity_id: substitutionCase.activity_id });
    }

    if (result.result.substitution_output.substitution_edge_id === null) {
      fail("substitution_case_edge_missing", { activity_id: substitutionCase.activity_id });
    }
  }

  for (const edgeId of edgeIds) {
    if (!contractCaseEdgeIds.has(edgeId)) {
      fail("substitution_edge_without_contract_case", { edge_id: edgeId });
    }
  }

  return true;
}

function tryValidateClosure(candidate) {
  try {
    validateClosure(candidate);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: error.reason ?? "unknown_failure",
      details: error.details ?? {}
    };
  }
}

test("S-V1-33 validates complete substitution registry closure for supported activities", () => {
  assert.equal(validateClosure(fixture), true);

  const activities = fixture.substitution_cases.map((entry) => entry.activity_id).sort();
  assert.deepEqual(activities, LOCKED_SUPPORTED_ACTIVITY_IDS);
});

test("S-V1-33 all substitutions resolve through registry law and v1 contract", () => {
  for (const substitutionCase of fixture.substitution_cases) {
    const result = buildV1SubstitutionResult(substitutionCase);

    assert.equal(result.substitution_output.substitution_status, "substitution_applied");
    assert.equal(result.substitution_output.registry_trace.activity_link_verified, true);
    assert.equal(result.substitution_output.registry_trace.edge_link_verified, true);
    assert.equal(result.substitution_output.registry_trace.equipment_links_verified, true);
    assert.equal(result.substitution_output.registry_trace.exercise_links_verified, true);
    assert.equal(result.substitution_output.registry_trace.movement_links_verified, true);
  }
});

test("S-V1-33 refuses ad hoc substitutions and UI-only substitution authority", () => {
  for (const testCase of negativeFixture.cases.filter((entry) => entry.expected_reason === "substitution_non_registry_authority_refused")) {
    const input = clone(fixture);
    setPath(input, testCase.mutation_path, testCase.mutation_value);

    const result = tryValidateClosure(input);

    assert.equal(result.ok, false, testCase.case_id);
    assert.equal(result.reason, "substitution_non_registry_authority_refused", testCase.case_id);
  }
});

test("S-V1-33 negative fixture proves registry closure fails closed", () => {
  for (const testCase of negativeFixture.cases) {
    const input = clone(fixture);
    setPath(input, testCase.mutation_path, testCase.mutation_value);

    const result = tryValidateClosure(input);

    assert.equal(result.ok, false, testCase.case_id);
    assert.equal(result.reason, testCase.expected_reason, testCase.case_id);
  }
});

test("S-V1-33 documentation binds substitution registry closure", () => {
  const doc = fs.readFileSync("docs/v1/V1_SUBSTITUTION_REGISTRY_CLOSURE.md", "utf8");

  assert.match(doc, /All substitutions resolve through registry law/);
  assert.match(doc, /No ad hoc substitutions/);
  assert.match(doc, /No UI-only substitution authority/);
  assert.match(doc, /S-V1-33/);
});

test("S-V1-33 stays fixtures tests guard docs only", () => {
  const packageJson = fs.readFileSync("package.json", "utf8");

  assert.match(packageJson, /node --test test\/s_v1_33_substitution_registry_closure\.test\.mjs/);
  assert.match(packageJson, /node ci\/guards\/s_v1_33_substitution_registry_closure_guard\.mjs/);
});
