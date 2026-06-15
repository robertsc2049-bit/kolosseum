// @law: v1 Exercise Registry Contract
// @severity: high
// @scope: v1-registry

// DEV NOTE: S-V1-21 boundary guard. This guard proves the exercise registry
// contract, negative fixture, documentation, package wiring, and generated
// indexes agree before large exercise content production begins. It must not
// require or add files under implementation surfaces such as shared/.

import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const TOKEN = "CI_V1_EXERCISE_REGISTRY_CONTRACT";
const TOKEN_PREFIX = "v1_exercise_registry_contract_";

const lockedActivityIds = Object.freeze([
  "powerlifting",
  "general_strength",
  "rugby_union"
]);

const requiredExerciseFields = Object.freeze([
  "exercise_id",
  "display_label",
  "movement_pattern_id",
  "primary_activity_applicability",
  "secondary_activity_applicability",
  "equipment_requirements",
  "equipment_alternatives",
  "difficulty_tier",
  "joint_stress_tags",
  "stimulus_intent",
  "instruction_short_text",
  "instruction_detail_text",
  "contraindication_or_exclusion_tags",
  "substitution_eligibility",
  "template_eligibility",
  "copy_legal_boundary_flags"
]);

const requiredMovementPatternCoverageByActivity = Object.freeze({
  powerlifting: Object.freeze([
    "squat",
    "hinge",
    "horizontal_push",
    "horizontal_pull",
    "brace"
  ]),
  general_strength: Object.freeze([
    "squat",
    "hinge",
    "horizontal_push",
    "vertical_push",
    "horizontal_pull",
    "vertical_pull",
    "carry",
    "brace",
    "lunge_split_stance"
  ]),
  rugby_union: Object.freeze([
    "squat",
    "hinge",
    "horizontal_push",
    "vertical_push",
    "horizontal_pull",
    "vertical_pull",
    "carry",
    "brace",
    "sprint_acceleration",
    "deceleration_change_of_direction",
    "jump_land",
    "conditioning_general"
  ])
});

const forbiddenFallbackMarkers = Object.freeze([
  "fallback",
  "default",
  "generic_fallback",
  "catch_all",
  "unknown",
  "misc",
  "other"
]);

const requiredFiles = Object.freeze([
  "docs/v1/V1_EXERCISE_REGISTRY_CONTRACT.md",
  "ci/fixtures/v1_exercise_registry_contract_negative/s_v1_21_missing_required_entry_negative.json",
  "test/s_v1_21_exercise_registry_contract.test.mjs",
  "ci/guards/s_v1_21_exercise_registry_contract_guard.mjs",
  "docs/v1/V1_SUPPORTED_ACTIVITY_SET_LOCK.md",
  "docs/roadmap/V1_REGISTRY_EXPANSION_TARGET.md",
  "docs/roadmap/V1_REGISTRY_CONTENT_PRODUCTION_CONTRACT.md"
]);

