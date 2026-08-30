import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";

export const REG_FULL_08_FAILURE_TOKEN = "CI_REG_FULL_08_COPY_INSTRUCTIONS_PROVENANCE_CLOSURE";

export const REG_FULL_08_PATHS = Object.freeze({
  surfaceManifest: "registries/final_registry_surface_manifest.json",
  schemaManifest: "registries/final_registry_schema_manifest.json",
  copySchema: "ci/schemas/copy_registry.registry.schema.json",
  canonicalCopy: "registries/copy/copy.registry.json",
  evidence: "ci/evidence/reg_full_08_copy_instructions_provenance_closure.v1.json"
});

export const REG_FULL_08_SOURCE_SPECS = Object.freeze([
  Object.freeze({ source_key: "activity", source_registry_id: "activity_registry_1", source_file: "registries/activity/activity.registry.json", source_authority: "compatibility_projection", entries_shape: "object", primary_key: "activity_id", expected_registry_id: "activity" }),
  Object.freeze({ source_key: "sport_subdivision", source_registry_id: "sport_subdivision_registry_1a", source_file: "registries/sport_subdivision/sport_subdivision.registry.json", source_authority: "compatibility_projection", entries_shape: "object", primary_key: "sport_subdivision_id", expected_registry_id: "sport_subdivision" }),
  Object.freeze({ source_key: "sport_metric", source_registry_id: "sport_metric_registry_1c", source_file: "registries/sport_metric/sport_metric.registry.json", source_authority: "compatibility_projection", entries_shape: "object", primary_key: "sport_metric_id", expected_registry_id: "sport_metric" }),
  Object.freeze({ source_key: "sport_role", source_registry_id: "sport_role_registry_2", source_file: "registries/sport_role/sport_role.registry.json", source_authority: "compatibility_projection", entries_shape: "object", primary_key: "sport_role_id", expected_registry_id: "sport_role" }),
  Object.freeze({ source_key: "movement", source_registry_id: "movement_registry_3", source_file: "registries/movement/movement.registry.json", source_authority: "compatibility_projection", entries_shape: "object", primary_key: "movement_pattern_id", expected_registry_id: "movement" }),
  Object.freeze({ source_key: "exercise", source_registry_id: "exercise_registry_3a", source_file: "registries/exercise/exercise.registry.json", source_authority: "compatibility_projection", entries_shape: "object", primary_key: "exercise_id", expected_registry_id: "exercise" }),
  Object.freeze({ source_key: "exercise_token", source_registry_id: "exercise_token_registry_3b", source_file: "registries/exercise_token/exercise_token.registry.json", source_authority: "compatibility_projection", entries_shape: "object", primary_key: "exercise_token_id", expected_registry_id: "exercise_token" }),
  Object.freeze({ source_key: "equipment", source_registry_id: "equipment_environment_registry_3e", source_file: "registries/equipment/equipment.registry.json", source_authority: "compatibility_projection", entries_shape: "object", primary_key: "equipment_id", expected_registry_id: "equipment" }),
  Object.freeze({ source_key: "metric_exercise_link", source_registry_id: "metric_exercise_link_registry_1c_a", source_file: "registries/metric_exercise_link/metric_exercise_link.registry.json", source_authority: "compatibility_projection", entries_shape: "object", primary_key: "metric_exercise_link_id", expected_registry_id: "metric_exercise_link" }),
  Object.freeze({ source_key: "exercise_equipment_compatibility", source_registry_id: "exercise_equipment_compatibility_registry", source_file: "registries/exercise_equipment_compatibility/exercise_equipment_compatibility.registry.json", source_authority: "authoritative", entries_shape: "object", primary_key: "compatibility_id", expected_registry_id: "exercise_equipment_compatibility_registry" }),
  Object.freeze({ source_key: "exercise_sport_applicability", source_registry_id: "exercise_sport_applicability_registry_6x", source_file: "registries/exercise_activity_applicability/exercise_activity_applicability.registry.json", source_authority: "compatibility_projection", entries_shape: "object", primary_key: "applicability_id", expected_registry_id: "exercise_activity_applicability" }),
  Object.freeze({ source_key: "program_compatibility", source_registry_id: "sport_program_template_registry_5f", source_file: "registries/program/program.registry.json", source_authority: "compatibility_projection", entries_shape: "array", primary_key: "template_id", expected_registry_id: "program" }),
  Object.freeze({ source_key: "program_template", source_registry_id: "sport_program_template_registry_5f", source_file: "registries/program/sport_program_template.registry.json", source_authority: "authoritative", entries_shape: "array", primary_key: "template_id", expected_registry_id: "sport_program_template_registry_5f" }),
  Object.freeze({ source_key: "substitution", source_registry_id: "substitution_registry", source_file: "registries/substitution/substitution.registry.json", source_authority: "authoritative", entries_shape: "object", primary_key: "substitution_edge_id", expected_registry_id: "substitution_registry" }),
  Object.freeze({ source_key: "beta_copy_root", source_registry_id: "copy_registry", source_file: "copy/beta_copy_registry.json", source_authority: "compatibility_runtime", entries_shape: "array", primary_key: "copy_id", expected_registry_id: "beta_copy_registry_authoritative" }),
  Object.freeze({ source_key: "beta_copy_16", source_registry_id: "copy_registry", source_file: "copy/beta_16_app_path_phase1_6_copy.json", source_authority: "compatibility_runtime", entries_shape: "array", primary_key: "copy_id", expected_registry_id: null }),
  Object.freeze({ source_key: "beta_copy_17", source_registry_id: "copy_registry", source_file: "copy/beta_17_coach_managed_path_copy.json", source_authority: "compatibility_runtime", entries_shape: "array", primary_key: "copy_id", expected_registry_id: null }),
  Object.freeze({ source_key: "beta_copy_20", source_registry_id: "copy_registry", source_file: "copy/beta_20_phase7_projection_copy.json", source_authority: "compatibility_runtime", entries_shape: "array", primary_key: "copy_id", expected_registry_id: null })
]);

