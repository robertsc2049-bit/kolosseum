import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = process.cwd();

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

function fail(code, message, details = {}) {
  const error = new Error(`${TOKEN_PREFIX}${code}: ${message}`);
  error.code = `${TOKEN_PREFIX}${code}`;
  error.details = details;
  throw error;
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
    fail(code, `${field} must be a non-empty array`, context);
  }

  const seen = new Set();

  for (const item of value) {
    if (typeof item !== "string" || item.length === 0) {
      fail(code, `${field} must contain non-empty strings only`, context);
    }

    if (seen.has(item)) {
      fail(code, `${field} must not contain duplicate values`, {
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
      fail("forbidden_operational_equipment_scope", "equipment registry contract must not include gym inventory, EPOS, or access-control scope", {
        equipment_id: record.equipment_id ?? null,
        term
      });
    }
  }
}

function assertEquipmentRecordShape(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    fail("equipment_record_not_object", "equipment registry entry must be an object");
  }

  for (const field of requiredEquipmentFields) {
    if (!hasOwn(record, field)) {
      fail("required_equipment_field_missing", `equipment registry entry missing required field: ${field}`, {
        equipment_id: record.equipment_id ?? null,
        field
      });
    }
  }

  if (typeof record.equipment_id !== "string" || record.equipment_id.length === 0) {
    fail("equipment_id_invalid", "equipment_id must be a non-empty string");
  }

  if (typeof record.display_label !== "string" || record.display_label.length === 0) {
    fail("display_label_invalid", "display_label must be a non-empty string", {
      equipment_id: record.equipment_id
    });
  }

  assertStringArray(record.activity_applicability, "activity_applicability_invalid", "activity_applicability", {
    equipment_id: record.equipment_id
  });

  assertStringArray(record.movement_pattern_applicability, "movement_pattern_applicability_invalid", "movement_pattern_applicability", {
    equipment_id: record.equipment_id
  });

  for (const activityId of record.activity_applicability) {
    if (!lockedActivityIds.includes(activityId)) {
      fail("unsupported_activity_leakage", "equipment registry entry references unsupported activity", {
        equipment_id: record.equipment_id,
        activity_id: activityId
      });
    }
  }

  for (const field of [
    "substitution_relevance",
    "template_relevance",
    "low_equipment_alternative_relevance",
    "copy_legal_boundary_notes"
  ]) {
    if (typeof record[field] !== "string" || record[field].length === 0) {
      fail("required_equipment_field_invalid", `${field} must be a non-empty string`, {
        equipment_id: record.equipment_id,
        field
      });
    }
  }

  assertNoOperationalEquipmentScope(record);
}

