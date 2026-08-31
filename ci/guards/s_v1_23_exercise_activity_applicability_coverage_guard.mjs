// @law: v1 Exercise Activity Applicability Coverage Contract
// @severity: high
// @scope: v1-registry

// DEV NOTE: S-V1-23 boundary guard. This guard proves the exercise activity
// applicability coverage contract, missing-applicability fixture, docs,
// package wiring, and generated indexes agree before active applicability
// registry content begins. It must not add recommendation, optimisation,
// capability inference, ranking, or implementation scope.

import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const TOKEN = "CI_V1_EXERCISE_ACTIVITY_APPLICABILITY_COVERAGE";
const TOKEN_PREFIX = "v1_exercise_activity_applicability_coverage_";

const lockedActivityIds = Object.freeze([
  "powerlifting",
  "general_strength",
  "rugby_union",
  "strongman"
]);

const requiredActivityContexts = Object.freeze([
  "training",
  "testing",
  "competition"
]);

const requiredApplicabilityFields = Object.freeze([
  "applicability_id",
  "exercise_id",
  "activity_id",
  "activity_context",
  "applicability_state",
  "conditions",
  "tier_cap",
  "template_applicability",
  "substitution_applicability",
  "copy_legal_boundary_notes"
]);

const applicabilityStates = Object.freeze([
  "allowed",
  "conditional",
  "prohibited"
]);

const templateApplicabilityStates = Object.freeze([
  "eligible",
  "not_eligible"
]);

const substitutionApplicabilityStates = Object.freeze([
  "eligible",
  "not_eligible"
]);

const forbiddenApplicabilityKeys = Object.freeze([
  "recommendation_score",
  "recommended_rank",
  "ranking_score",
  "rank",
  "optimisation_score",
  "optimization_score",
  "capability_inference",
  "capability_score",
  "inferred_applicability",
  "preferred_exercise"
]);

const requiredFiles = Object.freeze([
  "docs/v1/V1_EXERCISE_ACTIVITY_APPLICABILITY_COVERAGE_CONTRACT.md",
  "ci/fixtures/v1_exercise_activity_applicability_coverage_negative/s_v1_23_missing_applicability_negative.json",
  "test/s_v1_23_exercise_activity_applicability_coverage.test.mjs",
  "ci/guards/s_v1_23_exercise_activity_applicability_coverage_guard.mjs",
  "docs/v1/V1_SUPPORTED_ACTIVITY_SET_LOCK.md",
  "docs/v1/V1_EXERCISE_REGISTRY_CONTRACT.md",
  "docs/v1/V1_EQUIPMENT_REGISTRY_COVERAGE_CONTRACT.md",
  "docs/roadmap/V1_REGISTRY_EXPANSION_TARGET.md",
  "docs/roadmap/V1_REGISTRY_CONTENT_PRODUCTION_CONTRACT.md"
]);

function fail(message, details = {}) {
  console.error(JSON.stringify({
    ok: false,
    guard: "S-V1-23",
    token: TOKEN,
    message,
    ...details
  }));
  process.exit(1);
}

function contractFail(code, message, details = {}) {
  const error = new Error(`${TOKEN_PREFIX}${code}: ${message}`);
  error.code = `${TOKEN_PREFIX}${code}`;
  error.details = details;
  throw error;
}

function readText(relativePath) {
  const fullPath = path.join(repoRoot, relativePath);

  if (!fs.existsSync(fullPath)) {
    fail(`missing required file: ${relativePath}`);
  }

  return fs.readFileSync(fullPath, "utf8");
}

function readJson(relativePath) {
  try {
    return JSON.parse(readText(relativePath));
  } catch (error) {
    fail(`invalid JSON in ${relativePath}: ${error?.message ?? String(error)}`);
  }
}

function assertIncludes(text, required, context) {
  if (!text.includes(required)) {
    fail(`${context} missing required text: ${required}`);
  }
}

function assertArrayEquals(actual, expected, context) {
  if (!Array.isArray(actual)) {
    fail(`${context} is not an array`);
  }

  if (actual.length !== expected.length) {
    fail(`${context} length mismatch: expected ${expected.length}, got ${actual.length}`);
  }

  for (let i = 0; i < expected.length; i++) {
    if (actual[i] !== expected[i]) {
      fail(`${context} mismatch at index ${i}: expected ${expected[i]}, got ${actual[i]}`);
    }
  }
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(Object(value), key);
}

function asArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (value === null || value === undefined) {
    return [];
  }

  return [value];
}

function uniqueStrings(values, code, context) {
  const out = [];
  const seen = new Set();

  for (const value of values) {
    if (typeof value !== "string" || value.length === 0) {
      contractFail(code, "expected non-empty string values", context);
    }

    if (!seen.has(value)) {
      seen.add(value);
      out.push(value);
    }
  }

  return out;
}

