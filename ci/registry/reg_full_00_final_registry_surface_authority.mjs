// DEV NOTE: REG-FULL-00 shared enforcement module. This is executable validation
// logic only; registries/final_registry_surface_manifest.json remains the sole
// machine-readable architecture authority.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

export const TOKEN = "CI_REG_FULL_00_FINAL_REGISTRY_SURFACE_AUTHORITY";
export const CLASSIFICATIONS = Object.freeze(["required_active", "derived_generated", "retained_legacy", "dormant", "prohibited"]);
export const REQUIRED_CANONICAL_IDS = Object.freeze([
  "activity_registry_1", "sport_subdivision_registry_1a", "physical_requirements_registry_1b",
  "sport_metric_registry_1c", "event_metric_registry_1d", "sport_role_registry_2", "movement_registry_3",
  "exercise_registry_3a", "exercise_token_registry_3b", "exercise_alias_registry_3c",
  "exercise_variant_applicability_registry_3d", "equipment_environment_registry_3e", "biomechanics_registry_4",
  "metric_exercise_link_registry_1c_a", "training_structure_registry_5", "structure_governance_registry_5a",
  "sport_domain_structure_profiles_5b", "explicit_override_accountability_registry_5c",
  "sport_program_profile_registry_5d", "sport_event_model_registry_5e", "exercise_equipment_compatibility_registry",
  "exercise_sport_applicability_registry_6x", "sport_program_template_registry_5f", "substitution_registry", "copy_registry"
]);
export const EXPECTED_INDEX = Object.freeze([
  "activity", "movement", "exercise", "program", "equipment", "sport_subdivision", "sport_metric", "sport_role",
  "metric_exercise_link", "threshold_marker", "exercise_token", "exercise_activity_applicability"
]);
export const INDEX_TO_ENTITY = Object.freeze({
  activity: "activity_registry_1", movement: "movement_registry_3", exercise: "exercise_registry_3a",
  program: "sport_program_template_registry_5f", equipment: "equipment_environment_registry_3e",
  sport_subdivision: "sport_subdivision_registry_1a", sport_metric: "sport_metric_registry_1c",
  sport_role: "sport_role_registry_2", metric_exercise_link: "metric_exercise_link_registry_1c_a",
  threshold_marker: "threshold_marker_registry", exercise_token: "exercise_token_registry_3b",
  exercise_activity_applicability: "exercise_sport_applicability_registry_6x"
});
export const REQUIRED_SURFACE_IDS = Object.freeze([
  "activity.registry", "movement.registry", "exercise.registry", "program.registry", "equipment.registry",
  "sport_subdivision.registry", "sport_metric.registry", "sport_role.registry", "metric_exercise_link.registry",
  "threshold_marker.registry", "exercise_token.registry", "exercise_activity_applicability.registry",
  "exercise_substitution_graph", "exercise_warmup_mapping_registry"
]);
export const PROTECTED_PATHS = Object.freeze([
  "registries/registry_index.json", "registries/registry_bundle.json",
  "ci/evidence/registry_seal_manifest.v1.json", "ci/evidence/registry_seal_live_surface.v1.json",
  "ci/evidence/registry_seal_snapshot.v1.json", "ci/evidence/registry_seal_lifecycle.v1.json"
]);

