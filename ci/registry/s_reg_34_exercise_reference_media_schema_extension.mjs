/**
 * DEV NOTE: S-REG-34 exercise registry schema extension.
 * Purpose: historically added an optional `reference_media` field to the
 * already-active `exercise` registry's then-19 live entries, so a later
 * product-facing slice could attach coach/admin-entered video references to
 * exercises. Unlike S-REG-32 (which added two required fields with real
 * derived values to the then-19 live entries), this slice added a purely
 * optional field and gave it a value on zero entries - there was no
 * reference-media content to populate, only the schema shape to receive it
 * later.
 * Historical boundary: S-REG-34 authored against 19 live exercise entries.
 * That count remains evidence of the slice at authoring time, not a permanent
 * exact count for the live exercise registry. Later authorised production
 * slices may add exercises without rewriting S-REG-34 history. The current
 * live surface must never shrink below the historical floor, and every current
 * live exercise must still satisfy S-REG-34's content-free invariant until a
 * separately authorised content slice lawfully populates `reference_media`.
 * Boundary: extends the exercise registry's schema only. Must not itself touch
 * exercise.registry.json's content, registry_index.json, registry_bundle.json,
 * or the registry seal. `runtime_status` stays `non_runtime` - nothing
 * consumes this field yet; the product-facing read surface that will expose
 * it is built separately in FULL-UI-30, as ordinary product work.
 * Determinism: validates the 3 exercise schema files declare an identical,
 * well-formed optional `reference_media` property, preserves the historical
 * 19-record floor, and independently re-derives the content-free invariant by
 * reading every current live exercise entry and confirming none carries the
 * field yet.
 * Failure: throws CI_S_REG_34_EXERCISE_REFERENCE_MEDIA_SCHEMA_EXTENSION.
 */

import fs from "node:fs";

export const S_REG_34_SLICE_ID = "S-REG-34";
export const S_REG_34_FAILURE_TOKEN = "CI_S_REG_34_EXERCISE_REFERENCE_MEDIA_SCHEMA_EXTENSION";
export const S_REG_34_EXTENSION_ID = "exercise_reference_media_schema_extension";
export const S_REG_34_RUNTIME_STATUS = "non_runtime";
export const S_REG_34_EXTENDED_REGISTRY_ID = "exercise";

// Historical authoring-time count. This is evidence, not a permanent exact
// count for the live exercise registry after later authorised expansion.
export const S_REG_34_EXPECTED_EXERCISE_COUNT = 19;
export const S_REG_34_EXTENDED_FIELD_NAMES = Object.freeze(["reference_media"]);

// S-REG-34 originally introduced `reference_media` as an optional, content-free
// field. S-V1-25 later hardened the nested media object with source/licence,
// commercial-use, review and copy-boundary controls. Keep the historical
// optional/content-free boundary, but validate the current lawful nested shape.
export const S_REG_34_REFERENCE_MEDIA_REQUIRED_KEYS = Object.freeze([
  "video_url",
  "thumbnail_url",
  "source",
  "source_reference",
  "license_status",
  "commercial_use_status",
  "manual_review_status",
  "legal_review_status",
  "copy_boundary_flags"
]);
export const S_REG_34_REFERENCE_MEDIA_OPTIONAL_KEYS = Object.freeze([]);
export const S_REG_34_REFERENCE_MEDIA_SOURCES = Object.freeze([
  "founder_original",
  "licensed_source",
  "canonical_project_document"
]);

export const S_REG_34_SCHEMA_FILES = Object.freeze([
  "ci/schemas/exercise.registry.schema.json",
  "ci/schemas/exercise.registry.schema.v1.0.0.json",
  "ci/schemas/exercise_registry.schema.json"
]);

export const S_REG_34_REQUIRED_TRUE_FLAGS = Object.freeze([
  "schema_files_mutation",
  "content_free_invariant"
]);

export const S_REG_34_REQUIRED_FALSE_FLAGS = Object.freeze([
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
  "coach_interpretation_mutation"
]);

export const S_REG_34_EXPECTED_DOCUMENT_KEYS = Object.freeze([
  "slice_id",
  "extension_id",
  "decision_type",
  "runtime_status",
  "extended_registry_id",
  "extended_record_count",
  "extended_field_names",
  "schema_files_mutation",
  "content_free_invariant",
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
  "schema_file_hashes_before",
  "schema_file_hashes_after",
  "rollback_plan",
  "runtime_parity_proof"
]);

export const S_REG_34_PATHS = Object.freeze({
  extension: "ci/registry/s_reg_34_exercise_reference_media_schema_extension.json",
  exercise_registry: "registries/exercise/exercise.registry.json"
});

