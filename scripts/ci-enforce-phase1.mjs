// DEV NOTE: Repository automation script. This file exists to make a repeatable repo operation
// deterministic and reviewable. Keep side effects explicit, paths repo-root relative, and
// failure output readable for PowerShell and CI users.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const DEFAULT_INPUT_PATH = "test/fixtures/phase1.valid.json";
const TRUTH_SURFACE_PATH = "ci/contracts/phase1_v0_truth_surface.json";

function fail(code, msg) {
  console.error(`CI_FAIL::${code}::${msg}`);
  process.exit(1);
}

function ok(msg) {
  console.log(`CI_OK::${msg}`);
}

function readJsonWithRaw(filePath, missingCode, invalidCode) {
  if (!fs.existsSync(filePath)) {
    fail(missingCode, filePath);
  }

  const raw = fs.readFileSync(filePath, "utf8");

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    fail(invalidCode, filePath);
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    fail(invalidCode, filePath);
  }

  return { raw, parsed };
}

function readJson(filePath, missingCode, invalidCode) {
  return readJsonWithRaw(filePath, missingCode, invalidCode).parsed;
}

function ensureStringArray(truth, key) {
  if (!Array.isArray(truth[key]) || truth[key].some((v) => typeof v !== "string" || v.length === 0)) {
    fail("invalid_truth_surface", `invalid array field: ${key}`);
  }
}

function readTruthSurface() {
  const truthPath = path.resolve(process.cwd(), TRUTH_SURFACE_PATH);
  const truth = readJson(truthPath, "missing_truth_surface", "invalid_truth_surface");

  const requiredArrayFields = [
    "top_level_allowed_fields",
    "required_top_level_fields",
    "baseline_metric_allowed_fields",
    "personal_kit_allowed_fields",
    "capability_constraint_allowed_fields",
    "ui_preferences_allowed_fields",
    "class_c_fields",
    "allowed_actor_types",
    "allowed_execution_scopes",
    "allowed_activities",
    "allowed_age_declarations",
    "allowed_location_types",
    "allowed_instruction_density",
    "allowed_exposure_prompt_density",
    "allowed_bias_mode",
    "allowed_presentation_density",
    "allowed_capability_constraints",
    "allowed_metric_sources"
  ];

  for (const key of requiredArrayFields) {
    ensureStringArray(truth, key);
  }

  if (!truth.version_pins || typeof truth.version_pins !== "object" || Array.isArray(truth.version_pins)) {
    fail("invalid_truth_surface", "version_pins object required");
  }

  for (const key of ["engine_version", "enum_bundle_version", "phase1_schema_version"]) {
    if (typeof truth.version_pins[key] !== "string" || truth.version_pins[key].length === 0) {
      fail("invalid_truth_surface", `version pin missing: ${key}`);
    }
  }

  return {
    truthPath,
    versionPins: truth.version_pins,
    topLevelAllowedFields: new Set(truth.top_level_allowed_fields),
    requiredTopLevelFields: truth.required_top_level_fields,
    baselineMetricAllowedFields: new Set(truth.baseline_metric_allowed_fields),
    personalKitAllowedFields: new Set(truth.personal_kit_allowed_fields),
    capabilityConstraintAllowedFields: new Set(truth.capability_constraint_allowed_fields),
    uiPreferencesAllowedFields: new Set(truth.ui_preferences_allowed_fields),
    classCFields: new Set(truth.class_c_fields),
    allowedActorTypes: new Set(truth.allowed_actor_types),
    allowedExecutionScopes: new Set(truth.allowed_execution_scopes),
    allowedActivities: new Set(truth.allowed_activities),
    allowedAgeDeclarations: new Set(truth.allowed_age_declarations),
    allowedLocationTypes: new Set(truth.allowed_location_types),
    allowedInstructionDensity: new Set(truth.allowed_instruction_density),
    allowedExposurePromptDensity: new Set(truth.allowed_exposure_prompt_density),
    allowedBiasMode: new Set(truth.allowed_bias_mode),
    allowedPresentationDensity: new Set(truth.allowed_presentation_density),
    allowedCapabilityConstraints: new Set(truth.allowed_capability_constraints),
    allowedMetricSources: new Set(truth.allowed_metric_sources)
  };
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function pathFor(parent, key) {
  return parent ? `${parent}.${key}` : key;
}

function rejectExplicitNull(value, currentPath = "") {
  if (value === null) {
    fail("explicit_null_law_violated", currentPath || "$root");
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => rejectExplicitNull(item, `${currentPath}[${index}]`));
    return;
  }

  if (isPlainObject(value)) {
    for (const [key, nested] of Object.entries(value)) {
      rejectExplicitNull(nested, pathFor(currentPath, key));
    }
  }
}

