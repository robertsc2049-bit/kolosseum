import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  S_REG_34_EXPECTED_EXERCISE_COUNT,
  S_REG_34_EXTENDED_FIELD_NAMES,
  S_REG_34_FAILURE_TOKEN,
  S_REG_34_REFERENCE_MEDIA_REQUIRED_KEYS,
  S_REG_34_REFERENCE_MEDIA_SOURCES,
  S_REG_34_REQUIRED_FALSE_FLAGS,
  S_REG_34_REQUIRED_TRUE_FLAGS,
  S_REG_34_SCHEMA_FILES,
  sReg34LoadExerciseReferenceMediaSchemaExtension,
  sReg34ValidateExerciseReferenceMediaSchemaExtension
} from "../ci/registry/s_reg_34_exercise_reference_media_schema_extension.mjs";

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test("S-REG-34 records a genuine content-free schema extension, not a registry activation or content mutation", () => {
  const result = sReg34ValidateExerciseReferenceMediaSchemaExtension();

  assert.equal(result.ok, true);
  assert.equal(result.slice_id, "S-REG-34");
  assert.equal(result.extension_id, "exercise_reference_media_schema_extension");
  assert.equal(result.decision_type, "schema_extension");
  assert.equal(result.runtime_status, "non_runtime");
  assert.equal(result.extended_registry_id, "exercise");
  assert.equal(result.extended_record_count, 0);
  assert.deepEqual(result.extended_field_names, S_REG_34_EXTENDED_FIELD_NAMES);
});

test("S-REG-34 does not touch registry_index.json order or activate any domain", () => {
  const registryIndex = readJson("registries/registry_index.json");

  // Prefix check, not exact-match - a later, separately-authorised activation
  // slice could legitimately append new domains after this point.
  const orderAtAuthoringTime = [
    "activity", "movement", "exercise", "program", "equipment",
    "sport_subdivision", "sport_metric", "sport_role", "metric_exercise_link",
    "threshold_marker", "exercise_token", "exercise_activity_applicability"
  ];
  assert.deepEqual(registryIndex.order.slice(0, orderAtAuthoringTime.length), orderAtAuthoringTime);
});

test("S-REG-34 leaves every one of the 19 live exercise entries without a reference_media value", () => {
  const exerciseRegistry = readJson("registries/exercise/exercise.registry.json");
  const entries = Object.values(exerciseRegistry.entries);

  assert.equal(entries.length, S_REG_34_EXPECTED_EXERCISE_COUNT);

  for (const exercise of entries) {
    assert.equal("reference_media" in exercise, false, `${exercise.exercise_id}: expected no reference_media value in this content-free slice`);
  }
});

test("S-REG-34 declares an identical, optional, well-formed reference_media property in all 3 exercise schema files", () => {
  for (const schemaPath of S_REG_34_SCHEMA_FILES) {
    const schema = readJson(schemaPath);
    const entrySchema = schema.properties.entries.additionalProperties;
    const referenceMedia = entrySchema.properties.reference_media;

    assert.ok(referenceMedia, `${schemaPath}: expected a reference_media property`);
    assert.equal(referenceMedia.additionalProperties, false);
    assert.deepEqual(referenceMedia.required, [...S_REG_34_REFERENCE_MEDIA_REQUIRED_KEYS]);
    assert.equal(entrySchema.required.includes("reference_media"), false, `${schemaPath}: reference_media must stay optional`);

    assert.equal(referenceMedia.properties.video_url.type, "string");
    assert.equal(referenceMedia.properties.video_url.minLength, 1);
    assert.equal(referenceMedia.properties.thumbnail_url.type, "string");
    assert.deepEqual(referenceMedia.properties.source.enum, [...S_REG_34_REFERENCE_MEDIA_SOURCES]);
  }

  const [first, ...rest] = S_REG_34_SCHEMA_FILES.map((p) => JSON.stringify(readJson(p)));
  for (const other of rest) {
    assert.equal(other, first, "expected all 3 exercise schema files to remain byte-for-byte identical");
  }
});

test("S-REG-34 records human authorisation, before/after schema hashes, a rollback plan, and a runtime parity proof", () => {
  const extension = sReg34LoadExerciseReferenceMediaSchemaExtension();

  assert.equal(typeof extension.human_authorisation.authorised_by, "string");
  assert.ok(extension.human_authorisation.authorised_by.length > 0);
  assert.equal(extension.human_authorisation.authorisation_method, "explicit_chat_instruction");

  for (const schemaPath of S_REG_34_SCHEMA_FILES) {
    assert.notEqual(
      extension.schema_file_hashes_before[schemaPath],
      extension.schema_file_hashes_after[schemaPath]
    );
  }

  assert.ok(extension.rollback_plan.primary.includes("git revert"));
  assert.ok(extension.rollback_plan.fallback.length > 0);

  assert.equal(extension.runtime_parity_proof.identical, true);
  assert.equal(extension.runtime_parity_proof.fixture_count, 13);
  assert.equal(extension.runtime_parity_proof.byte_identical_fixture_count, 13);
  assert.deepEqual(extension.runtime_parity_proof.changed_fixtures, []);
});

test("S-REG-34's golden fixtures still list exercise_token as a loaded registry", () => {
  // This slice never touches loaded_registries (confirmed by its own frozen
  // runtime_parity_proof above, captured at authoring time) - the same
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

test("S-REG-34 fails closed if any required extension mutation flag is not true", () => {
  for (const flag of S_REG_34_REQUIRED_TRUE_FLAGS) {
    const extension = clone(sReg34LoadExerciseReferenceMediaSchemaExtension());
    extension[flag] = false;

    assert.throws(
      () => sReg34ValidateExerciseReferenceMediaSchemaExtension({ extensionDocument: extension }),
      (error) => {
        assert.equal(error.code, S_REG_34_FAILURE_TOKEN);
        assert.equal(error.reason, "s_reg_34_true_flag_invalid");
        return true;
      }
    );
  }
});

test("S-REG-34 fails closed if any out-of-scope mutation flag becomes true", () => {
  for (const flag of S_REG_34_REQUIRED_FALSE_FLAGS) {
    const extension = clone(sReg34LoadExerciseReferenceMediaSchemaExtension());
    extension[flag] = true;

    assert.throws(
      () => sReg34ValidateExerciseReferenceMediaSchemaExtension({ extensionDocument: extension }),
      (error) => {
        assert.equal(error.code, S_REG_34_FAILURE_TOKEN);
        assert.equal(error.reason, "s_reg_34_false_flag_invalid");
        return true;
      }
    );
  }
});

test("S-REG-34 fails closed if extended_record_count is declared inconsistent with the actual content-free entries", () => {
  const extension = clone(sReg34LoadExerciseReferenceMediaSchemaExtension());
  extension.extended_record_count = 1;

  assert.throws(
    () => sReg34ValidateExerciseReferenceMediaSchemaExtension({ extensionDocument: extension }),
    (error) => {
      assert.equal(error.code, S_REG_34_FAILURE_TOKEN);
      assert.equal(error.reason, "s_reg_34_extended_record_count_invalid");
      return true;
    }
  );
});
