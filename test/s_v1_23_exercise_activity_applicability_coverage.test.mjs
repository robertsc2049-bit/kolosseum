import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = process.cwd();

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

function uniqueStrings(values, code, context) {
  const out = [];
  const seen = new Set();

  for (const value of values) {
    if (typeof value !== "string" || value.length === 0) {
      fail(code, "expected non-empty string values", context);
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
      fail("forbidden_recommendation_inference_or_ranking_scope", "applicability metadata must not include recommendation, optimisation, capability inference, or ranking fields", {
        ...context,
        field: key
      });
    }
  }
}

function assertExerciseApplicabilitySourceShape(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    fail("exercise_record_not_object", "exercise registry entry must be an object");
  }

  for (const field of [
    "exercise_id",
    "primary_activity_applicability",
    "secondary_activity_applicability"
  ]) {
    if (!hasOwn(record, field)) {
      fail("exercise_applicability_source_field_missing", `exercise registry entry missing field required for applicability closure: ${field}`, {
        exercise_id: record.exercise_id ?? null,
        field
      });
    }
  }

  if (typeof record.exercise_id !== "string" || record.exercise_id.length === 0) {
    fail("exercise_id_invalid", "exercise_id must be a non-empty string");
  }

  if (typeof record.primary_activity_applicability !== "string" || record.primary_activity_applicability.length === 0) {
    fail("primary_activity_invalid", "primary_activity_applicability must be a non-empty string", {
      exercise_id: record.exercise_id
    });
  }

  if (!Array.isArray(record.secondary_activity_applicability)) {
    fail("secondary_activity_invalid", "secondary_activity_applicability must be an explicit array", {
      exercise_id: record.exercise_id
    });
  }

  for (const activityId of activityIdsForExercise(record)) {
    if (!lockedActivityIds.includes(activityId)) {
      fail("unsupported_activity_leakage", "exercise applicability source references unsupported activity", {
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
    fail("applicability_record_not_object", "applicability registry entry must be an object");
  }

  for (const field of requiredApplicabilityFields) {
    if (!hasOwn(record, field)) {
      fail("required_applicability_field_missing", `applicability registry entry missing required field: ${field}`, {
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
      fail("required_applicability_field_invalid", `${field} must be a non-empty string`, {
        applicability_id: record.applicability_id ?? null,
        field
      });
    }
  }

  if (!exerciseIds.has(record.exercise_id)) {
    fail("unknown_exercise_reference", "applicability entry references unknown exercise", {
      applicability_id: record.applicability_id,
      exercise_id: record.exercise_id
    });
  }

  if (!lockedActivityIds.includes(record.activity_id)) {
    fail("unsupported_activity_leakage", "applicability entry references unsupported activity", {
      applicability_id: record.applicability_id,
      activity_id: record.activity_id
    });
  }

  if (!requiredActivityContexts.includes(record.activity_context)) {
    fail("activity_context_invalid", "applicability entry uses unsupported activity context", {
      applicability_id: record.applicability_id,
      activity_context: record.activity_context
    });
  }

  if (!applicabilityStates.includes(record.applicability_state)) {
    fail("applicability_state_invalid", "applicability_state must be allowed, conditional, or prohibited", {
      applicability_id: record.applicability_id,
      applicability_state: record.applicability_state
    });
  }

  if (!templateApplicabilityStates.includes(record.template_applicability)) {
    fail("template_applicability_invalid", "template_applicability must be eligible or not_eligible", {
      applicability_id: record.applicability_id,
      template_applicability: record.template_applicability
    });
  }

  if (!substitutionApplicabilityStates.includes(record.substitution_applicability)) {
    fail("substitution_applicability_invalid", "substitution_applicability must be eligible or not_eligible", {
      applicability_id: record.applicability_id,
      substitution_applicability: record.substitution_applicability
    });
  }

  if (!Array.isArray(record.conditions)) {
    fail("conditions_invalid", "conditions must be an explicit array", {
      applicability_id: record.applicability_id
    });
  }

  for (const condition of record.conditions) {
    if (typeof condition !== "string" || condition.length === 0) {
      fail("conditions_invalid", "conditions must contain non-empty strings only", {
        applicability_id: record.applicability_id
      });
    }
  }

  if (record.applicability_state === "conditional") {
    if (!Number.isInteger(record.tier_cap) || record.tier_cap < 1 || record.tier_cap > 4) {
      fail("conditional_tier_cap_invalid", "conditional applicability requires integer tier_cap from 1 to 4", {
        applicability_id: record.applicability_id,
        tier_cap: record.tier_cap
      });
    }

    if (record.conditions.length === 0) {
      fail("conditional_conditions_missing", "conditional applicability requires explicit condition references", {
        applicability_id: record.applicability_id
      });
    }
  } else if (record.tier_cap !== null) {
    fail("tier_cap_must_be_null", "allowed or prohibited applicability must use null tier_cap", {
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
    fail("exercise_records_not_array", "exercise records must be an array");
  }

  if (!Array.isArray(applicabilityRecords)) {
    fail("applicability_records_not_array", "applicability records must be an array");
  }

  if (exerciseRecords.length === 0) {
    fail("exercise_records_empty", "exercise records must not be empty for applicability closure");
  }

  const exerciseIds = new Set();
  const requiredKeys = new Set();

  for (const exercise of exerciseRecords) {
    assertExerciseApplicabilitySourceShape(exercise);

    if (exerciseIds.has(exercise.exercise_id)) {
      fail("duplicate_exercise_id", "exercise_id must be unique", {
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
      fail("duplicate_applicability_id", "applicability_id must be unique", {
        applicability_id: applicability.applicability_id
      });
    }

    seenApplicabilityIds.add(applicability.applicability_id);

    const key = `${applicability.exercise_id}|${applicability.activity_id}|${applicability.activity_context}`;

    if (seenApplicabilityKeys.has(key)) {
      fail("duplicate_applicability_key", "exercise/activity/context applicability must be unique", {
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

      fail("missing_applicability", "missing explicit exercise activity applicability entry", {
        exercise_id: exerciseId,
        activity_id: activityId,
        activity_context: activityContext
      });
    }
  }

  return {
    ok: true,
    exercise_count: exerciseRecords.length,
    applicability_count: applicabilityRecords.length,
    locked_activity_ids: [...lockedActivityIds],
    required_activity_contexts: [...requiredActivityContexts]
  };
}

function makeExerciseRecord(overrides = {}) {
  return {
    exercise_id: "fixture_barbell_bench_press",
    display_label: "Fixture barbell bench press",
    movement_pattern_id: "horizontal_push",
    primary_activity_applicability: "powerlifting",
    secondary_activity_applicability: [
      "general_strength",
      "rugby_union"
    ],
    equipment_requirements: [
      "barbell",
      "bench",
      "rack"
    ],
    equipment_alternatives: [
      "bodyweight"
    ],
    difficulty_tier: "introductory",
    joint_stress_tags: [
      "shoulder",
      "elbow"
    ],
    stimulus_intent: "factual_training_stimulus",
    instruction_short_text: "Record planned work exactly as assigned.",
    instruction_detail_text: "Keep this copy factual and bounded.",
    contraindication_or_exclusion_tags: [],
    substitution_eligibility: "eligible",
    template_eligibility: "eligible",
    copy_legal_boundary_flags: [
      "factual_instruction_only"
    ],
    ...overrides
  };
}

function makeApplicabilityRecord(exerciseId, activityId, activityContext, overrides = {}) {
  return {
    applicability_id: `${exerciseId}_${activityId}_${activityContext}`,
    exercise_id: exerciseId,
    activity_id: activityId,
    activity_context: activityContext,
    applicability_state: "allowed",
    conditions: [],
    tier_cap: null,
    template_applicability: "eligible",
    substitution_applicability: "eligible",
    copy_legal_boundary_notes: "Factual applicability metadata only.",
    ...overrides
  };
}

function makeCompleteApplicabilityRecords(exerciseRecords) {
  const records = [];

  for (const exercise of exerciseRecords) {
    for (const activityId of activityIdsForExercise(exercise)) {
      for (const activityContext of requiredActivityContexts) {
        records.push(makeApplicabilityRecord(exercise.exercise_id, activityId, activityContext));
      }
    }
  }

  return records;
}

test("S-V1-23 locks exercise activity applicability to v1 activities, contexts, and fields", () => {
  assert.deepEqual(lockedActivityIds, [
    "powerlifting",
    "general_strength",
    "rugby_union",
    "strongman"
  ]);

  assert.deepEqual(requiredActivityContexts, [
    "training",
    "testing",
    "competition"
  ]);

  assert.deepEqual(requiredApplicabilityFields, [
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
});

test("S-V1-23 validates complete factual applicability closure", () => {
  const exerciseRecords = [makeExerciseRecord()];
  const applicabilityRecords = makeCompleteApplicabilityRecords(exerciseRecords);

  const result = validateExerciseActivityApplicabilityCoverage({
    exerciseRecords,
    applicabilityRecords
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.locked_activity_ids, lockedActivityIds);
  assert.deepEqual(result.required_activity_contexts, requiredActivityContexts);
});

test("S-V1-23 negative fixture fails closed when applicability is missing", () => {
  const fixturePath = path.join(
    repoRoot,
    "ci",
    "fixtures",
    "v1_exercise_activity_applicability_coverage_negative",
    "s_v1_23_missing_applicability_negative.json"
  );

  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));

  assert.equal(fixture.slice_id, "S-V1-23");
  assert.deepEqual(fixture.locked_activity_ids, lockedActivityIds);
  assert.deepEqual(fixture.required_activity_contexts, requiredActivityContexts);
  assert.equal(fixture.expected_failure_code, "v1_exercise_activity_applicability_coverage_missing_applicability");

  assert.throws(
    () => validateExerciseActivityApplicabilityCoverage({
      exerciseRecords: fixture.exercise_records,
      applicabilityRecords: fixture.applicability_records
    }),
    (error) =>
      error?.code === fixture.expected_failure_code &&
      error?.details?.exercise_id === fixture.missing_case.exercise_id &&
      error?.details?.activity_id === fixture.missing_case.activity_id &&
      error?.details?.activity_context === fixture.missing_case.activity_context
  );
});

test("S-V1-23 refuses unsupported activity leakage, duplicate keys, and conditional ambiguity", () => {
  assert.throws(
    () => validateExerciseActivityApplicabilityCoverage({
      exerciseRecords: [
        makeExerciseRecord({
          primary_activity_applicability: "weightlifting",
          secondary_activity_applicability: []
        })
      ],
      applicabilityRecords: []
    }),
    (error) => error?.code === "v1_exercise_activity_applicability_coverage_unsupported_activity_leakage"
  );

  const exerciseRecords = [makeExerciseRecord()];
  const applicabilityRecords = makeCompleteApplicabilityRecords(exerciseRecords);
  applicabilityRecords.push(applicabilityRecords[0]);

  assert.throws(
    () => validateExerciseActivityApplicabilityCoverage({
      exerciseRecords,
      applicabilityRecords
    }),
    (error) => error?.code === "v1_exercise_activity_applicability_coverage_duplicate_applicability_id"
  );

  const conditionalExerciseRecords = [makeExerciseRecord()];
  const conditionalApplicabilityRecords = makeCompleteApplicabilityRecords(conditionalExerciseRecords);
  conditionalApplicabilityRecords[0] = {
    ...conditionalApplicabilityRecords[0],
    applicability_state: "conditional",
    tier_cap: null,
    conditions: []
  };

  assert.throws(
    () => validateExerciseActivityApplicabilityCoverage({
      exerciseRecords: conditionalExerciseRecords,
      applicabilityRecords: conditionalApplicabilityRecords
    }),
    (error) => error?.code === "v1_exercise_activity_applicability_coverage_conditional_tier_cap_invalid"
  );
});

test("S-V1-23 refuses recommendation optimisation capability inference and ranking fields", () => {
  const exerciseRecords = [makeExerciseRecord()];
  const applicabilityRecords = makeCompleteApplicabilityRecords(exerciseRecords);

  applicabilityRecords[0] = {
    ...applicabilityRecords[0],
    recommendation_score: 1
  };

  assert.throws(
    () => validateExerciseActivityApplicabilityCoverage({
      exerciseRecords,
      applicabilityRecords
    }),
    (error) => error?.code === "v1_exercise_activity_applicability_coverage_forbidden_recommendation_inference_or_ranking_scope"
  );
});

test("S-V1-23 documentation binds applicability contract without adding active content", () => {
  const doc = fs.readFileSync(
    path.join(repoRoot, "docs", "v1", "V1_EXERCISE_ACTIVITY_APPLICABILITY_COVERAGE_CONTRACT.md"),
    "utf8"
  );

  assert.match(doc, /S-V1-23/);
  assert.match(doc, /exercise_activity_applicability_registry/);
  assert.match(doc, /powerlifting/);
  assert.match(doc, /general_strength/);
  assert.match(doc, /rugby_union/);
  assert.match(doc, /missing_applicability/);
  assert.match(doc, /No active applicability registry rows are added by this slice/);
  assert.match(doc, /factual registry metadata/);
  assert.match(doc, /does not recommend or optimise/);
});