function activityIdsForExercise(record) {
  return uniqueStrings([
    record.primary_activity_applicability,
    ...asArray(record.secondary_activity_applicability)
  ], "exercise_activity_invalid", {
    exercise_id: record?.exercise_id ?? null
  });
}

function assertNoForbiddenApplicabilityKeys(record, context) {
  for (const key of forbiddenApplicabilityKeys) {
    if (hasOwn(record, key)) {
      contractFail("forbidden_recommendation_inference_or_ranking_scope", "applicability metadata must not include recommendation, optimisation, capability inference, or ranking fields", {
        ...context,
        field: key
      });
    }
  }
}

function assertExerciseApplicabilitySourceShape(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    contractFail("exercise_record_not_object", "exercise registry entry must be an object");
  }

  for (const field of [
    "exercise_id",
    "primary_activity_applicability",
    "secondary_activity_applicability"
  ]) {
    if (!hasOwn(record, field)) {
      contractFail("exercise_applicability_source_field_missing", `exercise registry entry missing field required for applicability closure: ${field}`, {
        exercise_id: record.exercise_id ?? null,
        field
      });
    }
  }

  if (typeof record.exercise_id !== "string" || record.exercise_id.length === 0) {
    contractFail("exercise_id_invalid", "exercise_id must be a non-empty string");
  }

  if (typeof record.primary_activity_applicability !== "string" || record.primary_activity_applicability.length === 0) {
    contractFail("primary_activity_invalid", "primary_activity_applicability must be a non-empty string", {
      exercise_id: record.exercise_id
    });
  }

  if (!Array.isArray(record.secondary_activity_applicability)) {
    contractFail("secondary_activity_invalid", "secondary_activity_applicability must be an explicit array", {
      exercise_id: record.exercise_id
    });
  }

  for (const activityId of activityIdsForExercise(record)) {
    if (!lockedActivityIds.includes(activityId)) {
      contractFail("unsupported_activity_leakage", "exercise applicability source references unsupported activity", {
        exercise_id: record.exercise_id,
        activity_id: activityId
      });
    }
  }

  assertNoForbiddenApplicabilityKeys(record, {
    exercise_id: record.exercise_id
  });
}

function assertApplicabilityRecordShape(record, exerciseIds) {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    contractFail("applicability_record_not_object", "applicability registry entry must be an object");
  }

  for (const field of requiredApplicabilityFields) {
    if (!hasOwn(record, field)) {
      contractFail("required_applicability_field_missing", `applicability registry entry missing required field: ${field}`, {
        applicability_id: record.applicability_id ?? null,
        field
      });
    }
  }

  for (const field of [
    "applicability_id",
    "exercise_id",
    "activity_id",
    "activity_context",
    "applicability_state",
    "template_applicability",
    "substitution_applicability",
    "copy_legal_boundary_notes"
  ]) {
    if (typeof record[field] !== "string" || record[field].length === 0) {
      contractFail("required_applicability_field_invalid", `${field} must be a non-empty string`, {
        applicability_id: record.applicability_id ?? null,
        field
      });
    }
  }

  if (!exerciseIds.has(record.exercise_id)) {
    contractFail("unknown_exercise_reference", "applicability entry references unknown exercise", {
      applicability_id: record.applicability_id,
      exercise_id: record.exercise_id
    });
  }

  if (!lockedActivityIds.includes(record.activity_id)) {
    contractFail("unsupported_activity_leakage", "applicability entry references unsupported activity", {
      applicability_id: record.applicability_id,
      activity_id: record.activity_id
    });
  }

  if (!requiredActivityContexts.includes(record.activity_context)) {
    contractFail("activity_context_invalid", "applicability entry uses unsupported activity context", {
      applicability_id: record.applicability_id,
      activity_context: record.activity_context
    });
  }

  if (!applicabilityStates.includes(record.applicability_state)) {
    contractFail("applicability_state_invalid", "applicability_state must be allowed, conditional, or prohibited", {
      applicability_id: record.applicability_id,
      applicability_state: record.applicability_state
    });
  }

  if (!templateApplicabilityStates.includes(record.template_applicability)) {
    contractFail("template_applicability_invalid", "template_applicability must be eligible or not_eligible", {
      applicability_id: record.applicability_id,
      template_applicability: record.template_applicability
    });
  }

  if (!substitutionApplicabilityStates.includes(record.substitution_applicability)) {
    contractFail("substitution_applicability_invalid", "substitution_applicability must be eligible or not_eligible", {
      applicability_id: record.applicability_id,
      substitution_applicability: record.substitution_applicability
    });
  }

  if (!Array.isArray(record.conditions)) {
    contractFail("conditions_invalid", "conditions must be an explicit array", {
      applicability_id: record.applicability_id
    });
  }

  for (const condition of record.conditions) {
    if (typeof condition !== "string" || condition.length === 0) {
      contractFail("conditions_invalid", "conditions must contain non-empty strings only", {
        applicability_id: record.applicability_id
      });
    }
  }

  if (record.applicability_state === "conditional") {
    if (!Number.isInteger(record.tier_cap) || record.tier_cap < 1 || record.tier_cap > 4) {
      contractFail("conditional_tier_cap_invalid", "conditional applicability requires integer tier_cap from 1 to 4", {
        applicability_id: record.applicability_id,
        tier_cap: record.tier_cap
      });
    }

    if (record.conditions.length === 0) {
      contractFail("conditional_conditions_missing", "conditional applicability requires explicit condition references", {
        applicability_id: record.applicability_id
      });
    }
  } else if (record.tier_cap !== null) {
    contractFail("tier_cap_must_be_null", "allowed or prohibited applicability must use null tier_cap", {
      applicability_id: record.applicability_id,
      tier_cap: record.tier_cap
    });
  }

  assertNoForbiddenApplicabilityKeys(record, {
    applicability_id: record.applicability_id,
    exercise_id: record.exercise_id
  });
}

