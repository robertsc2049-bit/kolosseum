import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const recordPath = path.join(ROOT, "docs/releases/CONTROLLED_LAUNCH_EXECUTION_PACK.json");
const markdownPath = path.join(ROOT, "docs/releases/CONTROLLED_LAUNCH_EXECUTION_PACK.md");
const packagePath = path.join(ROOT, "package.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

test("S-V1-F-09 controlled launch execution pack files exist", () => {
  assert.ok(fs.existsSync(recordPath));
  assert.ok(fs.existsSync(markdownPath));
});

test("S-V1-F-09 records the required post-tag release identity", () => {
  const record = readJson(recordPath);

  assert.equal(record.slice_id, "S-V1-F-09");
  assert.equal(record.record_id, "controlled_launch_execution_pack");
  assert.equal(record.status, "prepared");
  assert.equal(record.scope, "controlled_launch_only");
  assert.equal(record.release_identity.tag_name, "v1-controlled-launch");
  assert.equal(record.release_identity.tag_commit, "43510e4c4d791effda647e80dc74d8452dc61f1f");
  assert.equal(record.release_identity.release_evidence_snapshot, "docs/releases/V1_RELEASE_EVIDENCE_SNAPSHOT.json");
  assert.equal(record.release_identity.final_ship_decision, "docs/releases/V1_FINAL_SHIP_DECISION.json");
  assert.equal(record.release_identity.controlled_launch_readiness_record, "docs/releases/CONTROLLED_LAUNCH_READINESS_RECORD.json");
});

test("S-V1-F-09 has one operator-facing checklist and one evidence capture path", () => {
  const record = readJson(recordPath);

  assert.ok(Array.isArray(record.operator_checklist));
  assert.ok(record.operator_checklist.length >= 10);
  assert.ok(record.operator_checklist.some((entry) => entry.id === "CLX-001"));
  assert.ok(record.operator_checklist.some((entry) => entry.id === "CLX-012"));
  assert.ok(record.operator_checklist.every((entry) => typeof entry.evidence === "string" && entry.evidence.length > 0));

  assert.ok(Array.isArray(record.evidence_capture_path));
  assert.ok(record.evidence_capture_path.length >= 8);
  assert.ok(record.evidence_capture_path.some((entry) => entry.evidence === "release_tag"));
  assert.ok(record.evidence_capture_path.some((entry) => entry.evidence === "release_evidence_snapshot"));
  assert.ok(record.evidence_capture_path.some((entry) => entry.evidence === "final_ship_decision"));
  assert.ok(record.evidence_capture_path.some((entry) => entry.evidence === "controlled_launch_readiness_record"));
  assert.ok(record.evidence_capture_path.some((entry) => entry.evidence === "founder_test_pack"));
});

test("S-V1-F-09 does not mark v1 live or alter product authority", () => {
  const record = readJson(recordPath);

  assert.equal(record.launch_start_rule.this_pack_marks_v1_live, false);
  assert.equal(record.launch_start_rule.this_pack_changes_product_state, false);
  assert.ok(record.launch_start_rule.may_start_only_when.includes("release_tag_exists_locally_and_remotely"));
  assert.ok(record.launch_start_rule.may_start_only_when.includes("release_evidence_snapshot_exists"));
  assert.ok(record.launch_start_rule.may_start_only_when.includes("final_ship_decision_records_ship"));
  assert.ok(record.launch_start_rule.may_start_only_when.includes("controlled_launch_readiness_record_is_completed_by_operator"));

  assert.equal(record.boundaries.operational_evidence_only, true);
  assert.equal(record.boundaries.creates_product_code, false);
  assert.equal(record.boundaries.changes_engine_behaviour, false);
  assert.equal(record.boundaries.changes_feature_implementation, false);
  assert.equal(record.boundaries.changes_onboarding_logic, false);
  assert.equal(record.boundaries.changes_pricing_logic, false);
  assert.equal(record.boundaries.creates_marketplace_scope, false);
  assert.equal(record.boundaries.creates_organisation_scope, false);
  assert.equal(record.boundaries.creates_gym_scope, false);
  assert.equal(record.boundaries.creates_team_scope, false);
  assert.equal(record.boundaries.creates_federation_scope, false);
  assert.equal(record.boundaries.creates_enterprise_dashboard_scope, false);
  assert.equal(record.boundaries.creates_messaging_scope, false);
  assert.equal(record.boundaries.creates_commercial_claims, false);
});

test("S-V1-F-09 records a launch-blocking defect path", () => {
  const record = readJson(recordPath);
  const defectPath = record.launch_blocking_defect_path;

  assert.equal(defectPath.engine_mutation_allowed, false);
  assert.equal(defectPath.scope_widening_allowed, false);
  assert.match(defectPath.operator_action, /stop new starts/);
  assert.ok(defectPath.required_record_fields.includes("defect_id"));
  assert.ok(defectPath.required_record_fields.includes("closure_reference"));
});

test("S-V1-F-09 markdown contains required operational sections and factual references", () => {
  const markdown = readText(markdownPath);

  assert.ok(markdown.includes("# Controlled Launch Execution Pack"));
  assert.ok(markdown.includes("Slice: S-V1-F-09"));
  assert.ok(markdown.includes("## Operator-facing checklist"));
  assert.ok(markdown.includes("## Controlled launch evidence path"));
  assert.ok(markdown.includes("## Founding user account setup instructions"));
  assert.ok(markdown.includes("## Founder test instructions"));
  assert.ok(markdown.includes("## Support and defect route references"));
  assert.ok(markdown.includes("docs/releases/CONTROLLED_LAUNCH_READINESS_RECORD.md"));
  assert.ok(markdown.includes("docs/releases/V1_FINAL_SHIP_DECISION.md"));
  assert.ok(markdown.includes("docs/releases/V1_RELEASE_EVIDENCE_SNAPSHOT.md"));
  assert.ok(markdown.includes("v1-controlled-launch"));
  assert.ok(markdown.includes("This pack does not mark v1 live by itself."));
});

test("S-V1-F-09 remains claim-bounded and non-scope bounded", () => {
  const record = readJson(recordPath);
  const markdown = readText(markdownPath);

  for (const value of Object.values(record.claim_boundary)) {
    assert.equal(value, false);
  }

  for (const forbidden of [
    "marketplace",
    "organisations",
    "gyms",
    "teams",
    "federations",
    "enterprise_dashboards",
    "messaging",
    "post_v1_scope"
  ]) {
    assert.ok(record.forbidden_scope.includes(forbidden));
  }

  for (const forbiddenPhrase of [
    "guaranteed outcome",
    "guarantees outcomes",
    "certified use",
    "athlete clearance",
    "coach clearance",
    "external approval",
    "return to play",
    "return-to-play",
    "return to run",
    "return-to-run",
    "fitness for duty",
    "fitness-for-duty"
  ]) {
    assert.equal(markdown.toLowerCase().includes(forbiddenPhrase), false, forbiddenPhrase);
  }
});

test("S-V1-F-09 package proof script is wired", () => {
  const pkg = readJson(packagePath);

  assert.ok(pkg.scripts["proof:s-v1-f-09"].includes("test/s_v1_f_09_controlled_launch_execution_pack.test.mjs"));
  assert.ok(pkg.scripts["proof:s-v1-f-09"].includes("ci/guards/s_v1_f_09_controlled_launch_execution_pack_guard.mjs"));
  assert.ok(pkg.scripts["lint:fast"].includes("test/s_v1_f_09_controlled_launch_execution_pack.test.mjs"));
  assert.ok(pkg.scripts["lint:fast"].includes("ci/guards/s_v1_f_09_controlled_launch_execution_pack_guard.mjs"));
  assert.ok(pkg.scripts["lint:fast:inline"].includes("test/s_v1_f_09_controlled_launch_execution_pack.test.mjs"));
  assert.ok(pkg.scripts["lint:fast:inline"].includes("ci/guards/s_v1_f_09_controlled_launch_execution_pack_guard.mjs"));
});
