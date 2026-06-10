#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const repoRoot = process.cwd();
const schemaPath = path.join(repoRoot, "docs", "v0", "phase1_declaration_surface.schema.json");
const suitePath = path.join(repoRoot, "docs", "v0", "phase1_declaration_surface_negative_tests.json");
const s26Path = path.join(repoRoot, "docs", "v0", "V0_ACTIVE_SCOPE_MANIFEST.json");

const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
const suite = JSON.parse(fs.readFileSync(suitePath, "utf8"));
const s26 = JSON.parse(fs.readFileSync(s26Path, "utf8"));

const knownFailures = new Set([
  "additionalProperties",
  "required",
  "const",
  "enum",
  "type",
  "not",
  "minLength",
  "pattern",
  "CLASS_C_ENGINE_OUTPUT_LEAK",
  "CLASS_B_HASH_MISSING",
  "DEFAULTED_VALUE_ENTERED_PHASE1",
  "HIDDEN_ENGINE_FIELD_ENTERED_PHASE1",
  "PHASE1_S26_SCOPE_MISMATCH",
  "PHASE1_SCHEMA_NOT_CLOSED"
]);

const failures = [];

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }

  return JSON.stringify(value);
}

function sha256(value) {
  return crypto.createHash("sha256").update(stableStringify(value)).digest("hex");
}

function setPath(object, pathExpression, value) {
  const parts = pathExpression.split(".");
  let cursor = object;

  while (parts.length > 1) {
    const part = parts.shift();
    if (!cursor[part] || typeof cursor[part] !== "object") {
      cursor[part] = {};
    }
    cursor = cursor[part];
  }

  cursor[parts[0]] = value;
}

function removePath(object, pathExpression) {
  const parts = pathExpression.split(".");
  let cursor = object;

  while (parts.length > 1) {
    const part = parts.shift();
    if (!cursor[part] || typeof cursor[part] !== "object") return;
    cursor = cursor[part];
  }

  delete cursor[parts[0]];
}

function mutate(base, mutation) {
  const payload = deepClone(base);

  if (!mutation) return payload;

  if (mutation.add) {
    for (const [key, value] of Object.entries(mutation.add)) {
      setPath(payload, key, value);
    }
  }

  if (mutation.replace) {
    for (const [key, value] of Object.entries(mutation.replace)) {
      setPath(payload, key, value);
    }
  }

  if (mutation.remove) {
    removePath(payload, mutation.remove);
  }

  return payload;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function validateRegistryId(value, pathName, errors) {
  if (typeof value !== "string") {
    errors.push({ keyword: "type", path: pathName });
    return;
  }

  if (value.length < 1) {
    errors.push({ keyword: "minLength", path: pathName });
    return;
  }

  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)) {
    errors.push({ keyword: "pattern", path: pathName });
  }
}

