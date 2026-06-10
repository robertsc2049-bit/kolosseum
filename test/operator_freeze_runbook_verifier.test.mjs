import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const verifierPath = path.resolve("ci/scripts/run_operator_freeze_runbook_verifier.mjs");

function writeUtf8(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "p96-operator-freeze-runbook-"));
}

function runVerifier(root) {
  return spawnSync(process.execPath, [verifierPath], {
    cwd: root,
    encoding: "utf8"
  });
}

test("passes when canonical operator freeze runbook is present", () => {
  const root = makeRoot();

  writeUtf8(
    path.join(root, "docs", "releases", "V1_OPERATOR_FREEZE_RUNBOOK.md"),
    [
      "# V1 Operator Freeze Runbook",
      "",
      "node .\\\\ci\\\\scripts\\\\run_registry_seal_manifest_verifier.mjs",
      "node .\\\\ci\\\\scripts\\\\run_registry_seal_scope_completeness_verifier.mjs",
      "node .\\\\ci\\\\scripts\\\\run_registry_seal_drift_diff_reporter.mjs",
      "node .\\\\ci\\\\scripts\\\\run_registry_seal_gate.mjs",
      "node .\\\\ci\\\\scripts\\\\run_registry_seal_freeze.mjs",
      "Unfreeze is not allowed.",
      "Only lawful transition: pre_seal -> sealed."
    ].join("\\n") + "\\n"
  );

  const result = runVerifier(root);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, true);
});

test("fails when runbook is missing", () => {
  const root = makeRoot();
  const result = runVerifier(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /CI_OPERATOR_FREEZE_RUNBOOK_MISSING/);
});

test("fails when contradictory instructions appear", () => {
  const root = makeRoot();

  writeUtf8(
    path.join(root, "docs", "releases", "V1_OPERATOR_FREEZE_RUNBOOK.md"),
    [
      "# V1 Operator Freeze Runbook",
      "",
      "node .\\\\ci\\\\scripts\\\\run_registry_seal_manifest_verifier.mjs",
      "node .\\\\ci\\\\scripts\\\\run_registry_seal_scope_completeness_verifier.mjs",
      "node .\\\\ci\\\\scripts\\\\run_registry_seal_drift_diff_reporter.mjs",
      "node .\\\\ci\\\\scripts\\\\run_registry_seal_gate.mjs",
      "node .\\\\ci\\\\scripts\\\\run_registry_seal_freeze.mjs",
      "Only lawful transition: pre_seal -> sealed.",
      "sealed -> pre_seal"
    ].join("\\n") + "\\n"
  );

  const result = runVerifier(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /CI_OPERATOR_FREEZE_RUNBOOK_CONTRADICTION/);
});
