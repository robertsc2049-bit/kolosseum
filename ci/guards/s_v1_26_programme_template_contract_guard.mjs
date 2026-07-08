// @law: v1 Programme Template Contract
// @severity: high
// @scope: v1-registry

// DEV NOTE: S-V1-26 contract guard. This guard proves the programme template
// contract before active v1 template content production. It enforces registry
// binding, explicit order, assigned coach-athlete execution support, and hidden
// formula/progression internals. It must not add marketplace, royalty, protected
// formula visibility, database, UI, or engine behaviour.

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const TOKEN = "CI_V1_PROGRAMME_TEMPLATE_CONTRACT";
const TOKEN_PREFIX = "v1_programme_template_contract_";

const lockedActivityIds = Object.freeze([
  "powerlifting",
  "general_strength",
  "rugby_union"
]);

const requiredFiles = Object.freeze([
  "docs/v1/V1_PROGRAMME_TEMPLATE_CONTRACT.md",
  "ci/fixtures/v1_programme_template_contract_negative/s_v1_26_invalid_template_negative.json",
  "test/s_v1_26_programme_template_contract.test.mjs",
  "ci/guards/s_v1_26_programme_template_contract_guard.mjs",
  "docs/v1/V1_REGISTRY_CONTENT_PRODUCTION_SYSTEM.md",
  "docs/v1/V1_REGISTRY_LOAD_ORDER_FK_CLOSURE_CONTRACT.md",
  "docs/v1/V1_EXERCISE_REGISTRY_CONTRACT.md",
  "docs/v1/V1_EQUIPMENT_REGISTRY_COVERAGE_CONTRACT.md",
  "docs/v1/V1_EXERCISE_ACTIVITY_APPLICABILITY_COVERAGE_CONTRACT.md"
]);

const requiredTemplateKeys = Object.freeze([
  "template_id",
  "template_version",
  "contract_version",
  "template_status",
  "activity_id",
  "assignment_scope",
  "source_record_id",
  "source_control_status",
  "template_structure",
  "registry_bindings",
  "visibility_boundary",
  "deterministic_boundary",
  "execution_surface",
  "copy_boundary_flags"
]);

const requiredRegistryBindingKeys = Object.freeze([
  "activity_id",
  "exercise_ids",
  "equipment_ids",
  "substitution_edge_ids",
  "applicability_ids"
]);

const requiredVisibilityBoundaryKeys = Object.freeze([
  "formula_payload_status",
  "progression_internals_status",
  "protected_logic_reference_status"
]);

const requiredDeterministicBoundaryKeys = Object.freeze([
  "template_hash_inputs",
  "order_policy",
  "unknown_field_policy",
  "registry_reference_policy"
]);

const requiredExecutionSurfaceKeys = Object.freeze([
  "coach_can_assign",
  "athlete_can_execute_assigned",
  "coach_can_edit_after_assignment",
  "assignment_mutates_template",
  "template_mutates_relationship",
  "template_mutates_engine"
]);

const expectedTemplateHashInputs = Object.freeze([
  "template_id",
  "template_version",
  "activity_id",
  "assignment_scope",
  "registry_bindings",
  "template_structure"
]);

const forbiddenTemplateKeys = Object.freeze([
  "marketplace_listing_id",
  "royalty_rate",
  "royalty_recipient",
  "protected_formula_payload",
  "progression_formula_payload",
  "coach_brand_attribution",
  "recommendation_score",
  "optimisation_score",
  "readiness_score",
  "risk_score"
]);

