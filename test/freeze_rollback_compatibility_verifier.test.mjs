import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

function writeFile(root, relativePath, content) {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content.replace(/\r\n/g, "\n"), "utf8");
}

function runVerifier(tempRoot) {
  const scriptPath = path.resolve("ci/scripts/run_freeze_rollback_compatibility_verifier.mjs");
  return spawnSync(process.execPath, [scriptPath, "--root", tempRoot], {
    encoding: "utf8"
  });
}

test("verifier passes for operational-only rollback language", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "freeze-rollback-pass-"));

  writeFile(
    tempRoot,
    "docs/releases/V1_OPERATOR_FREEZE_RUNBOOK.md",
    [
      "# Freeze Runbook",
      "",
      "- preserve frozen artefacts unchanged",
      "- preserve replay prerequisites",
      "- preserve auditability"
    ].join("\n")
  );

  writeFile(
    tempRoot,
    "docs/releases/V1_ROLLBACK_RUNBOOK.md",
    [
      "# Rollback Runbook",
      "",
      "- disable UI access",
      "- disable API routes",
      "- suspend integrations",
      "- do not modify historical data",
      "- do not bypass CI",
      "- do not bypass replay",
      "- do not destroy evidence artefacts"
    ].join("\n")
  );

  const result = runVerifier(tempRoot);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const reportPath = path.join(tempRoot, "docs/releases/V1_FREEZE_ROLLBACK_COMPATIBILITY.json");
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));

  assert.equal(report.ok, true);
  assert.equal(report.violations.length, 0);
  assert.equal(report.rollback_files_checked.includes("docs/releases/V1_ROLLBACK_RUNBOOK.md"), true);
});

test("verifier fails on contradictory rollback instructions", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "freeze-rollback-fail-"));

  writeFile(
    tempRoot,
    "docs/releases/V1_FREEZE_EXIT_CRITERIA.json",
    JSON.stringify({ ok: true }, null, 2)
  );

  writeFile(
    tempRoot,
    "docs/releases/V1_ROLLBACK_RUNBOOK.md",
    [
      "# Rollback Runbook",
      "",
      "- bypass replay during emergency rollback",
      "- rewrite historical truth if needed to restore service",
      "- use fallback behaviour to preserve availability",
      "- re-enable phase 8 during rollback validation"
    ].join("\n")
  );

  const result = runVerifier(tempRoot);
  assert.notEqual(result.status, 0, "expected verifier failure");

  const reportPath = path.join(tempRoot, "docs/releases/V1_FREEZE_ROLLBACK_COMPATIBILITY.json");
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));

  assert.equal(report.ok, false);
  assert.equal(report.violations.length >= 3, true);

  const ruleIds = new Set(report.violations.map((entry) => entry.rule_id));
  assert.equal(ruleIds.has("ROLLBACK_PROOF_BYPASS"), true);
  assert.equal(ruleIds.has("ROLLBACK_HISTORY_MUTATION"), true);
  assert.equal(ruleIds.has("ROLLBACK_FALLBACK_LANGUAGE"), true);
});

test("verifier fails when rollback or freeze artefacts are missing", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "freeze-rollback-missing-"));

  const result = runVerifier(tempRoot);
  assert.notEqual(result.status, 0, "expected verifier failure");

  const reportPath = path.join(tempRoot, "docs/releases/V1_FREEZE_ROLLBACK_COMPATIBILITY.json");
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));

  assert.equal(report.ok, false);

  const ruleIds = new Set(report.violations.map((entry) => entry.rule_id));
  assert.equal(ruleIds.has("ROLLBACK_DOC_MISSING"), true);
  assert.equal(ruleIds.has("FREEZE_DOC_MISSING"), true);
});