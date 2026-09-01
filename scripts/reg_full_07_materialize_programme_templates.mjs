import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

export const REG_FULL_07_FAILURE_TOKEN = "CI_REG_FULL_07_PROGRAMME_TEMPLATE_PRODUCTION";

export const REG_FULL_07_PATHS = Object.freeze({
  activity: "registries/activity/activity.registry.json",
  exercise: "registries/exercise/exercise.registry.json",
  equipment: "registries/equipment/equipment.registry.json",
  equipmentCompatibility: "registries/exercise_equipment_compatibility/exercise_equipment_compatibility.registry.json",
  applicability: "registries/exercise_activity_applicability/exercise_activity_applicability.registry.json",
  substitution: "registries/substitution/substitution.registry.json",
  legacyProgram: "registries/program/program.registry.json",
  legacyWarmup: "registries/exercise/exercise_warmup_mapping.registry.json",
  surfaceManifest: "registries/final_registry_surface_manifest.json",
  schemaManifest: "registries/final_registry_schema_manifest.json",
  canonicalProgram: "registries/program/sport_program_template.registry.json",
  evidence: "ci/evidence/reg_full_07_programme_template_production.v1.json"
});

const work = (exercise_id, planned_sets, planned_reps) => Object.freeze({ exercise_id, planned_sets, planned_reps });

