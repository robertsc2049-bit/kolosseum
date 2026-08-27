// @law: v1 Registry Load Order and FK Closure
// @severity: high
// @scope: v1-registry

// DEV NOTE: S-V1-24 boundary guard. This guard hardens deterministic registry
// load order and explicit FK closure without adding active registry content.
// It checks the active registry index/bundle, the negative FK fixture, existing
// registry loader/guard anchors, package wiring, and generated indexes.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const TOKEN = "CI_V1_REGISTRY_LOAD_ORDER_FK_CLOSURE";
const TOKEN_PREFIX = "v1_registry_load_order_fk_closure_";

const registryDependencyEdges = Object.freeze([
  ["activity", "movement"],
  ["movement", "exercise"],
  ["activity", "exercise"],
  ["exercise", "program"],
  ["activity", "program"],
  ["activity", "equipment"],
  ["movement", "equipment"],
  ["exercise", "exercise_activity_applicability"],
  ["activity", "exercise_activity_applicability"],
  ["exercise", "exercise_equipment_compatibility"],
  ["equipment", "exercise_equipment_compatibility"],
  ["exercise", "substitution_edge"],
  ["exercise_activity_applicability", "substitution_edge"],
  ["exercise", "programme_template"],
  ["equipment", "programme_template"],
  ["substitution_edge", "programme_template"]
]);

const requiredFiles = Object.freeze([
  "docs/v1/V1_REGISTRY_LOAD_ORDER_FK_CLOSURE_CONTRACT.md",
  "ci/fixtures/v1_registry_load_order_fk_closure_negative/s_v1_24_unknown_movement_fk_negative.json",
  "test/s_v1_24_registry_load_order_fk_closure.test.mjs",
  "ci/guards/s_v1_24_registry_load_order_fk_closure_guard.mjs",
  "registries/registry_index.json",
  "registries/registry_bundle.json",
  "engine/src/registries/loadRegistries.ts",
  "ci/guards/registry_schema_presence_guard.mjs",
  "ci/guards/registry_bundle_guard.mjs",
  "ci/guards/registry_law_guard.mjs",
  "docs/v1/V1_EXERCISE_REGISTRY_CONTRACT.md",
  "docs/v1/V1_EQUIPMENT_REGISTRY_COVERAGE_CONTRACT.md",
  "docs/v1/V1_EXERCISE_ACTIVITY_APPLICABILITY_COVERAGE_CONTRACT.md"
]);