export const REG_FULL_08_EXPECTED_BETA_SUBORDINATE_PATHS = Object.freeze([
  "copy/beta_16_app_path_phase1_6_copy.json",
  "copy/beta_17_coach_managed_path_copy.json",
  "copy/beta_20_phase7_projection_copy.json"
]);

export const REG_FULL_08_SUPPORTED_ACTIVITIES = Object.freeze(["powerlifting", "general_strength", "rugby_union"]);
export const REG_FULL_08_PROJECT_OWNED_POLICY = Object.freeze({
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
function readJson(abs) { return JSON.parse(fs.readFileSync(abs, "utf8")); }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function sha256File(abs) { return sha256(fs.readFileSync(abs)); }
function stableText(value) { return `${JSON.stringify(canonicalize(value), null, 2)}\n`; }
function assert(condition, message) { if (!condition) throw new Error(`REG_FULL_08_MATERIALIZE: ${message}`); }
function uniqSorted(values) { return [...new Set(values)].sort((a, b) => a.localeCompare(b)); }
function slug(value) { return String(value).toLowerCase().replace(/[^a-z0-9_.-]+/gu, "-").replace(/^-+|-+$/gu, ""); }

export function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isObject(value)) return value;
  const out = {};
  for (const key of Object.keys(value).sort((a, b) => a.localeCompare(b))) out[key] = canonicalize(value[key]);
  return out;
}

function sourceGitBlobSha(repoRoot, rel) {
  return execFileSync("git", ["hash-object", rel], { cwd: repoRoot, encoding: "utf8" }).trim();
}

function assertTrackedAndClean(repoRoot, rel) {
  const tracked = spawnSync("git", ["ls-files", "--error-unmatch", rel], { cwd: repoRoot, stdio: "ignore" });
  assert(tracked.status === 0, `source file is not tracked: ${rel}`);
  const unstaged = spawnSync("git", ["diff", "--quiet", "--", rel], { cwd: repoRoot, stdio: "ignore" });
  assert(unstaged.status === 0, `source file has unstaged changes: ${rel}`);
  const staged = spawnSync("git", ["diff", "--cached", "--quiet", "--", rel], { cwd: repoRoot, stdio: "ignore" });
  assert(staged.status === 0, `source file has staged changes: ${rel}`);
}

export function rowsForSpec(doc, spec) {
  let container;
  if (Array.isArray(doc)) {
    assert(spec.expected_registry_id === null, `${spec.source_file}: top-level array requires a headerless source`);
    assert(spec.entries_shape === "array", `${spec.source_file}: top-level array requires entries_shape=array`);
    container = doc;
  } else {
    assert(isObject(doc), `${spec.source_file}: document must be an object or an explicitly headerless top-level array`);
    if (spec.expected_registry_id !== null) assert(doc.registry_id === spec.expected_registry_id, `${spec.source_file}: registry_id mismatch`);
    container = doc.entries;
  }
  const rows = [];
  if (spec.entries_shape === "object") {
    assert(isObject(container), `${spec.source_file}: entries must be an object`);
    for (const [key, row] of Object.entries(container)) {
      assert(isObject(row), `${spec.source_file}: row ${key} must be an object`);
      const rowId = row[spec.primary_key] ?? key;
      assert(typeof rowId === "string" && rowId.length > 0, `${spec.source_file}: missing ${spec.primary_key}`);
      rows.push(Object.freeze({ row_id: rowId, row }));
    }
  } else {
    assert(Array.isArray(container), `${spec.source_file}: entries must be an array`);
    for (const row of container) {
      assert(isObject(row), `${spec.source_file}: array row must be an object`);
      const rowId = row[spec.primary_key];
      assert(typeof rowId === "string" && rowId.length > 0, `${spec.source_file}: missing ${spec.primary_key}`);
      rows.push(Object.freeze({ row_id: rowId, row }));
    }
  }
  rows.sort((a, b) => a.row_id.localeCompare(b.row_id));
  const ids = rows.map((item) => item.row_id);
  assert(new Set(ids).size === ids.length, `${spec.source_file}: duplicate source record id`);
  return rows;
}