export const REG_FULL_07_FAMILY_SPECS = Object.freeze([
  Object.freeze({ template_id: "powerlifting_novice", activity_id: "powerlifting", weeks: 4, low_equipment: false, days: Object.freeze([
    Object.freeze([work("back_squat", 3, 5), work("bench_press", 3, 5), work("deadlift", 2, 5)]),
    Object.freeze([work("bench_press", 3, 5), work("back_squat", 3, 5)]),
    Object.freeze([work("deadlift", 3, 3), work("bench_press", 3, 5), work("back_squat", 2, 5)])
  ]) }),
  Object.freeze({ template_id: "powerlifting_intermediate", activity_id: "powerlifting", weeks: 4, low_equipment: false, days: Object.freeze([
    Object.freeze([work("back_squat", 4, 5), work("paused_bench_press", 4, 5)]),
    Object.freeze([work("deadlift", 4, 4), work("bench_press", 4, 5)]),
    Object.freeze([work("paused_back_squat", 4, 4), work("bench_press", 5, 4)]),
    Object.freeze([work("paused_deadlift", 3, 4), work("paused_bench_press", 4, 4)])
  ]) }),
  Object.freeze({ template_id: "powerlifting_maintenance", activity_id: "powerlifting", weeks: 4, low_equipment: false, days: Object.freeze([
    Object.freeze([work("back_squat", 3, 4), work("bench_press", 3, 4), work("deadlift", 2, 3)]),
    Object.freeze([work("back_squat", 2, 4), work("bench_press", 3, 4)])
  ]) }),
  Object.freeze({ template_id: "powerlifting_meet_prep", activity_id: "powerlifting", weeks: 6, low_equipment: false, days: Object.freeze([
    Object.freeze([work("back_squat", 4, 3), work("paused_bench_press", 4, 3)]),
    Object.freeze([work("deadlift", 3, 3), work("bench_press", 4, 3)]),
    Object.freeze([work("paused_back_squat", 3, 2), work("bench_press", 5, 2)]),
    Object.freeze([work("paused_deadlift", 3, 2), work("paused_bench_press", 3, 2)])
  ]) }),
  Object.freeze({ template_id: "general_strength_novice", activity_id: "general_strength", weeks: 4, low_equipment: false, days: Object.freeze([
    Object.freeze([work("back_squat", 3, 8), work("dumbbell_bench_press", 3, 8), work("single_arm_dumbbell_row", 3, 10)]),
    Object.freeze([work("romanian_deadlift", 3, 8), work("dumbbell_overhead_press", 3, 8), work("single_arm_dumbbell_row", 3, 10)]),
    Object.freeze([work("back_squat", 3, 8), work("dumbbell_bench_press", 3, 8), work("romanian_deadlift", 3, 8)])
  ]) }),
  Object.freeze({ template_id: "general_strength_intermediate", activity_id: "general_strength", weeks: 4, low_equipment: false, days: Object.freeze([
    Object.freeze([work("back_squat", 4, 6), work("dumbbell_bench_press", 4, 8), work("single_arm_dumbbell_row", 4, 10)]),
    Object.freeze([work("romanian_deadlift", 4, 6), work("dumbbell_overhead_press", 4, 8), work("single_arm_dumbbell_row", 4, 10)]),
    Object.freeze([work("back_squat", 4, 6), work("dumbbell_bench_press", 4, 8), work("romanian_deadlift", 3, 8)]),
    Object.freeze([work("dumbbell_overhead_press", 3, 8), work("single_arm_dumbbell_row", 4, 10), work("dumbbell_bench_press", 3, 10)])
  ]) }),
  Object.freeze({ template_id: "general_strength_low_equipment", activity_id: "general_strength", weeks: 4, low_equipment: true, days: Object.freeze([
    Object.freeze([work("kettlebell_deadlift", 3, 8), work("dumbbell_bench_press", 3, 10), work("single_arm_dumbbell_row", 3, 10)]),
    Object.freeze([work("bulgarian_split_squat", 3, 8), work("dumbbell_overhead_press", 3, 10), work("single_arm_dumbbell_row", 3, 10)]),
    Object.freeze([work("kettlebell_deadlift", 3, 10), work("dumbbell_bench_press", 3, 10), work("bulgarian_split_squat", 3, 8)])
  ]) }),
  Object.freeze({ template_id: "rugby_union_off_season", activity_id: "rugby_union", weeks: 4, low_equipment: false, days: Object.freeze([
    Object.freeze([work("box_jump", 3, 5), work("back_squat", 4, 6), work("dumbbell_bench_press", 4, 8), work("single_arm_dumbbell_row", 4, 10)]),
    Object.freeze([work("backward_overhead_medicine_ball_throw", 4, 5), work("romanian_deadlift", 4, 6), work("dumbbell_overhead_press", 3, 8)]),
    Object.freeze([work("box_jump", 3, 5), work("back_squat", 3, 6), work("dumbbell_bench_press", 3, 8), work("single_arm_dumbbell_row", 3, 10)])
  ]) }),
  Object.freeze({ template_id: "rugby_union_pre_season", activity_id: "rugby_union", weeks: 4, low_equipment: false, days: Object.freeze([
    Object.freeze([work("box_jump", 4, 4), work("backward_overhead_medicine_ball_throw", 4, 4), work("back_squat", 3, 5)]),
    Object.freeze([work("romanian_deadlift", 3, 5), work("dumbbell_bench_press", 3, 6), work("single_arm_dumbbell_row", 3, 8)]),
    Object.freeze([work("box_jump", 3, 4), work("backward_overhead_medicine_ball_throw", 3, 4), work("dumbbell_overhead_press", 3, 6)])
  ]) }),
  Object.freeze({ template_id: "rugby_union_in_season", activity_id: "rugby_union", weeks: 4, low_equipment: false, days: Object.freeze([
    Object.freeze([work("box_jump", 3, 3), work("back_squat", 2, 4), work("dumbbell_bench_press", 2, 6), work("single_arm_dumbbell_row", 2, 8)]),
    Object.freeze([work("backward_overhead_medicine_ball_throw", 3, 3), work("romanian_deadlift", 2, 5), work("dumbbell_overhead_press", 2, 6)])
  ]) }),
  Object.freeze({ template_id: "rugby_union_low_equipment", activity_id: "rugby_union", weeks: 4, low_equipment: true, days: Object.freeze([
    Object.freeze([work("box_jump", 3, 4), work("kettlebell_deadlift", 3, 8), work("dumbbell_bench_press", 3, 8), work("single_arm_dumbbell_row", 3, 10)]),
    Object.freeze([work("bulgarian_split_squat", 3, 8), work("dumbbell_overhead_press", 3, 8), work("single_arm_dumbbell_row", 3, 10)])
  ]) }),
  Object.freeze({ template_id: "strongman_novice", activity_id: "strongman", weeks: 4, low_equipment: false, days: Object.freeze([
    Object.freeze([work("back_squat", 3, 5), work("bench_press", 3, 5), work("farmers_carry", 3, 1)]),
    Object.freeze([work("deadlift", 3, 5), work("farmers_carry", 3, 1)]),
    Object.freeze([work("back_squat", 3, 5), work("bench_press", 3, 5), work("deadlift", 2, 3)])
  ]) }),
  Object.freeze({ template_id: "strongman_intermediate", activity_id: "strongman", weeks: 4, low_equipment: false, days: Object.freeze([
    Object.freeze([work("back_squat", 4, 5), work("bench_press", 4, 5), work("farmers_carry", 4, 1)]),
    Object.freeze([work("deadlift", 4, 4), work("bench_press", 3, 6)]),
    Object.freeze([work("back_squat", 3, 6), work("farmers_carry", 3, 1)]),
    Object.freeze([work("deadlift", 3, 3), work("bench_press", 4, 4), work("farmers_carry", 3, 1)])
  ]) }),
  Object.freeze({ template_id: "strongman_low_equipment", activity_id: "strongman", weeks: 4, low_equipment: true, days: Object.freeze([
    Object.freeze([work("kettlebell_deadlift", 3, 8), work("dumbbell_bench_press", 3, 8), work("kettlebell_farmers_carry", 3, 1)]),
    Object.freeze([work("dumbbell_bench_press", 3, 10), work("kettlebell_farmers_carry", 3, 1)]),
    Object.freeze([work("kettlebell_deadlift", 3, 10), work("dumbbell_bench_press", 3, 8), work("kettlebell_farmers_carry", 3, 1)])
  ]) })
]);