function ensureRequired(data, truth) {
  for (const key of truth.requiredTopLevelFields) {
    if (!hasOwn(data, key)) {
      fail("missing_required_field", key);
    }
  }
}

function ensureStringEnum(name, value, allowedSet, failureCode) {
  if (typeof value !== "string" || !allowedSet.has(value)) {
    fail(failureCode, `${name}=${String(value)}`);
  }
}

function ensureBooleanTrue(name, value, failureCode) {
  if (value !== true) {
    fail(failureCode, `${name} must be true`);
  }
}

function validateRegistryId(value, name, failureCode) {
  if (typeof value !== "string") {
    fail(failureCode, `${name} must be string`);
  }
  if (value.length < 1) {
    fail(failureCode, `${name} must be non-empty`);
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)) {
    fail(failureCode, `${name} has invalid format`);
  }
}

function validateBaselineMetrics(rootActivityId, baselineMetrics, truth) {
  if (!Array.isArray(baselineMetrics)) {
    fail("metrics_not_array", "baseline_metrics must be an array");
  }

  for (let i = 0; i < baselineMetrics.length; i += 1) {
    const metric = baselineMetrics[i];
    const prefix = `baseline_metrics[${i}]`;

    if (!isPlainObject(metric)) {
      fail("metric_invalid_shape", `${prefix} must be an object`);
    }

    for (const key of Object.keys(metric)) {
      if (!truth.baselineMetricAllowedFields.has(key)) {
        fail("unknown_metric_field", `${prefix}.${key}`);
      }
    }

    for (const key of ["metric_id", "activity_id", "value", "recorded_at"]) {
      if (!hasOwn(metric, key)) {
        fail("metric_missing_required_field", `${prefix}.${key}`);
      }
    }

    validateRegistryId(metric.metric_id, `${prefix}.metric_id`, "metric_missing_id");

    if (typeof metric.activity_id !== "string" || metric.activity_id.length === 0) {
      fail("metric_missing_activity", `${prefix}.activity_id missing`);
    }

    if (!truth.allowedActivities.has(metric.activity_id)) {
      fail("metric_invalid_activity", `${prefix}.activity_id=${String(metric.activity_id)}`);
    }

    if (metric.activity_id !== rootActivityId) {
      fail("metric_activity_mismatch", `${prefix}.activity_id=${metric.activity_id} root=${rootActivityId}`);
    }

    if (!isPlainObject(metric.value) || Object.keys(metric.value).length < 1) {
      fail("metric_missing_value", `${prefix}.value missing`);
    }

    if (typeof metric.recorded_at !== "string" || metric.recorded_at.length === 0) {
      fail("metric_invalid_recorded_at", `${prefix}.recorded_at must be string`);
    }

    if (hasOwn(metric, "linked_exercise_token_id")) {
      validateRegistryId(metric.linked_exercise_token_id, `${prefix}.linked_exercise_token_id`, "metric_invalid_linked_exercise");
    }

    if (hasOwn(metric, "source") && !truth.allowedMetricSources.has(metric.source)) {
      fail("metric_invalid_source", `${prefix}.source=${String(metric.source)}`);
    }
  }
}

