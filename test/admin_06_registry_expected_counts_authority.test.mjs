import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";

import {
  REGISTRY_EXPECTED_COUNTS_PATH,
  auditRegistryExpectedCountsSnapshot,
  buildRegistryExpectedCountsSnapshot,
  deriveRegistryExpectedCountsFromDocuments,
  loadRegistryExpectedCountSourceDocuments,
  loadRegistryExpectedCounts,
  serializeRegistryExpectedCountsSnapshot,
  validateRegistryExpectedCountsSnapshot
} from "../ci/registry/registry_expected_counts.mjs";
import {
  auditRegFull04Documents,
  loadRegFull04Documents
} from "../ci/registry/reg_full_04_equipment_compatibility_applicability_closure.mjs";
import {
  auditRegFull06Documents,
  loadRegFull06Documents
} from "../ci/registry/reg_full_06_substitution_graph_closure.mjs";
import {
  auditActiveRecordPolicies,
  computeRegFull09Acceptance
} from "../ci/registry/reg_full_09_final_registry_acceptance.mjs";

const root = process.cwd();

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function read(rel) {
  return fs.readFileSync(path.join(root, ...rel.split("/")), "utf8");
}

function errorCodes(result) {
  return new Set(result.errors.map((row) => row.code));
}

test("ADMIN-06 committed expected-count snapshot is the byte-exact canonical derivation", () => {
  const generated = buildRegistryExpectedCountsSnapshot(root);
  const committed = read(REGISTRY_EXPECTED_COUNTS_PATH).replace(/\r\n/g, "\n");
  assert.equal(committed, serializeRegistryExpectedCountsSnapshot(generated));
  const audit = validateRegistryExpectedCountsSnapshot(root);
  assert.equal(audit.ok, true, JSON.stringify(audit.errors, null, 2));
  execFileSync(process.execPath, ["scripts/materialize_registry_expected_counts.mjs", "--check"], { cwd: root, stdio: "pipe" });
});

test("ADMIN-06 canonical registry change without count rematerialization fails closed", () => {
  const documents = clone(loadRegistryExpectedCountSourceDocuments(root));
  const firstExercise = Object.values(documents.exercise.entries)[0];
  assert.ok(firstExercise);
  documents.exercise.entries.__admin06_unmaterialized_exercise = {
    ...firstExercise,
    exercise_id: "__admin06_unmaterialized_exercise"
  };

  const derived = deriveRegistryExpectedCountsFromDocuments(documents);
  const snapshot = loadRegistryExpectedCounts(root);
  const audit = auditRegistryExpectedCountsSnapshot(snapshot, derived);
  assert.equal(audit.ok, false);
  assert.ok(audit.errors.some((row) => row.code === "SNAPSHOT_STALE" && row.detail.count === "exercise_count"));
});

test("ADMIN-06 changing the count snapshot alone cannot fake acceptance", () => {
  const derived = deriveRegistryExpectedCountsFromDocuments(loadRegistryExpectedCountSourceDocuments(root));
  const fake = clone(loadRegistryExpectedCounts(root));
  fake.counts.exercise_count += 1;
  fake.counts.substitution_edge_count += 1;

  const audit = auditRegistryExpectedCountsSnapshot(fake, derived);
  assert.equal(audit.ok, false);
  assert.ok(audit.errors.some((row) => row.code === "SNAPSHOT_STALE" && row.detail.count === "exercise_count"));
  assert.ok(audit.errors.some((row) => row.code === "SNAPSHOT_STALE" && row.detail.count === "substitution_edge_count"));
});

test("ADMIN-06 duplicate primary IDs still fail closed", () => {
  const rel = "registries/activity/activity.registry.json";
  const activity = clone(loadRegistryExpectedCountSourceDocuments(root).activity);
  activity.entries.general_strength.activity_id = "powerlifting";
  const errors = [];
  const counts = auditActiveRecordPolicies(root, errors, { [rel]: activity });
  assert.ok(counts.duplicate_id_count >= 1);
  assert.ok(errors.some((row) => row.code === "DUPLICATE_OR_INVALID_ID"));
});

