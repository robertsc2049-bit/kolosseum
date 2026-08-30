// DEV NOTE: REG-FULL-08 independent copy/instruction/provenance closure.
// The canonical copy registry is the sole provenance authority. It binds every
// explicitly active source record to its tracked Git blob, raw file SHA-256,
// canonical record SHA-256 and exact hashes for authored textual leaves.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

export const TOKEN = "CI_REG_FULL_08_COPY_INSTRUCTIONS_PROVENANCE_CLOSURE";

const ROOT = process.cwd();
const OUTPUT = "registries/copy/copy.registry.json";
const EVIDENCE = "ci/evidence/reg_full_08_copy_instructions_provenance_closure.v1.json";
const COPY_SCHEMA = "ci/schemas/copy_registry.registry.schema.json";
const SURFACE_MANIFEST = "registries/final_registry_surface_manifest.json";
const SUPPORTED_ACTIVITIES = Object.freeze(["powerlifting", "general_strength", "rugby_union"]);

export const REG_FULL_08_GUARD_SOURCE_SPECS = Object.freeze([
  Object.freeze({ key: "activity", registry: "activity_registry_1", file: "registries/activity/activity.registry.json", authority: "compatibility_projection", shape: "object", pk: "activity_id", header: "activity" }),
  Object.freeze({ key: "sport_subdivision", registry: "sport_subdivision_registry_1a", file: "registries/sport_subdivision/sport_subdivision.registry.json", authority: "compatibility_projection", shape: "object", pk: "sport_subdivision_id", header: "sport_subdivision" }),
  Object.freeze({ key: "sport_metric", registry: "sport_metric_registry_1c", file: "registries/sport_metric/sport_metric.registry.json", authority: "compatibility_projection", shape: "object", pk: "sport_metric_id", header: "sport_metric" }),
  Object.freeze({ key: "sport_role", registry: "sport_role_registry_2", file: "registries/sport_role/sport_role.registry.json", authority: "compatibility_projection", shape: "object", pk: "sport_role_id", header: "sport_role" }),
  Object.freeze({ key: "movement", registry: "movement_registry_3", file: "registries/movement/movement.registry.json", authority: "compatibility_projection", shape: "object", pk: "movement_pattern_id", header: "movement" }),
  Object.freeze({ key: "exercise", registry: "exercise_registry_3a", file: "registries/exercise/exercise.registry.json", authority: "compatibility_projection", shape: "object", pk: "exercise_id", header: "exercise" }),
  Object.freeze({ key: "exercise_token", registry: "exercise_token_registry_3b", file: "registries/exercise_token/exercise_token.registry.json", authority: "compatibility_projection", shape: "object", pk: "exercise_token_id", header: "exercise_token" }),
  Object.freeze({ key: "equipment", registry: "equipment_environment_registry_3e", file: "registries/equipment/equipment.registry.json", authority: "compatibility_projection", shape: "object", pk: "equipment_id", header: "equipment" }),
  Object.freeze({ key: "metric_exercise_link", registry: "metric_exercise_link_registry_1c_a", file: "registries/metric_exercise_link/metric_exercise_link.registry.json", authority: "compatibility_projection", shape: "object", pk: "metric_exercise_link_id", header: "metric_exercise_link" }),
  Object.freeze({ key: "exercise_equipment_compatibility", registry: "exercise_equipment_compatibility_registry", file: "registries/exercise_equipment_compatibility/exercise_equipment_compatibility.registry.json", authority: "authoritative", shape: "object", pk: "compatibility_id", header: "exercise_equipment_compatibility_registry" }),
  Object.freeze({ key: "exercise_sport_applicability", registry: "exercise_sport_applicability_registry_6x", file: "registries/exercise_activity_applicability/exercise_activity_applicability.registry.json", authority: "compatibility_projection", shape: "object", pk: "applicability_id", header: "exercise_activity_applicability" }),
  Object.freeze({ key: "program_compatibility", registry: "sport_program_template_registry_5f", file: "registries/program/program.registry.json", authority: "compatibility_projection", shape: "object", pk: "template_id", header: "program" }),
  Object.freeze({ key: "program_template", registry: "sport_program_template_registry_5f", file: "registries/program/sport_program_template.registry.json", authority: "authoritative", shape: "array", pk: "template_id", header: "sport_program_template_registry_5f" }),
  Object.freeze({ key: "substitution", registry: "substitution_registry", file: "registries/substitution/substitution.registry.json", authority: "authoritative", shape: "object", pk: "substitution_edge_id", header: "substitution_registry" }),
  Object.freeze({ key: "beta_copy_root", registry: "copy_registry", file: "copy/beta_copy_registry.json", authority: "compatibility_runtime", shape: "array", pk: "copy_id", header: "beta_copy_registry_authoritative" }),
  Object.freeze({ key: "beta_copy_16", registry: "copy_registry", file: "copy/beta_16_app_path_phase1_6_copy.json", authority: "compatibility_runtime", shape: "array", pk: "copy_id", header: null }),
  Object.freeze({ key: "beta_copy_17", registry: "copy_registry", file: "copy/beta_17_coach_managed_path_copy.json", authority: "compatibility_runtime", shape: "array", pk: "copy_id", header: null }),
  Object.freeze({ key: "beta_copy_20", registry: "copy_registry", file: "copy/beta_20_phase7_projection_copy.json", authority: "compatibility_runtime", shape: "array", pk: "copy_id", header: null })
]);