function fail(message, details = {}) {
  console.error(JSON.stringify({
    ok: false,
    guard: "S-V1-21",
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

function activityIdsForRecord(record) {
  return [
    ...asArray(record.primary_activity_applicability),
    ...asArray(record.secondary_activity_applicability),
    ...asArray(record.activity_applicability),
    ...asArray(record.activity_ids),
    ...asArray(record.activities)
  ].filter((value) => typeof value === "string" && value.length > 0);
}

function assertNoFallbackExerciseRecord(record) {
  const values = [
    record.exercise_id,
    record.display_label,
    record.movement_pattern_id,
    record.stimulus_intent,
    record.substitution_eligibility,
    record.template_eligibility
  ]
    .flatMap((value) => asArray(value))
    .filter((value) => typeof value === "string")
    .map((value) => value.toLowerCase());

  for (const marker of forbiddenFallbackMarkers) {
    if (values.some((value) => value === marker || value.includes(`_${marker}`) || value.includes(`${marker}_`))) {
      contractFail("fallback_record_present", `fallback-like exercise registry marker refused: ${marker}`, {
        exercise_id: record.exercise_id ?? null,
        marker
      });
    }
  }
}

function assertExerciseRecordShape(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    contractFail("record_not_object", "exercise registry entry must be an object");
  }

  for (const field of requiredExerciseFields) {
    if (!hasOwn(record, field)) {
      contractFail("required_field_missing", `exercise registry entry missing required field: ${field}`, {
        exercise_id: record.exercise_id ?? null,
        field
      });
    }
  }

  if (typeof record.exercise_id !== "string" || record.exercise_id.length === 0) {
    contractFail("exercise_id_invalid", "exercise_id must be a non-empty string");
  }

  if (!lockedActivityIds.includes(record.primary_activity_applicability)) {
    contractFail("primary_activity_not_locked", "primary activity applicability must be one locked v1 activity", {
      exercise_id: record.exercise_id,
      primary_activity_applicability: record.primary_activity_applicability
    });
  }

  for (const activityId of activityIdsForRecord(record)) {
    if (!lockedActivityIds.includes(activityId)) {
      contractFail("unsupported_activity_leakage", "exercise registry entry references unsupported activity", {
        exercise_id: record.exercise_id,
        activity_id: activityId
      });
    }
  }

  assertNoFallbackExerciseRecord(record);
}

function validateExerciseRegistryCoverage(records) {
  if (!Array.isArray(records)) {
    contractFail("registry_not_array", "exercise registry records must be an array");
  }

  if (records.length === 0) {
    contractFail("registry_empty", "exercise registry contract requires explicit records for active content acceptance");
  }

  const seenExerciseIds = new Set();
  const coverage = new Map(
    lockedActivityIds.map((activityId) => [activityId, new Set()])
  );

  for (const record of records) {
    assertExerciseRecordShape(record);

    if (seenExerciseIds.has(record.exercise_id)) {
      contractFail("duplicate_exercise_id", "exercise_id must be unique", {
        exercise_id: record.exercise_id
      });
    }

    seenExerciseIds.add(record.exercise_id);

    for (const activityId of activityIdsForRecord(record)) {
      if (coverage.has(activityId)) {
        coverage.get(activityId).add(record.movement_pattern_id);
      }
    }
  }

  for (const [activityId, movementPatterns] of Object.entries(requiredMovementPatternCoverageByActivity)) {
    const covered = coverage.get(activityId) ?? new Set();

    for (const movementPatternId of movementPatterns) {
      if (!covered.has(movementPatternId)) {
        contractFail("required_coverage_missing", "required exercise registry movement coverage is missing", {
          activity_id: activityId,
          movement_pattern_id: movementPatternId
        });
      }
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

if (fs.existsSync(path.join(repoRoot, "shared/v1-registry/v1ExerciseRegistryContract.mjs"))) {
  fail("S-V1-21 must not add shared/v1-registry/v1ExerciseRegistryContract.mjs");
}

const fixturePath = "ci/fixtures/v1_exercise_registry_contract_negative/s_v1_21_missing_required_entry_negative.json";
const fixture = readJson(fixturePath);

if (fixture.slice_id !== "S-V1-21") {
  fail(`${fixturePath} slice_id must be S-V1-21`);
}

assertArrayEquals(fixture.locked_activity_ids, lockedActivityIds, `${fixturePath}.locked_activity_ids`);

if (fixture.expected_failure_code !== "v1_exercise_registry_contract_required_coverage_missing") {
  fail(`${fixturePath} expected_failure_code mismatch`);
}

const error = assertThrowsWithCode(
  () => validateExerciseRegistryCoverage(fixture.records),
  fixture.expected_failure_code,
  "missing required entry negative fixture"
);

if (error.details?.activity_id !== fixture.missing_case.activity_id) {
  fail("negative fixture failed for wrong activity_id");
}

if (error.details?.movement_pattern_id !== fixture.missing_case.movement_pattern_id) {
  fail("negative fixture failed for wrong movement_pattern_id");
}

const docText = readText("docs/v1/V1_EXERCISE_REGISTRY_CONTRACT.md");
const packageText = readText("package.json");
const guardsIndexText = readText("docs/GUARDS_INDEX.md");
const failureTokenText = readText("docs/dev/FAILURE_TOKEN_INDEX.md");

for (const activityId of lockedActivityIds) {
  assertIncludes(docText, activityId, "docs/v1/V1_EXERCISE_REGISTRY_CONTRACT.md");
}

for (const field of requiredExerciseFields) {
  assertIncludes(docText, field, "docs/v1/V1_EXERCISE_REGISTRY_CONTRACT.md");
}

for (const requiredText of [
  "S-V1-21",
  "required_coverage_missing",
  "No active exercise registry rows are added by this slice",
  "missing required entries fail closed",
  "fallback records are refused"
]) {
  assertIncludes(docText, requiredText, "docs/v1/V1_EXERCISE_REGISTRY_CONTRACT.md");
}

assertIncludes(
  packageText,
  "node --test test/s_v1_21_exercise_registry_contract.test.mjs",
  "package.json lint:fast"
);

assertIncludes(
  packageText,
  "node ci/guards/s_v1_21_exercise_registry_contract_guard.mjs",
  "package.json lint:fast"
);

assertIncludes(
  guardsIndexText,
  "s_v1_21_exercise_registry_contract_guard",
  "docs/GUARDS_INDEX.md"
);

assertIncludes(
  failureTokenText,
  TOKEN,
  "docs/dev/FAILURE_TOKEN_INDEX.md"
);

console.log(JSON.stringify({
  ok: true,
  guard: "S-V1-21",
  token: TOKEN,
  message: "Exercise registry contract passed."
}));
