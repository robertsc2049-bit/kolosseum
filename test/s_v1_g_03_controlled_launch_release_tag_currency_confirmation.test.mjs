import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const RECORD_PATH = "docs/releases/CONTROLLED_LAUNCH_RELEASE_TAG_CURRENCY_CONFIRMATION.json";
const MARKDOWN_PATH = "docs/releases/CONTROLLED_LAUNCH_RELEASE_TAG_CURRENCY_CONFIRMATION.md";
const GO_NO_GO_PATH = "docs/releases/CONTROLLED_LAUNCH_GO_NO_GO_RECORD.json";
const PACKAGE_PATH = "package.json";

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function readText(path) {
  return fs.readFileSync(path, "utf8");
}

test("S-V1-G-03 currency confirmation files exist", () => {
  assert.equal(fs.existsSync(RECORD_PATH), true);
  assert.equal(fs.existsSync(MARKDOWN_PATH), true);
});

test("S-V1-G-03 does not change the S-V1-F-12 historical record", () => {
  const record = readJson(RECORD_PATH);
  const goNoGo = readJson(GO_NO_GO_PATH);

  assert.equal(goNoGo.decision, "GO");
  assert.equal(goNoGo.decision_scope, "controlled_launch_only");
  assert.equal(goNoGo.release_identity.tag_name, "v1-controlled-launch");
  assert.equal(goNoGo.release_identity.expected_tag_commit, "43510e4c4d791effda647e80dc74d8452dc61f1f");

  assert.equal(record.historical_go_no_go_record.slice_id, "S-V1-F-12");
  assert.equal(record.historical_go_no_go_record.decision, "GO");
  assert.equal(record.historical_go_no_go_record.recorded_release_tag, "v1-controlled-launch");
  assert.equal(record.historical_go_no_go_record.record_unchanged_by_this_slice, true);
});

test("S-V1-G-03 records the current release identity and evidence chain", () => {
  const record = readJson(RECORD_PATH);

  assert.equal(record.slice_id, "S-V1-G-03");
  assert.equal(record.record_id, "controlled_launch_release_tag_currency_confirmation");
  assert.equal(record.status, "CONFIRMED");
  assert.equal(record.decision_scope, "controlled_launch_only");

  assert.equal(record.current_release_identity.tag_name, "v1.0.0");
  assert.equal(record.current_release_identity.tag_commit, "fb32206e3a178954ed7fbeda5b67e68159618a46");
  assert.equal(record.current_release_identity.local_tag_verified, true);
  assert.equal(record.current_release_identity.remote_tag_verified, true);

  assert.equal(record.current_evidence_chain.final_ship_decision.decision, "SHIP");
  assert.equal(record.current_evidence_chain.release_evidence_snapshot.tag_name, "v1.0.0");
  assert.equal(record.current_evidence_chain.controlled_launch_execution_pack.status, "prepared");
  assert.equal(record.current_evidence_chain.controlled_launch_smoke_run.result, "pass");
  assert.equal(record.current_evidence_chain.controlled_launch_smoke_run.failed_required_command_count, 0);
  assert.equal(record.current_evidence_chain.controlled_launch_smoke_run.launch_blocker_recorded, false);
});

test("S-V1-G-03 currency findings and claim boundary remain true/false as required", () => {
  const record = readJson(RECORD_PATH);

  for (const [key, value] of Object.entries(record.currency_findings)) {
    assert.equal(value, true, key);
  }

  assert.equal(Array.isArray(record.blocker_reason_codes), true);
  assert.equal(record.blocker_reason_codes.length, 0);

  for (const [key, value] of Object.entries(record.claim_boundary)) {
    assert.equal(value, false, key);
  }

  assert.equal(record.permitted_next_action, "start_controlled_launch_for_named_founder_group_only_under_current_tag");
});

test("S-V1-G-03 markdown is human-readable and boundary-bounded", () => {
  const markdown = readText(MARKDOWN_PATH);

  assert.match(markdown, /# Controlled Launch Release Tag Currency Confirmation/);
  assert.match(markdown, /Slice: S-V1-G-03/);
  assert.match(markdown, /Status: CONFIRMED/);
  assert.match(markdown, /## Relationship to S-V1-F-12/);
  assert.match(markdown, /This record does not reissue a new GO decision\./);
  assert.match(markdown, /Tag: v1\.0\.0/);
  assert.match(markdown, /Do not expand launch scope from this record\./);
});

test("S-V1-G-03 runner check passes", () => {
  const result = spawnSync(process.execPath, [
    "ci/scripts/run_s_v1_g_03_controlled_launch_release_tag_currency_confirmation.mjs",
    "--check"
  ], {
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /S-V1-G-03 RELEASE_TAG_CURRENCY_CONFIRMATION_CHECK_PASS/);
});

test("S-V1-G-03 package proof script is wired", () => {
  const packageRaw = readText(PACKAGE_PATH);
  const packageJson = JSON.parse(packageRaw);

  const expected = "node --test test/s_v1_g_03_controlled_launch_release_tag_currency_confirmation.test.mjs && node ci/guards/s_v1_g_03_controlled_launch_release_tag_currency_confirmation_guard.mjs && node ci/scripts/run_s_v1_g_03_controlled_launch_release_tag_currency_confirmation.mjs --check";

  assert.equal(packageJson.scripts["proof:s-v1-g-03"], expected);
  assert.equal(packageJson.scripts["acceptance:v1:release-tag-currency:check"], "node ci/scripts/run_s_v1_g_03_controlled_launch_release_tag_currency_confirmation.mjs --check");
  assert.ok(packageJson.scripts["lint:fast"].includes(expected));
  assert.ok(packageJson.scripts["lint:fast:inline"].includes(expected));
});
