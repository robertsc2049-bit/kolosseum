// @law: v1 Equipment Registry Coverage Contract
// @severity: high
// @scope: v1-registry

// DEV NOTE: S-V1-22 boundary guard. This guard proves the equipment registry
// coverage contract, FK negative fixture, documentation, package wiring, and
// generated indexes agree before active equipment registry content begins.
// It must not add gym inventory, EPOS, access-control, or implementation scope.

import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const TOKEN = "CI_V1_EQUIPMENT_REGISTRY_COVERAGE_CONTRACT";
const TOKEN_PREFIX = "v1_equipment_registry_coverage_contract_";

const lockedActivityIds = Object.freeze([
  "powerlifting",
  "general_strength",
  "rugby_union"
]);

const requiredEquipmentFields = Object.freeze([
  "equipment_id",
  "display_label",
  "equipment_class",
  "activity_applicability",
  "movement_pattern_applicability",
  "substitution_relevance",
  "template_relevance",
  "low_equipment_alternative_relevance",
  "copy_legal_boundary_notes"
]);

const minimumEquipmentIds = Object.freeze([
  "barbell",
  "rack",
  "bench",
  "plate",
  "dumbbell",
  "kettlebell",
  "cable_machine",
  "resistance_band",
  "bodyweight",
  "pull_up_bar",
  "trap_bar",
  "medicine_ball",
  "sled",
  "box",
  "machine_general",
  "cardio_machine_general",
  "open_floor_space"
]);

const forbiddenOperationalTerms = Object.freeze([
  "gym_inventory",
  "epos",
  "access_control",
  "door_access",
  "scanner",
  "turnstile",
  "stock_count",
  "purchase_price",
  "sale_price"
]);

const requiredFiles = Object.freeze([
  "docs/v1/V1_EQUIPMENT_REGISTRY_COVERAGE_CONTRACT.md",
  "ci/fixtures/v1_equipment_registry_coverage_contract_negative/s_v1_22_missing_equipment_reference_negative.json",
  "test/s_v1_22_equipment_registry_coverage_contract.test.mjs",
  "ci/guards/s_v1_22_equipment_registry_coverage_contract_guard.mjs",
  "docs/v1/V1_EXERCISE_REGISTRY_CONTRACT.md",
  "docs/v1/V1_SUPPORTED_ACTIVITY_SET_LOCK.md",
  "docs/roadmap/V1_REGISTRY_EXPANSION_TARGET.md",
  "docs/roadmap/V1_REGISTRY_CONTENT_PRODUCTION_CONTRACT.md"
]);