function failGuard(message, details = {}) {
  console.error(JSON.stringify({
    ok: false,
    guard: "S-V1-26",
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
    failGuard(`missing required file: ${relativePath}`);
  }

  return fs.readFileSync(fullPath, "utf8");
}

function readJson(relativePath) {
  try {
    return JSON.parse(readText(relativePath));
  } catch (error) {
    failGuard(`invalid JSON in ${relativePath}: ${error?.message ?? String(error)}`);
  }
}

function assertIncludes(text, required, context) {
  if (!text.includes(required)) {
    failGuard(`${context} missing required text: ${required}`);
  }
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(Object(value), key);
}

function assertPlainObject(value, code, message, details = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    contractFail(code, message, details);
  }
}

function assertExactKeys(value, requiredKeys, code, details = {}) {
  const keys = Object.keys(value).sort();
  const expected = [...requiredKeys].sort();

  if (JSON.stringify(keys) !== JSON.stringify(expected)) {
    contractFail(code, "object keys do not match the closed-world contract", {
      ...details,
      actual_keys: keys,
      expected_keys: expected
    });
  }
}

function assertNonEmptyString(value, code, details = {}) {
  if (typeof value !== "string" || value.length === 0) {
    contractFail(code, "expected non-empty string", details);
  }
}

function assertBoolean(value, code, details = {}) {
  if (typeof value !== "boolean") {
    contractFail(code, "expected boolean", details);
  }
}

function assertPositiveInteger(value, code, details = {}) {
  if (!Number.isInteger(value) || value <= 0) {
    contractFail(code, "expected positive integer", details);
  }
}

function assertSortedUniqueStringArray(value, code, details = {}) {
  if (!Array.isArray(value) || value.length === 0) {
    contractFail(code, "expected non-empty string array", details);
  }

  const seen = new Set();
  let previous = "";

  for (const item of value) {
    if (typeof item !== "string" || item.length === 0) {
      contractFail(code, "array must contain non-empty strings only", details);
    }

    if (seen.has(item)) {
      contractFail("duplicate_array_value", "array contains duplicate value", {
        ...details,
        value: item
      });
    }

    if (previous && item < previous) {
      contractFail("array_order_not_deterministic", "array must be sorted for deterministic template hashing", {
        ...details,
        value: item
      });
    }

    previous = item;
    seen.add(item);
  }
}

function assertNoForbiddenKeysDeep(value, pathParts = []) {
  if (!value || typeof value !== "object") {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenKeysDeep(item, [...pathParts, String(index)]));
    return;
  }

  for (const key of Object.keys(value)) {
    if (forbiddenTemplateKeys.includes(key)) {
      contractFail("forbidden_template_field", "template contains a forbidden field", {
        path: [...pathParts, key].join("."),
        field: key
      });
    }

    assertNoForbiddenKeysDeep(value[key], [...pathParts, key]);
  }
}

function assertOrderIndexes(items, code, details = {}) {
  if (!Array.isArray(items) || items.length === 0) {
    contractFail(code, "expected non-empty ordered array", details);
  }

  const seen = new Set();

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];

    assertPlainObject(item, code, "ordered item must be an object", {
      ...details,
      index
    });

    assertPositiveInteger(item.order_index, code, {
      ...details,
      index
    });

    if (seen.has(item.order_index)) {
      contractFail("duplicate_order_index", "order_index must be unique within the ordered collection", {
        ...details,
        order_index: item.order_index
      });
    }

    seen.add(item.order_index);
  }
}

function validateWorkItem(workItem, registryBindings) {
  assertPlainObject(workItem, "work_item_not_object", "work item must be an object");

  for (const field of [
    "work_item_id",
    "exercise_id",
    "loading_reference",
    "substitution_policy_id"
  ]) {
    assertNonEmptyString(workItem[field], "work_item_required_field_invalid", {
      field,
      work_item_id: workItem.work_item_id ?? null
    });
  }

  assertPositiveInteger(workItem.order_index, "work_item_order_invalid", {
    work_item_id: workItem.work_item_id
  });

  assertPositiveInteger(workItem.planned_sets, "work_item_sets_invalid", {
    work_item_id: workItem.work_item_id
  });

  assertPositiveInteger(workItem.planned_reps, "work_item_reps_invalid", {
    work_item_id: workItem.work_item_id
  });

  assertSortedUniqueStringArray(workItem.equipment_requirement_ids, "work_item_equipment_requirements_invalid", {
    work_item_id: workItem.work_item_id
  });

  if (!registryBindings.exercise_ids.includes(workItem.exercise_id)) {
    contractFail("unknown_exercise_reference", "work item references an exercise_id outside registry_bindings.exercise_ids", {
      work_item_id: workItem.work_item_id,
      exercise_id: workItem.exercise_id
    });
  }

  for (const equipmentId of workItem.equipment_requirement_ids) {
    if (!registryBindings.equipment_ids.includes(equipmentId)) {
      contractFail("unknown_equipment_reference", "work item references equipment outside registry_bindings.equipment_ids", {
        work_item_id: workItem.work_item_id,
        equipment_id: equipmentId
      });
    }
  }

  if (!registryBindings.substitution_edge_ids.includes(workItem.substitution_policy_id)) {
    contractFail("unknown_substitution_reference", "work item references substitution policy outside registry_bindings.substitution_edge_ids", {
      work_item_id: workItem.work_item_id,
      substitution_policy_id: workItem.substitution_policy_id
    });
  }
}

