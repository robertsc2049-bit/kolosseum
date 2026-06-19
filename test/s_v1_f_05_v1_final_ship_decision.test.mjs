import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";

const JSON_PATH = "docs/releases/V1_FINAL_SHIP_DECISION.json";
const MD_PATH = "docs/releases/V1_FINAL_SHIP_DECISION.md";

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function readText(path) {
  return fs.readFileSync(path, "utf8");
}

test("S-V1-F-05 final ship decision files exist", () => {
  assert.equal(fs.existsSync(JSON_PATH), true);
  assert.equal(fs.existsSync(MD_PATH), true);
  assert.equal(fs.existsSync("ci/scripts/run_s_v1_f_05_v1_final_ship_decision.mjs"), true);
  assert.equal(fs.existsSync("ci/guards/s_v1_f_05_v1_final_ship_decision_guard.mjs"), true);
});

test("S-V1-F-05 decision record is evidence based and bounded", () => {
  const record = readJson(JSON_PATH);

  assert.equal(record.record_id, "v1_final_ship_decision");
  assert.equal(record.slice_id, "S-V1-F-05");
  assert.equal(record.title, "V1 Final Ship Decision");
  assert.match(record.decision, /^(SHIP|BLOCKED)$/);

  assert.equal(record.ship_blocking_rules.evidence_based_decision_required, true);
  assert.equal(record.ship_blocking_rules.failed_acceptance_item_blocks_v1, true);
  assert.equal(record.ship_blocking_rules.incomplete_v1_completion_wording_forbidden, true);
  assert.equal(record.ship_blocking_rules.product_code_change_allowed, false);
  assert.equal(record.ship_blocking_rules.feature_implementation_allowed, false);
  assert.equal(record.ship_blocking_rules.release_tag_creation_allowed, false);
  assert.equal(record.ship_blocking_rules.package_version_change_allowed, false);
  assert.equal(record.ship_blocking_rules.engine_behaviour_change_allowed, false);
  assert.equal(record.ship_blocking_rules.registry_content_change_allowed, false);
  assert.equal(record.ship_blocking_rules.post_v1_scope_activation_allowed, false);
});

test("S-V1-F-05 decision record names exact evidence commands", () => {
  const record = readJson(JSON_PATH);
  const labels = record.required_evidence.map((item) => item.label);

  assert.ok(labels.includes("npm.cmd run acceptance:v1:check"));
  assert.ok(labels.includes("npm.cmd run proof:s-v1-f-04"));
  assert.ok(labels.includes("npm.cmd run lint:fast"));

  assert.equal(record.final_gate.acceptance_gate_command, "npm.cmd run acceptance:v1:check");
  assert.equal(record.final_gate.release_tag_preparation_command, "npm.cmd run proof:s-v1-f-04");
  assert.equal(record.final_gate.full_local_gate_command, "npm.cmd run lint:fast");
});

test("S-V1-F-05 SHIP decision requires all recorded evidence to pass", () => {
  const record = readJson(JSON_PATH);

  if (record.decision !== "SHIP") {
    assert.equal(typeof record.blocked_reason, "string");
    assert.ok(record.blocked_reason.length > 0);
    return;
  }

  assert.equal(record.mainline_evidence.main_clean_before_decision, true);
  assert.equal(record.mainline_evidence.head_equals_origin_main, true);
  assert.equal(record.mainline_evidence.required_checks_green, true);
  assert.equal(record.blocked_reason, null);

  for (const item of record.required_evidence) {
    assert.equal(item.exit_code, 0);
    assert.equal(item.passed, true);
  }
});

test("S-V1-F-05 markdown contains decision without incomplete completion wording", () => {
  const markdown = readText(MD_PATH).toLowerCase();

  assert.ok(markdown.includes("# v1 final ship decision"));
  assert.ok(markdown.includes("any failed required acceptance item blocks v1."));
  assert.equal(markdown.includes("partial-complete"), false);
  assert.equal(markdown.includes("partial complete"), false);
  assert.equal(markdown.includes("almost complete"), false);
  assert.equal(markdown.includes("nearly complete"), false);
  assert.equal(markdown.includes("mostly complete"), false);
});

test("S-V1-F-05 runner check passes", () => {
  const result = spawnSync(process.execPath, ["ci/scripts/run_s_v1_f_05_v1_final_ship_decision.mjs", "--check"], {
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /S-V1-F-05 V1_FINAL_SHIP_DECISION_CHECK_PASS/);
});