function fail(message, details = {}) {
  console.error(JSON.stringify({
    ok: false,
    guard: "S-V1-24",
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
    fail(`missing required file: ${relativePath}`);
  }

  return fs.readFileSync(fullPath, "utf8");
}

function readJson(relativePath) {
  try {
    return JSON.parse(readText(relativePath));
  } catch (error) {
    fail(`invalid JSON in ${relativePath}: ${error?.message ?? String(error)}`);
  }
}

function assertIncludes(text, required, context) {
  if (!text.includes(required)) {
    fail(`${context} missing required text: ${required}`);
  }
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

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function findCollection(document, preferredName = null) {
  if (Array.isArray(document)) {
    return document;
  }

  if (!isPlainObject(document)) {
    return [];
  }

  const candidateKeys = [
    "entries",
    "records",
    "items",
    preferredName,
    preferredName ? `${preferredName}s` : null
  ].filter(Boolean);

  for (const key of candidateKeys) {
    if (Array.isArray(document[key])) {
      return document[key];
    }
  }

  return [];
}

function firstStringField(record, fieldNames) {
  for (const fieldName of fieldNames) {
    if (typeof record[fieldName] === "string" && record[fieldName].length > 0) {
      return record[fieldName];
    }
  }

  return null;
}

function collectIds(records, fieldNames) {
  const ids = new Set();

  for (const record of records) {
    if (!isPlainObject(record)) {
      continue;
    }

    const id = firstStringField(record, fieldNames);

    if (id) {
      ids.add(id);
    }
  }

  return ids;
}

function requireStringArray(value, code, context) {
  if (!Array.isArray(value)) {
    contractFail(code, "expected an explicit array", context);
  }

  const seen = new Set();

  for (const item of value) {
    if (typeof item !== "string" || item.length === 0) {
      contractFail(code, "expected non-empty string array entries", context);
    }

    if (seen.has(item)) {
      contractFail("duplicate_registry_order_entry", "registry order contains a duplicate entry", {
        value: item,
        ...context
      });
    }

    seen.add(item);
  }

  return value;
}

function assertBefore(order, upstream, downstream) {
  const upstreamIndex = order.indexOf(upstream);
  const downstreamIndex = order.indexOf(downstream);

  if (upstreamIndex === -1 || downstreamIndex === -1) {
    return;
  }

  if (upstreamIndex >= downstreamIndex) {
    contractFail("load_order_dependency_violation", "registry load order violates declared dependency order", {
      upstream,
      downstream,
      order
    });
  }
}

function validateLoadOrder(index, bundle) {
  if (!isPlainObject(index)) {
    contractFail("registry_index_invalid", "registry_index must be an object");
  }

  const order = requireStringArray(index.order, "registry_order_invalid", {
    field: "registry_index.order"
  });

  if (!isPlainObject(bundle)) {
    contractFail("registry_bundle_invalid", "registry_bundle must be an object");
  }

  if (!isPlainObject(bundle.registries)) {
    contractFail("registry_bundle_registries_invalid", "registry_bundle.registries must be an object");
  }

  if (typeof index.version !== "string" || index.version.length === 0) {
    contractFail("registry_index_version_invalid", "registry_index.version must be a non-empty string");
  }

  if (typeof bundle.version !== "string" || bundle.version.length === 0) {
    contractFail("registry_bundle_version_invalid", "registry_bundle.version must be a non-empty string");
  }

  if (bundle.version !== index.version) {
    contractFail("registry_bundle_version_mismatch", "registry bundle version must match registry index version", {
      index_version: index.version,
      bundle_version: bundle.version
    });
  }

  const bundleKeys = Object.keys(bundle.registries);

  try {
    assert.deepEqual(bundleKeys, order);
  } catch {
    contractFail("bundle_key_order_mismatch", "bundle registry key order must match registry_index.order exactly", {
      expected_order: order,
      actual_order: bundleKeys
    });
  }

  for (const name of order) {
    if (!hasOwn(bundle.registries, name)) {
      contractFail("registry_bundle_missing_ordered_registry", "registry bundle missing ordered registry", {
        registry: name
      });
    }
  }

  for (const [upstream, downstream] of registryDependencyEdges) {
    assertBefore(order, upstream, downstream);
  }

  return order;
}

function addRefsFromField(refs, record, fieldName) {
  if (!hasOwn(record, fieldName)) {
    return;
  }

  for (const value of asArray(record[fieldName])) {
    if (typeof value !== "string" || value.length === 0) {
      contractFail("registry_reference_invalid", "registry reference fields must contain non-empty strings", {
        field: fieldName
      });
    }

    refs.push({
      field: fieldName,
      value
    });
  }
}

function validateFkClosure(bundle) {
  const registries = bundle.registries;

  const activityRecords = findCollection(registries.activity, "activity");
  const movementRecords = findCollection(registries.movement, "movement");
  const exerciseRecords = findCollection(registries.exercise, "exercise");
  const equipmentRecords = findCollection(registries.equipment, "equipment");
  const applicabilityRecords = findCollection(registries.exercise_activity_applicability, "applicability");
  const equipmentCompatibilityRecords = findCollection(registries.exercise_equipment_compatibility, "equipment_compatibility");
  const substitutionRecords = findCollection(registries.substitution_edge, "substitution_edge");
  const programmeTemplateRecords = findCollection(registries.programme_template ?? registries.program, "programme_template");

  const activityIds = collectIds(activityRecords, ["activity_id", "id"]);
  const movementIds = collectIds(movementRecords, ["movement_pattern_id", "movement_id", "movement_family_id", "id"]);
  const exerciseIds = collectIds(exerciseRecords, ["exercise_id", "id"]);
  const equipmentIds = collectIds(equipmentRecords, ["equipment_id", "id"]);

  for (const exercise of exerciseRecords) {
    if (!isPlainObject(exercise)) {
      contractFail("exercise_record_not_object", "exercise registry record must be an object");
    }

    const exerciseId = firstStringField(exercise, ["exercise_id", "id"]) ?? "unknown_exercise";

    for (const movementField of ["movement_pattern_id", "movement_id", "movement_family_id"]) {
      if (hasOwn(exercise, movementField)) {
        const movementId = exercise[movementField];

        if (typeof movementId !== "string" || movementId.length === 0) {
          contractFail("movement_reference_invalid", "exercise movement reference must be a non-empty string", {
            exercise_id: exerciseId,
            field: movementField
          });
        }

        if (movementIds.size > 0 && !movementIds.has(movementId)) {
          contractFail("unknown_movement_reference", "exercise references an unknown movement registry id", {
            exercise_id: exerciseId,
            field: movementField,
            movement_pattern_id: movementId
          });
        }
      }
    }

    const activityRefs = [];
    addRefsFromField(activityRefs, exercise, "activity_id");
    addRefsFromField(activityRefs, exercise, "primary_activity_applicability");
    addRefsFromField(activityRefs, exercise, "secondary_activity_applicability");
    addRefsFromField(activityRefs, exercise, "activity_applicability");

    for (const ref of activityRefs) {
      if (activityIds.size > 0 && !activityIds.has(ref.value)) {
        contractFail("unknown_activity_reference", "exercise references an unknown activity registry id", {
          exercise_id: exerciseId,
          field: ref.field,
          activity_id: ref.value
        });
      }
    }

    const equipmentRefs = [];
    addRefsFromField(equipmentRefs, exercise, "equipment_requirements");
    addRefsFromField(equipmentRefs, exercise, "equipment_alternatives");

    if (equipmentIds.size > 0) {
      for (const ref of equipmentRefs) {
        if (!equipmentIds.has(ref.value)) {
          contractFail("unknown_equipment_reference", "exercise references an unknown equipment registry id", {
            exercise_id: exerciseId,
            field: ref.field,
            equipment_id: ref.value
          });
        }
      }
    }
  }

  for (const applicability of applicabilityRecords) {
    if (!isPlainObject(applicability)) {
      contractFail("applicability_record_not_object", "applicability registry record must be an object");
    }

    const applicabilityId = firstStringField(applicability, ["applicability_id", "id"]) ?? "unknown_applicability";

    if (hasOwn(applicability, "exercise_id") && exerciseIds.size > 0 && !exerciseIds.has(applicability.exercise_id)) {
      contractFail("unknown_exercise_reference", "applicability references an unknown exercise registry id", {
        applicability_id: applicabilityId,
        exercise_id: applicability.exercise_id
      });
    }

    if (hasOwn(applicability, "activity_id") && activityIds.size > 0 && !activityIds.has(applicability.activity_id)) {
      contractFail("unknown_activity_reference", "applicability references an unknown activity registry id", {
        applicability_id: applicabilityId,
        activity_id: applicability.activity_id
      });
    }
  }

  for (const compatibility of equipmentCompatibilityRecords) {
    if (!isPlainObject(compatibility)) {
      contractFail("equipment_compatibility_record_not_object", "equipment compatibility registry record must be an object");
    }

    const compatibilityId = firstStringField(compatibility, ["compatibility_id", "id"]) ?? "unknown_equipment_compatibility";

    if (hasOwn(compatibility, "exercise_id") && exerciseIds.size > 0 && !exerciseIds.has(compatibility.exercise_id)) {
      contractFail("unknown_exercise_reference", "equipment compatibility references an unknown exercise registry id", {
        compatibility_id: compatibilityId,
        exercise_id: compatibility.exercise_id
      });
    }

    const equipmentRefs = [];
    addRefsFromField(equipmentRefs, compatibility, "equipment_ids");
    addRefsFromField(equipmentRefs, compatibility, "equipment_requirements");
    addRefsFromField(equipmentRefs, compatibility, "equipment_alternatives");

    if (equipmentIds.size > 0) {
      for (const ref of equipmentRefs) {
        if (!equipmentIds.has(ref.value)) {
          contractFail("unknown_equipment_reference", "equipment compatibility references an unknown equipment registry id", {
            compatibility_id: compatibilityId,
            field: ref.field,
            equipment_id: ref.value
          });
        }
      }
    }
  }

  for (const substitution of substitutionRecords) {
    if (!isPlainObject(substitution)) {
      contractFail("substitution_record_not_object", "substitution registry record must be an object");
    }

    const substitutionId = firstStringField(substitution, ["substitution_edge_id"]) ?? "unknown_substitution_edge";

    for (const field of ["source_exercise_id", "target_exercise_id"]) {
      if (hasOwn(substitution, field) && exerciseIds.size > 0 && !exerciseIds.has(substitution[field])) {
        contractFail("unknown_exercise_reference", "substitution edge references an unknown exercise registry id", {
          substitution_edge_id: substitutionId,
          field,
          exercise_id: substitution[field]
        });
      }
    }
  }

  for (const template of programmeTemplateRecords) {
    if (!isPlainObject(template)) {
      contractFail("programme_template_record_not_object", "programme template registry record must be an object");
    }

    const templateId = firstStringField(template, ["template_id"]) ?? "unknown_programme_template";

    if (hasOwn(template, "activity_id") && activityIds.size > 0 && !activityIds.has(template.activity_id)) {
      contractFail("unknown_activity_reference", "programme template references an unknown activity registry id", {
        template_id: templateId,
        activity_id: template.activity_id
      });
    }

    const exerciseRefs = [];
    addRefsFromField(exerciseRefs, template, "exercise_id");
    addRefsFromField(exerciseRefs, template, "exercise_ids");
    addRefsFromField(exerciseRefs, template, "exercise_eligibility");

    if (exerciseIds.size > 0) {
      for (const ref of exerciseRefs) {
        if (!exerciseIds.has(ref.value)) {
          contractFail("unknown_exercise_reference", "programme template references an unknown exercise registry id", {
            template_id: templateId,
            field: ref.field,
            exercise_id: ref.value
          });
        }
      }
    }
  }
}

function validateRegistryLoadOrderAndFkClosure({ registry_index, registry_bundle }) {
  const order = validateLoadOrder(registry_index, registry_bundle);
  validateFkClosure(registry_bundle);

  return {
    ok: true,
    registry_count: order.length,
    registry_order: order
  };
}

function assertThrowsWithCode(fn, expectedCode, context) {
  try {
    fn();
  } catch (error) {
    if (error && error.code === expectedCode) {
      return error;
    }

    fail(`${context}: expected ${expectedCode}, got ${error && error.code ? error.code : "no_code"}`);
  }

  fail(`${context}: expected throw with ${expectedCode}`);
}

for (const file of requiredFiles) {
  readText(file);
}

const index = readJson("registries/registry_index.json");
const bundle = readJson("registries/registry_bundle.json");

const activeResult = validateRegistryLoadOrderAndFkClosure({
  registry_index: index,
  registry_bundle: bundle
});

if (!activeResult.ok) {
  fail("active registry validation failed");
}

const fixturePath = "ci/fixtures/v1_registry_load_order_fk_closure_negative/s_v1_24_unknown_movement_fk_negative.json";
const fixture = readJson(fixturePath);

if (fixture.slice_id !== "S-V1-24") {
  fail(`${fixturePath} slice_id must be S-V1-24`);
}

if (fixture.expected_failure_code !== "v1_registry_load_order_fk_closure_unknown_movement_reference") {
  fail(`${fixturePath} expected_failure_code mismatch`);
}

const error = assertThrowsWithCode(
  () => validateRegistryLoadOrderAndFkClosure({
    registry_index: fixture.registry_index,
    registry_bundle: fixture.registry_bundle
  }),
  fixture.expected_failure_code,
  "unknown movement FK negative fixture"
);

if (error.details?.exercise_id !== fixture.missing_case.exercise_id) {
  fail("negative fixture failed for wrong exercise_id");
}

if (error.details?.movement_pattern_id !== fixture.missing_case.movement_pattern_id) {
  fail("negative fixture failed for wrong movement_pattern_id");
}

const loaderText = readText("engine/src/registries/loadRegistries.ts");
const registryBundleGuardText = readText("ci/guards/registry_bundle_guard.mjs");
const registryLawGuardText = readText("ci/guards/registry_law_guard.mjs");
const docText = readText("docs/v1/V1_REGISTRY_LOAD_ORDER_FK_CLOSURE_CONTRACT.md");
const packageText = readText("package.json");
const guardsIndexText = readText("docs/GUARDS_INDEX.md");
const failureTokenText = readText("docs/dev/FAILURE_TOKEN_INDEX.md");

for (const requiredText of [
  "registry_order|index_order|registry_ids|order",
  "CI_REGISTRY_INDEX_INVALID",
  "loaded_registries"
]) {
  assertIncludes(loaderText, requiredText, "engine/src/registries/loadRegistries.ts");
}

for (const requiredText of [
  "registry_index.order",
  "does not match generated output",
  "generated bundle"
]) {
  assertIncludes(registryBundleGuardText, requiredText, "ci/guards/registry_bundle_guard.mjs");
}

for (const requiredText of [
  "registry_law_guard",
  "registry_index.json"
]) {
  assertIncludes(registryLawGuardText, requiredText, "ci/guards/registry_law_guard.mjs");
}

for (const requiredText of [
  "S-V1-24",
  "Load order is deterministic",
  "FK closure is enforced",
  "Missing/unknown references fail closed",
  "No active registry content is added by this slice",
  "registry_law_guard",
  "registry_bundle_guard",
  "negative FK fixture"
]) {
  assertIncludes(docText, requiredText, "docs/v1/V1_REGISTRY_LOAD_ORDER_FK_CLOSURE_CONTRACT.md");
}

assertIncludes(
  packageText,
  "node --test test/s_v1_24_registry_load_order_fk_closure.test.mjs",
  "package.json lint:fast"
);

assertIncludes(
  packageText,
  "node ci/guards/s_v1_24_registry_load_order_fk_closure_guard.mjs",
  "package.json lint:fast"
);

assertIncludes(
  guardsIndexText,
  "s_v1_24_registry_load_order_fk_closure_guard",
  "docs/GUARDS_INDEX.md"
);

assertIncludes(
  failureTokenText,
  TOKEN,
  "docs/dev/FAILURE_TOKEN_INDEX.md"
);

console.log(JSON.stringify({
  ok: true,
  guard: "S-V1-24",
  token: TOKEN,
  registry_count: activeResult.registry_count,
  message: "Registry load order and FK closure contract passed."
}));