function validateTemplateStructure(templateStructure, registryBindings) {
  assertPlainObject(templateStructure, "template_structure_not_object", "template_structure must be an object");

  if (!hasOwn(templateStructure, "blocks")) {
    contractFail("template_structure_blocks_missing", "template_structure.blocks is required");
  }

  assertOrderIndexes(templateStructure.blocks, "block_order_invalid");

  for (const block of templateStructure.blocks) {
    assertNonEmptyString(block.block_id, "block_id_invalid");
    assertOrderIndexes(block.weeks, "week_order_invalid", { block_id: block.block_id });

    for (const week of block.weeks) {
      assertNonEmptyString(week.week_id, "week_id_invalid", { block_id: block.block_id });
      assertOrderIndexes(week.days, "day_order_invalid", { block_id: block.block_id, week_id: week.week_id });

      for (const day of week.days) {
        assertNonEmptyString(day.day_id, "day_id_invalid", { week_id: week.week_id });
        assertOrderIndexes(day.sessions, "session_order_invalid", { week_id: week.week_id, day_id: day.day_id });

        for (const session of day.sessions) {
          assertNonEmptyString(session.session_id, "session_id_invalid", { day_id: day.day_id });
          assertOrderIndexes(session.work_items, "work_item_order_invalid", { session_id: session.session_id });

          for (const workItem of session.work_items) {
            validateWorkItem(workItem, registryBindings);
          }
        }
      }
    }
  }
}

