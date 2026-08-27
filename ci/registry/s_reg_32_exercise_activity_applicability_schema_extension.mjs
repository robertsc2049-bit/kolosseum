/**
 * DEV NOTE: S-REG-32 exercise registry schema extension.
 * Purpose: extends the already-active `exercise` registry's schema and all
 * 19 live entries with two new fields (`primary_activity_applicability`,
 * `secondary_activity_applicability`), required by the upcoming S-REG-33
 * activation of `exercise_activity_applicability`. Unlike every S-REG
 * activation slice, this one does not bring any new registry domain into
 * the active surface - `registry_index.json`'s `order[]` is unchanged, so
 * this slice does not claim S-REG-23/24's activation authority and is not
 * recorded in their supersession logs (the same way S-REG-25's own
 * exercise-schema extension for equipment_requirements/equipment_alternatives
 * was bundled inside that activation slice rather than claimed as a
 * separate activation).
 * Derivation rule (confirmed by explicit human decision): an exercise
 * applies to an activity iff its `pattern` field appears in that activity's
 * `allowed_movement_ids` (from the already legacy-active `activity_registry_1`
 * bridge). The 3 competition-lift exercises (`back_squat`, `deadlift`,
 * `bench_press`) get `primary_activity_applicability: "powerlifting"`; every
 * other exercise gets `primary_activity_applicability: "general_strength"`.
 * `secondary_activity_applicability` is every other applicable activity.
 * Boundary: extends `exercise` registry content and schema only. Must not
 * touch `exercise_activity_applicability`, `S-V1-23`, or any other candidate
 * domain. `runtime_status` stays `non_runtime` - nothing yet consumes these
 * new fields.
 * Determinism: validates every one of the 19 live exercise entries has a
 * `primary_activity_applicability` whose pattern is genuinely in that
 * activity's `allowed_movement_ids`, and every `secondary_activity_applicability`
 * entry is likewise genuinely applicable and does not duplicate the primary.
 * Failure: throws CI_S_REG_32_EXERCISE_ACTIVITY_APPLICABILITY_SCHEMA_EXTENSION.
 */

import fs from "node:fs";

export const S_REG_32_SLICE_ID = "S-REG-32";
export const S_REG_32_FAILURE_TOKEN = "CI_S_REG_32_EXERCISE_ACTIVITY_APPLICABILITY_SCHEMA_EXTENSION";
export const S_REG_32_EXTENSION_ID = "exercise_activity_applicability_schema_extension";
export const S_REG_32_RUNTIME_STATUS = "non_runtime";
export const S_REG_32_EXTENDED_REGISTRY_ID = "exercise";
export const S_REG_32_EXPECTED_EXERCISE_COUNT = 19;

// activity_id -> allowed_movement_ids, from the already legacy-active
// activity_registry_1 bridge (ci/registry/candidates/activity_registry_1).
export const S_REG_32_ACTIVITY_ALLOWED_MOVEMENT_IDS = Object.freeze({
  powerlifting: Object.freeze(["squat", "hinge", "horizontal_push", "horizontal_pull", "brace"]),
  general_strength: Object.freeze([
    "squat", "hinge", "horizontal_push", "vertical_push", "horizontal_pull",
    "vertical_pull", "carry", "brace", "lunge_split_stance"
  ]),
  rugby_union: Object.freeze([
    "squat", "hinge", "horizontal_push", "vertical_push", "horizontal_pull",
    "vertical_pull", "carry", "brace", "sprint_acceleration",
    "deceleration_change_of_direction", "jump_land", "conditioning_general"
  ])
});

export const S_REG_32_REQUIRED_TRUE_FLAGS = Object.freeze([
  "active_registry_mutation",
  "active_bundle_mutation",
  "registry_bundle_mutation",
  "registry_seal_mutation"
]);

export const S_REG_32_REQUIRED_FALSE_FLAGS = Object.freeze([
  "active_registry_activation",
  "registry_index_mutation",
  "registry_law_mutation",
  "engine_runtime_mutation",
  "phase1_runtime_schema_mutation",
  "marker_evaluator_mutation",
  "comparison_result_mutation",
  "recorded_value_input_mutation",
  "advice_mutation",
  "outcome_inference_mutation",
  "programme_assignment_mutation",
  "substitution_runtime_mutation",
  "ui_behaviour_mutation",
  "coach_interpretation_mutation"
]);

