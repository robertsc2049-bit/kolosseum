import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const recordPath = "docs/releases/CONTROLLED_LAUNCH_REGISTRY_WORKABILITY_HOLD.json";
const markdownPath = "docs/releases/CONTROLLED_LAUNCH_REGISTRY_WORKABILITY_HOLD.md";
const packagePath = "package.json";

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

test("S-V1-G-02 hold record files exist", () => {
  assert.equal(fs.existsSync(recordPath), true);
  assert.equal(fs.existsSync(markdownPath), true);
});

test("S-V1-G-02 records operational launch hold without changing GO record", () => {
  const record = readJson(recordPath);
  const goRecord = readJson("docs/releases/CONTROLLED_LAUNCH_GO_NO_GO_RECORD.json");

  assert.equal(goRecord.decision, "GO");
  assert.equal(record.status, "HOLD");
  assert.equal(record.operational_launch_status, "HOLD_REGISTRY_WORKABILITY_NOT_PROVEN");
  assert.equal(record.controlled_launch_user_start_authorised, false);
  assert.equal(record.recorded_after.go_no_go_decision, "GO");
  assert.equal(record.invariants.does_not_change_existing_go_no_go_record, true);
});

test("S-V1-G-02 states structural registry gates are not workability proof", () => {
  const record = readJson(recordPath);

  assert.equal(record.workability_findings.structural_registry_gates_pass, true);
  assert.equal(record.workability_findings.registry_content_workability_proven, false);
  assert.equal(record.workability_findings.minimum_real_execution_content_proven, false);
  assert.equal(record.workability_findings.real_coach_athlete_launch_path_with_current_registry_content_proven, false);
  assert.equal(record.workability_findings.release_go_record_changes_registry_content, false);
  assert.equal(record.workability_findings.smoke_run_changes_registry_content, false);
});

test("S-V1-G-02 records current active registry law counts", () => {
  const record = readJson(recordPath);

  assert.equal(record.registry_law_counts.activity, 3);
  assert.equal(record.registry_law_counts.movement, 4);
  assert.equal(record.registry_law_counts.exercise, 19);
  assert.equal(record.registry_law_counts.program, 3);
});

test("S-V1-G-02 has required blocker reason codes", () => {
  const record = readJson(recordPath);

  assert.ok(record.blocker_reason_codes.includes("REGISTRY_WORKABILITY_NOT_PROVEN"));
  assert.ok(record.blocker_reason_codes.includes("MINIMUM_REAL_EXECUTION_CONTENT_NOT_PROVEN"));
  assert.ok(record.blocker_reason_codes.includes("CONTROLLED_LAUNCH_GO_RECORD_IS_NOT_REGISTRY_CONTENT_PROOF"));
});

test("S-V1-G-02 markdown is human-readable and boundary-bounded", () => {
  const markdown = fs.readFileSync(markdownPath, "utf8");

  assert.match(markdown, /Operational launch status: HOLD_REGISTRY_WORKABILITY_NOT_PROVEN/);
  assert.match(markdown, /Controlled launch user start authorised: false/);
  assert.match(markdown, /structural gates are not the same as a workable registry/);
  assert.match(markdown, /This record does not change registry content/);
  assert.match(markdown, /do not start real controlled launch users from the current registry state/);
});

test("S-V1-G-02 runner check passes", () => {
  const result = spawnSync(process.execPath, [
    "ci/scripts/run_s_v1_g_02_registry_workability_audit_launch_hold.mjs",
    "--check"
  ], {
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /S-V1-G-02 REGISTRY_WORKABILITY_AUDIT_LAUNCH_HOLD_CHECK_PASS/);
});

test("S-V1-G-02 package proof script is wired", () => {
  const packageRaw = fs.readFileSync(packagePath, "utf8");
  const packageJson = JSON.parse(packageRaw);

  const expected = "node --test test/s_v1_g_02_registry_workability_audit_launch_hold.test.mjs && node ci/guards/s_v1_g_02_registry_workability_audit_launch_hold_guard.mjs && node ci/scripts/run_s_v1_g_02_registry_workability_audit_launch_hold.mjs --check";

  assert.equal(packageJson.scripts["proof:s-v1-g-02"], expected);
  assert.equal(packageJson.scripts["acceptance:v1:registry-workability-hold:check"], "node ci/scripts/run_s_v1_g_02_registry_workability_audit_launch_hold.mjs --check");
  assert.ok(packageRaw.includes(expected));
});
