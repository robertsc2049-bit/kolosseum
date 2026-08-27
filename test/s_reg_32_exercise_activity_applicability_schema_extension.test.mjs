import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  S_REG_32_ACTIVITY_ALLOWED_MOVEMENT_IDS,
  S_REG_32_EXPECTED_EXERCISE_COUNT,
  S_REG_32_EXTENDED_FIELD_NAMES,
  S_REG_32_FAILURE_TOKEN,
  S_REG_32_REQUIRED_FALSE_FLAGS,
  S_REG_32_REQUIRED_TRUE_FLAGS,
  sReg32LoadExerciseActivityApplicabilitySchemaExtension,
  sReg32ValidateExerciseActivityApplicabilitySchemaExtension
} from "../ci/registry/s_reg_32_exercise_activity_applicability_schema_extension.mjs";

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test("S-REG-32 records a genuine schema extension, not a registry activation", () => {
  const result = sReg32ValidateExerciseActivityApplicabilitySchemaExtension();

  assert.equal(result.ok, true);
  assert.equal(result.slice_id, "S-REG-32");
  assert.equal(result.extension_id, "exercise_activity_applicability_schema_extension");
  assert.equal(result.decision_type, "schema_extension");
  assert.equal(result.runtime_status, "non_runtime");
  assert.equal(result.extended_registry_id, "exercise");
  assert.equal(result.extended_record_count, S_REG_32_EXPECTED_EXERCISE_COUNT);
  assert.deepEqual(result.extended_field_names, S_REG_32_EXTENDED_FIELD_NAMES);
});

test("S-REG-32 does not touch registry_index.json order or activate any domain", () => {
  const registryIndex = readJson("registries/registry_index.json");

  // Prefix check, not exact-match - a later, separately-authorised
  // activation slice (S-REG-33) legitimately appended
  // exercise_activity_applicability after exercise_token.
  const orderAtAuthoringTime = [
    "activity", "movement", "exercise", "program", "equipment",
    "sport_subdivision", "sport_metric", "sport_role", "metric_exercise_link",
    "threshold_marker", "exercise_token"
  ];
  assert.deepEqual(registryIndex.order.slice(0, orderAtAuthoringTime.length), orderAtAuthoringTime);
});

test("S-REG-32 gives every one of the 19 live exercises a genuinely-applicable primary and secondary activity set", () => {
  const exerciseRegistry = readJson("registries/exercise/exercise.registry.json");
  const entries = Object.values(exerciseRegistry.entries);

  assert.equal(entries.length, S_REG_32_EXPECTED_EXERCISE_COUNT);

  for (const exercise of entries) {
    const primary = exercise.primary_activity_applicability;
    const secondary = exercise.secondary_activity_applicability;

    assert.ok(primary in S_REG_32_ACTIVITY_ALLOWED_MOVEMENT_IDS, `${exercise.exercise_id}: unknown primary activity ${primary}`);
    assert.ok(
      S_REG_32_ACTIVITY_ALLOWED_MOVEMENT_IDS[primary].includes(exercise.movement_pattern_id),
      `${exercise.exercise_id}: movement_pattern_id ${exercise.movement_pattern_id} not genuinely allowed for primary activity ${primary}`
    );

    assert.ok(Array.isArray(secondary));
    assert.equal(secondary.includes(primary), false, `${exercise.exercise_id}: secondary duplicates primary`);

    for (const activityId of secondary) {
      assert.ok(activityId in S_REG_32_ACTIVITY_ALLOWED_MOVEMENT_IDS, `${exercise.exercise_id}: unknown secondary activity ${activityId}`);
      assert.ok(
        S_REG_32_ACTIVITY_ALLOWED_MOVEMENT_IDS[activityId].includes(exercise.movement_pattern_id),
        `${exercise.exercise_id}: movement_pattern_id ${exercise.movement_pattern_id} not genuinely allowed for secondary activity ${activityId}`
      );
    }
  }
});

test("S-REG-32 assigns primary=powerlifting only to the 3 competition-lift exercises, general_strength to the rest", () => {
  const exerciseRegistry = readJson("registries/exercise/exercise.registry.json");
  const powerliftingPrimary = Object.values(exerciseRegistry.entries)
    .filter((e) => e.primary_activity_applicability === "powerlifting")
    .map((e) => e.exercise_id)
    .sort();

  assert.deepEqual(powerliftingPrimary, ["back_squat", "bench_press", "deadlift"]);
});