function validatePayload(payload) {
  const errors = [];

  if (!isPlainObject(payload)) {
    errors.push({ keyword: "type", path: "$" });
    return errors;
  }

  const allowedRoot = new Set(Object.keys(schema.properties));
  const requiredRoot = schema.required;

  for (const key of Object.keys(payload)) {
    if (!allowedRoot.has(key)) {
      errors.push({ keyword: "additionalProperties", path: key });
    }
  }

  for (const key of requiredRoot) {
    if (!hasOwn(payload, key)) {
      errors.push({ keyword: "required", path: key });
    }
  }

  if (payload.engine_version !== undefined && payload.engine_version !== "EB2-1.0.0") {
    errors.push({ keyword: typeof payload.engine_version === "string" ? "const" : "type", path: "engine_version" });
  }

  if (payload.enum_bundle_version !== undefined && payload.enum_bundle_version !== "EB2-1.0.0") {
    errors.push({ keyword: typeof payload.enum_bundle_version === "string" ? "const" : "type", path: "enum_bundle_version" });
  }

  if (payload.phase1_schema_version !== undefined && payload.phase1_schema_version !== "1.0.0") {
    errors.push({ keyword: typeof payload.phase1_schema_version === "string" ? "const" : "type", path: "phase1_schema_version" });
  }

  if (payload.consent_granted !== undefined && payload.consent_granted !== true) {
    errors.push({ keyword: typeof payload.consent_granted === "boolean" ? "const" : "type", path: "consent_granted" });
  }

  if (payload.jurisdiction_acknowledged !== undefined && payload.jurisdiction_acknowledged !== true) {
    errors.push({ keyword: typeof payload.jurisdiction_acknowledged === "boolean" ? "const" : "type", path: "jurisdiction_acknowledged" });
  }

  if (payload.age_declaration !== undefined && payload.age_declaration !== "adult_18_or_over") {
    errors.push({ keyword: typeof payload.age_declaration === "string" ? "enum" : "type", path: "age_declaration" });
  }

  if (payload.actor_type !== undefined && !["individual_user", "coach"].includes(payload.actor_type)) {
    errors.push({ keyword: typeof payload.actor_type === "string" ? "enum" : "type", path: "actor_type" });
  }

  if (payload.execution_scope !== undefined && !["individual", "coach_managed"].includes(payload.execution_scope)) {
    errors.push({ keyword: typeof payload.execution_scope === "string" ? "enum" : "type", path: "execution_scope" });
  }

  if (payload.execution_scope === "coach_managed" && !hasOwn(payload, "governing_authority_id")) {
    errors.push({ keyword: "required", path: "governing_authority_id" });
  }

  if (payload.execution_scope === "individual" && hasOwn(payload, "governing_authority_id")) {
    errors.push({ keyword: "not", path: "governing_authority_id" });
  }

  if (hasOwn(payload, "governing_authority_id")) {
    validateRegistryId(payload.governing_authority_id, "governing_authority_id", errors);
  }

  if (payload.activity_id !== undefined && !["powerlifting", "rugby_union", "general_strength"].includes(payload.activity_id)) {
    errors.push({ keyword: typeof payload.activity_id === "string" ? "enum" : "type", path: "activity_id" });
  }

  if (payload.location_type !== undefined && !["commercial_gym", "home_gym", "outdoor"].includes(payload.location_type)) {
    errors.push({ keyword: typeof payload.location_type === "string" ? "enum" : "type", path: "location_type" });
  }

  if (hasOwn(payload, "equipment_profile_id")) {
    validateRegistryId(payload.equipment_profile_id, "equipment_profile_id", errors);
  }

  if (hasOwn(payload, "sport_role_id")) {
    validateRegistryId(payload.sport_role_id, "sport_role_id", errors);
  }

  if (hasOwn(payload, "variant_id")) {
    validateRegistryId(payload.variant_id, "variant_id", errors);
  }

  if (hasOwn(payload, "baseline_metrics")) {
    if (!Array.isArray(payload.baseline_metrics)) {
      errors.push({ keyword: "type", path: "baseline_metrics" });
    } else {
      payload.baseline_metrics.forEach((metric, index) => validateBaselineMetric(metric, `baseline_metrics[${index}]`, errors));
    }
  }

  if (hasOwn(payload, "personal_kit")) {
    validatePersonalKit(payload.personal_kit, "personal_kit", errors);
  }

  if (hasOwn(payload, "capability_constraints")) {
    if (!Array.isArray(payload.capability_constraints)) {
      errors.push({ keyword: "type", path: "capability_constraints" });
    } else {
      payload.capability_constraints.forEach((constraint, index) => validateCapabilityConstraint(constraint, `capability_constraints[${index}]`, errors));
    }
  }

  if (hasOwn(payload, "ui_preferences")) {
    validateUiPreferences(payload.ui_preferences, "ui_preferences", errors);
  }

  return errors;
}

function validateBaselineMetric(metric, pathName, errors) {
  if (!isPlainObject(metric)) {
    errors.push({ keyword: "type", path: pathName });
    return;
  }

  const allowed = new Set(["metric_id", "activity_id", "value", "recorded_at", "linked_exercise_token_id", "source"]);
  for (const key of Object.keys(metric)) {
    if (!allowed.has(key)) errors.push({ keyword: "additionalProperties", path: `${pathName}.${key}` });
  }

  for (const key of ["metric_id", "activity_id", "value", "recorded_at"]) {
    if (!hasOwn(metric, key)) errors.push({ keyword: "required", path: `${pathName}.${key}` });
  }

  if (hasOwn(metric, "metric_id")) validateRegistryId(metric.metric_id, `${pathName}.metric_id`, errors);

  if (hasOwn(metric, "activity_id") && !["powerlifting", "rugby_union", "general_strength"].includes(metric.activity_id)) {
    errors.push({ keyword: typeof metric.activity_id === "string" ? "enum" : "type", path: `${pathName}.activity_id` });
  }

  if (hasOwn(metric, "value") && !isPlainObject(metric.value)) {
    errors.push({ keyword: "type", path: `${pathName}.value` });
  }

  if (hasOwn(metric, "value") && isPlainObject(metric.value) && Object.keys(metric.value).length < 1) {
    errors.push({ keyword: "minProperties", path: `${pathName}.value` });
  }

  if (hasOwn(metric, "recorded_at")) {
    if (typeof metric.recorded_at !== "string") {
      errors.push({ keyword: "type", path: `${pathName}.recorded_at` });
    } else if (!/^\d{4}-\d{2}-\d{2}([T ][0-2]\d:[0-5]\d(:[0-5]\d(\.\d{1,9})?)?(Z|[+-][0-2]\d:[0-5]\d)?)?$/.test(metric.recorded_at)) {
      errors.push({ keyword: "pattern", path: `${pathName}.recorded_at` });
    }
  }

  if (hasOwn(metric, "linked_exercise_token_id")) validateRegistryId(metric.linked_exercise_token_id, `${pathName}.linked_exercise_token_id`, errors);

  if (hasOwn(metric, "source") && !["user_manual", "coach_entered", "imported"].includes(metric.source)) {
    errors.push({ keyword: typeof metric.source === "string" ? "enum" : "type", path: `${pathName}.source` });
  }
}