export const REG_FULL_07_FAMILY_IDS = Object.freeze(REG_FULL_07_FAMILY_SPECS.map((row) => row.template_id));
export const REG_FULL_07_LOW_EQUIPMENT_IDS = Object.freeze(REG_FULL_07_FAMILY_SPECS.filter((row) => row.low_equipment).map((row) => row.template_id));
export const REG_FULL_07_LOW_EQUIPMENT_ALLOWED = Object.freeze([
  "bench", "bodyweight", "box", "dumbbell", "kettlebell", "medicine_ball", "open_floor_space", "plate", "pull_up_bar", "resistance_band"
]);

export const REG_FULL_07_EDGE_BY_EXERCISE = Object.freeze({
  back_squat: "back_squat__to__goblet_squat",
  paused_back_squat: "paused_back_squat__to__goblet_squat",
  bench_press: "bench_press__to__dumbbell_bench_press",
  paused_bench_press: "paused_bench_press__to__dumbbell_bench_press",
  deadlift: "deadlift__to__romanian_deadlift",
  paused_deadlift: "paused_deadlift__to__romanian_deadlift",
  romanian_deadlift: "romanian_deadlift__to__kettlebell_deadlift",
  dumbbell_bench_press: "dumbbell_bench_press__to__push_up",
  dumbbell_overhead_press: "dumbbell_overhead_press__to__pike_push_up",
  single_arm_dumbbell_row: "single_arm_dumbbell_row__to__band_row",
  kettlebell_deadlift: "kettlebell_deadlift__to__single_leg_rdl",
  bulgarian_split_squat: "bulgarian_split_squat__to__forward_lunge",
  box_jump: "box_jump__to__countermovement_jump",
  backward_overhead_medicine_ball_throw: "backward_overhead_medicine_ball_throw__to__medicine_ball_chest_pass",
  farmers_carry: "farmers_carry__to__kettlebell_farmers_carry",
  kettlebell_farmers_carry: "kettlebell_farmers_carry__to__farmers_carry"
});

const COPY_FLAGS = Object.freeze(["formula_payload_not_visible", "no_marketplace_scope", "no_royalty_scope", "registry_bound"]);
const HASH_INPUTS = Object.freeze(["template_id", "template_version", "activity_id", "assignment_scope", "registry_bindings", "template_structure"]);

function isObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function entries(doc) { return isObject(doc?.entries) ? doc.entries : {}; }
function readJson(abs) { return JSON.parse(fs.readFileSync(abs, "utf8")); }
function stableText(value) { return JSON.stringify(value, null, 2) + "\n"; }
function pad(value) { return String(value).padStart(2, "0"); }
function uniqSorted(values) { return [...new Set(values)].sort((a, b) => a.localeCompare(b)); }
function sha256File(abs) { return crypto.createHash("sha256").update(fs.readFileSync(abs)).digest("hex"); }
function assert(condition, message) { if (!condition) throw new Error(`REG_FULL_07_MATERIALIZE: ${message}`); }

