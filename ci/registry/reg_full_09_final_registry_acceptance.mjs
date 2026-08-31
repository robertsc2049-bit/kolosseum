// DEV NOTE: REG-FULL-09 final registry acceptance gate. This module aggregates
// the already-closed REG-FULL laws and adds the final cross-surface checks that
// must be true before the registry programme can be called finished.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  readJson as readRegFull01Json,
  validateSchemaManifest,
  auditRepository as auditRegFull01Repository
} from "./reg_full_01_registry_schema_closure.mjs";
import { auditRegFull04 } from "./reg_full_04_equipment_compatibility_applicability_closure.mjs";
import { runRegFull06Closure } from "./reg_full_06_substitution_graph_closure.mjs";
import { loadRegFull07Documents, auditRegFull07Documents } from "./reg_full_07_programme_template_production.mjs";
import {
  validateRegFull08Closure,
  REG_FULL_08_GUARD_SOURCE_SPECS
} from "./reg_full_08_copy_instructions_provenance_closure.mjs";

export const REG_FULL_09_FAILURE_TOKEN = "CI_REG_FULL_09_FINAL_REGISTRY_ACCEPTANCE";
export const REG_FULL_09_REPORT = "ci/evidence/reg_full_09_final_registry_acceptance.v1.json";
export const REG_FULL_09_SUPPORTED_ACTIVITIES = Object.freeze(["powerlifting", "general_strength", "rugby_union", "strongman"]);
const REG_FULL_09_EXPECTED_SUBSTITUTION_EDGES = 896;

const SURFACE_MANIFEST = "registries/final_registry_surface_manifest.json";
const SCHEMA_MANIFEST = "registries/final_registry_schema_manifest.json";
const REGISTRY_INDEX = "registries/registry_index.json";
const REGISTRY_BUNDLE = "registries/registry_bundle.json";
const COPY_REGISTRY = "registries/copy/copy.registry.json";

const COPY_OUTPUT_SPEC = Object.freeze({
  key: "copy_registry",
  registry: "copy_registry",
  file: COPY_REGISTRY,
  authority: "authoritative",
  shape: "object",
  pk: "copy_id",
  header: "copy_registry"
});

const OPERATIVE_FALLBACK_FIELDS = new Set([
  "fallback",
  "fallback_id",
  "fallback_exercise_id",
  "fallback_registry_id",
  "default_exercise_id",
  "closest_exercise",
  "closest_exercise_id"
]);
const CANDIDATE_STATUS_FIELDS = new Set([
  "status",
  "record_status",
  "lifecycle_status",
  "activation_status",
  "authority_status"
]);
const CANDIDATE_STATUS_VALUES = new Set(["candidate", "candidate_only", "inert_candidate"]);