function validatePersonalKit(kit, pathName, errors) {
  if (!isPlainObject(kit)) {
    errors.push({ keyword: "type", path: pathName });
    return;
  }

  const allowed = new Set(["owned_item_ids", "present_item_ids"]);
  for (const key of Object.keys(kit)) {
    if (!allowed.has(key)) errors.push({ keyword: "additionalProperties", path: `${pathName}.${key}` });
  }

  for (const key of ["owned_item_ids", "present_item_ids"]) {
    if (!hasOwn(kit, key)) {
      errors.push({ keyword: "required", path: `${pathName}.${key}` });
    } else if (!Array.isArray(kit[key])) {
      errors.push({ keyword: "type", path: `${pathName}.${key}` });
    } else {
      kit[key].forEach((item, index) => validateRegistryId(item, `${pathName}.${key}[${index}]`, errors));
    }
  }
}

function validateCapabilityConstraint(constraint, pathName, errors) {
  if (!isPlainObject(constraint)) {
    errors.push({ keyword: "type", path: pathName });
    return;
  }

  const allowed = new Set(["constraint_id", "target_token_id"]);
  for (const key of Object.keys(constraint)) {
    if (!allowed.has(key)) errors.push({ keyword: "additionalProperties", path: `${pathName}.${key}` });
  }

  if (!hasOwn(constraint, "constraint_id")) {
    errors.push({ keyword: "required", path: `${pathName}.constraint_id` });
  } else if (!["reduced_range_position", "loaded_position_instability", "setup_modification_required", "position_unavailable"].includes(constraint.constraint_id)) {
    errors.push({ keyword: typeof constraint.constraint_id === "string" ? "enum" : "type", path: `${pathName}.constraint_id` });
  }

  if (hasOwn(constraint, "target_token_id")) validateRegistryId(constraint.target_token_id, `${pathName}.target_token_id`, errors);
}

function validateUiPreferences(ui, pathName, errors) {
  if (!isPlainObject(ui)) {
    errors.push({ keyword: "type", path: pathName });
    return;
  }

  const allowed = new Set(["instruction_density", "presentation_density", "nd_mode"]);
  for (const key of Object.keys(ui)) {
    if (!allowed.has(key)) errors.push({ keyword: "additionalProperties", path: `${pathName}.${key}` });
  }

  if (hasOwn(ui, "instruction_density") && !["low", "medium", "high"].includes(ui.instruction_density)) {
    errors.push({ keyword: typeof ui.instruction_density === "string" ? "enum" : "type", path: `${pathName}.instruction_density` });
  }

  if (hasOwn(ui, "presentation_density") && !["compact", "standard", "expanded"].includes(ui.presentation_density)) {
    errors.push({ keyword: typeof ui.presentation_density === "string" ? "enum" : "type", path: `${pathName}.presentation_density` });
  }

  if (hasOwn(ui, "nd_mode") && typeof ui.nd_mode !== "boolean") {
    errors.push({ keyword: "type", path: `${pathName}.nd_mode` });
  }
}