function isCopyBearingKey(key) {
  if (MACHINE_ID.test(key)) return false;
  if (key === "copy_boundary_flags" || key === "copy_legal_boundary_flags" || key === "forbidden_phrase_references") return false;
  return COPY_FIELD.test(key);
}

export function exactCopyControlsForRecord(record) {
  const out = [];
  function walk(value, fieldPath, copyContext) {
    if (typeof value === "string") {
      if (copyContext) out.push({ field_path: fieldPath, text_sha256: sha256(Buffer.from(value, "utf8")) });
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, `${fieldPath}[${index}]`, copyContext));
      return;
    }
    if (!isObject(value)) return;
    for (const key of Object.keys(value).sort((a, b) => a.localeCompare(b))) {
      const next = fieldPath ? `${fieldPath}.${key}` : key;
      walk(value[key], next, copyContext || isCopyBearingKey(key));
    }
  }
  walk(record, "", false);
  out.sort((a, b) => a.field_path.localeCompare(b.field_path));
  return out;
}

export function activityApplicabilityForRecord(record) {
  const values = [];
  const add = (value) => { if (REG_FULL_08_SUPPORTED_ACTIVITIES.includes(value)) values.push(value); };
  add(record.activity_id);
  add(record.primary_activity_applicability);
  if (Array.isArray(record.secondary_activity_applicability)) record.secondary_activity_applicability.forEach(add);
  if (Array.isArray(record.activity_applicability)) record.activity_applicability.forEach(add);
  add(record.registry_bindings?.activity_id);
  return uniqSorted(values);
}

export function provenanceCopyId(spec, rowId) {
  return `provenance.${slug(spec.source_key)}.${sha256(`${spec.source_file}\u0000${rowId}`).slice(0, 20)}`;
}

export function loadRegFull08Sources(repoRoot = process.cwd(), { requireClean = false } = {}) {
  const loaded = [];
  for (const spec of REG_FULL_08_SOURCE_SPECS) {
    const abs = path.join(repoRoot, ...spec.source_file.split("/"));
    assert(fs.existsSync(abs), `missing source file: ${spec.source_file}`);
    if (requireClean) assertTrackedAndClean(repoRoot, spec.source_file);
    const doc = readJson(abs);
    loaded.push(Object.freeze({
      spec,
      doc,
      rows: rowsForSpec(doc, spec),
      source_file_sha256: sha256File(abs),
      source_git_blob_sha: sourceGitBlobSha(repoRoot, spec.source_file)
    }));
  }
  return loaded;
}

export function assertBetaCopySourceClosure(loaded) {
  const root = loaded.find((item) => item.spec.source_key === "beta_copy_root");
  assert(root, "beta copy root source is missing");
  const actual = (root.doc.subordinate_registries ?? []).map((item) => item.path).sort((a, b) => a.localeCompare(b));
  const expected = [...REG_FULL_08_EXPECTED_BETA_SUBORDINATE_PATHS].sort((a, b) => a.localeCompare(b));
  assert(JSON.stringify(actual) === JSON.stringify(expected), `beta copy subordinate source set drifted: ${JSON.stringify(actual)}`);
  for (const subordinate of root.doc.subordinate_registries ?? []) {
    const source = loaded.find((item) => item.spec.source_file === subordinate.path);
    assert(source, `missing beta subordinate source ${subordinate.path}`);
    assert(subordinate.content_sha256 === source.source_file_sha256, `beta subordinate hash drift: ${subordinate.path}`);
  }
}