function validatePersonalKit(personalKit, truth) {
  if (!isPlainObject(personalKit)) {
    fail("invalid_personal_kit", "personal_kit must be an object");
  }

  for (const key of Object.keys(personalKit)) {
    if (!truth.personalKitAllowedFields.has(key)) {
      fail("unknown_personal_kit_field", `personal_kit.${key}`);
    }
  }

  for (const key of ["owned_item_ids", "present_item_ids"]) {
    if (!hasOwn(personalKit, key)) {
      fail("missing_personal_kit_field", `personal_kit.${key}`);
    }
    if (!Array.isArray(personalKit[key])) {
      fail("invalid_personal_kit", `personal_kit.${key} must be an array`);
    }
    for (let i = 0; i < personalKit[key].length; i += 1) {
      validateRegistryId(personalKit[key][i], `personal_kit.${key}[${i}]`, "invalid_personal_kit_item");
    }
  }

  const owned = new Set(personalKit.owned_item_ids);
  for (const present of personalKit.present_item_ids) {
    if (!owned.has(present)) {
      fail("invalid_personal_kit_presence", `present item not owned: ${present}`);
    }
  }
}

function validateCapabilityConstraints(constraints, truth) {
  if (!Array.isArray(constraints)) {
    fail("invalid_capability_constraints", "capability_constraints must be an array");
  }

  for (let i = 0; i < constraints.length; i += 1) {
    const constraint = constraints[i];
    const prefix = `capability_constraints[${i}]`;

    if (!isPlainObject(constraint)) {
      fail("invalid_capability_constraint", `${prefix} must be an object`);
    }

    for (const key of Object.keys(constraint)) {
      if (!truth.capabilityConstraintAllowedFields.has(key)) {
        fail("unknown_capability_constraint_field", `${prefix}.${key}`);
      }
    }

    if (!hasOwn(constraint, "constraint_id")) {
      fail("missing_capability_constraint", `${prefix}.constraint_id`);
    }

    ensureStringEnum(`${prefix}.constraint_id`, constraint.constraint_id, truth.allowedCapabilityConstraints, "invalid_capability_constraint");

    if (hasOwn(constraint, "target_token_id")) {
      validateRegistryId(constraint.target_token_id, `${prefix}.target_token_id`, "invalid_capability_constraint_target");
    }
  }
}