function validateProgrammeTemplateContract(template) {
  assertPlainObject(template, "template_not_object", "template must be an object");
  assertExactKeys(template, requiredTemplateKeys, "template_keys_invalid", {
    template_id: template.template_id ?? null
  });

  assertNoForbiddenKeysDeep(template);

  for (const field of [
    "template_id",
    "template_version",
    "contract_version",
    "template_status",
    "activity_id",
    "assignment_scope",
    "source_record_id",
    "source_control_status"
  ]) {
    assertNonEmptyString(template[field], "template_required_field_invalid", {
      field,
      template_id: template.template_id ?? null
    });
  }

  if (template.contract_version !== "S-V1-26") {
    contractFail("contract_version_invalid", "template contract_version must be S-V1-26", {
      template_id: template.template_id
    });
  }

  if (!lockedActivityIds.includes(template.activity_id)) {
    contractFail("unsupported_activity_refused", "programme template activity_id must be in the locked v1 activity set", {
      template_id: template.template_id,
      activity_id: template.activity_id
    });
  }

  if (template.assignment_scope !== "coach_athlete_assigned_execution") {
    contractFail("assignment_scope_invalid", "programme templates in this contract must support assigned coach-athlete execution", {
      template_id: template.template_id,
      assignment_scope: template.assignment_scope
    });
  }

  if (template.source_control_status !== "approved") {
    contractFail("source_control_status_required", "programme templates require approved source-control status before active registry candidate use", {
      template_id: template.template_id
    });
  }

  assertPlainObject(template.registry_bindings, "registry_bindings_not_object", "registry_bindings must be an object");
  assertExactKeys(template.registry_bindings, requiredRegistryBindingKeys, "registry_bindings_keys_invalid", {
    template_id: template.template_id
  });

  if (template.registry_bindings.activity_id !== template.activity_id) {
    contractFail("registry_activity_mismatch", "registry_bindings.activity_id must match template.activity_id", {
      template_id: template.template_id
    });
  }

  assertSortedUniqueStringArray(template.registry_bindings.exercise_ids, "exercise_bindings_invalid", {
    template_id: template.template_id
  });
  assertSortedUniqueStringArray(template.registry_bindings.equipment_ids, "equipment_bindings_invalid", {
    template_id: template.template_id
  });
  assertSortedUniqueStringArray(template.registry_bindings.substitution_edge_ids, "substitution_bindings_invalid", {
    template_id: template.template_id
  });
  assertSortedUniqueStringArray(template.registry_bindings.applicability_ids, "applicability_bindings_invalid", {
    template_id: template.template_id
  });

  assertPlainObject(template.visibility_boundary, "visibility_boundary_not_object", "visibility_boundary must be an object");
  assertExactKeys(template.visibility_boundary, requiredVisibilityBoundaryKeys, "visibility_boundary_keys_invalid", {
    template_id: template.template_id
  });

  if (template.visibility_boundary.formula_payload_status !== "not_present") {
    contractFail("formula_payload_refused", "formula payloads must not be visible in the programme template contract", {
      template_id: template.template_id
    });
  }

  if (template.visibility_boundary.progression_internals_status !== "not_present") {
    contractFail("progression_internals_refused", "progression internals must not be visible in the programme template contract", {
      template_id: template.template_id
    });
  }

  if (template.visibility_boundary.protected_logic_reference_status !== "opaque_reference_only") {
    contractFail("protected_logic_reference_invalid", "protected logic references must be opaque only", {
      template_id: template.template_id
    });
  }

  assertPlainObject(template.deterministic_boundary, "deterministic_boundary_not_object", "deterministic_boundary must be an object");
  assertExactKeys(template.deterministic_boundary, requiredDeterministicBoundaryKeys, "deterministic_boundary_keys_invalid", {
    template_id: template.template_id
  });

  if (JSON.stringify(template.deterministic_boundary.template_hash_inputs) !== JSON.stringify(expectedTemplateHashInputs)) {
    contractFail("template_hash_inputs_invalid", "template_hash_inputs must match the locked deterministic input list", {
      template_id: template.template_id
    });
  }

  if (template.deterministic_boundary.order_policy !== "explicit_order_index_only") {
    contractFail("order_policy_invalid", "template order policy must be explicit_order_index_only", {
      template_id: template.template_id
    });
  }

  if (template.deterministic_boundary.unknown_field_policy !== "fail_closed") {
    contractFail("unknown_field_policy_invalid", "unknown field policy must be fail_closed", {
      template_id: template.template_id
    });
  }

  if (template.deterministic_boundary.registry_reference_policy !== "declared_registry_ids_only") {
    contractFail("registry_reference_policy_invalid", "registry reference policy must be declared_registry_ids_only", {
      template_id: template.template_id
    });
  }

  assertPlainObject(template.execution_surface, "execution_surface_not_object", "execution_surface must be an object");
  assertExactKeys(template.execution_surface, requiredExecutionSurfaceKeys, "execution_surface_keys_invalid", {
    template_id: template.template_id
  });

  for (const field of requiredExecutionSurfaceKeys) {
    assertBoolean(template.execution_surface[field], "execution_surface_boolean_invalid", {
      template_id: template.template_id,
      field
    });
  }

  if (template.execution_surface.coach_can_assign !== true) {
    contractFail("coach_assignment_support_required", "template must support coach assignment", {
      template_id: template.template_id
    });
  }

  if (template.execution_surface.athlete_can_execute_assigned !== true) {
    contractFail("athlete_assigned_execution_required", "template must support athlete execution after assignment", {
      template_id: template.template_id
    });
  }

  for (const field of [
    "coach_can_edit_after_assignment",
    "assignment_mutates_template",
    "template_mutates_relationship",
    "template_mutates_engine"
  ]) {
    if (template.execution_surface[field] !== false) {
      contractFail("execution_surface_boundary_invalid", "execution surface must remain read/assignment bounded", {
        template_id: template.template_id,
        field
      });
    }
  }

  assertSortedUniqueStringArray(template.copy_boundary_flags, "copy_boundary_flags_invalid", {
    template_id: template.template_id
  });

  for (const requiredFlag of [
    "formula_payload_not_visible",
    "no_marketplace_scope",
    "no_royalty_scope",
    "registry_bound"
  ]) {
    if (!template.copy_boundary_flags.includes(requiredFlag)) {
      contractFail("copy_boundary_flag_missing", "required copy boundary flag missing", {
        template_id: template.template_id,
        requiredFlag
      });
    }
  }

  validateTemplateStructure(template.template_structure, template.registry_bindings);

  return {
    ok: true,
    template_id: template.template_id,
    activity_id: template.activity_id
  };
}

function assertThrowsWithCode(fn, expectedCode, context) {
  try {
    fn();
  } catch (error) {
    if (error && error.code === expectedCode) {
      return error;
    }

    failGuard(`${context}: expected ${expectedCode}, got ${error && error.code ? error.code : "no_code"}`);
  }

  failGuard(`${context}: expected throw with ${expectedCode}`);
}

