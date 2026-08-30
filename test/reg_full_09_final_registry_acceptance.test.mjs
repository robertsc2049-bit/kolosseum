import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";

import {
  REG_FULL_09_REPORT,
  auditActiveRecordPolicies,
  computeRegFull09Acceptance
} from "../ci/registry/reg_full_09_final_registry_acceptance.mjs";

const root = process.cwd();
const live = computeRegFull09Acceptance(root);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(root, ...rel.split("/")), "utf8"));
}

function mutatedActivity(mutator) {
  const rel = "registries/activity/activity.registry.json";
  const doc = clone(readJson(rel));
  mutator(doc.entries);
  const errors = [];
  const counts = auditActiveRecordPolicies(root, errors, { [rel]: doc });
  return { counts, errors };
}

test("REG-FULL-09 final registry acceptance is green and the committed report is exact", () => {
  assert.equal(live.ok, true, JSON.stringify({ errors: live.errors, expected_report: live.report }, null, 2));
  assert.equal(live.report.status, "PASS");
  assert.equal(live.report.completion_statement, "REGISTRIES_FINISHED: all REG-FULL-09 final acceptance criteria pass");
  const reportPath = path.join(root, ...REG_FULL_09_REPORT.split("/"));
  assert.equal(fs.existsSync(reportPath), true, JSON.stringify({ missing: REG_FULL_09_REPORT, expected_report: live.report }, null, 2));
  const committed = readJson(REG_FULL_09_REPORT);
  assert.deepEqual(committed, live.report);
});

test("REG-FULL-09 reports the exact final closure counts", () => {
  const c = live.report.counts;
  assert.equal(c.required_active_registry_count, 25);
  assert.equal(c.authoritative_schema_count, 25);
  assert.equal(c.schema_conflict_count, 0);
  assert.equal(c.compact_bundle_registry_count, 12);
  assert.equal(c.supported_activity_count, 3);
  assert.equal(c.unsupported_activity_count, 0);
  assert.equal(c.candidate_only_active_record_count, 0);
  assert.equal(c.dormant_candidate_only_record_count, 5);
  assert.equal(c.fallback_count, 0);
  assert.equal(c.duplicate_id_count, 0);
  assert.equal(c.orphan_relationship_count, 0);
  assert.ok(c.closed_materialized_registry_count > 0);
  assert.ok(c.declared_fk_field_count > 0);
  assert.ok(c.fk_reference_count > 0);
  assert.equal(c.dependency_gate_count, 10);
  assert.equal(c.dependency_failure_count, 0);
  assert.equal(c.exercise_count, 215);
  assert.equal(c.resolved_exercise_count, 215);
  assert.equal(c.equipment_compatibility_edge_count, 396);
  assert.equal(c.activity_relation_pair_count, 595);
  assert.equal(c.applicability_row_count, 1785);
  assert.equal(c.programme_template_count, 11);
  assert.equal(c.powerlifting_template_count, 4);
  assert.equal(c.general_strength_template_count, 3);
  assert.equal(c.rugby_union_template_count, 4);
  assert.equal(c.low_equipment_template_count, 2);
  assert.equal(c.programme_template_coverage_gap_count, 0);
  assert.equal(c.substitution_edge_count, 736);
  assert.equal(c.substitution_source_count, 190);
  assert.equal(c.substitution_target_count, 192);
  assert.equal(c.substitution_reachability_gap_count, 0);
  assert.equal(c.copy_source_file_count, 18);
  assert.equal(c.copy_source_record_count, 3383);
  assert.equal(c.copy_provenance_record_count, 3383);
  assert.equal(c.exact_copy_control_count, 5499);
});

test("REG-FULL-09 rebuilds registry_bundle.json twice with byte-identical output", () => {
  const bundlePath = path.join(root, "registries", "registry_bundle.json");
  const before = fs.readFileSync(bundlePath);
  execFileSync(process.execPath, ["scripts/bundle_writer.cjs"], { cwd: root, stdio: "pipe" });
  const once = fs.readFileSync(bundlePath);
  execFileSync(process.execPath, ["scripts/bundle_writer.cjs"], { cwd: root, stdio: "pipe" });
  const twice = fs.readFileSync(bundlePath);
  assert.deepEqual(once, before);
  assert.deepEqual(twice, once);
});

test("REG-FULL-09 fails closed on an unsupported active activity reference", () => {
  const result = mutatedActivity((entries) => {
    entries.powerlifting.secondary_activity_applicability = ["unsupported_activity"];
  });
  assert.equal(result.counts.unsupported_activity_count, 1);
  assert.ok(result.errors.some((row) => row.code === "UNSUPPORTED_ACTIVITY"));
});

test("REG-FULL-09 fails closed on a candidate-only active record", () => {
  const result = mutatedActivity((entries) => {
    entries.powerlifting.copy_boundary_notes = "candidate only";
  });
  assert.equal(result.counts.candidate_only_active_record_count, 1);
  assert.ok(result.errors.some((row) => row.code === "CANDIDATE_ONLY_ACTIVE_RECORD"));
});

test("REG-FULL-09 fails closed on an operative fallback", () => {
  const result = mutatedActivity((entries) => {
    entries.powerlifting.fallback_exercise_id = "back_squat";
  });
  assert.equal(result.counts.fallback_count, 1);
  assert.ok(result.errors.some((row) => row.code === "OPERATIVE_FALLBACK"));
});

test("REG-FULL-09 fails closed on duplicate or mismatched primary IDs", () => {
  const result = mutatedActivity((entries) => {
    entries.general_strength.activity_id = "powerlifting";
  });
  assert.ok(result.counts.duplicate_id_count >= 1);
  assert.ok(result.errors.some((row) => row.code === "DUPLICATE_OR_INVALID_ID"));
});