const CHILD_GATES = Object.freeze([
  Object.freeze({ key: "reg_full_00", args: ["ci/registry/reg_full_00_final_registry_surface_authority.mjs"] }),
  Object.freeze({ key: "reg_full_02", args: ["ci/registry/reg_full_02_activity_movement_completion.mjs"] }),
  Object.freeze({ key: "reg_full_03", args: ["ci/registry/reg_full_03_exercise_registry_production.mjs"] }),
  Object.freeze({ key: "registry_bundle_guard", args: ["ci/guards/registry_bundle_guard.mjs"] }),
  Object.freeze({ key: "v1_registry_fk_closure", args: ["ci/guards/s_v1_24_registry_load_order_fk_closure_guard.mjs"] })
]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readJson(root, rel) {
  return JSON.parse(fs.readFileSync(path.join(root, ...rel.split("/")), "utf8"));
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sameJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function push(errors, code, detail) {
  errors.push({ code, detail });
}

function canonicalBundleText(root) {
  const index = readJson(root, REGISTRY_INDEX);
  if (!isObject(index) || typeof index.version !== "string" || !Array.isArray(index.order)) {
    throw new Error("registry_index invalid");
  }
  const registries = {};
  for (const name of index.order) {
    const rel = `registries/${name}/${name}.registry.json`;
    registries[name] = readJson(root, rel);
  }
  return stableJson({
    version: index.version,
    note: "generated bundle (do not hand edit)",
    registries
  });
}

export function auditBundleDeterminism(root, errors = []) {
  const index = readJson(root, REGISTRY_INDEX);
  const actualText = fs.readFileSync(path.join(root, ...REGISTRY_BUNDLE.split("/")), "utf8").replace(/\r\n/g, "\n");
  const expectedTextA = canonicalBundleText(root);
  const expectedTextB = canonicalBundleText(root);
  if (expectedTextA !== expectedTextB) push(errors, "BUNDLE_REMATERIALIZATION_NONDETERMINISTIC", true);
  if (actualText !== expectedTextA) push(errors, "BUNDLE_DRIFT", REGISTRY_BUNDLE);
  let bundle = null;
  try { bundle = JSON.parse(actualText); }
  catch (error) { push(errors, "BUNDLE_JSON_INVALID", error?.message ?? String(error)); }
  const keys = isObject(bundle?.registries) ? Object.keys(bundle.registries) : [];
  if (!sameJson(keys, index.order)) push(errors, "BUNDLE_ORDER", { expected: index.order, actual: keys });
  return {
    registry_count: Array.isArray(index.order) ? index.order.length : 0,
    bundle_rebuild_result: actualText === expectedTextA ? "byte_identical" : "drift"
  };
}

function rowsForSpec(root, spec, errors, sourceDocumentOverrides = null) {
  const doc = sourceDocumentOverrides?.[spec.file] ?? readJson(root, spec.file);
  if (spec.header !== null && !Array.isArray(doc) && doc?.registry_id !== spec.header) {
    push(errors, "ACTIVE_SOURCE_HEADER", { file: spec.file, expected: spec.header, actual: doc?.registry_id });
  }
  let container;
  if (Array.isArray(doc)) container = doc;
  else container = doc?.entries;
  const rows = [];
  if (spec.shape === "array") {
    if (!Array.isArray(container)) {
      push(errors, "ACTIVE_SOURCE_SHAPE", { file: spec.file, expected: "array" });
      return rows;
    }
    for (let index = 0; index < container.length; index += 1) {
      const row = container[index];
      if (!isObject(row)) { push(errors, "ACTIVE_SOURCE_ROW", { file: spec.file, index }); continue; }
      rows.push({ location: `${spec.file}:${index}`, id: row[spec.pk], row });
    }
    return rows;
  }
  if (!isObject(container)) {
    push(errors, "ACTIVE_SOURCE_SHAPE", { file: spec.file, expected: "object" });
    return rows;
  }
  for (const [key, row] of Object.entries(container)) {
    if (!isObject(row)) { push(errors, "ACTIVE_SOURCE_ROW", { file: spec.file, key }); continue; }
    rows.push({ location: `${spec.file}:${key}`, id: row[spec.pk] ?? key, key, row });
  }
  return rows;
}

function candidateOnly(row) {
  if (row?.candidate_only === true) return true;
  for (const [key, value] of Object.entries(row ?? {})) {
    if (CANDIDATE_STATUS_FIELDS.has(key) && typeof value === "string" && CANDIDATE_STATUS_VALUES.has(value.toLowerCase())) return true;
    if (/notes?$/u.test(key) && typeof value === "string" && /\bcandidate\s+only\b/iu.test(value)) return true;
  }
  return false;
}

function operativeValue(value) {
  if (value === null || value === undefined || value === false || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function collectPolicyFindings(value, location, findings) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectPolicyFindings(item, `${location}[${index}]`, findings));
    return;
  }
  if (!isObject(value)) return;
  for (const [key, child] of Object.entries(value)) {
    const next = `${location}.${key}`;
    if (OPERATIVE_FALLBACK_FIELDS.has(key) && operativeValue(child)) findings.fallbacks.push({ location: next, value: child });
    if (typeof child === "string" && /(?:^|[_-])(?:fallback|catch_all|closest)(?:[_-]|$)/iu.test(child) && /(?:^|_)id$/u.test(key)) {
      findings.fallbacks.push({ location: next, value: child });
    }
    if ((key === "activity_id" || key.endsWith("_activity_id")) && typeof child === "string" && !REG_FULL_09_SUPPORTED_ACTIVITIES.includes(child)) {
      findings.unsupportedActivities.push({ location: next, value: child });
    }
    if ((key === "activity_ids" || key.endsWith("_activity_ids") || key === "activity_applicability" || key === "secondary_activity_applicability") && Array.isArray(child)) {
      for (const activityId of child) {
        if (typeof activityId === "string" && !REG_FULL_09_SUPPORTED_ACTIVITIES.includes(activityId)) findings.unsupportedActivities.push({ location: next, value: activityId });
      }
    }
    collectPolicyFindings(child, next, findings);
  }
}

export function auditActiveRecordPolicies(root, errors = [], sourceDocumentOverrides = null) {
  const findings = { duplicateIds: [], candidateOnly: [], fallbacks: [], unsupportedActivities: [] };
  const specs = [...REG_FULL_08_GUARD_SOURCE_SPECS, COPY_OUTPUT_SPEC];
  for (const spec of specs) {
    const rows = rowsForSpec(root, spec, errors, sourceDocumentOverrides);
    const seen = new Set();
    for (const item of rows) {
      if (typeof item.id !== "string" || item.id.length === 0) {
        findings.duplicateIds.push({ location: item.location, reason: "missing_primary_key", primary_key: spec.pk });
        continue;
      }
      if (seen.has(item.id)) findings.duplicateIds.push({ location: item.location, id: item.id });
      seen.add(item.id);
      if (item.key !== undefined && item.row[spec.pk] !== item.key) {
        findings.duplicateIds.push({ location: item.location, id: item.id, reason: "object_key_primary_key_mismatch", object_key: item.key });
      }
      if (candidateOnly(item.row)) findings.candidateOnly.push({ location: item.location, id: item.id });
      collectPolicyFindings(item.row, item.location, findings);
    }
  }
  if (findings.duplicateIds.length) push(errors, "DUPLICATE_OR_INVALID_ID", findings.duplicateIds.slice(0, 25));
  if (findings.candidateOnly.length) push(errors, "CANDIDATE_ONLY_ACTIVE_RECORD", findings.candidateOnly.slice(0, 25));
  if (findings.fallbacks.length) push(errors, "OPERATIVE_FALLBACK", findings.fallbacks.slice(0, 25));
  if (findings.unsupportedActivities.length) push(errors, "UNSUPPORTED_ACTIVITY", findings.unsupportedActivities.slice(0, 25));
  return {
    duplicate_id_count: findings.duplicateIds.length,
    candidate_only_active_record_count: findings.candidateOnly.length,
    fallback_count: findings.fallbacks.length,
    unsupported_activity_count: findings.unsupportedActivities.length
  };
}

function preferredAuthoritySpecs() {
  const candidates = [...REG_FULL_08_GUARD_SOURCE_SPECS, COPY_OUTPUT_SPEC];
  const rank = { authoritative: 3, compatibility_projection: 2, compatibility_runtime: 1 };
  const byRegistry = new Map();
  for (const spec of candidates) {
    const current = byRegistry.get(spec.registry);
    if (!current || (rank[spec.authority] ?? 0) > (rank[current.authority] ?? 0)) byRegistry.set(spec.registry, spec);
  }
  return byRegistry;
}

function fieldOccurrences(value, fieldName, out = []) {
  if (Array.isArray(value)) {
    for (const item of value) fieldOccurrences(item, fieldName, out);
    return out;
  }
  if (!isObject(value)) return out;
  for (const [key, child] of Object.entries(value)) {
    if (key === fieldName) out.push(child);
    fieldOccurrences(child, fieldName, out);
  }
  return out;
}

function sourceIsLegacyProjection(schema, source) {
  const projection = schema?.legacy_runtime_projection;
  return isObject(projection)
    && projection.authority === "compatibility_only"
    && projection.data_path === source?.spec?.file;
}

export function auditDeclaredForeignKeys(root, schemaManifest, errors = []) {
  const byRegistry = preferredAuthoritySpecs();
  const rowsets = new Map();
  for (const [registryId, spec] of byRegistry) {
    const localErrors = [];
    const rows = rowsForSpec(root, spec, localErrors);
    for (const error of localErrors) push(errors, error.code, error.detail);
    const ids = new Set();
    for (const item of rows) if (typeof item.id === "string" && item.id.length > 0) ids.add(item.id);
    rowsets.set(registryId, { spec, rows, ids });
  }

  const schemaRows = Array.isArray(schemaManifest?.registries) ? schemaManifest.registries : [];
  const closedSchemas = schemaRows.filter((row) => row?.row_contract_status === "closed");
  const closedIds = closedSchemas.map((row) => row.canonical_registry_id).sort((a, b) => a.localeCompare(b));
  const materializedIds = [...rowsets.keys()].filter((id) => closedIds.includes(id)).sort((a, b) => a.localeCompare(b));

  let declaredFkFieldCount = 0;
  let fkReferenceCount = 0;
  let orphanRelationshipCount = 0;
  for (const schema of closedSchemas) {
    const source = rowsets.get(schema.canonical_registry_id);
    if (!source) continue;
    for (const fk of schema.fk_fields ?? []) {
      const rowOccurrences = source.rows.map((item) => ({ item, occurrences: fieldOccurrences(item.row, fk.field) }));
      const representedByMaterializedSource = rowOccurrences.some(({ occurrences }) => occurrences.length > 0);
      if (sourceIsLegacyProjection(schema, source) && !representedByMaterializedSource) continue;

      declaredFkFieldCount += 1;
      const target = rowsets.get(fk.target_registry_id);
      for (const { item, occurrences } of rowOccurrences) {
        if (fk.required === true && occurrences.length === 0) {
          orphanRelationshipCount += 1;
          push(errors, "REQUIRED_FK_FIELD_MISSING", { registry: schema.canonical_registry_id, record_id: item.id, field: fk.field });
          continue;
        }
        for (const occurrence of occurrences) {
          const values = fk.cardinality === "many" ? occurrence : [occurrence];
          if (fk.cardinality === "many" && !Array.isArray(occurrence)) {
            orphanRelationshipCount += 1;
            push(errors, "FK_CARDINALITY", { registry: schema.canonical_registry_id, record_id: item.id, field: fk.field, expected: "many" });
            continue;
          }
          for (const value of values) {
            fkReferenceCount += 1;
            if (typeof value !== "string" || value.length === 0 || !target?.ids.has(value)) {
              orphanRelationshipCount += 1;
              push(errors, "ORPHAN_RELATIONSHIP", {
                registry: schema.canonical_registry_id,
                record_id: item.id,
                field: fk.field,
                value,
                target_registry: fk.target_registry_id
              });
            }
          }
        }
      }
    }
  }

  return {
    closed_materialized_registry_count: materializedIds.length,
    declared_fk_field_count: declaredFkFieldCount,
    fk_reference_count: fkReferenceCount,
    orphan_relationship_count: orphanRelationshipCount
  };
}

function dormantCandidateCount(root, surfaceManifest) {
  const paths = new Set();
  for (const entity of surfaceManifest?.entities ?? []) {
    if (entity?.classification !== "dormant") continue;
    for (const rel of entity?.current_state?.repo_paths ?? []) paths.add(rel);
  }
  let count = 0;
  for (const rel of [...paths].sort((a, b) => a.localeCompare(b))) {
    const abs = path.join(root, ...rel.split("/"));
    if (!fs.existsSync(abs)) continue;
    const doc = readJson(root, rel);
    const container = doc?.entries;
    const rows = Array.isArray(container) ? container : isObject(container) ? Object.values(container) : [];
    for (const row of rows) if (isObject(row) && candidateOnly(row)) count += 1;
  }
  return count;
}

function childGate(root, spec, errors) {
  try {
    execFileSync(process.execPath, spec.args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return "PASS";
  } catch (error) {
    const detail = `${error?.stdout ?? ""}${error?.stderr ?? ""}`.trim();
    push(errors, "DEPENDENCY_GATE", { gate: spec.key, detail: detail.slice(0, 4000) });
    return "FAIL";
  }
}

function dependencyGates(root, errors) {
  const gates = {};
  for (const spec of CHILD_GATES) gates[spec.key] = childGate(root, spec, errors);

  const surfaceManifest = readRegFull01Json(root, SURFACE_MANIFEST);
  const schemaManifest = readRegFull01Json(root, SCHEMA_MANIFEST);
  const manifestResult = validateSchemaManifest(schemaManifest, surfaceManifest);
  const repoResult = auditRegFull01Repository(root, schemaManifest, surfaceManifest);
  if (!manifestResult.ok || !repoResult.ok) push(errors, "REG_FULL_01", [...manifestResult.errors, ...repoResult.errors].slice(0, 50));
  gates.reg_full_01 = manifestResult.ok && repoResult.ok ? "PASS" : "FAIL";

  const reg04 = auditRegFull04(root);
  if (!reg04.ok) push(errors, "REG_FULL_04", reg04.errors.slice(0, 50));
  gates.reg_full_04 = reg04.ok ? "PASS" : "FAIL";

  let reg06 = null;
  try { reg06 = runRegFull06Closure(root); gates.reg_full_06 = "PASS"; }
  catch (error) { push(errors, "REG_FULL_06", error?.errors ?? error?.message ?? String(error)); gates.reg_full_06 = "FAIL"; }

  const reg07Docs = loadRegFull07Documents(root);
  const reg07 = auditRegFull07Documents(reg07Docs, root);
  if (!reg07.ok) push(errors, "REG_FULL_07", reg07.errors.slice(0, 50));
  gates.reg_full_07 = reg07.ok ? "PASS" : "FAIL";

  const reg08 = validateRegFull08Closure({ repoRoot: root });
  if (!reg08.ok) push(errors, "REG_FULL_08", reg08.errors.slice(0, 50));
  gates.reg_full_08 = reg08.ok ? "PASS" : "FAIL";

  return { gates, surfaceManifest, schemaManifest, reg04, reg06, reg07, reg08 };
}

function checkStatus(ok) { return ok ? "PASS" : "FAIL"; }

export function computeRegFull09Acceptance(root = process.cwd()) {
  const errors = [];
  const bundle = auditBundleDeterminism(root, errors);
  const policies = auditActiveRecordPolicies(root, errors);
  const dependencies = dependencyGates(root, errors);
  const fkAudit = auditDeclaredForeignKeys(root, dependencies.schemaManifest, errors);
  const schemaSummary = dependencies.schemaManifest?.summary ?? {};
  const activityDoc = readJson(root, "registries/activity/activity.registry.json");
  const supportedActivityIds = Object.keys(isObject(activityDoc?.entries) ? activityDoc.entries : {});
  const exactActivityScope = sameJson([...supportedActivityIds].sort(), [...REG_FULL_09_SUPPORTED_ACTIVITIES].sort());
  if (!exactActivityScope) push(errors, "SUPPORTED_ACTIVITY_SCOPE", supportedActivityIds);

  const templateSummary = dependencies.reg07?.summary ?? {};
  const substitutionCounts = dependencies.reg06?.counts ?? {};
  const copySummary = dependencies.reg08?.summary ?? {};
  const reg04Counts = dependencies.reg04?.counts ?? {};
  const requiredActive = (dependencies.surfaceManifest?.entities ?? []).filter((row) => row?.classification === "required_active").length;
  const authoritativeSchemas = Array.isArray(dependencies.schemaManifest?.registries) ? dependencies.schemaManifest.registries.length : 0;
  const schemaConflicts = Array.isArray(dependencies.schemaManifest?.schema_conflicts) ? dependencies.schemaManifest.schema_conflicts.length : -1;
  const templateCoverageGap = REG_FULL_09_SUPPORTED_ACTIVITIES.filter((activityId) => {
    if (activityId === "powerlifting") return templateSummary.powerlifting_templates !== 4;
    if (activityId === "general_strength") return templateSummary.general_strength_templates !== 3;
    if (activityId === "rugby_union") return templateSummary.rugby_union_templates !== 4;
    if (activityId === "strongman") return templateSummary.strongman_templates !== 1;
    return true;
  }).length;
  if (templateCoverageGap) push(errors, "TEMPLATE_COVERAGE_GAP", templateCoverageGap);

  const dependencyFailures = Object.values(dependencies.gates).filter((status) => status !== "PASS").length;
  const substitutionReachabilityGap = dependencies.gates.reg_full_06 === "PASS" ? 0 : 1;
  const orphanRelationships = fkAudit.orphan_relationship_count;

  const checks = {
    registry_bundle_rebuild: checkStatus(bundle.bundle_rebuild_result === "byte_identical"),
    schema_closure: checkStatus(dependencies.gates.reg_full_01 === "PASS" && requiredActive === authoritativeSchemas && schemaConflicts === 0),
    foreign_key_closure: checkStatus(orphanRelationships === 0),
    deterministic_ordering: checkStatus(bundle.bundle_rebuild_result === "byte_identical" && dependencies.gates.reg_full_06 === "PASS" && dependencies.gates.reg_full_07 === "PASS" && dependencies.gates.reg_full_08 === "PASS"),
    supported_activity_closure: checkStatus(exactActivityScope && policies.unsupported_activity_count === 0),
    candidate_only_active_closure: checkStatus(policies.candidate_only_active_record_count === 0),
    fallback_closure: checkStatus(policies.fallback_count === 0 && dependencies.gates.reg_full_06 === "PASS" && dependencies.gates.reg_full_07 === "PASS"),
    duplicate_id_closure: checkStatus(policies.duplicate_id_count === 0),
    orphan_relationship_closure: checkStatus(orphanRelationships === 0),
    programme_template_coverage: checkStatus(templateCoverageGap === 0 && templateSummary.template_count === 12),
    substitution_reachability: checkStatus(substitutionReachabilityGap === 0 && substitutionCounts.edges === REG_FULL_09_EXPECTED_SUBSTITUTION_EDGES)
  };

  const overallPass = errors.length === 0 && Object.values(checks).every((status) => status === "PASS") && dependencyFailures === 0;
  const report = {
    evidence_id: "reg_full_09_final_registry_acceptance",
    evidence_version: "1.0.0",
    slice_id: "REG-FULL-09",
    status: overallPass ? "PASS" : "FAIL",
    scope: "final_registry_acceptance",
    supported_activity_scope: [...REG_FULL_09_SUPPORTED_ACTIVITIES],
    checks,
    counts: {
      required_active_registry_count: requiredActive,
      authoritative_schema_count: authoritativeSchemas,
      schema_conflict_count: schemaConflicts,
      compact_bundle_registry_count: bundle.registry_count,
      supported_activity_count: supportedActivityIds.length,
      unsupported_activity_count: policies.unsupported_activity_count,
      candidate_only_active_record_count: policies.candidate_only_active_record_count,
      dormant_candidate_only_record_count: dormantCandidateCount(root, dependencies.surfaceManifest),
      fallback_count: policies.fallback_count,
      duplicate_id_count: policies.duplicate_id_count,
      closed_materialized_registry_count: fkAudit.closed_materialized_registry_count,
      declared_fk_field_count: fkAudit.declared_fk_field_count,
      fk_reference_count: fkAudit.fk_reference_count,
      orphan_relationship_count: orphanRelationships,
      dependency_gate_count: Object.keys(dependencies.gates).length,
      dependency_failure_count: dependencyFailures,
      exercise_count: reg04Counts.exercise_count ?? 0,
      resolved_exercise_count: reg04Counts.resolved_exercise_count ?? 0,
      equipment_compatibility_edge_count: reg04Counts.compatibility_edge_count ?? 0,
      activity_relation_pair_count: reg04Counts.activity_relation_pair_count ?? 0,
      applicability_row_count: reg04Counts.applicability_row_count ?? 0,
      programme_template_count: templateSummary.template_count ?? 0,
      powerlifting_template_count: templateSummary.powerlifting_templates ?? 0,
      general_strength_template_count: templateSummary.general_strength_templates ?? 0,
      rugby_union_template_count: templateSummary.rugby_union_templates ?? 0,
      strongman_template_count: templateSummary.strongman_templates ?? 0,
      low_equipment_template_count: templateSummary.low_equipment_templates ?? 0,
      programme_template_coverage_gap_count: templateCoverageGap,
      substitution_edge_count: substitutionCounts.edges ?? 0,
      substitution_source_count: substitutionCounts.sources ?? 0,
      substitution_target_count: substitutionCounts.targets ?? 0,
      substitution_reachability_gap_count: substitutionReachabilityGap,
      copy_source_file_count: copySummary.source_files ?? 0,
      copy_source_record_count: copySummary.source_records ?? 0,
      copy_provenance_record_count: copySummary.provenance_records ?? 0,
      exact_copy_control_count: copySummary.exact_copy_controls ?? 0
    },
    dependency_gates: dependencies.gates,
    bundle: {
      path: REGISTRY_BUNDLE,
      rebuild_result: bundle.bundle_rebuild_result
    },
    completion_statement: overallPass
      ? "REGISTRIES_FINISHED: all REG-FULL-09 final acceptance criteria pass"
      : "REGISTRIES_NOT_FINISHED: one or more REG-FULL-09 final acceptance criteria fail"
  };
  return { ok: overallPass, token: REG_FULL_09_FAILURE_TOKEN, errors, report };
}

export function validateRegFull09Closure({ repoRoot = process.cwd(), reportOverride = null } = {}) {
  const result = computeRegFull09Acceptance(repoRoot);
  const errors = [...result.errors];
  let committed = reportOverride;
  if (committed === null) {
    const abs = path.join(repoRoot, ...REG_FULL_09_REPORT.split("/"));
    if (!fs.existsSync(abs)) push(errors, "COMPLETION_REPORT_MISSING", REG_FULL_09_REPORT);
    else committed = JSON.parse(fs.readFileSync(abs, "utf8"));
  }
  if (committed !== null && !sameJson(committed, result.report)) push(errors, "COMPLETION_REPORT_DRIFT", { expected: result.report, actual: committed });
  return { ...result, ok: result.ok && errors.length === 0, errors };
}

function main() {
  const result = validateRegFull09Closure();
  if (!result.ok) {
    console.error(`${REG_FULL_09_FAILURE_TOKEN}: FAIL`);
    for (const error of result.errors) console.error(`${error.code}: ${typeof error.detail === "string" ? error.detail : JSON.stringify(error.detail)}`);
    console.error(`EXPECTED_REPORT=${JSON.stringify(result.report)}`);
    process.exit(1);
  }
  const c = result.report.counts;
  console.log(`${REG_FULL_09_FAILURE_TOKEN}: PASS registries=${c.required_active_registry_count} schemas=${c.authoritative_schema_count} bundle=${c.compact_bundle_registry_count} unsupported=${c.unsupported_activity_count} candidates=${c.candidate_only_active_record_count} fallbacks=${c.fallback_count} duplicates=${c.duplicate_id_count} orphans=${c.orphan_relationship_count} templates=${c.programme_template_count} substitutions=${c.substitution_edge_count} sources=${c.substitution_source_count} targets=${c.substitution_target_count}`);
}

const invoked = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invoked === fileURLToPath(import.meta.url)) main();