function loadingReference(exerciseId) {
  if (exerciseId === "box_jump" || exerciseId === "bulgarian_split_squat") return "bodyweight";
  if (exerciseId === "backward_overhead_medicine_ball_throw") return "coach_declared_implement_load";
  return "coach_declared_load";
}

function requiredEquipmentMap(doc) {
  const out = new Map();
  for (const row of Object.values(entries(doc))) {
    if (!isObject(row) || row.compatibility_type !== "required") continue;
    if (!out.has(row.exercise_id)) out.set(row.exercise_id, []);
    out.get(row.exercise_id).push(row.equipment_id);
  }
  for (const [exerciseId, values] of out) out.set(exerciseId, uniqSorted(values));
  return out;
}

function trainingApplicabilityMap(doc) {
  const out = new Map();
  for (const row of Object.values(entries(doc))) {
    if (!isObject(row) || row.activity_context !== "training") continue;
    out.set(`${row.exercise_id}__${row.activity_id}`, row);
  }
  return out;
}

export function loadRegFull07SourceDocuments(repoRoot = process.cwd()) {
  return {
    activity: readJson(path.join(repoRoot, REG_FULL_07_PATHS.activity)),
    exercise: readJson(path.join(repoRoot, REG_FULL_07_PATHS.exercise)),
    equipment: readJson(path.join(repoRoot, REG_FULL_07_PATHS.equipment)),
    equipmentCompatibility: readJson(path.join(repoRoot, REG_FULL_07_PATHS.equipmentCompatibility)),
    applicability: readJson(path.join(repoRoot, REG_FULL_07_PATHS.applicability)),
    substitution: readJson(path.join(repoRoot, REG_FULL_07_PATHS.substitution)),
    legacyProgram: readJson(path.join(repoRoot, REG_FULL_07_PATHS.legacyProgram)),
    legacyWarmup: readJson(path.join(repoRoot, REG_FULL_07_PATHS.legacyWarmup)),
    surfaceManifest: readJson(path.join(repoRoot, REG_FULL_07_PATHS.surfaceManifest)),
    schemaManifest: readJson(path.join(repoRoot, REG_FULL_07_PATHS.schemaManifest))
  };
}

