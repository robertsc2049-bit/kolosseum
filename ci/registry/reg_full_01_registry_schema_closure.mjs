// DEV NOTE: REG-FULL-01 shared enforcement module. The machine-readable schema
// authority remains registries/final_registry_schema_manifest.json; this module
// validates that authority and the committed repository implementation.
import fs from "node:fs";
import path from "node:path";

export const TOKEN = "CI_REG_FULL_01_REGISTRY_SCHEMA_CLOSURE";
export const REQUIRED_ACTIVITY_SCOPE = Object.freeze(["powerlifting", "general_strength", "rugby_union"]);
export const FORBIDDEN_CANONICAL_FIELDS = Object.freeze(["id", "pattern", "movement_id", "program_id"]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function readJson(root, rel) {
  return JSON.parse(fs.readFileSync(path.join(root, ...rel.split("/")), "utf8"));
}

function schemaObjectClosureErrors(schema, schemaPath) {
  const errors = [];
  function walk(node, pointer) {
    if (Array.isArray(node)) {
      node.forEach((value, index) => walk(value, `${pointer}/${index}`));
      return;
    }
    if (!isObject(node)) return;
    if (node.type === "object") {
      const hasProperties = isObject(node.properties);
      const mapSchema = isObject(node.additionalProperties);
      if (node.additionalProperties !== false && !mapSchema) {
        errors.push({ code: "SCHEMA_OPEN_OBJECT", detail: `${schemaPath}:${pointer}` });
      }
      if (hasProperties) {
        const required = new Set(Array.isArray(node.required) ? node.required : []);
        for (const property of Object.keys(node.properties)) {
          if (!required.has(property)) {
            errors.push({ code: "SCHEMA_UNDOCUMENTED_OPTIONAL_FIELD", detail: `${schemaPath}:${pointer}.${property}` });
          }
        }
      }
    }
    for (const [key, value] of Object.entries(node)) walk(value, `${pointer}/${key}`);
  }
  walk(schema, "#");
  return errors;
}

export function validateSchemaManifest(manifest, surfaceManifest) {
  const errors = [];
  const fail = (code, detail) => errors.push({ code, detail });
  if (!isObject(manifest)) return { ok: false, errors: [{ code: "MANIFEST_INVALID", detail: "root must be object" }] };
  if (manifest.manifest_id !== "kolosseum_final_registry_schema_authority" || manifest.manifest_version !== "1.0.0" || manifest.slice_id !== "REG-FULL-01" || manifest.status !== "authoritative" || manifest.schema_scope !== "required_active_registries") fail("MANIFEST_HEADER", "header mismatch");
  if (manifest.parent_surface_manifest_id !== surfaceManifest?.manifest_id || manifest.parent_surface_manifest_version !== surfaceManifest?.manifest_version) fail("PARENT_SURFACE_MISMATCH", "surface authority mismatch");
  if (manifest.canonical_id_law?.generic_id_aliases_forbidden !== true || manifest.canonical_id_law?.foreign_keys_use_target_primary_key_vocabulary !== true || manifest.canonical_id_law?.permanent_dual_read_forbidden !== true) fail("CANONICAL_ID_LAW", manifest.canonical_id_law);
  const expected = (surfaceManifest?.entities || []).filter((e) => e.classification === "required_active").sort((a,b)=>a.final_state.final_load_position-b.final_state.final_load_position);
  const regs = Array.isArray(manifest.registries) ? manifest.registries : [];
  if (regs.length !== expected.length) fail("SCHEMA_COUNT", `${regs.length}/${expected.length}`);
  const ids = new Set(); const paths = new Set(); const positions = new Set(); const byId = new Map();
  for (const r of regs) {
    if (!isObject(r) || typeof r.canonical_registry_id !== "string") { fail("REGISTRY_ENTRY_INVALID", r); continue; }
    if (ids.has(r.canonical_registry_id)) fail("DUPLICATE_REGISTRY_SCHEMA_AUTHORITY", r.canonical_registry_id); else ids.add(r.canonical_registry_id);
    if (paths.has(r.schema_path)) fail("DUPLICATE_SCHEMA_PATH", r.schema_path); else paths.add(r.schema_path);
    if (!Number.isInteger(r.load_position) || positions.has(r.load_position)) fail("DUPLICATE_OR_INVALID_LOAD_POSITION", `${r.canonical_registry_id}:${r.load_position}`); else positions.add(r.load_position);
    if (!['closed','deferred_no_rows'].includes(r.row_contract_status)) fail("ROW_CONTRACT_STATUS", r.canonical_registry_id);
    if (r.row_contract_status === 'closed' && (typeof r.primary_key_field !== 'string' || !r.primary_key_field)) fail("PRIMARY_KEY_MISSING", r.canonical_registry_id);
    if (r.row_contract_status === 'deferred_no_rows' && r.primary_key_field !== null) fail("DEFERRED_PRIMARY_KEY_FORBIDDEN", r.canonical_registry_id);
    if (!Array.isArray(r.fk_fields) || !Array.isArray(r.optional_fields)) fail("REGISTRY_SCHEMA_METADATA", r.canonical_registry_id);
    if (r.optional_fields?.length) fail("CANONICAL_OPTIONAL_FIELD", `${r.canonical_registry_id}:${r.optional_fields.join(',')}`);
    byId.set(r.canonical_registry_id, r);
  }
  expected.forEach((e, index) => {
    const r = byId.get(e.canonical_registry_id);
    if (!r) fail("REQUIRED_ACTIVE_SCHEMA_MISSING", e.canonical_registry_id);
    else if (r.load_position !== index + 1 || r.load_position !== e.final_state.final_load_position) fail("LOAD_POSITION_MISMATCH", e.canonical_registry_id);
  });
  for (const r of regs) {
    for (const fk of r.fk_fields || []) {
      const target = byId.get(fk.target_registry_id);
      if (!target) { fail("FK_TARGET_UNKNOWN", `${r.canonical_registry_id}.${fk.field}->${fk.target_registry_id}`); continue; }
      if (fk.target_primary_key_field !== target.primary_key_field) fail("FK_TARGET_KEY_MISMATCH", `${r.canonical_registry_id}.${fk.field}`);
      if (fk.required !== true || fk.nullable !== false || !['one','many'].includes(fk.cardinality)) fail("FK_DECLARATION_INVALID", `${r.canonical_registry_id}.${fk.field}`);
    }
  }
  if (!Array.isArray(manifest.schema_conflicts) || manifest.schema_conflicts.length !== 0) fail("SCHEMA_CONFLICT", manifest.schema_conflicts);
  const summary = manifest.summary || {};
  if (summary.required_active_registry_count !== expected.length || summary.authoritative_schema_count !== expected.length || summary.schema_conflict_count !== 0 || summary.legacy_dual_read_allowed !== false) fail("SUMMARY_MISMATCH", summary);
  return { ok: errors.length === 0, errors };
}

export function auditRepository(root, manifest, surfaceManifest) {
  const errors = [];
  const fail = (code, detail) => errors.push({ code, detail });
  for (const r of manifest.registries || []) {
    const abs = path.join(root, ...String(r.schema_path).split('/'));
    if (!fs.existsSync(abs)) { fail("SCHEMA_FILE_MISSING", r.schema_path); continue; }
    let schema;
    try { schema = JSON.parse(fs.readFileSync(abs, 'utf8')); } catch (e) { fail("SCHEMA_JSON_INVALID", `${r.schema_path}:${e.message}`); continue; }
    if (schema.$schema !== 'https://json-schema.org/draft/2020-12/schema') fail("SCHEMA_DRAFT", r.schema_path);
    if (schema.type !== 'object' || schema.additionalProperties !== false) fail("SCHEMA_ROOT_NOT_CLOSED", r.schema_path);
    if (schema.properties?.registry_id?.const !== r.canonical_registry_id) fail("SCHEMA_REGISTRY_ID_CONST", r.canonical_registry_id);
    errors.push(...schemaObjectClosureErrors(schema, r.schema_path));
    const propertyNames = new Set();
    (function collectPropertyNames(node) {
      if (Array.isArray(node)) { node.forEach(collectPropertyNames); return; }
      if (!isObject(node)) return;
      if (isObject(node.properties)) for (const key of Object.keys(node.properties)) propertyNames.add(key);
      for (const value of Object.values(node)) collectPropertyNames(value);
    })(schema);
    for (const legacy of FORBIDDEN_CANONICAL_FIELDS) {
      const distinctTokenPattern = r.canonical_registry_id === "exercise_token_registry_3b" && legacy === "pattern";
      if (propertyNames.has(legacy) && !distinctTokenPattern) fail("CANONICAL_SCHEMA_LEGACY_FIELD", `${r.canonical_registry_id}:${legacy}`);
    }
    if (r.row_contract_status === 'deferred_no_rows') {
      const entries = schema.properties?.entries;
      const hardClosedArray = entries?.type === 'array' && entries.maxItems === 0 && entries.items === false;
      const hardClosedObject = entries?.type === 'object' && entries.maxProperties === 0 && entries.additionalProperties === false;
      if (!hardClosedArray && !hardClosedObject) fail("DEFERRED_ROWS_NOT_HARD_CLOSED", r.canonical_registry_id);
    }
  }
  const live = (manifest.registries || []).filter((r) => isObject(r.legacy_runtime_projection));
  for (const r of live) {
    const projection = r.legacy_runtime_projection;
    const dataPath = path.join(root, ...projection.data_path.split('/'));
    const schemaPath = path.join(root, ...projection.schema_path.split('/'));
    if (!fs.existsSync(dataPath) || !fs.existsSync(schemaPath)) { fail("LIVE_PROJECTION_MISSING", r.canonical_registry_id); continue; }
    const doc = JSON.parse(fs.readFileSync(dataPath,'utf8'));
    const entries = isObject(doc.entries) ? Object.values(doc.entries) : [];
    for (const row of entries) {
      if (!isObject(row)) continue;
      for (const legacy of FORBIDDEN_CANONICAL_FIELDS) if (Object.prototype.hasOwnProperty.call(row, legacy)) fail("LIVE_LEGACY_FIELD", `${projection.registry_id}:${legacy}`);
      if (r.primary_key_field && !Object.prototype.hasOwnProperty.call(row, r.primary_key_field)) fail("LIVE_PRIMARY_KEY_MISSING", `${projection.registry_id}:${r.primary_key_field}`);
    }
  }
  const activity = readJson(root, 'registries/activity/activity.registry.json');
  const activityIds = Object.keys(activity.entries || {}).sort();
  if (JSON.stringify(activityIds) !== JSON.stringify([...REQUIRED_ACTIVITY_SCOPE].sort())) fail("SUPPORTED_ACTIVITY_SCOPE_CHANGED", activityIds);
  const currentProgram = (surfaceManifest.entities || []).find((e)=>e.current_state?.repo_registry_ids?.includes('program'));
  if (currentProgram?.canonical_registry_id !== 'sport_program_template_registry_5f') fail("PROGRAM_TEMPLATE_IDENTITY", currentProgram?.canonical_registry_id);
  const noDualReadFiles = [
    'engine/src/phases/phase4/templates.ts',
    'ci/guards/registry_law_guard.mjs',
    'src/api/exercise_content_service.ts',
    'ci/scripts/run_canonical_compound_set_lock_verifier.mjs',
    'ci/scripts/run_unilateral_coverage_verifier.mjs',
    'ci/guards/s_v1_24_registry_load_order_fk_closure_guard.mjs'
  ];
  for (const rel of noDualReadFiles) {
    const text = fs.readFileSync(path.join(root,...rel.split('/')),'utf8');
    if (/\.pattern\b|\.movement_id\b|\[\s*["']template_id["']\s*,\s*["']program_id["']|\[\s*["']substitution_edge_id["']\s*,\s*["']id["']/.test(text)) fail("PERMANENT_DUAL_READ_OR_LEGACY_CONSUMER", rel);
  }
  return { ok: errors.length === 0, errors };
}