const BETA_SUBORDINATES = Object.freeze([
  "copy/beta_16_app_path_phase1_6_copy.json",
  "copy/beta_17_coach_managed_path_copy.json",
  "copy/beta_20_phase7_projection_copy.json"
]);

const POLICY = Object.freeze({
  source: "canonical_project_document",
  license_status: "project_owned",
  commercial_use_status: "permitted",
  manual_review_status: "approved",
  legal_review_status: "project_owned_clear",
  exact_copy_policy: "sha256_exact_utf8"
});
const COPY_FIELD = /(?:^|_)(?:label|name|title|description|instruction|instructions|text|body|cue|cues|fault|faults|note|notes|rationale|phrase|condition|conditions)(?:_|$)/u;
const MACHINE_ID = /(?:^|_)(?:id|ids)$/u;

function isObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function readJson(root, rel) { return JSON.parse(fs.readFileSync(path.join(root, ...rel.split("/")), "utf8")); }
function sha256File(root, rel) { return sha256(fs.readFileSync(path.join(root, ...rel.split("/")))); }
function gitBlob(root, rel) { return execFileSync("git", ["hash-object", rel], { cwd: root, encoding: "utf8" }).trim(); }
function stableText(value) { return `${JSON.stringify(canonicalize(value), null, 2)}\n`; }
function slug(value) { return String(value).toLowerCase().replace(/[^a-z0-9_.-]+/gu, "-").replace(/^-+|-+$/gu, ""); }
function uniqSorted(values) { return [...new Set(values)].sort((a, b) => a.localeCompare(b)); }

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isObject(value)) return value;
  const out = {};
  for (const key of Object.keys(value).sort((a, b) => a.localeCompare(b))) out[key] = canonicalize(value[key]);
  return out;
}

function rows(doc, spec, fail) {
  if (!isObject(doc)) { fail("SOURCE_DOCUMENT_INVALID", spec.file); return []; }
  if (spec.header !== null && doc.registry_id !== spec.header) fail("SOURCE_REGISTRY_HEADER", `${spec.file}:${doc.registry_id}`);
  const container = doc.entries;
  const out = [];
  if (spec.shape === "object") {
    if (!isObject(container)) { fail("SOURCE_ENTRIES_SHAPE", spec.file); return []; }
    for (const [key, row] of Object.entries(container)) {
      if (!isObject(row)) { fail("SOURCE_ROW_INVALID", `${spec.file}:${key}`); continue; }
      const id = row[spec.pk] ?? key;
      if (typeof id !== "string" || !id) { fail("SOURCE_PRIMARY_KEY_MISSING", `${spec.file}:${key}:${spec.pk}`); continue; }
      out.push({ id, row });
    }
  } else {
    if (!Array.isArray(container)) { fail("SOURCE_ENTRIES_SHAPE", spec.file); return []; }
    for (const row of container) {
      if (!isObject(row)) { fail("SOURCE_ROW_INVALID", spec.file); continue; }
      const id = row[spec.pk];
      if (typeof id !== "string" || !id) { fail("SOURCE_PRIMARY_KEY_MISSING", `${spec.file}:${spec.pk}`); continue; }
      out.push({ id, row });
    }
  }
  out.sort((a, b) => a.id.localeCompare(b.id));
  if (new Set(out.map((item) => item.id)).size !== out.length) fail("SOURCE_PRIMARY_KEY_DUPLICATE", spec.file);
  return out;
}

function isCopyKey(key) {
  if (MACHINE_ID.test(key)) return false;
  if (["copy_boundary_flags", "copy_legal_boundary_flags", "forbidden_phrase_references"].includes(key)) return false;
  return COPY_FIELD.test(key);
}