export function buildRegFull08Registry(loaded) {
  assertBetaCopySourceClosure(loaded);
  const entries = {};
  for (const source of loaded) {
    for (const { row_id: rowId, row } of source.rows) {
      const copyId = provenanceCopyId(source.spec, rowId);
      assert(!entries[copyId], `duplicate provenance copy_id ${copyId}`);
      entries[copyId] = {
        copy_id: copyId,
        copy_category: "registry_record_provenance",
        allowed_phrase: null,
        forbidden_phrase_references: [],
        supported_surface: source.spec.source_registry_id,
        activity_applicability: activityApplicabilityForRecord(row),
        status: "active",
        source_registry_id: source.spec.source_registry_id,
        source_record_id: rowId,
        source_file: source.spec.source_file,
        source_authority: source.spec.source_authority,
        source: REG_FULL_08_PROJECT_OWNED_POLICY.source,
        source_reference: `git-blob:${source.source_git_blob_sha}:${source.spec.source_file}#${rowId}`,
        source_git_blob_sha: source.source_git_blob_sha,
        source_file_sha256: source.source_file_sha256,
        license_status: REG_FULL_08_PROJECT_OWNED_POLICY.license_status,
        commercial_use_status: REG_FULL_08_PROJECT_OWNED_POLICY.commercial_use_status,
        manual_review_status: REG_FULL_08_PROJECT_OWNED_POLICY.manual_review_status,
        legal_review_status: REG_FULL_08_PROJECT_OWNED_POLICY.legal_review_status,
        record_sha256: sha256(stableText(row)),
        exact_copy_policy: REG_FULL_08_PROJECT_OWNED_POLICY.exact_copy_policy,
        exact_copy_controls: exactCopyControlsForRecord(row),
        provenance_notes: "project_owned_repository_content"
      };
    }
  }
  return {
    registry_id: "copy_registry",
    version: "1.0.0",
    entries: Object.fromEntries(Object.entries(entries).sort(([a], [b]) => a.localeCompare(b)))
  };
}

export function buildRegFull08Evidence(repoRoot, loaded, registry) {
  const registryText = stableText(registry);
  const sourceFiles = loaded.map((source) => ({
    source_registry_id: source.spec.source_registry_id,
    source_file: source.spec.source_file,
    source_authority: source.spec.source_authority,
    source_record_count: source.rows.length,
    source_git_blob_sha: source.source_git_blob_sha,
    source_file_sha256: source.source_file_sha256
  }));
  const entries = Object.values(registry.entries);
  return {
    slice_id: "REG-FULL-08",
    evidence_version: "1.0.0",
    status: "authoritative",
    coverage_policy: "every_explicit_active_source_record",
    source_file_count: sourceFiles.length,
    source_record_count: sourceFiles.reduce((sum, item) => sum + item.source_record_count, 0),
    provenance_record_count: entries.length,
    exact_copy_control_count: entries.reduce((sum, item) => sum + item.exact_copy_controls.length, 0),
    provenance_policy: REG_FULL_08_PROJECT_OWNED_POLICY,
    source_files: sourceFiles,
    canonical_copy_registry_sha256: sha256(registryText),
    copy_schema_sha256: sha256File(path.join(repoRoot, ...REG_FULL_08_PATHS.copySchema.split("/"))),
    no_source_content_mutation: true,
    no_runtime_inference: true,
    licensed_content_inference: false
  };
}

function writeFile(repoRoot, rel, text) {
  const abs = path.join(repoRoot, ...rel.split("/"));
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text, "utf8");
}

function sameFile(repoRoot, rel, expected) {
  const abs = path.join(repoRoot, ...rel.split("/"));
  return fs.existsSync(abs) && fs.readFileSync(abs, "utf8") === expected;
}

export function materializeRegFull08(repoRoot = process.cwd(), { write = false, writeEvidence = false, check = false } = {}) {
  const loaded = loadRegFull08Sources(repoRoot, { requireClean: write || check });
  const registry = buildRegFull08Registry(loaded);
  const registryText = stableText(registry);
  const evidence = buildRegFull08Evidence(repoRoot, loaded, registry);
  const evidenceText = stableText(evidence);

  if (write) writeFile(repoRoot, REG_FULL_08_PATHS.canonicalCopy, registryText);
  if (writeEvidence) writeFile(repoRoot, REG_FULL_08_PATHS.evidence, evidenceText);
  if (check) {
    assert(sameFile(repoRoot, REG_FULL_08_PATHS.canonicalCopy, registryText), "canonical copy registry is not deterministic/current");
    assert(sameFile(repoRoot, REG_FULL_08_PATHS.evidence, evidenceText), "REG-FULL-08 evidence is not deterministic/current");
  }

  return Object.freeze({
    registry,
    evidence,
    source_file_count: loaded.length,
    source_record_count: evidence.source_record_count,
    provenance_record_count: evidence.provenance_record_count,
    exact_copy_control_count: evidence.exact_copy_control_count
  });
}

const args = new Set(process.argv.slice(2));
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("reg_full_08_materialize_copy_provenance.mjs")) {
  const result = materializeRegFull08(process.cwd(), {
    write: args.has("--write"),
    writeEvidence: args.has("--write-evidence"),
    check: args.has("--check")
  });
  console.log(JSON.stringify({
    ok: true,
    token: REG_FULL_08_FAILURE_TOKEN,
    source_files: result.source_file_count,
    source_records: result.source_record_count,
    provenance_records: result.provenance_record_count,
    exact_copy_controls: result.exact_copy_control_count
  }, null, 2));
}