function validateExerciseActivityApplicabilityCoverage({ exerciseRecords, applicabilityRecords }) {
  if (!Array.isArray(exerciseRecords)) {
    contractFail("exercise_records_not_array", "exercise records must be an array");
  }

  if (!Array.isArray(applicabilityRecords)) {
    contractFail("applicability_records_not_array", "applicability records must be an array");
  }

  if (exerciseRecords.length === 0) {
    contractFail("exercise_records_empty", "exercise records must not be empty for applicability closure");
  }

  const exerciseIds = new Set();
  const requiredKeys = new Set();

  for (const exercise of exerciseRecords) {
    assertExerciseApplicabilitySourceShape(exercise);

    if (exerciseIds.has(exercise.exercise_id)) {
      contractFail("duplicate_exercise_id", "exercise_id must be unique", {
        exercise_id: exercise.exercise_id
      });
    }

    exerciseIds.add(exercise.exercise_id);

    for (const activityId of activityIdsForExercise(exercise)) {
      for (const activityContext of requiredActivityContexts) {
        requiredKeys.add(`${exercise.exercise_id}|${activityId}|${activityContext}`);
      }
    }
  }

  const seenApplicabilityIds = new Set();
  const seenApplicabilityKeys = new Set();

  for (const applicability of applicabilityRecords) {
    assertApplicabilityRecordShape(applicability, exerciseIds);

    if (seenApplicabilityIds.has(applicability.applicability_id)) {
      contractFail("duplicate_applicability_id", "applicability_id must be unique", {
        applicability_id: applicability.applicability_id
      });
    }

    seenApplicabilityIds.add(applicability.applicability_id);

    const key = `${applicability.exercise_id}|${applicability.activity_id}|${applicability.activity_context}`;

    if (seenApplicabilityKeys.has(key)) {
      contractFail("duplicate_applicability_key", "exercise/activity/context applicability must be unique", {
        exercise_id: applicability.exercise_id,
        activity_id: applicability.activity_id,
        activity_context: applicability.activity_context
      });
    }

    seenApplicabilityKeys.add(key);
  }

  for (const key of requiredKeys) {
    if (!seenApplicabilityKeys.has(key)) {
      const [exerciseId, activityId, activityContext] = key.split("|");

      contractFail("missing_applicability", "missing explicit exercise activity applicability entry", {
        exercise_id: exerciseId,
        activity_id: activityId,
        activity_context: activityContext
      });
    }
  }

  return true;
}

function assertThrowsWithCode(fn, expectedCode, context) {
  try {
    fn();
  } catch (error) {
    if (error && error.code === expectedCode) {
      return error;
    }

    fail(`${context}: expected ${expectedCode}, got ${error && error.code ? error.code : "no_code"}`);
  }

  fail(`${context}: expected throw with ${expectedCode}`);
}

for (const file of requiredFiles) {
  readText(file);
}

for (const forbiddenPath of [
  "shared/v1-registry/v1ExerciseActivityApplicabilityCoverageContract.mjs"
]) {
  if (fs.existsSync(path.join(repoRoot, forbiddenPath))) {
    fail(`forbidden active or implementation surface present: ${forbiddenPath}`);
  }
}

const fixturePath = "ci/fixtures/v1_exercise_activity_applicability_coverage_negative/s_v1_23_missing_applicability_negative.json";
const fixture = readJson(fixturePath);