function assertExerciseEquipmentReferences(exerciseRecords, equipmentIds) {
  if (!Array.isArray(exerciseRecords)) {
    fail("exercise_records_not_array", "exercise records must be an array for FK validation");
  }

  for (const exercise of exerciseRecords) {
    if (!exercise || typeof exercise !== "object" || Array.isArray(exercise)) {
      fail("exercise_record_not_object", "exercise registry entry must be an object for FK validation");
    }

    if (typeof exercise.exercise_id !== "string" || exercise.exercise_id.length === 0) {
      fail("exercise_id_invalid", "exercise_id must be a non-empty string for FK validation");
    }

    for (const field of ["equipment_requirements", "equipment_alternatives"]) {
      if (!Array.isArray(exercise[field])) {
        fail("exercise_equipment_reference_array_missing", `${field} must be an explicit array`, {
          exercise_id: exercise.exercise_id,
          field
        });
      }

      for (const equipmentId of exercise[field]) {
        if (typeof equipmentId !== "string" || equipmentId.length === 0) {
          fail("equipment_reference_invalid", "equipment reference must be a non-empty string", {
            exercise_id: exercise.exercise_id,
            field
          });
        }

        if (!equipmentIds.has(equipmentId)) {
          fail("missing_equipment_reference", "exercise references equipment that is not declared in the equipment registry contract input", {
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
    fail("equipment_records_not_array", "equipment records must be an array");
  }

  if (equipmentRecords.length === 0) {
    fail("equipment_registry_empty", "equipment registry contract requires explicit records for active content acceptance");
  }

  const equipmentIds = new Set();
  const activityCoverage = new Map(lockedActivityIds.map((activityId) => [activityId, new Set()]));

  for (const record of equipmentRecords) {
    assertEquipmentRecordShape(record);

    if (equipmentIds.has(record.equipment_id)) {
      fail("duplicate_equipment_id", "equipment_id must be unique", {
        equipment_id: record.equipment_id
      });
    }

    equipmentIds.add(record.equipment_id);

    for (const activityId of record.activity_applicability) {
      activityCoverage.get(activityId).add(record.equipment_id);
    }
  }

  for (const minimumEquipmentId of minimumEquipmentIds) {
    if (!equipmentIds.has(minimumEquipmentId)) {
      fail("required_equipment_missing", "minimum v1 equipment coverage is missing", {
        equipment_id: minimumEquipmentId
      });
    }
  }

  for (const activityId of lockedActivityIds) {
    if ((activityCoverage.get(activityId) ?? new Set()).size === 0) {
      fail("activity_equipment_coverage_missing", "locked activity has no explicit equipment coverage", {
        activity_id: activityId
      });
    }
  }

  assertExerciseEquipmentReferences(exerciseRecords, equipmentIds);

  return {
    ok: true,
    equipment_count: equipmentRecords.length,
    locked_activity_ids: [...lockedActivityIds]
  };
}

function makeEquipmentRecord(equipmentId, overrides = {}) {
  return {
    equipment_id: equipmentId,
    display_label: equipmentId.replaceAll("_", " "),
    equipment_class: "contract_class",
    activity_applicability: [
      "powerlifting",
      "general_strength",
      "rugby_union"
    ],
    movement_pattern_applicability: [
      "squat",
      "hinge",
      "horizontal_push",
      "vertical_push",
      "horizontal_pull",
      "vertical_pull",
      "carry",
      "brace"
    ],
    substitution_relevance: "required_or_lateral_swap",
    template_relevance: "template_selectable",
    low_equipment_alternative_relevance: equipmentId === "bodyweight" ? "primary_low_equipment_option" : "not_low_equipment",
    copy_legal_boundary_notes: "Factual equipment label only.",
    ...overrides
  };
}

function makeCompleteEquipmentRecords() {
  return minimumEquipmentIds.map((equipmentId) => makeEquipmentRecord(equipmentId));
}

test("S-V1-22 locks equipment registry contract to v1 activities and required fields", () => {
  assert.deepEqual(lockedActivityIds, [
    "powerlifting",
    "general_strength",
    "rugby_union"
  ]);

  assert.deepEqual(requiredEquipmentFields, [
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

  assert.ok(minimumEquipmentIds.includes("barbell"));
  assert.ok(minimumEquipmentIds.includes("bodyweight"));
  assert.ok(minimumEquipmentIds.includes("open_floor_space"));
});

test("S-V1-22 validates complete explicit equipment coverage and exercise equipment FK closure", () => {
  const result = validateEquipmentRegistryCoverage({
    equipmentRecords: makeCompleteEquipmentRecords(),
    exerciseRecords: [
      {
        exercise_id: "fixture_back_squat",
        equipment_requirements: ["barbell", "rack", "plate"],
        equipment_alternatives: ["dumbbell", "bodyweight"]
      }
    ]
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.locked_activity_ids, lockedActivityIds);
});

test("S-V1-22 negative fixture fails closed when an exercise references undeclared equipment", () => {
  const fixturePath = path.join(
    repoRoot,
    "ci",
    "fixtures",
    "v1_equipment_registry_coverage_contract_negative",
    "s_v1_22_missing_equipment_reference_negative.json"
  );

  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));

  assert.equal(fixture.slice_id, "S-V1-22");
  assert.deepEqual(fixture.locked_activity_ids, lockedActivityIds);
  assert.equal(fixture.expected_failure_code, "v1_equipment_registry_coverage_contract_missing_equipment_reference");

  assert.throws(
    () => validateEquipmentRegistryCoverage({
      equipmentRecords: fixture.equipment_records,
      exerciseRecords: fixture.exercise_records
    }),
    (error) =>
      error?.code === fixture.expected_failure_code &&
      error?.details?.exercise_id === fixture.missing_case.exercise_id &&
      error?.details?.equipment_id === fixture.missing_case.equipment_id
  );
});

test("S-V1-22 refuses implicit equipment assumptions and unsupported operational scope", () => {
  assert.throws(
    () => validateEquipmentRegistryCoverage({
      equipmentRecords: makeCompleteEquipmentRecords().filter((record) => record.equipment_id !== "rack"),
      exerciseRecords: []
    }),
    (error) => error?.code === "v1_equipment_registry_coverage_contract_required_equipment_missing"
  );

  const operationalRecords = makeCompleteEquipmentRecords();
  operationalRecords[0] = makeEquipmentRecord("barbell", {
    copy_legal_boundary_notes: "gym_inventory stock_count entry"
  });

  assert.throws(
    () => validateEquipmentRegistryCoverage({
      equipmentRecords: operationalRecords,
      exerciseRecords: []
    }),
    (error) => error?.code === "v1_equipment_registry_coverage_contract_forbidden_operational_equipment_scope"
  );
});

test("S-V1-22 real active equipment and exercise registries satisfy the coverage contract for real (S-REG-25 activation)", () => {
  const activeEquipmentRegistry = JSON.parse(
    fs.readFileSync(path.join(repoRoot, "registries", "equipment", "equipment.registry.json"), "utf8")
  );
  const activeExerciseRegistry = JSON.parse(
    fs.readFileSync(path.join(repoRoot, "registries", "exercise", "exercise.registry.json"), "utf8")
  );

  const result = validateEquipmentRegistryCoverage({
    equipmentRecords: Object.values(activeEquipmentRegistry.entries),
    exerciseRecords: Object.values(activeExerciseRegistry.entries)
  });

  assert.equal(result.ok, true);
  assert.equal(result.equipment_count, 33);
  assert.deepEqual(result.locked_activity_ids, lockedActivityIds);
});

test("S-V1-22 documentation records the S-REG-25 supersession without rewriting its own original boundary", () => {
  const doc = fs.readFileSync(
    path.join(repoRoot, "docs", "v1", "V1_EQUIPMENT_REGISTRY_COVERAGE_CONTRACT.md"),
    "utf8"
  );

  assert.match(doc, /S-REG-25/);
  assert.match(doc, /superseded_by_slice_ids/);
  assert.match(doc, /No active equipment registry rows are added by this slice/);
});

test("S-V1-22 documentation binds equipment contract without adding active equipment content", () => {
  const doc = fs.readFileSync(
    path.join(repoRoot, "docs", "v1", "V1_EQUIPMENT_REGISTRY_COVERAGE_CONTRACT.md"),
    "utf8"
  );

  assert.match(doc, /S-V1-22/);
  assert.match(doc, /powerlifting/);
  assert.match(doc, /general_strength/);
  assert.match(doc, /rugby_union/);
  assert.match(doc, /missing_equipment_reference/);
  assert.match(doc, /No active equipment registry rows are added by this slice/);
  assert.match(doc, /gym inventory/);
  assert.match(doc, /EPOS/);
  assert.match(doc, /access control/);
});
