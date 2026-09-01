import assert from "node:assert/strict";
import test from "node:test";
import { auditRegFull07Documents, loadRegFull07Documents } from "../ci/registry/reg_full_07_programme_template_production.mjs";

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function fresh() { return clone(loadRegFull07Documents(process.cwd())); }
function expectFailure(mutator, code) {
  const docs = fresh();
  mutator(docs);
  const result = auditRegFull07Documents(docs, process.cwd());
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.code === code), `expected ${code}; got ${JSON.stringify(result.errors.slice(0, 8))}`);
}
function firstWorkItem(docs, templateId = "powerlifting_novice") {
  const template = docs.canonicalProgram.entries.find((row) => row.template_id === templateId);
  return template.template_structure.blocks[0].weeks[0].days[0].sessions[0].work_items[0];
}
function rebuildBindings(docs, template) {
  const usedExercises = new Set();
  const usedEquipment = new Set();
  const usedEdges = new Set();
  const usedApplicability = new Set();
  const compatibilityRows = Object.values(docs.equipmentCompatibility.entries);

  for (const block of template.template_structure.blocks) {
    for (const week of block.weeks) {
      for (const day of week.days) {
        for (const session of day.sessions) {
          for (const item of session.work_items) {
            usedExercises.add(item.exercise_id);
            usedEdges.add(item.substitution_policy_id);
            usedApplicability.add(`${item.exercise_id}__${template.activity_id}__training`);
            for (const row of compatibilityRows) {
              if (row.exercise_id === item.exercise_id && row.compatibility_type === "required") {
                usedEquipment.add(row.equipment_id);
              }
            }
          }
        }
      }
    }
  }

  template.registry_bindings = {
    activity_id: template.activity_id,
    exercise_ids: [...usedExercises].sort((a, b) => a.localeCompare(b)),
    equipment_ids: [...usedEquipment].sort((a, b) => a.localeCompare(b)),
    substitution_edge_ids: [...usedEdges].sort((a, b) => a.localeCompare(b)),
    applicability_ids: [...usedApplicability].sort((a, b) => a.localeCompare(b))
  };
}

test("REG-FULL-07 canonical programme inventory passes complete registry-backed closure", () => {
  const result = auditRegFull07Documents(loadRegFull07Documents(process.cwd()), process.cwd());
  assert.equal(result.ok, true, JSON.stringify(result.errors, null, 2));
  assert.deepEqual(result.summary, {
    template_count: 14,
    powerlifting_templates: 4,
    general_strength_templates: 3,
    rugby_union_templates: 4,
    strongman_templates: 3,
    low_equipment_templates: 3
  });
});

test("REG-FULL-07 refuses a missing required programme family", () => {
  expectFailure((docs) => { docs.canonicalProgram.entries.pop(); }, "FAMILY_INVENTORY");
});

test("REG-FULL-07 refuses unsupported activity drift", () => {
  expectFailure((docs) => { docs.canonicalProgram.entries[0].activity_id = "football"; }, "FAMILY_ACTIVITY_COUNTS");
});

test("REG-FULL-07 refuses exercise references outside finished template-eligible exercise law", () => {
  expectFailure((docs) => {
    const item = firstWorkItem(docs);
    docs.exercise.entries[item.exercise_id].template_eligibility = "not_eligible";
  }, "EXERCISE_TEMPLATE_ELIGIBILITY");
});

test("REG-FULL-07 refuses missing or ineligible training applicability", () => {
  expectFailure((docs) => {
    const item = firstWorkItem(docs);
    const id = `${item.exercise_id}__powerlifting__training`;
    docs.applicability.entries[id].template_applicability = "not_eligible";
  }, "APPLICABILITY_CLOSURE");
});

test("REG-FULL-07 refuses inferred alternative or extra equipment", () => {
  expectFailure((docs) => { firstWorkItem(docs).equipment_requirement_ids.push("resistance_band"); }, "REQUIRED_EQUIPMENT_PARITY");
});

test("REG-FULL-07 refuses missing explicit substitution edges", () => {
  expectFailure((docs) => {
    const item = firstWorkItem(docs);
    delete docs.substitution.entries[item.substitution_policy_id];
  }, "SUBSTITUTION_CLOSURE");
});

test("REG-FULL-07 refuses substitution edges whose source is not the scheduled exercise", () => {
  expectFailure((docs) => {
    const item = firstWorkItem(docs);
    docs.substitution.entries[item.substitution_policy_id].source_exercise_id = "bench_press";
  }, "SUBSTITUTION_CLOSURE");
});

test("REG-FULL-07 refuses substitution edges outside the template activity", () => {
  expectFailure((docs) => {
    const item = firstWorkItem(docs);
    docs.substitution.entries[item.substitution_policy_id].activity_applicability = ["general_strength"];
  }, "SUBSTITUTION_CLOSURE");
});

test("REG-FULL-07 refuses registry binding drift", () => {
  expectFailure((docs) => { docs.canonicalProgram.entries[0].registry_bindings.exercise_ids.push("push_up"); }, "BINDING_CLOSURE");
});

test("REG-FULL-07 refuses non-deterministic structural ordering", () => {
  expectFailure((docs) => { docs.canonicalProgram.entries[0].template_structure.blocks[0].weeks[0].order_index = 2; }, "WEEK_ORDER");
});

test("REG-FULL-07 refuses formula and recommendation authority leakage", () => {
  expectFailure((docs) => { docs.canonicalProgram.entries[0].progression_formula_payload = "increase weekly"; }, "FORBIDDEN_TEMPLATE_FIELD");
});

test("REG-FULL-07 enforces the explicit low-equipment ceiling", () => {
  expectFailure((docs) => {
    const template = docs.canonicalProgram.entries.find((row) => row.template_id === "general_strength_low_equipment");
    const item = firstWorkItem(docs, "general_strength_low_equipment");
    item.exercise_id = "back_squat";
    item.equipment_requirement_ids = ["barbell", "rack"];
    item.substitution_policy_id = "back_squat__to__goblet_squat";
    rebuildBindings(docs, template);
  }, "LOW_EQUIPMENT_BOUNDARY");
});

test("REG-FULL-07 refuses mutation of the three-row compact compatibility projection", () => {
  expectFailure((docs) => { docs.legacyProgram.entries[0].exercise_eligibility.push("front_squat"); }, "LEGACY_PROGRAM_PROJECTION_MUTATED");
});

test("REG-FULL-07 refuses reactivation or remapping of the retained legacy warm-up authority", () => {
  expectFailure((docs) => {
    const row = docs.surfaceManifest.entities.find((entry) => entry.entity_id === "exercise_warmup_mapping_registry");
    row.final_state.authoritative = true;
  }, "LEGACY_WARMUP_ARCHITECTURE");
});