export const S_REG_32_EXPECTED_DOCUMENT_KEYS = Object.freeze([
  "slice_id",
  "extension_id",
  "decision_type",
  "runtime_status",
  "extended_registry_id",
  "extended_record_count",
  "extended_field_names",
  "active_registry_mutation",
  "active_bundle_mutation",
  "registry_index_mutation",
  "registry_bundle_mutation",
  "registry_law_mutation",
  "registry_seal_mutation",
  "active_registry_activation",
  "engine_runtime_mutation",
  "phase1_runtime_schema_mutation",
  "marker_evaluator_mutation",
  "comparison_result_mutation",
  "recorded_value_input_mutation",
  "advice_mutation",
  "outcome_inference_mutation",
  "programme_assignment_mutation",
  "substitution_runtime_mutation",
  "ui_behaviour_mutation",
  "coach_interpretation_mutation",
  "human_authorisation",
  "active_registry_hashes_before",
  "active_registry_hashes_after",
  "rollback_plan",
  "runtime_parity_proof"
]);

export const S_REG_32_EXTENDED_FIELD_NAMES = Object.freeze([
  "primary_activity_applicability",
  "secondary_activity_applicability"
]);

export const S_REG_32_PATHS = Object.freeze({
  extension: "ci/registry/s_reg_32_exercise_activity_applicability_schema_extension.json",
  exercise_registry: "registries/exercise/exercise.registry.json",
  registry_bundle: "registries/registry_bundle.json"
});

function fail(reason, details = {}) {
  const error = new Error(reason);
  error.code = S_REG_32_FAILURE_TOKEN;
  error.reason = reason;
  error.details = details;
  throw error;
}

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function assertPlainObject(value, reason) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(reason, { actual: value });
  }
}

function assertExactArray(actual, expected, reason) {
  if (!Array.isArray(actual)) {
    fail(reason, { actual });
  }

  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(reason, { actual, expected });
  }
}

function assertExerciseApplicabilityFieldsCorrect() {
  const exerciseRegistry = readJson(S_REG_32_PATHS.exercise_registry);
  const entries = Object.values(exerciseRegistry.entries ?? {});

  if (entries.length !== S_REG_32_EXPECTED_EXERCISE_COUNT) {
    fail("s_reg_32_exercise_count_invalid", { actual: entries.length, expected: S_REG_32_EXPECTED_EXERCISE_COUNT });
  }

  for (const exercise of entries) {
    const { exercise_id: exerciseId, movement_pattern_id: movementPatternId, primary_activity_applicability: primary, secondary_activity_applicability: secondary } = exercise;

    if (typeof primary !== "string" || !(primary in S_REG_32_ACTIVITY_ALLOWED_MOVEMENT_IDS)) {
      fail("s_reg_32_primary_activity_invalid", { exercise_id: exerciseId, primary });
    }

    if (!S_REG_32_ACTIVITY_ALLOWED_MOVEMENT_IDS[primary].includes(movementPatternId)) {
      fail("s_reg_32_primary_activity_not_genuinely_applicable", { exercise_id: exerciseId, movement_pattern_id: movementPatternId, primary });
    }

    if (!Array.isArray(secondary)) {
      fail("s_reg_32_secondary_activity_not_array", { exercise_id: exerciseId });
    }

    if (secondary.includes(primary)) {
      fail("s_reg_32_secondary_activity_duplicates_primary", { exercise_id: exerciseId, primary });
    }

    const seen = new Set();
    for (const activityId of secondary) {
      if (!(activityId in S_REG_32_ACTIVITY_ALLOWED_MOVEMENT_IDS)) {
        fail("s_reg_32_secondary_activity_unknown", { exercise_id: exerciseId, activity_id: activityId });
      }

      if (!S_REG_32_ACTIVITY_ALLOWED_MOVEMENT_IDS[activityId].includes(movementPatternId)) {
        fail("s_reg_32_secondary_activity_not_genuinely_applicable", { exercise_id: exerciseId, movement_pattern_id: movementPatternId, activity_id: activityId });
      }

      if (seen.has(activityId)) {
        fail("s_reg_32_secondary_activity_duplicate", { exercise_id: exerciseId, activity_id: activityId });
      }

      seen.add(activityId);
    }
  }

  return entries.length;
}

export function sReg32LoadExerciseActivityApplicabilitySchemaExtension() {
  return readJson(S_REG_32_PATHS.extension);
}

