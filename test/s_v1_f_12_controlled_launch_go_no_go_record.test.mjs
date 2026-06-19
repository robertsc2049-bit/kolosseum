import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";

const JSON_PATH = "docs/releases/CONTROLLED_LAUNCH_GO_NO_GO_RECORD.json";
const MD_PATH = "docs/releases/CONTROLLED_LAUNCH_GO_NO_GO_RECORD.md";
const RUNNER_PATH = "ci/scripts/run_s_v1_f_12_controlled_launch_go_no_go_record.mjs";
const GUARD_PATH = "ci/guards/s_v1_f_12_controlled_launch_go_no_go_record_guard.mjs";
const PACKAGE_PATH = "package.json";

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function readText(path) {
  return fs.readFileSync(path, "utf8");
}

test("S-V1-F-12 go/no-go record files exist", () => {
  assert.equal(fs.existsSync(JSON_PATH), true);
  assert.equal(fs.existsSync(MD_PATH), true);
  assert.equal(fs.existsSync(RUNNER_PATH), true);
  assert.equal(fs.existsSync(GUARD_PATH), true);
});

test("S-V1-F-12 decision record is evidence based and bounded", () => {
  const record = readJson(JSON_PATH);

  assert.equal(record.schema_version, "1.0.0");
  assert.equal(record.slice_id, "S-V1-F-12");
  assert.equal(record.record_id, "controlled_launch_go_no_go_record");
  assert.equal(record.title, "Controlled Launch Go/No-Go Record");
  assert.match(record.decision, /^(GO|NO-GO)$/);
  assert.equal(record.decision_scope, "controlled_launch_only");

  assert.equal(record.decision_rules.evidence_based_decision_required, true);
  assert.equal(record.decision_rules.any_failed_required_item_means_no_go, true);
  assert.equal(record.decision_rules.incomplete_completion_wording_forbidden, true);
  assert.equal(record.decision_rules.go_scope_is_controlled_launch_only, true);
  assert.equal(record.decision_rules.go_authorises_open_availability, false);
  assert.equal(record.decision_rules.product_code_change_allowed, false);
  assert.equal(record.decision_rules.engine_behaviour_change_allowed, false);
  assert.equal(record.decision_rules.feature_implementation_allowed, false);
  assert.equal(record.decision_rules.acceptance_gate_law_change_allowed, false);
  assert.equal(record.decision_rules.release_tag_change_allowed, false);
  assert.equal(record.decision_rules.post_v1_scope_activation_allowed, false);

  assert.equal(record.boundaries.decision_record_only, true);
  assert.equal(record.boundaries.touches_product_code, false);
  assert.equal(record.boundaries.touches_engine_behaviour, false);
  assert.equal(record.boundaries.touches_feature_implementation, false);
  assert.equal(record.boundaries.changes_acceptance_gate_law, false);
  assert.equal(record.boundaries.changes_release_tag, false);
  assert.equal(record.boundaries.activates_post_v1_scope, false);
});

test("S-V1-F-12 required evidence references are present", () => {
  const record = readJson(JSON_PATH);

  assert.equal(record.release_identity.tag_name, "v1-controlled-launch");
  assert.equal(record.release_identity.expected_tag_commit, "43510e4c4d791effda647e80dc74d8452dc61f1f");
  assert.equal(record.release_identity.verified_tag_commit, "43510e4c4d791effda647e80dc74d8452dc61f1f");
  assert.equal(record.release_identity.tag_commit_match, true);

  assert.equal(record.evidence_references.final_ship_decision, "docs/releases/V1_FINAL_SHIP_DECISION.json");
  assert.equal(record.evidence_references.release_evidence_snapshot, "docs/releases/V1_RELEASE_EVIDENCE_SNAPSHOT.json");
  assert.equal(record.evidence_references.controlled_launch_execution_pack, "docs/releases/CONTROLLED_LAUNCH_EXECUTION_PACK.json");
  assert.equal(record.evidence_references.controlled_launch_smoke_run, "docs/releases/CONTROLLED_LAUNCH_SMOKE_RUN.json");
  assert.equal(record.evidence_references.controlled_launch_readiness_record, "docs/releases/CONTROLLED_LAUNCH_READINESS_RECORD.json");
  assert.equal(record.evidence_references.acceptance_gate_manifest, "docs/v1/V1_ACCEPTANCE_GATE_MANIFEST.json");

  const itemIds = new Set(record.required_items.map((item) => item.id));
  for (const id of ["GNG-001", "GNG-002", "GNG-003", "GNG-004", "GNG-005", "GNG-006", "GNG-007", "GNG-008"]) {
    assert.equal(itemIds.has(id), true, `missing required item ${id}`);
  }
});