function fail(message, details = {}) {
  console.error(JSON.stringify({
    ok: false,
    guard: "S-V1-22",
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

function assertStringArray(value, code, field, context) {
  if (!Array.isArray(value) || value.length === 0) {
    contractFail(code, `${field} must be a non-empty array`, context);
  }

  const seen = new Set();

  for (const item of value) {
    if (typeof item !== "string" || item.length === 0) {
      contractFail(code, `${field} must contain non-empty strings only`, context);
    }

    if (seen.has(item)) {
      contractFail(code, `${field} must not contain duplicate values`, {
        ...context,
        value: item
      });
    }

    seen.add(item);
  }
}

function assertNoOperationalEquipmentScope(record) {
  const text = JSON.stringify(record).toLowerCase();

  for (const term of forbiddenOperationalTerms) {
    if (text.includes(term)) {
      contractFail("forbidden_operational_equipment_scope", "equipment registry contract must not include gym inventory, EPOS, or access-control scope", {
        equipment_id: record.equipment_id ?? null,
        term
      });
    }
  }
}

function assertEquipmentRecordShape(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    contractFail("equipment_record_not_object", "equipment registry entry must be an object");
  }

  for (const field of requiredEquipmentFields) {
    if (!hasOwn(record, field)) {
      contractFail("required_equipment_field_missing", `equipment registry entry missing required field: ${field}`, {
        equipment_id: record.equipment_id ?? null,
        field
      });
    }
  }

  if (typeof record.equipment_id !== "string" || record.equipment_id.length === 0) {
    contractFail("equipment_id_invalid", "equipment_id must be a non-empty string");
  }

  assertStringArray(record.activity_applicability, "activity_applicability_invalid", "activity_applicability", {
    equipment_id: record.equipment_id
  });

  assertStringArray(record.movement_pattern_applicability, "movement_pattern_applicability_invalid", "movement_pattern_applicability", {
    equipment_id: record.equipment_id
  });

  for (const activityId of record.activity_applicability) {
    if (!lockedActivityIds.includes(activityId)) {
      contractFail("unsupported_activity_leakage", "equipment registry entry references unsupported activity", {
        equipment_id: record.equipment_id,
        activity_id: activityId
      });
    }
  }

  for (const field of [
    "display_label",
    "equipment_class",
    "substitution_relevance",
    "template_relevance",
    "low_equipment_alternative_relevance",
    "copy_legal_boundary_notes"
  ]) {
    if (typeof record[field] !== "string" || record[field].length === 0) {
      contractFail("required_equipment_field_invalid", `${field} must be a non-empty string`, {
        equipment_id: record.equipment_id,
        field
      });
    }
  }

  assertNoOperationalEquipmentScope(record);
}

function assertExerciseEquipmentReferences(exerciseRecords, equipmentIds) {
  if (!Array.isArray(exerciseRecords)) {
    contractFail("exercise_records_not_array", "exercise records must be an array for FK validation");
  }

  for (const exercise of exerciseRecords) {
    if (!exercise || typeof exercise !== "object" || Array.isArray(exercise)) {
      contractFail("exercise_record_not_object", "exercise registry entry must be an object for FK validation");
    }

    if (typeof exercise.exercise_id !== "string" || exercise.exercise_id.length === 0) {
      contractFail("exercise_id_invalid", "exercise_id must be a non-empty string for FK validation");
    }

    for (const field of ["equipment_requirements", "equipment_alternatives"]) {
      if (!Array.isArray(exercise[field])) {
        contractFail("exercise_equipment_reference_array_missing", `${field} must be an explicit array`, {
          exercise_id: exercise.exercise_id,
          field
        });
      }

      for (const equipmentId of exercise[field]) {
        if (typeof equipmentId !== "string" || equipmentId.length === 0) {
          contractFail("equipment_reference_invalid", "equipment reference must be a non-empty string", {
            exercise_id: exercise.exercise_id,
            field
          });
        }

        if (!equipmentIds.has(equipmentId)) {
          contractFail("missing_equipment_reference", "exercise references equipment that is not declared in the equipment registry contract input", {
            exercise_id: exercise.exercise_id,
            equipment_id: equipmentId,
            field
          });
        }
      }
    }
  }
}

function validateEquipmentRegistryCoverage({ equipmentRecords, exerciseRecords }) {
  if (!Array.isArray(equipmentRecords)) {
    contractFail("equipment_records_not_array", "equipment records must be an array");
  }

  if (equipmentRecords.length === 0) {
    contractFail("equipment_registry_empty", "equipment registry contract requires explicit records for active content acceptance");
  }

  const equipmentIds = new Set();
  const activityCoverage = new Map(lockedActivityIds.map((activityId) => [activityId, new Set()]));

  for (const record of equipmentRecords) {
    assertEquipmentRecordShape(record);

    if (equipmentIds.has(record.equipment_id)) {
      contractFail("duplicate_equipment_id", "equipment_id must be unique", {
        equipment_id: record.equipment_id
      });
    }

    equipmentIds.add(record.equipment_id);

    for (const activityId of record.activity_applicability) {
      activityCoverage.get(activityId).add(record.equipment_id);
    }
  }

  for (const equipmentId of minimumEquipmentIds) {
    if (!equipmentIds.has(equipmentId)) {
      contractFail("required_equipment_missing", "minimum v1 equipment coverage is missing", {
        equipment_id: equipmentId
      });
    }
  }

  for (const activityId of lockedActivityIds) {
    if ((activityCoverage.get(activityId) ?? new Set()).size === 0) {
      contractFail("activity_equipment_coverage_missing", "locked activity has no explicit equipment coverage", {
        activity_id: activityId
      });
    }
  }

  assertExerciseEquipmentReferences(exerciseRecords, equipmentIds);

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

if (fs.existsSync(path.join(repoRoot, "registries/equipment/equipment.registry.json"))) {
  fail("S-V1-22 must not add active registries/equipment/equipment.registry.json");
}

const fixturePath = "ci/fixtures/v1_equipment_registry_coverage_contract_negative/s_v1_22_missing_equipment_reference_negative.json";
const fixture = readJson(fixturePath);

if (fixture.slice_id !== "S-V1-22") {
  fail(`${fixturePath} slice_id must be S-V1-22`);
}

assertArrayEquals(fixture.locked_activity_ids, lockedActivityIds, `${fixturePath}.locked_activity_ids`);

if (fixture.expected_failure_code !== "v1_equipment_registry_coverage_contract_missing_equipment_reference") {
  fail(`${fixturePath} expected_failure_code mismatch`);
}

const error = assertThrowsWithCode(
  () => validateEquipmentRegistryCoverage({
    equipmentRecords: fixture.equipment_records,
    exerciseRecords: fixture.exercise_records
  }),
  fixture.expected_failure_code,
  "missing equipment reference negative fixture"
);

if (error.details?.exercise_id !== fixture.missing_case.exercise_id) {
  fail("negative fixture failed for wrong exercise_id");
}

if (error.details?.equipment_id !== fixture.missing_case.equipment_id) {
  fail("negative fixture failed for wrong equipment_id");
}

const docText = readText("docs/v1/V1_EQUIPMENT_REGISTRY_COVERAGE_CONTRACT.md");
const packageText = readText("package.json");
const guardsIndexText = readText("docs/GUARDS_INDEX.md");
const failureTokenText = readText("docs/dev/FAILURE_TOKEN_INDEX.md");

for (const activityId of lockedActivityIds) {
  assertIncludes(docText, activityId, "docs/v1/V1_EQUIPMENT_REGISTRY_COVERAGE_CONTRACT.md");
}

for (const field of requiredEquipmentFields) {
  assertIncludes(docText, field, "docs/v1/V1_EQUIPMENT_REGISTRY_COVERAGE_CONTRACT.md");
}

for (const equipmentId of minimumEquipmentIds) {
  assertIncludes(docText, equipmentId, "docs/v1/V1_EQUIPMENT_REGISTRY_COVERAGE_CONTRACT.md");
}

for (const requiredText of [
  "S-V1-22",
  "missing_equipment_reference",
  "No active equipment registry rows are added by this slice",
  "missing equipment references fail closed",
  "No implicit equipment assumptions",
  "substitution",
  "programme templates",
  "gym inventory",
  "EPOS",
  "access control"
]) {
  assertIncludes(docText, requiredText, "docs/v1/V1_EQUIPMENT_REGISTRY_COVERAGE_CONTRACT.md");
}

for (const forbiddenPath of [
  "registries/equipment/equipment.registry.json",
  "shared/v1-registry/v1EquipmentRegistryCoverageContract.mjs"
]) {
  if (fs.existsSync(path.join(repoRoot, forbiddenPath))) {
    fail(`forbidden active or implementation surface present: ${forbiddenPath}`);
  }
}

assertIncludes(
  packageText,
  "node --test test/s_v1_22_equipment_registry_coverage_contract.test.mjs",
  "package.json lint:fast"
);

assertIncludes(
  packageText,
  "node ci/guards/s_v1_22_equipment_registry_coverage_contract_guard.mjs",
  "package.json lint:fast"
);

assertIncludes(
  guardsIndexText,
  "s_v1_22_equipment_registry_coverage_contract_guard",
  "docs/GUARDS_INDEX.md"
);

assertIncludes(
  failureTokenText,
  TOKEN,
  "docs/dev/FAILURE_TOKEN_INDEX.md"
);

console.log(JSON.stringify({
  ok: true,
  guard: "S-V1-22",
  token: TOKEN,
  message: "Equipment registry coverage contract passed."
}));