for (const file of requiredFiles) {
  readText(file);
}

for (const forbiddenPath of [
  "registries/programme_template_contract.registry.json",
  "registries/programme_template/programme_template_contract.registry.json",
  "shared/v1-registry/v1ProgrammeTemplateContract.mjs",
  "src/programmeTemplateContract.mjs"
]) {
  if (fs.existsSync(path.join(repoRoot, forbiddenPath))) {
    failGuard(`forbidden active or shared implementation surface present: ${forbiddenPath}`);
  }
}

const fixturePath = "ci/fixtures/v1_programme_template_contract_negative/s_v1_26_invalid_template_negative.json";
const fixture = readJson(fixturePath);

if (fixture.slice_id !== "S-V1-26") {
  failGuard(`${fixturePath} slice_id must be S-V1-26`);
}

if (fixture.expected_failure_code !== "v1_programme_template_contract_formula_payload_refused") {
  failGuard(`${fixturePath} expected_failure_code mismatch`);
}

const error = assertThrowsWithCode(
  () => validateProgrammeTemplateContract(fixture.template),
  fixture.expected_failure_code,
  "invalid programme template negative fixture"
);

if (error.details?.template_id !== fixture.template.template_id) {
  failGuard("negative fixture failed for wrong template_id");
}

const docText = readText("docs/v1/V1_PROGRAMME_TEMPLATE_CONTRACT.md");
const s25Text = readText("docs/v1/V1_REGISTRY_CONTENT_PRODUCTION_SYSTEM.md");
const s24Text = readText("docs/v1/V1_REGISTRY_LOAD_ORDER_FK_CLOSURE_CONTRACT.md");
const packageText = readText("package.json");
const guardsIndexText = readText("docs/GUARDS_INDEX.md");
const failureTokenText = readText("docs/dev/FAILURE_TOKEN_INDEX.md");

for (const requiredText of [
  "S-V1-26",
  "programme template contract",
  "coach_athlete_assigned_execution",
  "registry-bound",
  "formula and progression internals remain protected",
  "deterministic and registry-bound",
  "No active programme template rows are added by this slice",
  "marketplace and royalties remain out of scope",
  "formula_payload_status",
  "progression_internals_status",
  "template_hash_inputs",
  "registry_reference_policy",
  "declared_registry_ids_only",
  "explicit_order_index_only"
]) {
  assertIncludes(docText, requiredText, "docs/v1/V1_PROGRAMME_TEMPLATE_CONTRACT.md");
}

for (const field of requiredTemplateKeys) {
  assertIncludes(docText, field, "docs/v1/V1_PROGRAMME_TEMPLATE_CONTRACT.md");
}

for (const field of requiredRegistryBindingKeys) {
  assertIncludes(docText, field, "docs/v1/V1_PROGRAMME_TEMPLATE_CONTRACT.md");
}

for (const requiredText of [
  "source-control register",
  "Content must be original or licensed",
  "manual_review_status",
  "licence_status"
]) {
  assertIncludes(s25Text, requiredText, "docs/v1/V1_REGISTRY_CONTENT_PRODUCTION_SYSTEM.md");
}

for (const requiredText of [
  "programme_template",
  "exercise before programme_template",
  "equipment before programme_template",
  "substitution_edge before programme_template"
]) {
  assertIncludes(s24Text, requiredText, "docs/v1/V1_REGISTRY_LOAD_ORDER_FK_CLOSURE_CONTRACT.md");
}

assertIncludes(
  packageText,
  "node --test test/s_v1_26_programme_template_contract.test.mjs",
  "package.json lint:fast"
);

assertIncludes(
  packageText,
  "node ci/guards/s_v1_26_programme_template_contract_guard.mjs",
  "package.json lint:fast"
);

assertIncludes(
  guardsIndexText,
  "s_v1_26_programme_template_contract_guard",
  "docs/GUARDS_INDEX.md"
);

assertIncludes(
  failureTokenText,
  TOKEN,
  "docs/dev/FAILURE_TOKEN_INDEX.md"
);

console.log(JSON.stringify({
  ok: true,
  guard: "S-V1-26",
  token: TOKEN,
  message: "Programme template contract passed."
}));