function validateUiPreferences(uiPreferences, truth) {
  if (!isPlainObject(uiPreferences)) {
    fail("invalid_presentation_flag", "ui_preferences must be an object");
  }

  for (const key of Object.keys(uiPreferences)) {
    if (!truth.uiPreferencesAllowedFields.has(key)) {
      fail("invalid_presentation_flag", `ui_preferences.${key}`);
    }
  }

  if (hasOwn(uiPreferences, "instruction_density")) {
    ensureStringEnum("ui_preferences.instruction_density", uiPreferences.instruction_density, truth.allowedInstructionDensity, "invalid_presentation_flag");
  }

  if (hasOwn(uiPreferences, "presentation_density")) {
    ensureStringEnum("ui_preferences.presentation_density", uiPreferences.presentation_density, truth.allowedPresentationDensity, "invalid_presentation_flag");
  }

  if (hasOwn(uiPreferences, "nd_mode") && typeof uiPreferences.nd_mode !== "boolean") {
    fail("invalid_presentation_flag", "ui_preferences.nd_mode must be boolean");
  }
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (isPlainObject(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }

  return JSON.stringify(value);
}

function engineVisiblePayload(data, truth) {
  const clone = JSON.parse(JSON.stringify(data));
  for (const key of truth.classCFields) {
    delete clone[key];
  }
  return clone;
}

function main() {
  const truth = readTruthSurface();
  const inputPath = path.resolve(process.cwd(), process.env.PHASE1_INPUT_PATH || DEFAULT_INPUT_PATH);
  const { raw, parsed: data } = readJsonWithRaw(inputPath, "missing_phase1", "invalid_json");

  rejectExplicitNull(data);

  for (const key of Object.keys(data)) {
    if (!truth.topLevelAllowedFields.has(key)) {
      fail("unknown_field", key);
    }
  }

  ensureRequired(data, truth);

  if (data.engine_version !== truth.versionPins.engine_version) {
    fail("version_mismatch", `engine_version=${String(data.engine_version)}`);
  }
  if (data.enum_bundle_version !== truth.versionPins.enum_bundle_version) {
    fail("version_mismatch", `enum_bundle_version=${String(data.enum_bundle_version)}`);
  }
  if (data.phase1_schema_version !== truth.versionPins.phase1_schema_version) {
    fail("version_mismatch", `phase1_schema_version=${String(data.phase1_schema_version)}`);
  }

  ensureBooleanTrue("consent_granted", data.consent_granted, "consent_not_granted");
  ensureBooleanTrue("jurisdiction_acknowledged", data.jurisdiction_acknowledged, "jurisdiction_not_acknowledged");

  ensureStringEnum("age_declaration", data.age_declaration, truth.allowedAgeDeclarations, "invalid_age_declaration");
  ensureStringEnum("actor_type", data.actor_type, truth.allowedActorTypes, "invalid_actor_type");
  ensureStringEnum("execution_scope", data.execution_scope, truth.allowedExecutionScopes, "invalid_execution_scope");
  ensureStringEnum("activity_id", data.activity_id, truth.allowedActivities, "invalid_activity_id");
  ensureStringEnum("location_type", data.location_type, truth.allowedLocationTypes, "invalid_location_type");
  validateRegistryId(data.equipment_profile_id, "equipment_profile_id", "invalid_equipment_profile");

  if (typeof data.nd_mode !== "boolean") {
    fail("invalid_presentation_flag", "nd_mode must be boolean");
  }
  ensureStringEnum("instruction_density", data.instruction_density, truth.allowedInstructionDensity, "invalid_presentation_flag");
  ensureStringEnum("exposure_prompt_density", data.exposure_prompt_density, truth.allowedExposurePromptDensity, "invalid_presentation_flag");
  ensureStringEnum("bias_mode", data.bias_mode, truth.allowedBiasMode, "invalid_presentation_flag");

  if (data.execution_scope === "coach_managed") {
    if (!hasOwn(data, "governing_authority_id")) {
      fail("missing_governing_authority", "governing_authority_id required for coach_managed scope");
    }
    validateRegistryId(data.governing_authority_id, "governing_authority_id", "invalid_governing_authority");
  } else if (hasOwn(data, "governing_authority_id")) {
    fail("invalid_governing_authority", "governing_authority_id forbidden for individual scope");
  }

  if (hasOwn(data, "sport_role_id")) {
    validateRegistryId(data.sport_role_id, "sport_role_id", "invalid_sport_role");
  }

  if (hasOwn(data, "variant_id")) {
    validateRegistryId(data.variant_id, "variant_id", "invalid_variant_id");
  }

  if (hasOwn(data, "baseline_metrics")) {
    validateBaselineMetrics(data.activity_id, data.baseline_metrics, truth);
  }

  if (hasOwn(data, "personal_kit")) {
    validatePersonalKit(data.personal_kit, truth);
  }

  if (hasOwn(data, "capability_constraints")) {
    validateCapabilityConstraints(data.capability_constraints, truth);
  }

  if (hasOwn(data, "ui_preferences")) {
    validateUiPreferences(data.ui_preferences, truth);
  }

  const canonicalHash = crypto
    .createHash("sha256")
    .update(stableStringify(engineVisiblePayload(data, truth)))
    .digest("hex");

  if (typeof canonicalHash !== "string" || canonicalHash.length !== 64) {
    fail("hashing_failed", "canonical hash not generated");
  }

  if (process.env.PHASE1_ECHO_ACCEPTED_INPUT === "1") {
    process.stdout.write(raw);
    return;
  }

  ok(`phase1_valid::sha256=${canonicalHash}::truth=${TRUTH_SURFACE_PATH}`);
}

main();