export function buildRegFull07Registry(docs) {
  const exerciseRows = entries(docs.exercise);
  const equipmentRows = entries(docs.equipment);
  const substitutionRows = entries(docs.substitution);
  const requiredEquipment = requiredEquipmentMap(docs.equipmentCompatibility);
  const trainingRows = trainingApplicabilityMap(docs.applicability);

  assert(docs.exercise?.registry_id === "exercise", "exercise registry header invalid");
  assert(docs.equipmentCompatibility?.registry_id === "exercise_equipment_compatibility_registry", "equipment compatibility header invalid");
  assert(docs.applicability?.registry_id === "exercise_activity_applicability", "applicability header invalid");
  assert(docs.substitution?.registry_id === "substitution_registry", "substitution header invalid");

  const templates = REG_FULL_07_FAMILY_SPECS.map((spec) => {
    const usedExercises = [];
    const usedEquipment = [];
    const usedEdges = [];
    const usedApplicability = [];

    const weeks = [];
    for (let weekIndex = 1; weekIndex <= spec.weeks; weekIndex += 1) {
      const days = spec.days.map((dayItems, dayOffset) => {
        const dayIndex = dayOffset + 1;
        const workItems = dayItems.map((item, itemOffset) => {
          const exercise = exerciseRows[item.exercise_id];
          assert(isObject(exercise), `${spec.template_id}: unknown exercise ${item.exercise_id}`);
          assert(exercise.template_eligibility === "eligible", `${spec.template_id}: exercise ${item.exercise_id} is not template eligible`);

          const equipmentIds = requiredEquipment.get(item.exercise_id);
          assert(Array.isArray(equipmentIds) && equipmentIds.length > 0, `${spec.template_id}: required equipment missing for ${item.exercise_id}`);
          for (const equipmentId of equipmentIds) assert(isObject(equipmentRows[equipmentId]), `${spec.template_id}: unknown equipment ${equipmentId}`);

          const applicabilityId = `${item.exercise_id}__${spec.activity_id}__training`;
          const applicability = trainingRows.get(`${item.exercise_id}__${spec.activity_id}`);
          assert(isObject(applicability), `${spec.template_id}: missing training applicability ${applicabilityId}`);
          assert(applicability.applicability_id === applicabilityId, `${spec.template_id}: applicability id mismatch ${applicabilityId}`);
          assert(applicability.applicability_state === "allowed" && applicability.template_applicability === "eligible", `${spec.template_id}: ineligible training applicability ${applicabilityId}`);

          const edgeId = REG_FULL_07_EDGE_BY_EXERCISE[item.exercise_id];
          const edge = substitutionRows[edgeId];
          assert(isObject(edge), `${spec.template_id}: missing substitution edge for ${item.exercise_id}`);
          assert(edge.source_exercise_id === item.exercise_id, `${spec.template_id}: substitution source mismatch ${edgeId}`);
          assert(Array.isArray(edge.activity_applicability) && edge.activity_applicability.includes(spec.activity_id), `${spec.template_id}: substitution activity mismatch ${edgeId}`);
          assert(isObject(exerciseRows[edge.target_exercise_id]), `${spec.template_id}: substitution target missing ${edgeId}`);

          usedExercises.push(item.exercise_id);
          usedEquipment.push(...equipmentIds);
          usedEdges.push(edgeId);
          usedApplicability.push(applicabilityId);

          const workItemIndex = itemOffset + 1;
          return {
            work_item_id: `${spec.template_id}_w${pad(weekIndex)}_d${pad(dayIndex)}_i${pad(workItemIndex)}`,
            order_index: workItemIndex,
            exercise_id: item.exercise_id,
            planned_sets: item.planned_sets,
            planned_reps: item.planned_reps,
            loading_reference: loadingReference(item.exercise_id),
            equipment_requirement_ids: [...equipmentIds],
            substitution_policy_id: edgeId
          };
        });

        return {
          day_id: `${spec.template_id}_w${pad(weekIndex)}_d${pad(dayIndex)}`,
          order_index: dayIndex,
          sessions: [{
            session_id: `${spec.template_id}_w${pad(weekIndex)}_d${pad(dayIndex)}_s01`,
            order_index: 1,
            work_items: workItems
          }]
        };
      });

      weeks.push({
        week_id: `${spec.template_id}_w${pad(weekIndex)}`,
        order_index: weekIndex,
        days
      });
    }

    const registryBindings = {
      activity_id: spec.activity_id,
      exercise_ids: uniqSorted(usedExercises),
      equipment_ids: uniqSorted(usedEquipment),
      substitution_edge_ids: uniqSorted(usedEdges),
      applicability_ids: uniqSorted(usedApplicability)
    };

    if (spec.low_equipment) {
      for (const equipmentId of registryBindings.equipment_ids) {
        assert(REG_FULL_07_LOW_EQUIPMENT_ALLOWED.includes(equipmentId), `${spec.template_id}: low-equipment boundary exceeded by ${equipmentId}`);
      }
    }

    return {
      template_id: spec.template_id,
      template_version: "1.0.0",
      contract_version: "S-V1-26",
      template_status: "active",
      activity_id: spec.activity_id,
      assignment_scope: "coach_athlete_assigned_execution",
      source_record_id: `reg_full_07_${spec.template_id}`,
      source_control_status: "approved",
      template_structure: {
        blocks: [{
          block_id: `${spec.template_id}_main`,
          order_index: 1,
          weeks
        }]
      },
      registry_bindings: registryBindings,
      visibility_boundary: {
        formula_payload_status: "not_present",
        progression_internals_status: "not_present",
        protected_logic_reference_status: "opaque_reference_only"
      },
      deterministic_boundary: {
        template_hash_inputs: [...HASH_INPUTS],
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
      copy_boundary_flags: [...COPY_FLAGS]
    };
  });

  return {
    registry_id: "sport_program_template_registry_5f",
    version: "1.0.0",
    entries: templates
  };
}

function sourceHashes(repoRoot) {
  const sourceNames = ["activity", "exercise", "equipment", "equipmentCompatibility", "applicability", "substitution", "legacyProgram", "legacyWarmup", "surfaceManifest", "schemaManifest"];
  const out = {};
  for (const name of sourceNames) out[name] = { path: REG_FULL_07_PATHS[name], sha256: sha256File(path.join(repoRoot, REG_FULL_07_PATHS[name])) };
  return out;
}

export function buildRegFull07Evidence(repoRoot, registry) {
  let workItemCount = 0;
  const exerciseIds = new Set();
  for (const template of registry.entries) {
    for (const block of template.template_structure.blocks) {
      for (const week of block.weeks) {
        for (const day of week.days) {
          for (const session of day.sessions) {
            workItemCount += session.work_items.length;
            for (const item of session.work_items) exerciseIds.add(item.exercise_id);
          }
        }
      }
    }
  }

  return {
    evidence_id: "reg_full_07_programme_template_production",
    evidence_version: "1.0.0",
    slice_id: "REG-FULL-07",
    status: "closed",
    canonical_registry_path: REG_FULL_07_PATHS.canonicalProgram,
    canonical_registry_sha256: crypto.createHash("sha256").update(stableText(registry), "utf8").digest("hex"),
    source_authorities: sourceHashes(repoRoot),
    counts: {
      template_count: registry.entries.length,
      powerlifting_templates: registry.entries.filter((row) => row.activity_id === "powerlifting").length,
      general_strength_templates: registry.entries.filter((row) => row.activity_id === "general_strength").length,
      rugby_union_templates: registry.entries.filter((row) => row.activity_id === "rugby_union").length,
      strongman_templates: registry.entries.filter((row) => row.activity_id === "strongman").length,
      low_equipment_templates: registry.entries.filter((row) => REG_FULL_07_LOW_EQUIPMENT_IDS.includes(row.template_id)).length,
      unique_scheduled_exercises: exerciseIds.size,
      scheduled_work_items: workItemCount
    },
    family_ids: [...REG_FULL_07_FAMILY_IDS],
    policy: {
      finished_exercises_only: true,
      explicit_training_applicability_only: true,
      explicit_required_equipment_only: true,
      explicit_substitution_edges_only: true,
      runtime_inference_forbidden: true,
      formula_payload_forbidden: true,
      progression_internals_forbidden: true,
      low_equipment_boundary_explicit: true,
      legacy_program_projection_mutated: false,
      legacy_warmup_authority_reactivated: false,
      compact_registry_index_mutated: false,
      compact_registry_bundle_mutated: false
    }
  };
}

function main() {
  const repoRoot = process.cwd();
  const args = process.argv.slice(2);
  const write = args.includes("--write");
  const writeEvidence = args.includes("--write-evidence");
  const check = args.includes("--check");
  const docs = loadRegFull07SourceDocuments(repoRoot);
  const registry = buildRegFull07Registry(docs);
  const registryText = stableText(registry);
  const registryAbs = path.join(repoRoot, REG_FULL_07_PATHS.canonicalProgram);

  if (write) {
    fs.mkdirSync(path.dirname(registryAbs), { recursive: true });
    fs.writeFileSync(registryAbs, registryText, "utf8");
    console.log(`REG-FULL-07 wrote ${REG_FULL_07_PATHS.canonicalProgram}`);
  }

  if (check) {
    assert(fs.existsSync(registryAbs), `missing ${REG_FULL_07_PATHS.canonicalProgram}`);
    assert(fs.readFileSync(registryAbs, "utf8").replace(/\r\n/g, "\n") === registryText, "canonical programme registry is stale or non-deterministic");
    console.log(`REG-FULL-07 materializer check PASS templates=${registry.entries.length}`);
  }

  if (writeEvidence) {
    assert(fs.existsSync(registryAbs), "canonical programme registry must be written before evidence");
    const evidence = buildRegFull07Evidence(repoRoot, registry);
    const evidenceAbs = path.join(repoRoot, REG_FULL_07_PATHS.evidence);
    fs.mkdirSync(path.dirname(evidenceAbs), { recursive: true });
    fs.writeFileSync(evidenceAbs, stableText(evidence), "utf8");
    console.log(`REG-FULL-07 wrote ${REG_FULL_07_PATHS.evidence}`);
  }

  if (!write && !writeEvidence && !check) process.stdout.write(registryText);
}

const invoked = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invoked === fileURLToPath(import.meta.url)) main();