function runCiAssertion(assertion) {
  if (!assertion || typeof assertion !== "object") return null;

  if (assertion.type === "class_c_engine_inertness" && assertion.engine_output_changed === true) return "CLASS_C_ENGINE_OUTPUT_LEAK";
  if (assertion.type === "class_b_hash_affecting" && assertion.phase1_hash_unchanged === true) return "CLASS_B_HASH_MISSING";
  if (assertion.type === "defaulted_value_entered_payload") return "DEFAULTED_VALUE_ENTERED_PHASE1";
  if (assertion.type === "hidden_ui_field_entered_payload") return "HIDDEN_ENGINE_FIELD_ENTERED_PHASE1";

  return null;
}

function assertS26Alignment() {
  const actorEnum = schema.properties.actor_type.enum;
  const scopeEnum = schema.properties.execution_scope.enum;
  const activityEnum = schema.properties.activity_id.enum;

  const s26Actors = s26.allowed_actor_types;
  const s26Scopes = s26.allowed_execution_scopes;
  const s26Activities = s26.allowed_activities;

  const same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

  if (!same(actorEnum, s26Actors) || !same(scopeEnum, s26Scopes) || !same(activityEnum, s26Activities)) {
    failures.push({
      test_id: "s26_alignment",
      expected_ok: true,
      actual_ok: false,
      expected_failure: null,
      actual_failure: "PHASE1_S26_SCOPE_MISMATCH"
    });
  }
}

function assertSchemaClosure() {
  const closureChecks = [
    ["root", schema],
    ["baseline_metric", schema.$defs.baseline_metric],
    ["personal_kit", schema.$defs.personal_kit],
    ["capability_constraint", schema.$defs.capability_constraint],
    ["ui_preferences", schema.$defs.ui_preferences]
  ];

  for (const [name, node] of closureChecks) {
    if (!node || node.additionalProperties !== false) {
      failures.push({
        test_id: `schema_closure_${name}`,
        expected_ok: true,
        actual_ok: false,
        expected_failure: null,
        actual_failure: "PHASE1_SCHEMA_NOT_CLOSED"
      });
    }
  }
}

function assertHashBehaviour() {
  const base = deepClone(suite.valid_control_payload);
  const baseHash = hashEngineVisible(base);

  const changedClassB = deepClone(base);
  changedClassB.activity_id = "powerlifting";
  const classBHash = hashEngineVisible(changedClassB);

  if (baseHash === classBHash) {
    failures.push({
      test_id: "hash_class_b_activity_changes_hash",
      expected_ok: true,
      actual_ok: false,
      expected_failure: null,
      actual_failure: "CLASS_B_HASH_MISSING"
    });
  }

  const changedClassC = deepClone(base);
  changedClassC.ui_preferences = {
    instruction_density: "high",
    presentation_density: "expanded",
    nd_mode: true
  };

  const classCHash = hashEngineVisible(changedClassC);

  if (baseHash !== classCHash) {
    failures.push({
      test_id: "hash_class_c_ui_preferences_engine_inert",
      expected_ok: true,
      actual_ok: false,
      expected_failure: null,
      actual_failure: "CLASS_C_ENGINE_OUTPUT_LEAK"
    });
  }
}

function hashEngineVisible(payload) {
  const copy = deepClone(payload);
  delete copy.ui_preferences;
  return sha256(copy);
}

assertS26Alignment();
assertSchemaClosure();
assertHashBehaviour();

for (const test of suite.tests) {
  let actualOk = true;
  let actualFailure = null;

  if (test.mutation && test.mutation.ci_assertion) {
    actualFailure = runCiAssertion(test.mutation.ci_assertion);
    actualOk = actualFailure === null;
  } else {
    const payload = mutate(suite.valid_control_payload, test.mutation);
    const errors = validatePayload(payload);
    actualOk = errors.length === 0;
    actualFailure = errors.length > 0 ? errors[0].keyword : null;
  }

  if (actualOk !== test.expected_ok || actualFailure !== test.expected_failure) {
    failures.push({
      test_id: test.test_id,
      expected_ok: test.expected_ok,
      actual_ok: actualOk,
      expected_failure: test.expected_failure,
      actual_failure: actualFailure
    });
  }

  if (actualFailure && !knownFailures.has(actualFailure)) {
    failures.push({
      test_id: `${test.test_id}_unknown_failure_token`,
      expected_ok: true,
      actual_ok: false,
      expected_failure: null,
      actual_failure: actualFailure
    });
  }
}

const report = {
  ok: failures.length === 0,
  suite: suite.test_suite_id,
  total_tests: suite.tests.length,
  failures
};

const output = JSON.stringify(report, null, 2);

if (!report.ok) {
  console.error(output);
  process.exit(1);
}

console.log(output);