test("S-V1-F-12 GO requires every required item to pass", () => {
  const record = readJson(JSON_PATH);

  if (record.decision === "GO") {
    assert.equal(record.blocked_reason, null);
    assert.equal(record.failed_required_items.length, 0);
    assert.equal(record.required_items.every((item) => item.required === true && item.passed === true && item.status === "pass"), true);
    assert.equal(record.source_evidence.final_ship_decision.decision, "SHIP");
    assert.equal(record.source_evidence.release_evidence_snapshot.status, "recorded");
    assert.equal(record.source_evidence.controlled_launch_execution_pack.status, "prepared");
    assert.equal(record.source_evidence.controlled_launch_smoke_run.status, "pass");
    assert.equal(record.source_evidence.controlled_launch_smoke_run.result, "pass");
    assert.equal(record.source_evidence.controlled_launch_smoke_run.failed_required_command_count, 0);
    assert.equal(record.source_evidence.controlled_launch_smoke_run.launch_blocker_recorded, false);
    return;
  }

  assert.equal(typeof record.blocked_reason, "string");
  assert.ok(record.blocked_reason.length > 0);
  assert.ok(record.failed_required_items.length > 0);
});

test("S-V1-F-12 markdown is human-readable and avoids forbidden wording", () => {
  const markdown = readText(MD_PATH);
  const lower = markdown.toLowerCase();

  assert.ok(markdown.includes("# Controlled Launch Go/No-Go Record"));
  assert.ok(markdown.includes("Slice: S-V1-F-12"));
  assert.ok(markdown.includes("Decision: GO") || markdown.includes("Decision: NO-GO"));
  assert.ok(markdown.includes("Any failed required item means NO-GO."));
  assert.ok(markdown.includes("## Required evidence items"));
  assert.ok(markdown.includes("## Decision outcome"));
  assert.ok(markdown.includes("## Boundary"));
  assert.ok(markdown.includes("## Required proof"));

  for (const forbiddenPhrase of [
    "partial-complete",
    "partial complete",
    "partially complete",
    "partially-complete",
    "almost complete",
    "nearly complete",
    "mostly complete",
    "guaranteed outcome",
    "guarantees outcomes",
    "athlete clearance",
    "coach clearance",
    "return to play",
    "return-to-play",
    "return to run",
    "return-to-run",
    "fitness for duty",
    "fitness-for-duty",
    "recommended programme",
    "optimal programme"
  ]) {
    assert.equal(lower.includes(forbiddenPhrase), false, forbiddenPhrase);
  }
});

test("S-V1-F-12 claim boundary remains false", () => {
  const record = readJson(JSON_PATH);

  for (const [key, value] of Object.entries(record.claim_boundary)) {
    assert.equal(value, false, key);
  }
});

test("S-V1-F-12 package proof script is wired", () => {
  const pkg = readJson(PACKAGE_PATH);
  const proof = "node --test test/s_v1_f_12_controlled_launch_go_no_go_record.test.mjs && node ci/guards/s_v1_f_12_controlled_launch_go_no_go_record_guard.mjs && node ci/scripts/run_s_v1_f_12_controlled_launch_go_no_go_record.mjs --check";

  assert.equal(pkg.scripts["proof:s-v1-f-12"], proof);
  assert.equal(pkg.scripts["acceptance:v1:go-no-go:check"], "node ci/scripts/run_s_v1_f_12_controlled_launch_go_no_go_record.mjs --check");
  assert.ok(pkg.scripts["lint:fast"].includes(proof));
  assert.ok(pkg.scripts["lint:fast:inline"].includes(proof));
});

test("S-V1-F-12 runner check passes", () => {
  const result = spawnSync(process.execPath, [RUNNER_PATH, "--check"], {
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /S-V1-F-12 CONTROLLED_LAUNCH_GO_NO_GO_CHECK_PASS/);
});
