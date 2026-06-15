import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = process.cwd();

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
      fail("fallback_record_present", `fallback-like exercise registry marker refused: ${marker}`, {
        exercise_id: record.exercise_id ?? null,
        marker
      });
    }
  }
}

function assertExerciseRecordShape(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    fail("record_not_object", "exercise registry entry must be an object");
  }

  for (const field of requiredExerciseFields) {
    if (!hasOwn(record, field)) {
      fail("required_field_missing", `exercise registry entry missing required field: ${field}`, {
        exercise_id: record.exercise_id ?? null,
        field
      });
    }
  }

  if (typeof record.exercise_id !== "string" || record.exercise_id.length === 0) {
    fail("exercise_id_invalid", "exercise_id must be a non-empty string");
  }

  if (!lockedActivityIds.includes(record.primary_activity_applicability)) {
    fail("primary_activity_not_locked", "primary activity applicability must be one locked v1 activity", {
      exercise_id: record.exercise_id,
      primary_activity_applicability: record.primary_activity_applicability
    });
  }

  for (const activityId of activityIdsForRecord(record)) {
    if (!lockedActivityIds.includes(activityId)) {
      fail("unsupported_activity_leakage", "exercise registry entry references unsupported activity", {
        exercise_id: record.exercise_id,
        activity_id: activityId
      });
    }
  }

  assertNoFallbackExerciseRecord(record);
}

function validateExerciseRegistryCoverage(records) {
  if (!Array.isArray(records)) {
    fail("registry_not_array", "exercise registry records must be an array");
  }

  if (records.length === 0) {
    fail("registry_empty", "exercise registry contract requires explicit records for active content acceptance");
  }

  const seenExerciseIds = new Set();
  const coverage = new Map(
    lockedActivityIds.map((activityId) => [activityId, new Set()])
  );

  for (const record of records) {
    assertExerciseRecordShape(record);

    if (seenExerciseIds.has(record.exercise_id)) {
      fail("duplicate_exercise_id", "exercise_id must be unique", {
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
        fail("required_coverage_missing", "required exercise registry movement coverage is missing", {
          activity_id: activityId,
          movement_pattern_id: movementPatternId
        });
      }
    }
  }

  return {
    ok: true,
    record_count: records.length,
    locked_activity_ids: [...lockedActivityIds]
  };
}

function makeRecord(overrides) {
  return {
    exercise_id: "exercise_placeholder",
    display_label: "Exercise placeholder",
    movement_pattern_id: "squat",
    primary_activity_applicability: "general_strength",
    secondary_activity_applicability: [],
    equipment_requirements: ["bodyweight"],
    equipment_alternatives: [],
    difficulty_tier: "introductory",
    joint_stress_tags: ["general"],
    stimulus_intent: "factual_training_stimulus",
    instruction_short_text: "Record planned work exactly as assigned.",
    instruction_detail_text: "Keep this copy factual and bounded.",
    contraindication_or_exclusion_tags: [],
    substitution_eligibility: "eligible",
    template_eligibility: "eligible",
    copy_legal_boundary_flags: ["factual_instruction_only"],
    ...overrides
  };
}

function makeCompleteCoverageRecords() {
  const records = [];
  let counter = 0;

  for (const [activityId, movementPatterns] of Object.entries(requiredMovementPatternCoverageByActivity)) {
    for (const movementPatternId of movementPatterns) {
      counter++;
      records.push(
        makeRecord({
          exercise_id: `${activityId}_${movementPatternId}_${counter}`,
          display_label: `${activityId} ${movementPatternId}`,
          movement_pattern_id: movementPatternId,
          primary_activity_applicability: activityId
        })
      );
    }
  }

  return records;
}

test("S-V1-21 locks exercise registry contract to v1 activities and fields", () => {
  assert.deepEqual(lockedActivityIds, [
    "powerlifting",
    "general_strength",
    "rugby_union"
  ]);

  assert.deepEqual(requiredExerciseFields, [
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

  assert.ok(requiredMovementPatternCoverageByActivity.powerlifting.includes("squat"));
  assert.ok(requiredMovementPatternCoverageByActivity.general_strength.includes("vertical_pull"));
  assert.ok(requiredMovementPatternCoverageByActivity.rugby_union.includes("jump_land"));
});

test("S-V1-21 validates complete locked activity exercise coverage", () => {
  const result = validateExerciseRegistryCoverage(makeCompleteCoverageRecords());

  assert.equal(result.ok, true);
  assert.deepEqual(result.locked_activity_ids, lockedActivityIds);
});

test("S-V1-21 negative fixture fails closed when a required entry is missing", () => {
  const fixturePath = path.join(
    repoRoot,
    "ci",
    "fixtures",
    "v1_exercise_registry_contract_negative",
    "s_v1_21_missing_required_entry_negative.json"
  );

  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));

  assert.equal(fixture.slice_id, "S-V1-21");
  assert.deepEqual(fixture.locked_activity_ids, lockedActivityIds);
  assert.equal(fixture.expected_failure_code, "v1_exercise_registry_contract_required_coverage_missing");

  assert.throws(
    () => validateExerciseRegistryCoverage(fixture.records),
    (error) =>
      error?.code === fixture.expected_failure_code &&
      error?.details?.activity_id === fixture.missing_case.activity_id &&
      error?.details?.movement_pattern_id === fixture.missing_case.movement_pattern_id
  );
});

test("S-V1-21 refuses unsupported activity leakage and fallback entries", () => {
  const unsupportedActivityRecords = makeCompleteCoverageRecords();
  unsupportedActivityRecords.push(
    makeRecord({
      exercise_id: "strongman_yoke_walk",
      display_label: "Yoke walk",
      movement_pattern_id: "carry",
      primary_activity_applicability: "strongman"
    })
  );

  assert.throws(
    () => validateExerciseRegistryCoverage(unsupportedActivityRecords),
    (error) => error?.code === "v1_exercise_registry_contract_primary_activity_not_locked"
  );

  const fallbackRecords = makeCompleteCoverageRecords();
  fallbackRecords.push(
    makeRecord({
      exercise_id: "generic_fallback_exercise",
      display_label: "Generic fallback exercise",
      movement_pattern_id: "squat",
      primary_activity_applicability: "general_strength"
    })
  );

  assert.throws(
    () => validateExerciseRegistryCoverage(fallbackRecords),
    (error) => error?.code === "v1_exercise_registry_contract_fallback_record_present"
  );
});

test("S-V1-21 documentation binds contract without adding active exercise content", () => {
  const doc = fs.readFileSync(
    path.join(repoRoot, "docs", "v1", "V1_EXERCISE_REGISTRY_CONTRACT.md"),
    "utf8"
  );

  assert.match(doc, /S-V1-21/);
  assert.match(doc, /powerlifting/);
  assert.match(doc, /general_strength/);
  assert.match(doc, /rugby_union/);
  assert.match(doc, /required_coverage_missing/);
  assert.match(doc, /No active exercise registry rows are added by this slice/);
});