test("S-REG-32 excludes powerlifting from the 4 vertical_push exercises' applicability", () => {
  const exerciseRegistry = readJson("registries/exercise/exercise.registry.json");
  const verticalPushIds = ["overhead_press", "dumbbell_overhead_press", "single_arm_overhead_press", "pike_push_up"];

  for (const id of verticalPushIds) {
    const exercise = exerciseRegistry.entries[id];
    assert.equal(exercise.movement_pattern_id, "vertical_push");
    assert.equal(exercise.primary_activity_applicability, "general_strength");
    assert.deepEqual(exercise.secondary_activity_applicability, ["rugby_union"]);
  }
});

test("S-REG-32 records human authorisation, before/after hashes, a rollback plan, and a runtime parity proof", () => {
  const extension = sReg32LoadExerciseActivityApplicabilitySchemaExtension();

  assert.equal(typeof extension.human_authorisation.authorised_by, "string");
  assert.ok(extension.human_authorisation.authorised_by.length > 0);
  assert.equal(extension.human_authorisation.authorisation_method, "explicit_chat_instruction");

  assert.notEqual(
    extension.active_registry_hashes_before.exercise_registry,
    extension.active_registry_hashes_after.exercise_registry
  );
  assert.notEqual(
    extension.active_registry_hashes_before.registry_bundle,
    extension.active_registry_hashes_after.registry_bundle
  );

  assert.ok(extension.rollback_plan.primary.includes("git revert"));
  assert.ok(extension.rollback_plan.fallback.length > 0);

  assert.equal(extension.runtime_parity_proof.identical, true);
  assert.equal(extension.runtime_parity_proof.fixture_count, 13);
  assert.equal(extension.runtime_parity_proof.byte_identical_fixture_count, 13);
  assert.deepEqual(extension.runtime_parity_proof.changed_fixtures, []);
});

test("S-REG-32's golden fixtures still list exercise_token as a loaded registry", () => {
  // This slice itself never touched loaded_registries (confirmed by its own
  // frozen runtime_parity_proof above, captured at authoring time). Whether
  // a later slice's own domain name also appears is that slice's concern,
  // not a permanent negative claim this test should keep making - the same
  // stale-negative-existence lesson already applied repeatedly elsewhere in
  // this chain, adapted for a golden-fixture substring instead of a file's
  // existsSync.
  for (const path of [
    "test/fixtures/golden/expected/phase3_precedence_banned_over_available.json",
    "test/fixtures/golden/expected/phase3_sovereign_constraints_envelope.json"
  ]) {
    const serialized = fs.readFileSync(path, "utf8");
    assert.ok(serialized.includes("\"exercise_token\""), `expected ${path} to still list exercise_token as a loaded registry`);
  }
});

test("S-REG-32 fails closed if any required extension mutation flag is not true", () => {
  for (const flag of S_REG_32_REQUIRED_TRUE_FLAGS) {
    const extension = clone(sReg32LoadExerciseActivityApplicabilitySchemaExtension());
    extension[flag] = false;

    assert.throws(
      () => sReg32ValidateExerciseActivityApplicabilitySchemaExtension({ extensionDocument: extension }),
      (error) => {
        assert.equal(error.code, S_REG_32_FAILURE_TOKEN);
        assert.equal(error.reason, "s_reg_32_true_flag_invalid");
        return true;
      }
    );
  }
});

test("S-REG-32 fails closed if any out-of-scope mutation flag becomes true", () => {
  for (const flag of S_REG_32_REQUIRED_FALSE_FLAGS) {
    const extension = clone(sReg32LoadExerciseActivityApplicabilitySchemaExtension());
    extension[flag] = true;

    assert.throws(
      () => sReg32ValidateExerciseActivityApplicabilitySchemaExtension({ extensionDocument: extension }),
      (error) => {
        assert.equal(error.code, S_REG_32_FAILURE_TOKEN);
        assert.equal(error.reason, "s_reg_32_false_flag_invalid");
        return true;
      }
    );
  }
});