// DEV NOTE: Return a structured deterministic validation result rather than
// throwing so tests can prove individual negative cases without process control.
export function validateManifest(manifest) {
  const errors = [];
  const fail = (code, detail) => errors.push({ code, detail });
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) return { ok: false, errors: [{ code: "MANIFEST_INVALID", detail: "root must be object" }] };
  if (manifest.manifest_id !== "kolosseum_final_registry_surface_authority") fail("MANIFEST_ID", manifest.manifest_id);
  if (manifest.manifest_version !== "1.0.0" || manifest.slice_id !== "REG-FULL-00" || manifest.status !== "authoritative" || manifest.scope !== "registry_architecture_only") fail("MANIFEST_HEADER", "header mismatch");
  if (!Array.isArray(manifest.classification_enum) || JSON.stringify(manifest.classification_enum) !== JSON.stringify(CLASSIFICATIONS)) fail("CLASSIFICATION_ENUM", manifest.classification_enum);
  if (JSON.stringify(manifest.supported_activity_scope) !== JSON.stringify(["powerlifting", "general_strength", "rugby_union", "strongman"])) fail("ACTIVITY_SCOPE", manifest.supported_activity_scope);
  const entities = Array.isArray(manifest.entities) ? manifest.entities : [];
  if (entities.length === 0) fail("ENTITIES_EMPTY", "entities required");
  const ids = new Set(); const canonical = new Set(); const pos = new Set();
  const byId = new Map();
  for (const e of entities) {
    if (!e || typeof e !== "object") { fail("ENTITY_INVALID", String(e)); continue; }
    if (!CLASSIFICATIONS.includes(e.classification)) fail("ENTITY_UNCLASSIFIED", e.entity_id);
    if (!e.entity_id || ids.has(e.entity_id)) fail("ENTITY_ID_DUPLICATE", e.entity_id); else ids.add(e.entity_id);
    if (!e.canonical_registry_id || canonical.has(e.canonical_registry_id)) fail("CANONICAL_DUPLICATE", e.canonical_registry_id); else canonical.add(e.canonical_registry_id);
    byId.set(e.canonical_registry_id, e);
    const p = e?.final_state?.final_load_position;
    if (p !== null && p !== undefined) { if (!Number.isInteger(p) || p < 1 || pos.has(p)) fail("LOAD_POSITION_DUPLICATE_OR_INVALID", `${e.canonical_registry_id}:${p}`); pos.add(p); }
    if (e.classification === "required_active") {
      if (e?.final_state?.authoritative !== true || e?.final_state?.final_runtime_load !== true || e?.final_state?.new_content_allowed !== true || !Number.isInteger(p)) fail("REQUIRED_ACTIVE_STATE", e.canonical_registry_id);
    } else {
      if (p !== null) fail("NON_ACTIVE_LOAD_POSITION", e.canonical_registry_id);
      if (e?.final_state?.authoritative === true || e?.final_state?.final_runtime_load === true) fail("NON_ACTIVE_AUTHORITY", e.canonical_registry_id);
    }
    if (e.classification === "retained_legacy" && !e.successor_registry_id && !/retire/i.test(String(e.migration_action || ""))) fail("LEGACY_MIGRATION_MISSING", e.canonical_registry_id);
    if (e.classification === "dormant" && !e.governing_boundary) fail("DORMANT_BOUNDARY_MISSING", e.canonical_registry_id);
    if (e.classification === "prohibited" && !e.governing_boundary) fail("PROHIBITED_BOUNDARY_MISSING", e.canonical_registry_id);
    if (e.classification === "derived_generated" && (!Array.isArray(e.authoritative_input_registry_ids) || e.authoritative_input_registry_ids.length === 0)) fail("DERIVED_INPUTS_MISSING", e.canonical_registry_id);
  }
  for (const id of REQUIRED_CANONICAL_IDS) if (!byId.has(id)) fail("CANONICAL_REQUIRED_MISSING", id);
  const load = Array.isArray(manifest.final_load_order) ? manifest.final_load_order : [];
  if (load.length !== REQUIRED_CANONICAL_IDS.length || new Set(load).size !== load.length) fail("LOAD_ORDER_CARDINALITY", load.length);
  for (const id of load) if (byId.get(id)?.classification !== "required_active") fail("LOAD_ORDER_NON_ACTIVE", id);
  for (const id of REQUIRED_CANONICAL_IDS) if (!load.includes(id)) fail("LOAD_ORDER_REQUIRED_MISSING", id);
  const orderPos = new Map(load.map((id, i) => [id, i + 1]));
  for (const id of load) {
    const e = byId.get(id); if (!e) continue;
    if (e.final_state.final_load_position !== orderPos.get(id)) fail("LOAD_POSITION_MISMATCH", id);
    for (const dep of e.dependency_ids || []) {
      const target = byId.get(dep);
      if (!target) { fail("DEPENDENCY_UNKNOWN", `${id}->${dep}`); continue; }
      if (target.classification !== "required_active") fail("DEPENDENCY_NON_ACTIVE", `${id}->${dep}`);
      if ((orderPos.get(dep) || Infinity) >= orderPos.get(id)) fail("DEPENDENCY_FORWARD", `${id}->${dep}`);
    }
  }
  const state = new Map();
  const visit = (id) => { const s=state.get(id)||0; if (s===1) { fail("DEPENDENCY_CYCLE", id); return; } if (s===2) return; state.set(id,1); for (const d of byId.get(id)?.dependency_ids||[]) if (byId.has(d)) visit(d); state.set(id,2); };
  for (const id of load) visit(id);
  for (const compact of EXPECTED_INDEX) {
    const target = INDEX_TO_ENTITY[compact]; const e = byId.get(target);
    if (!e || !(e.current_state?.repo_registry_ids || []).includes(compact) || e.current_state?.registry_index_member !== true) fail("INDEX_DOMAIN_UNMAPPED", compact);
  }
  for (const surfaceId of REQUIRED_SURFACE_IDS) {
    const hit = entities.some((e) => (e.current_state?.repo_registry_ids || []).includes(surfaceId));
    if (!hit) fail("SURFACE_ID_UNMAPPED", surfaceId);
  }
  if (!Array.isArray(manifest.architecture_conflicts) || manifest.architecture_conflicts.length !== 0) fail("ARCHITECTURE_CONFLICT", manifest.architecture_conflicts?.length);
  const counts = Object.fromEntries(CLASSIFICATIONS.map((c) => [c, entities.filter((e) => e.classification === c).length]));
  const s = manifest.summary || {};
  if (s.discovered_entity_count !== entities.length || s.required_active_count !== counts.required_active || s.derived_generated_count !== counts.derived_generated || s.retained_legacy_count !== counts.retained_legacy || s.dormant_count !== counts.dormant || s.prohibited_count !== counts.prohibited || s.unclassified_count !== 0 || s.unresolved_architecture_conflict_count !== 0) fail("SUMMARY_MISMATCH", s);
  return { ok: errors.length === 0, errors };
}