export function sReg32ValidateExerciseActivityApplicabilitySchemaExtension({
  extensionDocument = sReg32LoadExerciseActivityApplicabilitySchemaExtension()
} = {}) {
  assertPlainObject(extensionDocument, "s_reg_32_extension_document_invalid");
  assertExactArray(
    Object.keys(extensionDocument).sort(),
    [...S_REG_32_EXPECTED_DOCUMENT_KEYS].sort(),
    "s_reg_32_extension_document_keys_invalid"
  );

  const extendedRecordCount = assertExerciseApplicabilityFieldsCorrect();

  if (extensionDocument.slice_id !== S_REG_32_SLICE_ID) {
    fail("s_reg_32_slice_id_invalid", { actual: extensionDocument.slice_id });
  }

  if (extensionDocument.extension_id !== S_REG_32_EXTENSION_ID || extensionDocument.decision_type !== "schema_extension") {
    fail("s_reg_32_extension_identity_invalid", {
      extension_id: extensionDocument.extension_id,
      decision_type: extensionDocument.decision_type
    });
  }

  if (extensionDocument.runtime_status !== S_REG_32_RUNTIME_STATUS) {
    fail("s_reg_32_runtime_status_invalid", { actual: extensionDocument.runtime_status });
  }

  if (extensionDocument.extended_registry_id !== S_REG_32_EXTENDED_REGISTRY_ID) {
    fail("s_reg_32_extended_registry_id_invalid", { actual: extensionDocument.extended_registry_id });
  }

  if (extensionDocument.extended_record_count !== extendedRecordCount) {
    fail("s_reg_32_extended_record_count_invalid", {
      declared: extensionDocument.extended_record_count,
      actual: extendedRecordCount
    });
  }

  assertExactArray(
    extensionDocument.extended_field_names,
    S_REG_32_EXTENDED_FIELD_NAMES,
    "s_reg_32_extended_field_names_invalid"
  );

  for (const flag of S_REG_32_REQUIRED_TRUE_FLAGS) {
    if (extensionDocument[flag] !== true) {
      fail("s_reg_32_true_flag_invalid", { flag, actual: extensionDocument[flag] });
    }
  }

  for (const flag of S_REG_32_REQUIRED_FALSE_FLAGS) {
    if (extensionDocument[flag] !== false) {
      fail("s_reg_32_false_flag_invalid", { flag, actual: extensionDocument[flag] });
    }
  }

  assertPlainObject(extensionDocument.human_authorisation, "s_reg_32_human_authorisation_invalid");
  if (
    typeof extensionDocument.human_authorisation.authorised_by !== "string" ||
    extensionDocument.human_authorisation.authorised_by.trim() === "" ||
    typeof extensionDocument.human_authorisation.authorisation_method !== "string" ||
    extensionDocument.human_authorisation.authorisation_method.trim() === "" ||
    typeof extensionDocument.human_authorisation.authorised_at_iso8601_date !== "string" ||
    extensionDocument.human_authorisation.authorised_at_iso8601_date.trim() === ""
  ) {
    fail("s_reg_32_human_authorisation_invalid", { actual: extensionDocument.human_authorisation });
  }

  assertPlainObject(extensionDocument.active_registry_hashes_before, "s_reg_32_hashes_before_invalid");
  assertPlainObject(extensionDocument.active_registry_hashes_after, "s_reg_32_hashes_after_invalid");
  for (const key of ["exercise_registry", "registry_bundle"]) {
    if (
      typeof extensionDocument.active_registry_hashes_before[key] !== "string" ||
      typeof extensionDocument.active_registry_hashes_after[key] !== "string" ||
      extensionDocument.active_registry_hashes_before[key] === extensionDocument.active_registry_hashes_after[key]
    ) {
      fail("s_reg_32_hashes_invalid", { key });
    }
  }

  assertPlainObject(extensionDocument.rollback_plan, "s_reg_32_rollback_plan_invalid");
  if (
    typeof extensionDocument.rollback_plan.primary !== "string" ||
    extensionDocument.rollback_plan.primary.trim() === "" ||
    typeof extensionDocument.rollback_plan.fallback !== "string" ||
    extensionDocument.rollback_plan.fallback.trim() === ""
  ) {
    fail("s_reg_32_rollback_plan_invalid", { actual: extensionDocument.rollback_plan });
  }

  assertPlainObject(extensionDocument.runtime_parity_proof, "s_reg_32_runtime_parity_proof_invalid");
  const parity = extensionDocument.runtime_parity_proof;
  if (
    parity.identical !== true ||
    typeof parity.fixture_count !== "number" ||
    parity.fixture_count < 1 ||
    typeof parity.byte_identical_fixture_count !== "number" ||
    !Array.isArray(parity.changed_fixtures) ||
    parity.byte_identical_fixture_count + parity.changed_fixtures.length !== parity.fixture_count
  ) {
    fail("s_reg_32_runtime_parity_proof_invalid", { actual: parity });
  }

  return Object.freeze({
    ok: true,
    token: S_REG_32_FAILURE_TOKEN,
    slice_id: S_REG_32_SLICE_ID,
    extension_id: extensionDocument.extension_id,
    decision_type: extensionDocument.decision_type,
    runtime_status: S_REG_32_RUNTIME_STATUS,
    extended_registry_id: extensionDocument.extended_registry_id,
    extended_record_count: extendedRecordCount,
    extended_field_names: [...extensionDocument.extended_field_names]
  });
}