function exactControls(record) {
  const out = [];
  function walk(value, fieldPath, copyContext) {
    if (typeof value === "string") {
      if (copyContext) out.push({ field_path: fieldPath, text_sha256: sha256(Buffer.from(value, "utf8")) });
      return;
    }
    if (Array.isArray(value)) { value.forEach((item, index) => walk(item, `${fieldPath}[${index}]`, copyContext)); return; }
    if (!isObject(value)) return;
    for (const key of Object.keys(value).sort((a, b) => a.localeCompare(b))) {
      walk(value[key], fieldPath ? `${fieldPath}.${key}` : key, copyContext || isCopyKey(key));
    }
  }
  walk(record, "", false);
  out.sort((a, b) => a.field_path.localeCompare(b.field_path));
  return out;
}

function activities(record) {
  const out = [];
  const add = (value) => { if (SUPPORTED_ACTIVITIES.includes(value)) out.push(value); };
  add(record.activity_id);
  add(record.primary_activity_applicability);
  if (Array.isArray(record.secondary_activity_applicability)) record.secondary_activity_applicability.forEach(add);
  if (Array.isArray(record.activity_applicability)) record.activity_applicability.forEach(add);
  add(record.registry_bindings?.activity_id);
  return uniqSorted(out);
}

function copyId(spec, id) {
  return `provenance.${slug(spec.key)}.${sha256(`${spec.file}\u0000${id}`).slice(0, 20)}`;
}

function expectedEntry(root, spec, id, row) {
  const fileSha = sha256File(root, spec.file);
  const blobSha = gitBlob(root, spec.file);
  const idValue = copyId(spec, id);
  return {
    copy_id: idValue,
    copy_category: "registry_record_provenance",
    allowed_phrase: null,
    forbidden_phrase_references: [],
    supported_surface: spec.registry,
    activity_applicability: activities(row),
    status: "active",
    source_registry_id: spec.registry,
    source_record_id: id,
    source_file: spec.file,
    source_authority: spec.authority,
    source: POLICY.source,
    source_reference: `git-blob:${blobSha}:${spec.file}#${id}`,
    source_git_blob_sha: blobSha,
    source_file_sha256: fileSha,
    license_status: POLICY.license_status,
    commercial_use_status: POLICY.commercial_use_status,
    manual_review_status: POLICY.manual_review_status,
    legal_review_status: POLICY.legal_review_status,
    record_sha256: sha256(stableText(row)),
    exact_copy_policy: POLICY.exact_copy_policy,
    exact_copy_controls: exactControls(row),
    provenance_notes: "project_owned_repository_content"
  };
}

function validateSchema(root, fail) {
  const schema = readJson(root, COPY_SCHEMA);
  const row = schema?.properties?.entries?.additionalProperties;
  if (!isObject(row) || row.additionalProperties !== false) fail("COPY_SCHEMA_ROW_NOT_CLOSED", COPY_SCHEMA);
  const required = new Set(row?.required ?? []);
  for (const field of [
    "source_registry_id", "source_record_id", "source_file", "source_authority", "source", "source_reference",
    "source_git_blob_sha", "source_file_sha256", "license_status", "commercial_use_status", "manual_review_status",
    "legal_review_status", "record_sha256", "exact_copy_policy", "exact_copy_controls"
  ]) if (!required.has(field)) fail("COPY_SCHEMA_PROVENANCE_FIELD_MISSING", field);
  const sources = row?.properties?.source?.enum ?? [];
  for (const source of ["founder_original", "licensed_source", "canonical_project_document"]) if (!sources.includes(source)) fail("COPY_SCHEMA_SOURCE_VOCABULARY", source);
}

function validateSurfaceLaw(root, fail) {
  const manifest = readJson(root, SURFACE_MANIFEST);
  const copy = (manifest.entities ?? []).find((item) => item.entity_id === "copy_registry");
  if (copy?.classification !== "required_active" || copy?.final_state?.authoritative !== true || copy?.final_state?.final_runtime_load !== true || copy?.final_state?.final_load_position !== 25) fail("COPY_AUTHORITY_SURFACE_INVALID", copy);
  for (const id of ["instruction_display_copy_registry", "copy_legal_claim_boundary_registry"]) {
    const item = (manifest.entities ?? []).find((entry) => entry.entity_id === id);
    if (item?.classification !== "prohibited" || item?.successor_registry_id !== "copy_registry") fail("DUPLICATE_COPY_AUTHORITY_NOT_PROHIBITED", id);
  }
}

function validateBetaSubordinates(root, fail) {
  const beta = readJson(root, "copy/beta_copy_registry.json");
  const actual = (beta.subordinate_registries ?? []).map((item) => item.path).sort((a, b) => a.localeCompare(b));
  const expected = [...BETA_SUBORDINATES].sort((a, b) => a.localeCompare(b));
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fail("BETA_COPY_SOURCE_SET_DRIFT", actual);
  for (const item of beta.subordinate_registries ?? []) {
    if (item.content_sha256 !== sha256File(root, item.path)) fail("BETA_COPY_HASH_DRIFT", item.path);
  }
}