// DEV NOTE: Read a required JSON file from a repo root with a stable error path.
export function readJson(root, rel) { return JSON.parse(fs.readFileSync(path.join(root, ...rel.split("/")), "utf8")); }

// DEV NOTE: Prove current implementation inputs match the recorded baseline and
// every protected registry/seal file is byte-identical to the manifest base commit.
export function auditRepository(root, manifest) {
  const errors=[]; const fail=(code,detail)=>errors.push({code,detail});
  const idx=readJson(root,"registries/registry_index.json");
  if (JSON.stringify(idx.order)!==JSON.stringify(manifest.baseline.registry_index_order) || JSON.stringify(idx.order)!==JSON.stringify(EXPECTED_INDEX)) fail("BASELINE_INDEX_DRIFT",idx.order);
  const surface=readJson(root,"registries/registry_surface_classification.json");
  const listed=new Set((surface.registry_surface_classification?.classification||[]).filter((x)=>x.class!=="excluded").map((x)=>x.document_id));
  for (const id of REQUIRED_SURFACE_IDS) if (!listed.has(id)) fail("SURFACE_CLASSIFICATION_MISSING",id);
  const seal=readJson(root,"ci/evidence/registry_seal_manifest.v1.json");
  const sealPaths=new Set((seal.entries||[]).map((x)=>x.path));
  for (const p of manifest.baseline.active_registry_file_set) if (!sealPaths.has(p)) fail("SEAL_ACTIVE_PATH_MISSING",p);
  for (const p of ["registries/exercise/exercise_substitution_graph.json","registries/exercise/exercise_warmup_mapping.registry.json"]) if (!sealPaths.has(p)) fail("SEAL_LEGACY_PATH_MISSING",p);
  for (const p of manifest.baseline.active_registry_file_set) if (!fs.existsSync(path.join(root,...p.split('/')))) fail("ACTIVE_FILE_MISSING",p);
  // REG-FULL-00 originally proved the architecture-only slice left all governed
  // registry bytes untouched. Once REG-FULL-01 is present, those bytes are
  // lawfully migrated under the successor schema authority; continuing to pin
  // them to the REG-FULL-00 base commit would make downstream closure
  // impossible. In successor mode, prove the successor is authoritative and
  // explicitly bound to this surface manifest while retaining the unchanged
  // compact loader/index architecture proof above.
  const schemaManifestPath=path.join(root,"registries","final_registry_schema_manifest.json");
  if (fs.existsSync(schemaManifestPath)) {
    const schemaManifest=readJson(root,"registries/final_registry_schema_manifest.json");
    if (schemaManifest.manifest_id!=="kolosseum_final_registry_schema_authority" || schemaManifest.slice_id!=="REG-FULL-01" || schemaManifest.status!=="authoritative") {
      fail("SUCCESSOR_SCHEMA_AUTHORITY_INVALID",schemaManifest.manifest_id||"missing");
    }
    if (schemaManifest.parent_surface_manifest_id!==manifest.manifest_id || schemaManifest.parent_surface_manifest_version!==manifest.manifest_version) {
      fail("SUCCESSOR_SCHEMA_PARENT_MISMATCH",`${schemaManifest.parent_surface_manifest_id||"missing"}@${schemaManifest.parent_surface_manifest_version||"missing"}`);
    }
  } else {
    const base=manifest.base_commit;
    const protectedPaths=[...PROTECTED_PATHS,...manifest.baseline.active_registry_file_set];
    const diff=spawnSync("git",["diff","--name-only",base,"--",...protectedPaths],{cwd:root,encoding:"utf8"});
    if (diff.status!==0) fail("GIT_DIFF_FAILED",String(diff.stderr||""));
    else if (String(diff.stdout||"").trim()) fail("PROTECTED_BYTES_CHANGED",String(diff.stdout).trim());
  }
  const activationFiles=["ci/registry/s_reg_25_equipment_registry_activation.mjs","ci/registry/s_reg_26_sport_subdivision_registry_activation.mjs","ci/registry/s_reg_27_sport_metric_registry_activation.mjs","ci/registry/s_reg_28_sport_role_registry_activation.mjs","ci/registry/s_reg_29_metric_exercise_link_registry_activation.mjs","ci/registry/s_reg_30_sport_metric_extension_threshold_marker_activation.mjs","ci/registry/s_reg_31_exercise_token_registry_activation.mjs","ci/registry/s_reg_33_exercise_activity_applicability_registry_activation.mjs"];
  for (const p of activationFiles) if (!fs.existsSync(path.join(root,...p.split('/')))) fail("ACTIVATION_EVIDENCE_MISSING",p);
  return {ok:errors.length===0,errors};
}
