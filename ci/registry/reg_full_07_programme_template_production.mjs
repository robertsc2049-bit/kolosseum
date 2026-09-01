import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  REG_FULL_07_FAILURE_TOKEN,
  REG_FULL_07_PATHS,
  REG_FULL_07_FAMILY_IDS,
  REG_FULL_07_LOW_EQUIPMENT_IDS,
  REG_FULL_07_LOW_EQUIPMENT_ALLOWED,
  buildRegFull07Registry,
  buildRegFull07Evidence,
  loadRegFull07SourceDocuments
} from "../../scripts/reg_full_07_materialize_programme_templates.mjs";

const EXPECTED_FAMILY_IDS = Object.freeze([
  "powerlifting_novice",
  "powerlifting_intermediate",
  "powerlifting_maintenance",
  "powerlifting_meet_prep",
  "general_strength_novice",
  "general_strength_intermediate",
  "general_strength_low_equipment",
  "rugby_union_off_season",
  "rugby_union_pre_season",
  "rugby_union_in_season",
  "rugby_union_low_equipment",
  "strongman_novice",
  "strongman_intermediate",
  "strongman_low_equipment"
]);

const EXPECTED_LEGACY_PROGRAM = Object.freeze({
  registry_id: "program",
  version: "1.2.0",
  entries: [
    { activity_id: "powerlifting", template_id: "PROGRAM_POWERLIFTING_V1", exercise_eligibility: ["bench_press", "back_squat", "deadlift", "overhead_press", "incline_bench_press", "push_up"] },
    { activity_id: "rugby_union", template_id: "PROGRAM_RUGBY_UNION_V1", exercise_eligibility: ["back_squat", "bench_press", "deadlift", "overhead_press", "incline_bench_press", "push_up"] },
    { activity_id: "general_strength", template_id: "PROGRAM_GENERAL_STRENGTH_V1", exercise_eligibility: ["deadlift", "bench_press", "back_squat", "overhead_press", "incline_bench_press", "push_up"] },
    { activity_id: "strongman", template_id: "PROGRAM_STRONGMAN_V1", exercise_eligibility: ["back_squat", "bench_press", "deadlift", "farmers_carry"] }
  ]
});

const EXPECTED_HASH_INPUTS = Object.freeze(["template_id", "template_version", "activity_id", "assignment_scope", "registry_bindings", "template_structure"]);
const EXPECTED_COPY_FLAGS = Object.freeze(["formula_payload_not_visible", "no_marketplace_scope", "no_royalty_scope", "registry_bound"]);
const LOADING_REFERENCE_ALLOWLIST = new Set(["bodyweight", "coach_declared_implement_load", "coach_declared_load"]);
const FORBIDDEN_KEYS = new Set([
  "marketplace_listing_id", "royalty_rate", "royalty_recipient", "protected_formula_payload", "progression_formula_payload",
  "coach_brand_attribution", "recommendation_score", "optimisation_score", "readiness_score", "risk_score", "safety_score",
  "effectiveness_score", "formula", "progression_formula", "closest_exercise", "fallback_exercise_id"
]);

function isObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function entries(doc) { return isObject(doc?.entries) ? doc.entries : {}; }
function readJson(abs) { return JSON.parse(fs.readFileSync(abs, "utf8")); }
function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function sortedUnique(values) { return Array.isArray(values) && values.length > 0 && same(values, [...new Set(values)].sort((a, b) => a.localeCompare(b))); }
function push(errors, code, detail) { errors.push({ code, detail }); }
function walkKeys(value, errors, pathParts = []) {
  if (Array.isArray(value)) { value.forEach((item, index) => walkKeys(item, errors, [...pathParts, String(index)])); return; }
  if (!isObject(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key)) push(errors, "FORBIDDEN_TEMPLATE_FIELD", [...pathParts, key].join("."));
    walkKeys(child, errors, [...pathParts, key]);
  }
}
function exactSequence(items, errors, code, context) {
  if (!Array.isArray(items) || items.length === 0) { push(errors, code, { ...context, reason: "empty" }); return; }
  for (let index = 0; index < items.length; index += 1) {
    if (items[index]?.order_index !== index + 1) push(errors, code, { ...context, index, order_index: items[index]?.order_index });
  }
}
function requiredEquipmentMap(doc) {
  const out = new Map();
  for (const row of Object.values(entries(doc))) {
    if (!isObject(row) || row.compatibility_type !== "required") continue;
    if (!out.has(row.exercise_id)) out.set(row.exercise_id, []);
    out.get(row.exercise_id).push(row.equipment_id);
  }
  for (const [key, values] of out) out.set(key, [...new Set(values)].sort((a, b) => a.localeCompare(b)));
  return out;
}

export function loadRegFull07Documents(repoRoot = process.cwd()) {
  const docs = loadRegFull07SourceDocuments(repoRoot);
  docs.canonicalProgram = readJson(path.join(repoRoot, REG_FULL_07_PATHS.canonicalProgram));
  docs.evidence = readJson(path.join(repoRoot, REG_FULL_07_PATHS.evidence));
  docs.registryIndex = readJson(path.join(repoRoot, "registries/registry_index.json"));
  docs.registryBundle = readJson(path.join(repoRoot, "registries/registry_bundle.json"));
  return docs;
}

function auditArchitecture(docs, errors) {
  const entities = Array.isArray(docs.surfaceManifest?.entities) ? docs.surfaceManifest.entities : [];
  const canonical = entities.find((row) => row?.entity_id === "sport_program_template_registry_5f");
  const warmup = entities.find((row) => row?.entity_id === "exercise_warmup_mapping_registry");

  if (!canonical || canonical.classification !== "required_active" || canonical.final_state?.authoritative !== true || canonical.final_state?.final_runtime_load !== true || canonical.final_state?.final_load_position !== 23 || canonical.final_state?.new_content_allowed !== true) {
    push(errors, "PROGRAMME_TEMPLATE_ARCHITECTURE", canonical ?? null);
  }
  if (!warmup || warmup.classification !== "retained_legacy" || warmup.final_state?.authoritative !== false || warmup.final_state?.final_runtime_load !== false || warmup.final_state?.new_content_allowed !== false || warmup.successor_registry_id !== "sport_program_template_registry_5f" || warmup.migration_action !== "migrate/retire" || warmup.target_slice !== "REG-FULL-07") {
    push(errors, "LEGACY_WARMUP_ARCHITECTURE", warmup ?? null);
  }

  const schemaRows = Array.isArray(docs.schemaManifest?.registries) ? docs.schemaManifest.registries : [];
  const schema = schemaRows.find((row) => row?.canonical_registry_id === "sport_program_template_registry_5f");
  if (!schema || schema.load_position !== 23 || schema.primary_key_field !== "template_id" || schema.row_contract_status !== "closed" || schema.legacy_runtime_projection?.registry_id !== "program" || schema.legacy_runtime_projection?.authority !== "compatibility_only") {
    push(errors, "PROGRAMME_TEMPLATE_SCHEMA_AUTHORITY", schema ?? null);
  }

  if (!same(docs.legacyProgram, EXPECTED_LEGACY_PROGRAM)) push(errors, "LEGACY_PROGRAM_PROJECTION_MUTATED", docs.legacyProgram);
  if (!Array.isArray(docs.registryIndex?.order) || docs.registryIndex.order[3] !== "program" || docs.registryIndex.order.includes("sport_program_template_registry_5f")) {
    push(errors, "COMPACT_REGISTRY_INDEX_DRIFT", docs.registryIndex?.order ?? null);
  }
  if (!same(docs.registryBundle?.registries?.program, docs.legacyProgram)) push(errors, "COMPACT_PROGRAM_BUNDLE_DRIFT", null);
}