function fail(reason, details = {}) {
  const error = new Error(reason);
  error.code = S_REG_34_FAILURE_TOKEN;
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

function assertSchemaFilesDeclareReferenceMedia() {
  const canonicalSchemaPath = S_REG_34_SCHEMA_FILES[0];
  const canonicalSchema = readJson(canonicalSchemaPath);
  const entrySchema = canonicalSchema?.properties?.entries?.additionalProperties;

  assertPlainObject(entrySchema, "s_reg_34_schema_entry_shape_invalid");

  const referenceMedia = entrySchema?.properties?.reference_media;
  assertPlainObject(referenceMedia, "s_reg_34_schema_reference_media_missing");

  if (referenceMedia.additionalProperties !== false) {
    fail("s_reg_34_schema_reference_media_additional_properties_invalid", { schemaPath: canonicalSchemaPath });
  }

  assertExactArray(referenceMedia.required, [...S_REG_34_REFERENCE_MEDIA_REQUIRED_KEYS], "s_reg_34_schema_reference_media_required_invalid");

  if (Array.isArray(entrySchema.required) && entrySchema.required.includes("reference_media")) {
    fail("s_reg_34_schema_reference_media_must_stay_optional", { schemaPath: canonicalSchemaPath });
  }

  const properties = referenceMedia.properties ?? {};
  if (properties.video_url?.type !== "string" || properties.video_url?.minLength !== 1) {
    fail("s_reg_34_schema_video_url_invalid", { schemaPath: canonicalSchemaPath, actual: properties.video_url });
  }

  if (properties.thumbnail_url?.type !== "string" || properties.thumbnail_url?.minLength !== 1) {
    fail("s_reg_34_schema_thumbnail_url_invalid", { schemaPath: canonicalSchemaPath, actual: properties.thumbnail_url });
  }

  assertExactArray(properties.source?.enum, [...S_REG_34_REFERENCE_MEDIA_SOURCES], "s_reg_34_schema_source_enum_invalid");

  for (const schemaPath of S_REG_34_SCHEMA_FILES.slice(1)) {
    const compatibilitySchema = readJson(schemaPath);
    if (
      compatibilitySchema?.$ref !== canonicalSchema.$id ||
      compatibilitySchema?.["x-kolosseum-authority"] !== "compatibility_reference" ||
      compatibilitySchema?.["x-kolosseum-canonical-authority"] !== "registries/final_registry_schema_manifest.json"
    ) {
      fail("s_reg_34_schema_entry_shape_invalid", { schemaPath, actual: compatibilitySchema });
    }
  }
}

function assertContentFreeInvariant() {
  const exerciseRegistry = readJson(S_REG_34_PATHS.exercise_registry);
  const entries = Object.values(exerciseRegistry.entries ?? {});

  if (entries.length < S_REG_34_EXPECTED_EXERCISE_COUNT) {
    fail("s_reg_34_exercise_count_below_historical_extension", {
      actual: entries.length,
      historical_minimum: S_REG_34_EXPECTED_EXERCISE_COUNT
    });
  }

  let extendedRecordCount = 0;
  for (const exercise of entries) {
    if ("reference_media" in exercise) {
      extendedRecordCount += 1;
    }
  }

  if (extendedRecordCount !== 0) {
    fail("s_reg_34_content_free_invariant_violated", { extendedRecordCount });
  }

  return extendedRecordCount;
}

export function sReg34LoadExerciseReferenceMediaSchemaExtension() {
  return readJson(S_REG_34_PATHS.extension);
}

export function sReg34ValidateExerciseReferenceMediaSchemaExtension({
  extensionDocument = sReg34LoadExerciseReferenceMediaSchemaExtension()
} = {}) {
  assertPlainObject(extensionDocument, "s_reg_34_extension_document_invalid");
  assertExactArray(
    Object.keys(extensionDocument).sort(),
    [...S_REG_34_EXPECTED_DOCUMENT_KEYS].sort(),
    "s_reg_34_extension_document_keys_invalid"
  );

  assertSchemaFilesDeclareReferenceMedia();
  const extendedRecordCount = assertContentFreeInvariant();

  if (extensionDocument.slice_id !== S_REG_34_SLICE_ID) {
    fail("s_reg_34_slice_id_invalid", { actual: extensionDocument.slice_id });
  }

  if (extensionDocument.extension_id !== S_REG_34_EXTENSION_ID || extensionDocument.decision_type !== "schema_extension") {
    fail("s_reg_34_extension_identity_invalid", {
      extension_id: extensionDocument.extension_id,
      decision_type: extensionDocument.decision_type
    });
  }

  if (extensionDocument.runtime_status !== S_REG_34_RUNTIME_STATUS) {
    fail("s_reg_34_runtime_status_invalid", { actual: extensionDocument.runtime_status });
  }

  if (extensionDocument.extended_registry_id !== S_REG_34_EXTENDED_REGISTRY_ID) {
    fail("s_reg_34_extended_registry_id_invalid", { actual: extensionDocument.extended_registry_id });
  }

  if (extensionDocument.extended_record_count !== extendedRecordCount) {
    fail("s_reg_34_extended_record_count_invalid", {
      declared: extensionDocument.extended_record_count,
      actual: extendedRecordCount
    });
  }

  assertExactArray(
    extensionDocument.extended_field_names,
    S_REG_34_EXTENDED_FIELD_NAMES,
    "s_reg_34_extended_field_names_invalid"
  );

  for (const flag of S_REG_34_REQUIRED_TRUE_FLAGS) {
    if (extensionDocument[flag] !== true) {
      fail("s_reg_34_true_flag_invalid", { flag, actual: extensionDocument[flag] });
    }
  }

  for (const flag of S_REG_34_REQUIRED_FALSE_FLAGS) {
    if (extensionDocument[flag] !== false) {
      fail("s_reg_34_false_flag_invalid", { flag, actual: extensionDocument[flag] });
    }
  }

  assertPlainObject(extensionDocument.human_authorisation, "s_reg_34_human_authorisation_invalid");
  if (
    typeof extensionDocument.human_authorisation.authorised_by !== "string" ||
    extensionDocument.human_authorisation.authorised_by.trim() === "" ||
    typeof extensionDocument.human_authorisation.authorisation_method !== "string" ||
    extensionDocument.human_authorisation.authorisation_method.trim() === "" ||
    typeof extensionDocument.human_authorisation.authorised_at_iso8601_date !== "string" ||
    extensionDocument.human_authorisation.authorised_at_iso8601_date.trim() === ""
  ) {
    fail("s_reg_34_human_authorisation_invalid", { actual: extensionDocument.human_authorisation });
  }

  assertPlainObject(extensionDocument.schema_file_hashes_before, "s_reg_34_hashes_before_invalid");
  assertPlainObject(extensionDocument.schema_file_hashes_after, "s_reg_34_hashes_after_invalid");
  for (const schemaPath of S_REG_34_SCHEMA_FILES) {
    if (
      typeof extensionDocument.schema_file_hashes_before[schemaPath] !== "string" ||
      typeof extensionDocument.schema_file_hashes_after[schemaPath] !== "string" ||
      extensionDocument.schema_file_hashes_before[schemaPath] === extensionDocument.schema_file_hashes_after[schemaPath]
    ) {
      fail("s_reg_34_hashes_invalid", { schemaPath });
    }
  }

  assertPlainObject(extensionDocument.rollback_plan, "s_reg_34_rollback_plan_invalid");
  if (
    typeof extensionDocument.rollback_plan.primary !== "string" ||
    extensionDocument.rollback_plan.primary.trim() === "" ||
    typeof extensionDocument.rollback_plan.fallback !== "string" ||
    extensionDocument.rollback_plan.fallback.trim() === ""
  ) {
    fail("s_reg_34_rollback_plan_invalid", { actual: extensionDocument.rollback_plan });
  }

  assertPlainObject(extensionDocument.runtime_parity_proof, "s_reg_34_runtime_parity_proof_invalid");
  const parity = extensionDocument.runtime_parity_proof;
  if (
    parity.identical !== true ||
    typeof parity.fixture_count !== "number" ||
    parity.fixture_count < 1 ||
    typeof parity.byte_identical_fixture_count !== "number" ||
    !Array.isArray(parity.changed_fixtures) ||
    parity.byte_identical_fixture_count + parity.changed_fixtures.length !== parity.fixture_count
  ) {
    fail("s_reg_34_runtime_parity_proof_invalid", { actual: parity });
  }

  return Object.freeze({
    ok: true,
    token: S_REG_34_FAILURE_TOKEN,
    slice_id: S_REG_34_SLICE_ID,
    extension_id: extensionDocument.extension_id,
    decision_type: extensionDocument.decision_type,
    runtime_status: S_REG_34_RUNTIME_STATUS,
    extended_registry_id: extensionDocument.extended_registry_id,
    extended_record_count: extendedRecordCount,
    extended_field_names: [...extensionDocument.extended_field_names]
  });
}