export function validateRegFull08Closure({ repoRoot = ROOT, registryOverride = null, evidenceOverride = null } = {}) {
  const errors = [];
  const fail = (code, detail) => errors.push({ code, detail });
  for (const rel of [OUTPUT, EVIDENCE, COPY_SCHEMA, SURFACE_MANIFEST]) if (!fs.existsSync(path.join(repoRoot, ...rel.split("/")))) fail("REQUIRED_FILE_MISSING", rel);
  if (errors.length) return { ok: false, token: TOKEN, errors };

  validateSchema(repoRoot, fail);
  validateSurfaceLaw(repoRoot, fail);
  validateBetaSubordinates(repoRoot, fail);

  const registry = registryOverride ?? readJson(repoRoot, OUTPUT);
  const evidence = evidenceOverride ?? readJson(repoRoot, EVIDENCE);
  if (registry.registry_id !== "copy_registry" || registry.version !== "1.0.0" || !isObject(registry.entries)) fail("COPY_REGISTRY_HEADER", registry?.registry_id);

  const expected = {};
  const sourceFiles = [];
  let sourceRecordCount = 0;
  let exactCopyCount = 0;
  for (const spec of REG_FULL_08_GUARD_SOURCE_SPECS) {
    const abs = path.join(repoRoot, ...spec.file.split("/"));
    if (!fs.existsSync(abs)) { fail("ACTIVE_SOURCE_MISSING", spec.file); continue; }
    const doc = readJson(repoRoot, spec.file);
    const sourceRows = rows(doc, spec, fail);
    sourceRecordCount += sourceRows.length;
    sourceFiles.push({
      source_registry_id: spec.registry,
      source_file: spec.file,
      source_authority: spec.authority,
      source_record_count: sourceRows.length,
      source_git_blob_sha: gitBlob(repoRoot, spec.file),
      source_file_sha256: sha256File(repoRoot, spec.file)
    });
    for (const { id, row } of sourceRows) {
      const entry = expectedEntry(repoRoot, spec, id, row);
      expected[entry.copy_id] = entry;
      exactCopyCount += entry.exact_copy_controls.length;
    }
  }

  const actualIds = Object.keys(registry.entries).sort((a, b) => a.localeCompare(b));
  const expectedIds = Object.keys(expected).sort((a, b) => a.localeCompare(b));
  if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) fail("PROVENANCE_COVERAGE_SET", { actual: actualIds.length, expected: expectedIds.length });
  for (const id of expectedIds) {
    if (!registry.entries[id]) continue;
    if (JSON.stringify(canonicalize(registry.entries[id])) !== JSON.stringify(canonicalize(expected[id]))) fail("PROVENANCE_RECORD_DRIFT", id);
  }

  if (sourceRecordCount !== expectedIds.length) fail("SOURCE_RECORD_COVERAGE_COUNT", { sourceRecordCount, provenance: expectedIds.length });
  if (Object.values(registry.entries).some((entry) => entry.source === "licensed_source" || entry.license_status === "licensed")) fail("LICENSED_CONTENT_INFERRED_WITHOUT_EXPLICIT_OVERRIDE", true);
  if (Object.values(registry.entries).some((entry) => entry.commercial_use_status !== "permitted" || entry.manual_review_status !== "approved" || entry.legal_review_status !== "project_owned_clear")) fail("ACTIVE_CONTENT_REVIEW_STATUS", true);

  const expectedRegistrySha = sha256(stableText(registry));
  const expectedEvidence = {
    slice_id: "REG-FULL-08",
    evidence_version: "1.0.0",
    status: "authoritative",
    coverage_policy: "every_explicit_active_source_record",
    source_file_count: sourceFiles.length,
    source_record_count: sourceRecordCount,
    provenance_record_count: expectedIds.length,
    exact_copy_control_count: exactCopyCount,
    provenance_policy: POLICY,
    source_files: sourceFiles,
    canonical_copy_registry_sha256: expectedRegistrySha,
    copy_schema_sha256: sha256File(repoRoot, COPY_SCHEMA),
    no_source_content_mutation: true,
    no_runtime_inference: true,
    licensed_content_inference: false
  };
  if (JSON.stringify(canonicalize(evidence)) !== JSON.stringify(canonicalize(expectedEvidence))) fail("EVIDENCE_DRIFT", true);

  return {
    ok: errors.length === 0,
    token: TOKEN,
    errors,
    summary: {
      source_files: sourceFiles.length,
      source_records: sourceRecordCount,
      provenance_records: expectedIds.length,
      exact_copy_controls: exactCopyCount
    }
  };
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("reg_full_08_copy_instructions_provenance_closure.mjs")) {
  const result = validateRegFull08Closure();
  if (!result.ok) {
    console.error(JSON.stringify(result, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify(result, null, 2));
}