export function auditRegFull07Documents(docs, repoRoot = process.cwd()) {
  const errors = [];
  auditArchitecture(docs, errors);

  if (!same(REG_FULL_07_FAMILY_IDS, EXPECTED_FAMILY_IDS)) push(errors, "FAMILY_CONTRACT_DRIFT", REG_FULL_07_FAMILY_IDS);
  if (docs.canonicalProgram?.registry_id !== "sport_program_template_registry_5f" || docs.canonicalProgram?.version !== "1.0.0" || !Array.isArray(docs.canonicalProgram?.entries)) {
    push(errors, "CANONICAL_PROGRAMME_HEADER", { registry_id: docs.canonicalProgram?.registry_id, version: docs.canonicalProgram?.version });
  }

  const templates = Array.isArray(docs.canonicalProgram?.entries) ? docs.canonicalProgram.entries : [];
  const familyIds = templates.map((row) => row?.template_id);
  if (!same(familyIds, EXPECTED_FAMILY_IDS)) push(errors, "FAMILY_INVENTORY", familyIds);

  const activityCounts = { powerlifting: 0, general_strength: 0, rugby_union: 0, strongman: 0 };
  for (const template of templates) if (Object.hasOwn(activityCounts, template?.activity_id)) activityCounts[template.activity_id] += 1;
  if (!same(activityCounts, { powerlifting: 4, general_strength: 3, rugby_union: 4, strongman: 3 })) push(errors, "FAMILY_ACTIVITY_COUNTS", activityCounts);

  const exerciseRows = entries(docs.exercise);
  const equipmentRows = entries(docs.equipment);
  const compatibilityRows = entries(docs.equipmentCompatibility);
  const applicabilityRows = entries(docs.applicability);
  const substitutionRows = entries(docs.substitution);
  const requiredEquipment = requiredEquipmentMap(docs.equipmentCompatibility);
  const globalIds = new Set();

  for (const template of templates) {
    if (!isObject(template)) { push(errors, "TEMPLATE_ROW", template); continue; }
    const templateId = template.template_id;
    if (template.contract_version !== "S-V1-26" || template.template_status !== "active" || template.assignment_scope !== "coach_athlete_assigned_execution" || template.source_control_status !== "approved") push(errors, "TEMPLATE_BOUNDARY", templateId);
    if (template.registry_bindings?.activity_id !== template.activity_id) push(errors, "BINDING_ACTIVITY", templateId);
    for (const field of ["exercise_ids", "equipment_ids", "substitution_edge_ids", "applicability_ids"]) {
      if (!sortedUnique(template.registry_bindings?.[field])) push(errors, "BINDING_ORDER", { template_id: templateId, field });
    }
    if (!same(template.visibility_boundary, { formula_payload_status: "not_present", progression_internals_status: "not_present", protected_logic_reference_status: "opaque_reference_only" })) push(errors, "VISIBILITY_BOUNDARY", templateId);
    if (!same(template.deterministic_boundary, { template_hash_inputs: [...EXPECTED_HASH_INPUTS], order_policy: "explicit_order_index_only", unknown_field_policy: "fail_closed", registry_reference_policy: "declared_registry_ids_only" })) push(errors, "DETERMINISTIC_BOUNDARY", templateId);
    if (!same(template.execution_surface, { coach_can_assign: true, athlete_can_execute_assigned: true, coach_can_edit_after_assignment: false, assignment_mutates_template: false, template_mutates_relationship: false, template_mutates_engine: false })) push(errors, "EXECUTION_BOUNDARY", templateId);
    if (!same(template.copy_boundary_flags, [...EXPECTED_COPY_FLAGS])) push(errors, "COPY_BOUNDARY", templateId);
    walkKeys(template, errors, [templateId]);

    const usedExercises = new Set();
    const usedEquipment = new Set();
    const usedEdges = new Set();
    const usedApplicability = new Set();
    const blocks = template.template_structure?.blocks;
    exactSequence(blocks, errors, "BLOCK_ORDER", { template_id: templateId });

    for (const block of Array.isArray(blocks) ? blocks : []) {
      if (globalIds.has(block.block_id)) push(errors, "DUPLICATE_STRUCTURAL_ID", block.block_id); else globalIds.add(block.block_id);
      exactSequence(block.weeks, errors, "WEEK_ORDER", { template_id: templateId, block_id: block.block_id });
      for (const week of Array.isArray(block.weeks) ? block.weeks : []) {
        if (globalIds.has(week.week_id)) push(errors, "DUPLICATE_STRUCTURAL_ID", week.week_id); else globalIds.add(week.week_id);
        exactSequence(week.days, errors, "DAY_ORDER", { template_id: templateId, week_id: week.week_id });
        for (const day of Array.isArray(week.days) ? week.days : []) {
          if (globalIds.has(day.day_id)) push(errors, "DUPLICATE_STRUCTURAL_ID", day.day_id); else globalIds.add(day.day_id);
          exactSequence(day.sessions, errors, "SESSION_ORDER", { template_id: templateId, day_id: day.day_id });
          for (const session of Array.isArray(day.sessions) ? day.sessions : []) {
            if (globalIds.has(session.session_id)) push(errors, "DUPLICATE_STRUCTURAL_ID", session.session_id); else globalIds.add(session.session_id);
            exactSequence(session.work_items, errors, "WORK_ITEM_ORDER", { template_id: templateId, session_id: session.session_id });
            for (const item of Array.isArray(session.work_items) ? session.work_items : []) {
              if (globalIds.has(item.work_item_id)) push(errors, "DUPLICATE_STRUCTURAL_ID", item.work_item_id); else globalIds.add(item.work_item_id);
              if (!Number.isInteger(item.planned_sets) || item.planned_sets < 1 || !Number.isInteger(item.planned_reps) || item.planned_reps < 1) push(errors, "PRESCRIPTION_SHAPE", item.work_item_id);
              if (!LOADING_REFERENCE_ALLOWLIST.has(item.loading_reference)) push(errors, "LOADING_REFERENCE", { work_item_id: item.work_item_id, loading_reference: item.loading_reference });

              const exercise = exerciseRows[item.exercise_id];
              if (!isObject(exercise) || exercise.template_eligibility !== "eligible") push(errors, "EXERCISE_TEMPLATE_ELIGIBILITY", { template_id: templateId, exercise_id: item.exercise_id });
              usedExercises.add(item.exercise_id);

              const expectedEquipment = requiredEquipment.get(item.exercise_id) ?? [];
              if (!same(item.equipment_requirement_ids, expectedEquipment)) push(errors, "REQUIRED_EQUIPMENT_PARITY", { work_item_id: item.work_item_id, actual: item.equipment_requirement_ids, expected: expectedEquipment });
              for (const equipmentId of expectedEquipment) {
                if (!isObject(equipmentRows[equipmentId])) push(errors, "EQUIPMENT_FK", { work_item_id: item.work_item_id, equipment_id: equipmentId });
                const compatibility = compatibilityRows[`${item.exercise_id}__${equipmentId}`];
                if (!isObject(compatibility) || compatibility.compatibility_type !== "required") push(errors, "EQUIPMENT_COMPATIBILITY", { work_item_id: item.work_item_id, equipment_id: equipmentId });
                usedEquipment.add(equipmentId);
              }

              const applicabilityId = `${item.exercise_id}__${template.activity_id}__training`;
              const applicability = applicabilityRows[applicabilityId];
              if (!isObject(applicability) || applicability.exercise_id !== item.exercise_id || applicability.activity_id !== template.activity_id || applicability.activity_context !== "training" || applicability.applicability_state !== "allowed" || applicability.template_applicability !== "eligible") push(errors, "APPLICABILITY_CLOSURE", { work_item_id: item.work_item_id, applicability_id: applicabilityId });
              usedApplicability.add(applicabilityId);

              const edge = substitutionRows[item.substitution_policy_id];
              if (!isObject(edge) || edge.source_exercise_id !== item.exercise_id || !Array.isArray(edge.activity_applicability) || !edge.activity_applicability.includes(template.activity_id) || !isObject(exerciseRows[edge?.target_exercise_id])) push(errors, "SUBSTITUTION_CLOSURE", { work_item_id: item.work_item_id, substitution_edge_id: item.substitution_policy_id });
              usedEdges.add(item.substitution_policy_id);
            }
          }
        }
      }
    }

    const expectedBindings = {
      exercise_ids: [...usedExercises].sort((a, b) => a.localeCompare(b)),
      equipment_ids: [...usedEquipment].sort((a, b) => a.localeCompare(b)),
      substitution_edge_ids: [...usedEdges].sort((a, b) => a.localeCompare(b)),
      applicability_ids: [...usedApplicability].sort((a, b) => a.localeCompare(b))
    };
    for (const [field, expected] of Object.entries(expectedBindings)) if (!same(template.registry_bindings?.[field], expected)) push(errors, "BINDING_CLOSURE", { template_id: templateId, field, actual: template.registry_bindings?.[field], expected });

    if (REG_FULL_07_LOW_EQUIPMENT_IDS.includes(templateId)) {
      for (const equipmentId of expectedBindings.equipment_ids) if (!REG_FULL_07_LOW_EQUIPMENT_ALLOWED.includes(equipmentId)) push(errors, "LOW_EQUIPMENT_BOUNDARY", { template_id: templateId, equipment_id: equipmentId });
    }
  }

  let expectedRegistry = null;
  try { expectedRegistry = buildRegFull07Registry(docs); }
  catch (error) { push(errors, "MATERIALIZER_RECOMPUTE", error?.message ?? String(error)); }
  if (expectedRegistry && !same(docs.canonicalProgram, expectedRegistry)) push(errors, "MATERIALIZER_PARITY", null);

  if (expectedRegistry) {
    try {
      const expectedEvidence = buildRegFull07Evidence(repoRoot, expectedRegistry);
      if (!same(docs.evidence, expectedEvidence)) push(errors, "EVIDENCE_PARITY", null);
    } catch (error) { push(errors, "EVIDENCE_RECOMPUTE", error?.message ?? String(error)); }
  }

  return {
    ok: errors.length === 0,
    errors,
    summary: {
      template_count: templates.length,
      powerlifting_templates: activityCounts.powerlifting,
      general_strength_templates: activityCounts.general_strength,
      rugby_union_templates: activityCounts.rugby_union,
      strongman_templates: activityCounts.strongman,
      low_equipment_templates: REG_FULL_07_LOW_EQUIPMENT_IDS.length
    }
  };
}

function main() {
  let docs;
  try { docs = loadRegFull07Documents(process.cwd()); }
  catch (error) {
    console.error(`${REG_FULL_07_FAILURE_TOKEN}: FAIL load ${error?.message ?? String(error)}`);
    process.exit(1);
  }
  const result = auditRegFull07Documents(docs, process.cwd());
  if (!result.ok) {
    console.error(`${REG_FULL_07_FAILURE_TOKEN}: FAIL`);
    for (const error of result.errors) console.error(JSON.stringify(error));
    process.exit(1);
  }
  console.log(`${REG_FULL_07_FAILURE_TOKEN}: PASS templates=${result.summary.template_count} powerlifting=${result.summary.powerlifting_templates} general_strength=${result.summary.general_strength_templates} rugby_union=${result.summary.rugby_union_templates} strongman=${result.summary.strongman_templates} low_equipment=${result.summary.low_equipment_templates}`);
}

const invoked = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invoked === fileURLToPath(import.meta.url)) main();