test("ADMIN-06 orphan relationships still fail closed", () => {
  const docs = clone(loadRegFull04Documents(root));
  const source = Object.values(docs.compatibility.entries).find((row) => row?.compatibility_type === "required");
  assert.ok(source);
  const key = `__admin06_orphan_exercise__${source.equipment_id}`;
  docs.compatibility.entries[key] = {
    ...source,
    compatibility_id: key,
    exercise_id: "__admin06_orphan_exercise"
  };
  const result = auditRegFull04Documents(docs);
  assert.equal(result.ok, false);
  assert.equal(errorCodes(result).has("COMPATIBILITY_EXERCISE_FK"), true);
  assert.equal(errorCodes(result).has("ORPHAN_EQUIPMENT_RELATION"), true);
});

test("ADMIN-06 missing applicability still fails closed", () => {
  const docs = clone(loadRegFull04Documents(root));
  delete docs.applicability.entries.back_squat__powerlifting__training;
  const result = auditRegFull04Documents(docs);
  assert.equal(result.ok, false);
  assert.equal(errorCodes(result).has("APPLICABILITY_COUNT"), true);
  assert.equal(errorCodes(result).has("ACTIVITY_CONTEXT_CLOSURE"), true);
});

test("ADMIN-06 substitution graph drift still fails closed", () => {
  const docs = clone(loadRegFull06Documents(root));
  const firstEdge = Object.keys(docs.substitution.entries)[0];
  assert.ok(firstEdge);
  delete docs.substitution.entries[firstEdge];
  const result = auditRegFull06Documents(docs);
  assert.equal(result.ok, false);
  assert.equal(errorCodes(result).has("SUBSTITUTION_COUNT"), true);
  assert.equal(errorCodes(result).has("CANDIDATE_SET_CLOSURE"), true);
});

test("ADMIN-06 REG-FULL-09 still independently aggregates child-gate PASS state", () => {
  const result = computeRegFull09Acceptance(root);
  assert.equal(result.ok, true, JSON.stringify(result.errors, null, 2));
  assert.equal(result.report.checks.registry_expected_count_authority, "PASS");
  assert.equal(result.report.counts.dependency_failure_count, 0);
  assert.equal(result.report.counts.dependency_gate_count, Object.keys(result.report.dependency_gates).length);
  for (const [gate, state] of Object.entries(result.report.dependency_gates)) {
    assert.equal(state, "PASS", `${gate} must independently report PASS`);
  }
});

test("ADMIN-06 migrated REG-FULL surfaces contain no duplicate production-total literals", () => {
  const files = [
    "ci/registry/reg_full_03_exercise_registry_production.mjs",
    "ci/registry/reg_full_04_equipment_compatibility_applicability_closure.mjs",
    "ci/registry/reg_full_06_substitution_graph_closure.mjs",
    "ci/registry/reg_full_09_final_registry_acceptance.mjs",
    "scripts/reg_full_04_materialize_relations.mjs",
    "test/reg_full_06_substitution_graph_closure.test.mjs",
    "test/reg_full_07_programme_template_production.test.mjs",
    "test/reg_full_09_final_registry_acceptance.test.mjs"
  ];
  const forbidden = [
    /EXPECTED_EXERCISE_COUNT\s*=\s*244/,
    /EXPECTED_APPLICABILITY_COUNT\s*=\s*2028/,
    /Object\.keys\(ex(?:ercises)?\)\.length\s*!==\s*244/,
    /Object\.keys\(mv\)\.length\s*!==\s*54/,
    /REG_FULL_09_EXPECTED_SUBSTITUTION_EDGES/,
    /templateSummary\.template_count\s*===\s*14/,
    /result\.counts\.exercises\s*,\s*244/,
    /result\.counts\.movements\s*,\s*54/,
    /copy_source_record_count\s*,\s*3946/,
    /exact_copy_control_count\s*,\s*6366/
  ];

  for (const rel of files) {
    const text = read(rel);
    for (const pattern of forbidden) assert.equal(pattern.test(text), false, `${rel} still matches ${pattern}`);
  }
});
