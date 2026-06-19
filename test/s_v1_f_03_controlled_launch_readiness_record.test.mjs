import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const recordPath = "docs/releases/CONTROLLED_LAUNCH_READINESS_RECORD.json";
const markdownPath = "docs/releases/CONTROLLED_LAUNCH_READINESS_RECORD.md";

test("S-V1-F-03 controlled launch record starts unsigned and controlled", () => {
  const record = JSON.parse(fs.readFileSync(recordPath, "utf8"));

  assert.equal(record.slice_id, "S-V1-F-03");
  assert.equal(record.record_state, "template_not_signed");
  assert.equal(record.launch_decision.status, "not_recorded");
  assert.equal(record.signoff.current_state, "unsigned");

  assert.equal(record.launch_control.type, "controlled");
  assert.equal(record.launch_control.named_participants_only, true);
  assert.equal(record.launch_control.open_signup_allowed, false);
  assert.equal(record.launch_control.marketing_expansion_allowed, false);
  assert.equal(record.launch_control.broad_rollout_allowed, false);
  assert.equal(record.launch_control.enterprise_launch_allowed, false);
  assert.equal(record.launch_control.post_v1_surfaces_allowed, false);
});

test("S-V1-F-03 controlled launch record has all required gate items unrecorded", () => {
  const record = JSON.parse(fs.readFileSync(recordPath, "utf8"));
  const expectedIds = [
    "CLRR-001",
    "CLRR-002",
    "CLRR-003",
    "CLRR-004",
    "CLRR-005",
    "CLRR-006",
    "CLRR-007",
    "CLRR-008",
    "CLRR-009",
    "CLRR-010",
    "CLRR-011",
    "CLRR-012"
  ];

  assert.deepEqual(record.required_gate_items.map((item) => item.item_id), expectedIds);

  for (const item of record.required_gate_items) {
    assert.equal(item.status, "unrecorded");
    assert.deepEqual(item.evidence_refs, []);
  }
});

test("S-V1-F-03 markdown states controlled-only scope and unsigned state", () => {
  const markdown = fs.readFileSync(markdownPath, "utf8");

  assert.match(markdown, /Scope: controlled launch only/);
  assert.match(markdown, /Initial record state: not signed\./);
  assert.match(markdown, /open sign-up/);
  assert.match(markdown, /If this record is unsigned, controlled launch operation is not recorded as permitted\./);
});

test("S-V1-F-03 guard passes", () => {
  const result = spawnSync(
    process.execPath,
    ["ci/guards/s_v1_f_03_controlled_launch_readiness_record_guard.mjs"],
    { encoding: "utf8" }
  );

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /"ok": true/);
});