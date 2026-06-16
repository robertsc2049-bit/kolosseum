import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = process.cwd();

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
    fail(code, "expected an explicit array", context);
  }

  const seen = new Set();

  for (const item of value) {
    if (typeof item !== "string" || item.length === 0) {
      fail(code, "expected non-empty string array entries", context);
    }

    if (seen.has(item)) {
      fail("duplicate_registry_order_entry", "registry order contains a duplicate entry", {
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
    fail("load_order_dependency_violation", "registry load order violates declared dependency order", {
      upstream,
      downstream,
      order
    });
  }
}

function validateLoadOrder(index, bundle) {
  if (!isPlainObject(index)) {
    fail("registry_index_invalid", "registry_index must be an object");
  }

  const order = requireStringArray(index.order, "registry_order_invalid", {
    field: "registry_index.order"
  });

  if (!isPlainObject(bundle)) {
    fail("registry_bundle_invalid", "registry_bundle must be an object");
  }

  if (!isPlainObject(bundle.registries)) {
    fail("registry_bundle_registries_invalid", "registry_bundle.registries must be an object");
  }

  if (typeof index.version !== "string" || index.version.length === 0) {
    fail("registry_index_version_invalid", "registry_index.version must be a non-empty string");
  }

  if (typeof bundle.version !== "string" || bundle.version.length === 0) {
    fail("registry_bundle_version_invalid", "registry_bundle.version must be a non-empty string");
  }

  if (bundle.version !== index.version) {
    fail("registry_bundle_version_mismatch", "registry bundle version must match registry index version", {
      index_version: index.version,
      bundle_version: bundle.version
    });
  }

  const bundleKeys = Object.keys(bundle.registries);

  assert.deepEqual(
    bundleKeys,
    order,
    "bundle registry key order must match registry_index.order exactly"
  );

  for (const name of order) {
    if (!hasOwn(bundle.registries, name)) {
      fail("registry_bundle_missing_ordered_registry", "registry bundle missing ordered registry", {
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
      fail("registry_reference_invalid", "registry reference fields must contain non-empty strings", {
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
      fail("exercise_record_not_object", "exercise registry record must be an object");
    }

    const exerciseId = firstStringField(exercise, ["exercise_id", "id"]) ?? "unknown_exercise";

    for (const movementField of ["movement_pattern_id", "movement_id", "movement_family_id"]) {
      if (hasOwn(exercise, movementField)) {
        const movementId = exercise[movementField];

        if (typeof movementId !== "string" || movementId.length === 0) {
          fail("movement_reference_invalid", "exercise movement reference must be a non-empty string", {
            exercise_id: exerciseId,
            field: movementField
          });
        }

        if (movementIds.size > 0 && !movementIds.has(movementId)) {
          fail("unknown_movement_reference", "exercise references an unknown movement registry id", {
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
        fail("unknown_activity_reference", "exercise references an unknown activity registry id", {
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
          fail("unknown_equipment_reference", "exercise references an unknown equipment registry id", {
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
      fail("applicability_record_not_object", "applicability registry record must be an object");
    }

    const applicabilityId = firstStringField(applicability, ["applicability_id", "id"]) ?? "unknown_applicability";

    if (hasOwn(applicability, "exercise_id") && exerciseIds.size > 0 && !exerciseIds.has(applicability.exercise_id)) {
      fail("unknown_exercise_reference", "applicability references an unknown exercise registry id", {
        applicability_id: applicabilityId,
        exercise_id: applicability.exercise_id
      });
    }

    if (hasOwn(applicability, "activity_id") && activityIds.size > 0 && !activityIds.has(applicability.activity_id)) {
      fail("unknown_activity_reference", "applicability references an unknown activity registry id", {
        applicability_id: applicabilityId,
        activity_id: applicability.activity_id
      });
    }
  }

  for (const compatibility of equipmentCompatibilityRecords) {
    if (!isPlainObject(compatibility)) {
      fail("equipment_compatibility_record_not_object", "equipment compatibility registry record must be an object");
    }

    const compatibilityId = firstStringField(compatibility, ["compatibility_id", "id"]) ?? "unknown_equipment_compatibility";

    if (hasOwn(compatibility, "exercise_id") && exerciseIds.size > 0 && !exerciseIds.has(compatibility.exercise_id)) {
      fail("unknown_exercise_reference", "equipment compatibility references an unknown exercise registry id", {
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
          fail("unknown_equipment_reference", "equipment compatibility references an unknown equipment registry id", {
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
      fail("substitution_record_not_object", "substitution registry record must be an object");
    }

    const substitutionId = firstStringField(substitution, ["substitution_edge_id", "id"]) ?? "unknown_substitution_edge";

    for (const field of ["source_exercise_id", "target_exercise_id"]) {
      if (hasOwn(substitution, field) && exerciseIds.size > 0 && !exerciseIds.has(substitution[field])) {
        fail("unknown_exercise_reference", "substitution edge references an unknown exercise registry id", {
          substitution_edge_id: substitutionId,
          field,
          exercise_id: substitution[field]
        });
      }
    }
  }

  for (const template of programmeTemplateRecords) {
    if (!isPlainObject(template)) {
      fail("programme_template_record_not_object", "programme template registry record must be an object");
    }

    const templateId = firstStringField(template, ["template_id", "program_id", "id"]) ?? "unknown_programme_template";

    if (hasOwn(template, "activity_id") && activityIds.size > 0 && !activityIds.has(template.activity_id)) {
      fail("unknown_activity_reference", "programme template references an unknown activity registry id", {
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
          fail("unknown_exercise_reference", "programme template references an unknown exercise registry id", {
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

function makePositiveBundle() {
  return {
    registry_index: {
      version: "fixture-s-v1-24",
      order: [
        "activity",
        "movement",
        "exercise",
        "program"
      ]
    },
    registry_bundle: {
      version: "fixture-s-v1-24",
      note: "fixture bundle only",
      registries: {
        activity: {
          entries: [
            {
              activity_id: "powerlifting"
            }
          ]
        },
        movement: {
          entries: [
            {
              movement_pattern_id: "squat"
            }
          ]
        },
        exercise: {
          entries: [
            {
              exercise_id: "fixture_back_squat",
              movement_pattern_id: "squat",
              primary_activity_applicability: "powerlifting",
              secondary_activity_applicability: []
            }
          ]
        },
        program: {
          entries: [
            {
              program_id: "fixture_powerlifting_program",
              activity_id: "powerlifting",
              exercise_ids: [
                "fixture_back_squat"
              ]
            }
          ]
        }
      }
    }
  };
}

test("S-V1-24 validates deterministic registry load order and FK closure", () => {
  const result = validateRegistryLoadOrderAndFkClosure(makePositiveBundle());

  assert.equal(result.ok, true);
  assert.deepEqual(result.registry_order, [
    "activity",
    "movement",
    "exercise",
    "program"
  ]);
});

test("S-V1-24 refuses registry bundle key order drift from registry_index.order", () => {
  const fixture = makePositiveBundle();

  fixture.registry_bundle.registries = {
    movement: fixture.registry_bundle.registries.movement,
    activity: fixture.registry_bundle.registries.activity,
    exercise: fixture.registry_bundle.registries.exercise,
    program: fixture.registry_bundle.registries.program
  };

  assert.throws(
    () => validateRegistryLoadOrderAndFkClosure(fixture),
    /bundle registry key order must match registry_index.order exactly/
  );
});

test("S-V1-24 refuses dependency order violations", () => {
  const fixture = makePositiveBundle();

  fixture.registry_index.order = [
    "exercise",
    "movement",
    "activity",
    "program"
  ];

  fixture.registry_bundle.registries = {
    exercise: fixture.registry_bundle.registries.exercise,
    movement: fixture.registry_bundle.registries.movement,
    activity: fixture.registry_bundle.registries.activity,
    program: fixture.registry_bundle.registries.program
  };

  assert.throws(
    () => validateRegistryLoadOrderAndFkClosure(fixture),
    (error) => error?.code === "v1_registry_load_order_fk_closure_load_order_dependency_violation"
  );
});

test("S-V1-24 negative fixture fails closed for unknown movement FK", () => {
  const fixturePath = path.join(
    repoRoot,
    "ci",
    "fixtures",
    "v1_registry_load_order_fk_closure_negative",
    "s_v1_24_unknown_movement_fk_negative.json"
  );

  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));

  assert.equal(fixture.slice_id, "S-V1-24");
  assert.equal(fixture.expected_failure_code, "v1_registry_load_order_fk_closure_unknown_movement_reference");

  assert.throws(
    () => validateRegistryLoadOrderAndFkClosure({
      registry_index: fixture.registry_index,
      registry_bundle: fixture.registry_bundle
    }),
    (error) =>
      error?.code === fixture.expected_failure_code &&
      error?.details?.exercise_id === fixture.missing_case.exercise_id &&
      error?.details?.movement_pattern_id === fixture.missing_case.movement_pattern_id
  );
});

test("S-V1-24 validates current active registry bundle through the hardened closure contract", () => {
  const index = JSON.parse(fs.readFileSync(path.join(repoRoot, "registries", "registry_index.json"), "utf8"));
  const bundle = JSON.parse(fs.readFileSync(path.join(repoRoot, "registries", "registry_bundle.json"), "utf8"));

  const result = validateRegistryLoadOrderAndFkClosure({
    registry_index: index,
    registry_bundle: bundle
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.registry_order, index.order);
});

test("S-V1-24 documentation binds load order and FK closure without adding registry content", () => {
  const doc = fs.readFileSync(
    path.join(repoRoot, "docs", "v1", "V1_REGISTRY_LOAD_ORDER_FK_CLOSURE_CONTRACT.md"),
    "utf8"
  );

  assert.match(doc, /S-V1-24/);
  assert.match(doc, /Load order is deterministic/);
  assert.match(doc, /FK closure is enforced/);
  assert.match(doc, /Missing\/unknown references fail closed/);
  assert.match(doc, /No active registry content is added by this slice/);
  assert.match(doc, /registry_law_guard/);
  assert.match(doc, /registry_bundle_guard/);
});