if (fixture.slice_id !== "S-V1-23") {
  fail(`${fixturePath} slice_id must be S-V1-23`);
}

assertArrayEquals(fixture.locked_activity_ids, lockedActivityIds, `${fixturePath}.locked_activity_ids`);
assertArrayEquals(fixture.required_activity_contexts, requiredActivityContexts, `${fixturePath}.required_activity_contexts`);

if (fixture.expected_failure_code !== "v1_exercise_activity_applicability_coverage_missing_applicability") {
  fail(`${fixturePath} expected_failure_code mismatch`);
}

const error = assertThrowsWithCode(
  () => validateExerciseActivityApplicabilityCoverage({
    exerciseRecords: fixture.exercise_records,
    applicabilityRecords: fixture.applicability_records
  }),
  fixture.expected_failure_code,
  "missing applicability negative fixture"
);

if (error.details?.exercise_id !== fixture.missing_case.exercise_id) {
  fail("negative fixture failed for wrong exercise_id");
}

if (error.details?.activity_id !== fixture.missing_case.activity_id) {
  fail("negative fixture failed for wrong activity_id");
}

if (error.details?.activity_context !== fixture.missing_case.activity_context) {
  fail("negative fixture failed for wrong activity_context");
}

const docText = readText("docs/v1/V1_EXERCISE_ACTIVITY_APPLICABILITY_COVERAGE_CONTRACT.md");
const packageText = readText("package.json");
const guardsIndexText = readText("docs/GUARDS_INDEX.md");
const failureTokenText = readText("docs/dev/FAILURE_TOKEN_INDEX.md");

for (const activityId of lockedActivityIds) {
  assertIncludes(docText, activityId, "docs/v1/V1_EXERCISE_ACTIVITY_APPLICABILITY_COVERAGE_CONTRACT.md");
}

for (const context of requiredActivityContexts) {
  assertIncludes(docText, context, "docs/v1/V1_EXERCISE_ACTIVITY_APPLICABILITY_COVERAGE_CONTRACT.md");
}

for (const field of requiredApplicabilityFields) {
  assertIncludes(docText, field, "docs/v1/V1_EXERCISE_ACTIVITY_APPLICABILITY_COVERAGE_CONTRACT.md");
}

for (const requiredText of [
  "S-V1-23",
  "exercise_activity_applicability_registry",
  "missing_applicability",
  "No active applicability registry rows are added by this slice",
  "factual registry metadata",
  "does not recommend or optimise",
  "does not rank",
  "does not infer capability",
  "Missing applicability fails closed"
]) {
  assertIncludes(docText, requiredText, "docs/v1/V1_EXERCISE_ACTIVITY_APPLICABILITY_COVERAGE_CONTRACT.md");
}

// S-REG-33 authorised the real activation this contract was written ahead of.
// Once active exercise_activity_applicability registry content exists, it
// must independently satisfy the same coverage validator the fixture proof
// above exercises - this is additive real-content enforcement, not a
// replacement of that proof.
const activeApplicabilityRegistryPath = "registries/exercise_activity_applicability/exercise_activity_applicability.registry.json";

if (fs.existsSync(path.join(repoRoot, activeApplicabilityRegistryPath))) {
  const activeApplicabilityRegistry = readJson(activeApplicabilityRegistryPath);
  const activeExerciseRegistry = readJson("registries/exercise/exercise.registry.json");

  try {
    validateExerciseActivityApplicabilityCoverage({
      exerciseRecords: Object.values(activeExerciseRegistry.entries ?? {}),
      applicabilityRecords: Object.values(activeApplicabilityRegistry.entries ?? {})
    });
  } catch (activeContentError) {
    fail(
      `active exercise activity applicability coverage contract failed: ${activeContentError.message}`,
      activeContentError.details ?? {}
    );
  }
}

assertIncludes(
  packageText,
  "node --test test/s_v1_23_exercise_activity_applicability_coverage.test.mjs",
  "package.json lint:fast"
);

assertIncludes(
  packageText,
  "node ci/guards/s_v1_23_exercise_activity_applicability_coverage_guard.mjs",
  "package.json lint:fast"
);

assertIncludes(
  guardsIndexText,
  "s_v1_23_exercise_activity_applicability_coverage_guard",
  "docs/GUARDS_INDEX.md"
);

assertIncludes(
  failureTokenText,
  TOKEN,
  "docs/dev/FAILURE_TOKEN_INDEX.md"
);

console.log(JSON.stringify({
  ok: true,
  guard: "S-V1-23",
  token: TOKEN,
  message: "Exercise activity applicability coverage contract passed."
}));
