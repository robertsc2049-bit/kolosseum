import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = process.cwd();

const TOKEN_PREFIX = "v1_programme_template_contract_";

const lockedActivityIds = Object.freeze([
  "powerlifting",
  "general_strength",
  "rugby_union"
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

function fail(code, message, details = {}) {
  const error = new Error(`${TOKEN_PREFIX}${code}: ${message}`);
  error.code = `${TOKEN_PREFIX}${code}`;
  error.details = details;
  throw error;
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(Object(value), key);
}

function assertPlainObject(value, code, message, details = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(code, message, details);
  }
}

function assertExactKeys(value, requiredKeys, code, details = {}) {
  const keys = Object.keys(value).sort();
  const expected = [...requiredKeys].sort();

  if (JSON.stringify(keys) !== JSON.stringify(expected)) {
    fail(code, "object keys do not match the closed-world contract", {
      ...details,
      actual_keys: keys,
      expected_keys: expected
    });
  }
}

function assertNonEmptyString(value, code, details = {}) {
  if (typeof value !== "string" || value.length === 0) {
    fail(code, "expected non-empty string", details);
  }
}

function assertBoolean(value, code, details = {}) {
  if (typeof value !== "boolean") {
    fail(code, "expected boolean", details);
  }
}

function assertPositiveInteger(value, code, details = {}) {
  if (!Number.isInteger(value) || value <= 0) {
    fail(code, "expected positive integer", details);
  }
}

function assertSortedUniqueStringArray(value, code, details = {}) {
  if (!Array.isArray(value) || value.length === 0) {
    fail(code, "expected non-empty string array", details);
  }

  const seen = new Set();
  let previous = "";

  for (const item of value) {
    if (typeof item !== "string" || item.length === 0) {
      fail(code, "array must contain non-empty strings only", details);
    }

    if (seen.has(item)) {
      fail("duplicate_array_value", "array contains duplicate value", {
        ...details,
        value: item
      });
    }

    if (previous && item < previous) {
      fail("array_order_not_deterministic", "array must be sorted for deterministic template hashing", {
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
      fail("forbidden_template_field", "template contains a forbidden field", {
        path: [...pathParts, key].join("."),
        field: key
      });
    }

    assertNoForbiddenKeysDeep(value[key], [...pathParts, key]);
  }
}

function assertOrderIndexes(items, code, details = {}) {
  if (!Array.isArray(items) || items.length === 0) {
    fail(code, "expected non-empty ordered array", details);
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
      fail("duplicate_order_index", "order_index must be unique within the ordered collection", {
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
    fail("unknown_exercise_reference", "work item references an exercise_id outside registry_bindings.exercise_ids", {
      work_item_id: workItem.work_item_id,
      exercise_id: workItem.exercise_id
    });
  }

  for (const equipmentId of workItem.equipment_requirement_ids) {
    if (!registryBindings.equipment_ids.includes(equipmentId)) {
      fail("unknown_equipment_reference", "work item references equipment outside registry_bindings.equipment_ids", {
        work_item_id: workItem.work_item_id,
        equipment_id: equipmentId
      });
    }
  }

  if (!registryBindings.substitution_edge_ids.includes(workItem.substitution_policy_id)) {
    fail("unknown_substitution_reference", "work item references substitution policy outside registry_bindings.substitution_edge_ids", {
      work_item_id: workItem.work_item_id,
      substitution_policy_id: workItem.substitution_policy_id
    });
  }
}

function validateTemplateStructure(templateStructure, registryBindings) {
  assertPlainObject(templateStructure, "template_structure_not_object", "template_structure must be an object");

  if (!hasOwn(templateStructure, "blocks")) {
    fail("template_structure_blocks_missing", "template_structure.blocks is required");
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
    fail("contract_version_invalid", "template contract_version must be S-V1-26", {
      template_id: template.template_id
    });
  }

  if (!lockedActivityIds.includes(template.activity_id)) {
    fail("unsupported_activity_refused", "programme template activity_id must be in the locked v1 activity set", {
      template_id: template.template_id,
      activity_id: template.activity_id
    });
  }

  if (template.assignment_scope !== "coach_athlete_assigned_execution") {
    fail("assignment_scope_invalid", "programme templates in this contract must support assigned coach-athlete execution", {
      template_id: template.template_id,
      assignment_scope: template.assignment_scope
    });
  }

  if (template.source_control_status !== "approved") {
    fail("source_control_status_required", "programme templates require approved source-control status before active registry candidate use", {
      template_id: template.template_id
    });
  }

  assertPlainObject(template.registry_bindings, "registry_bindings_not_object", "registry_bindings must be an object");
  assertExactKeys(template.registry_bindings, requiredRegistryBindingKeys, "registry_bindings_keys_invalid", {
    template_id: template.template_id
  });

  if (template.registry_bindings.activity_id !== template.activity_id) {
    fail("registry_activity_mismatch", "registry_bindings.activity_id must match template.activity_id", {
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
    fail("formula_payload_refused", "formula payloads must not be visible in the programme template contract", {
      template_id: template.template_id
    });
  }

  if (template.visibility_boundary.progression_internals_status !== "not_present") {
    fail("progression_internals_refused", "progression internals must not be visible in the programme template contract", {
      template_id: template.template_id
    });
  }

  if (template.visibility_boundary.protected_logic_reference_status !== "opaque_reference_only") {
    fail("protected_logic_reference_invalid", "protected logic references must be opaque only", {
      template_id: template.template_id
    });
  }

  assertPlainObject(template.deterministic_boundary, "deterministic_boundary_not_object", "deterministic_boundary must be an object");
  assertExactKeys(template.deterministic_boundary, requiredDeterministicBoundaryKeys, "deterministic_boundary_keys_invalid", {
    template_id: template.template_id
  });

  assert.deepEqual(
    template.deterministic_boundary.template_hash_inputs,
    expectedTemplateHashInputs,
    `${TOKEN_PREFIX}template_hash_inputs_invalid`
  );

  if (template.deterministic_boundary.order_policy !== "explicit_order_index_only") {
    fail("order_policy_invalid", "template order policy must be explicit_order_index_only", {
      template_id: template.template_id
    });
  }

  if (template.deterministic_boundary.unknown_field_policy !== "fail_closed") {
    fail("unknown_field_policy_invalid", "unknown field policy must be fail_closed", {
      template_id: template.template_id
    });
  }

  if (template.deterministic_boundary.registry_reference_policy !== "declared_registry_ids_only") {
    fail("registry_reference_policy_invalid", "registry reference policy must be declared_registry_ids_only", {
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
    fail("coach_assignment_support_required", "template must support coach assignment", {
      template_id: template.template_id
    });
  }

  if (template.execution_surface.athlete_can_execute_assigned !== true) {
    fail("athlete_assigned_execution_required", "template must support athlete execution after assignment", {
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
      fail("execution_surface_boundary_invalid", "execution surface must remain read/assignment bounded", {
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
      fail("copy_boundary_flag_missing", "required copy boundary flag missing", {
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

function makeValidTemplate() {
  return {
    template_id: "fixture_valid_programme_template",
    template_version: "1.0.0",
    contract_version: "S-V1-26",
    template_status: "active_registry_candidate",
    activity_id: "powerlifting",
    assignment_scope: "coach_athlete_assigned_execution",
    source_record_id: "source_fixture_valid_template",
    source_control_status: "approved",
    template_structure: {
      blocks: [
        {
          block_id: "block_001",
          order_index: 1,
          weeks: [
            {
              week_id: "week_001",
              order_index: 1,
              days: [
                {
                  day_id: "day_001",
                  order_index: 1,
                  sessions: [
                    {
                      session_id: "session_001",
                      order_index: 1,
                      work_items: [
                        {
                          work_item_id: "work_001",
                          order_index: 1,
                          exercise_id: "competition_back_squat",
                          planned_sets: 3,
                          planned_reps: 5,
                          loading_reference: "declared_percentage_reference",
                          equipment_requirement_ids: [
                            "barbell"
                          ],
                          substitution_policy_id: "substitution_edge_registry"
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    },
    registry_bindings: {
      activity_id: "powerlifting",
      exercise_ids: [
        "competition_back_squat"
      ],
      equipment_ids: [
        "barbell"
      ],
      substitution_edge_ids: [
        "substitution_edge_registry"
      ],
      applicability_ids: [
        "powerlifting_competition_back_squat"
      ]
    },
    visibility_boundary: {
      formula_payload_status: "not_present",
      progression_internals_status: "not_present",
      protected_logic_reference_status: "opaque_reference_only"
    },
    deterministic_boundary: {
      template_hash_inputs: [
        "template_id",
        "template_version",
        "activity_id",
        "assignment_scope",
        "registry_bindings",
        "template_structure"
      ],
      order_policy: "explicit_order_index_only",
      unknown_field_policy: "fail_closed",
      registry_reference_policy: "declared_registry_ids_only"
    },
    execution_surface: {
      coach_can_assign: true,
      athlete_can_execute_assigned: true,
      coach_can_edit_after_assignment: false,
      assignment_mutates_template: false,
      template_mutates_relationship: false,
      template_mutates_engine: false
    },
    copy_boundary_flags: [
      "formula_payload_not_visible",
      "no_marketplace_scope",
      "no_royalty_scope",
      "registry_bound"
    ]
  };
}

test("S-V1-26 locks programme template contract fields and deterministic boundaries", () => {
  assert.deepEqual(lockedActivityIds, [
    "powerlifting",
    "general_strength",
    "rugby_union"
  ]);

  assert.ok(requiredTemplateKeys.includes("template_structure"));
  assert.ok(requiredTemplateKeys.includes("registry_bindings"));
  assert.ok(requiredTemplateKeys.includes("visibility_boundary"));
  assert.ok(requiredTemplateKeys.includes("deterministic_boundary"));
  assert.ok(requiredTemplateKeys.includes("execution_surface"));
  assert.ok(requiredRegistryBindingKeys.includes("exercise_ids"));
  assert.ok(requiredRegistryBindingKeys.includes("equipment_ids"));
});

test("S-V1-26 accepts a registry-bound assigned coach-athlete execution template candidate", () => {
  const result = validateProgrammeTemplateContract(makeValidTemplate());

  assert.equal(result.ok, true);
  assert.equal(result.template_id, "fixture_valid_programme_template");
  assert.equal(result.activity_id, "powerlifting");
});

test("S-V1-26 negative fixture rejects visible formula and progression internals", () => {
  const fixturePath = path.join(
    repoRoot,
    "ci",
    "fixtures",
    "v1_programme_template_contract_negative",
    "s_v1_26_invalid_template_negative.json"
  );

  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));

  assert.equal(fixture.slice_id, "S-V1-26");
  assert.equal(fixture.expected_failure_code, "v1_programme_template_contract_formula_payload_refused");

  assert.throws(
    () => validateProgrammeTemplateContract(fixture.template),
    (error) =>
      error?.code === fixture.expected_failure_code &&
      error?.details?.template_id === fixture.template.template_id
  );
});

test("S-V1-26 rejects unsupported activity and non-assigned execution scope", () => {
  const unsupported = makeValidTemplate();
  unsupported.activity_id = "strongman";
  unsupported.registry_bindings.activity_id = "strongman";

  assert.throws(
    () => validateProgrammeTemplateContract(unsupported),
    (error) => error?.code === "v1_programme_template_contract_unsupported_activity_refused"
  );

  const wrongScope = makeValidTemplate();
  wrongScope.assignment_scope = "marketplace_download";

  assert.throws(
    () => validateProgrammeTemplateContract(wrongScope),
    (error) => error?.code === "v1_programme_template_contract_assignment_scope_invalid"
  );
});

test("S-V1-26 rejects unknown fields, unsorted registry ids, and unknown registry references", () => {
  const unknownField = makeValidTemplate();
  unknownField.marketplace_listing_id = "listing_001";

  assert.throws(
    () => validateProgrammeTemplateContract(unknownField),
    (error) => error?.code === "v1_programme_template_contract_template_keys_invalid"
  );

  const unsorted = makeValidTemplate();
  unsorted.registry_bindings.exercise_ids = [
    "z_exercise",
    "a_exercise"
  ];

  assert.throws(
    () => validateProgrammeTemplateContract(unsorted),
    (error) => error?.code === "v1_programme_template_contract_array_order_not_deterministic"
  );

  const unknownExercise = makeValidTemplate();
  unknownExercise.template_structure.blocks[0].weeks[0].days[0].sessions[0].work_items[0].exercise_id = "not_declared";

  assert.throws(
    () => validateProgrammeTemplateContract(unknownExercise),
    (error) => error?.code === "v1_programme_template_contract_unknown_exercise_reference"
  );
});

test("S-V1-26 documentation binds the template contract without adding active content", () => {
  const doc = fs.readFileSync(
    path.join(repoRoot, "docs", "v1", "V1_PROGRAMME_TEMPLATE_CONTRACT.md"),
    "utf8"
  );

  assert.match(doc, /S-V1-26/);
  assert.match(doc, /programme template contract/);
  assert.match(doc, /coach_athlete_assigned_execution/);
  assert.match(doc, /registry-bound/);
  assert.match(doc, /formula and progression internals remain protected/);
  assert.match(doc, /No active programme template rows are added by this slice/);
  assert.match(doc, /marketplace and royalties remain out of scope/);
});
