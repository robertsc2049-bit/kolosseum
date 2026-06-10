import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const REPO_ROOT = process.cwd();
const SCRIPT = path.join(REPO_ROOT, "ci", "scripts", "run_operator_freeze_release_checklist_binding_verifier.mjs");

function setupTempRepo({ runbookContent, checklistContent }) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "p100-freeze-checklist-binding-"));
  fs.mkdirSync(path.join(tempRoot, "docs", "releases"), { recursive: true });
  fs.mkdirSync(path.join(tempRoot, "ci", "scripts"), { recursive: true });

  fs.writeFileSync(
    path.join(tempRoot, "docs", "releases", "V1_OPERATOR_FREEZE_RUNBOOK.md"),
    runbookContent,
    "utf8"
  );

  fs.writeFileSync(
    path.join(tempRoot, "docs", "releases", "V1_RELEASE_CHECKLIST.md"),
    checklistContent,
    "utf8"
  );

  return tempRoot;
}

function runVerifier(cwd) {
  try {
    const stdout = execFileSync(process.execPath, [SCRIPT], {
      cwd,
      encoding: "utf8"
    });
    return { status: 0, stdout };
  } catch (error) {
    return {
      status: error.status ?? 1,
      stdout: error.stdout?.toString() ?? "",
      stderr: error.stderr?.toString() ?? ""
    };
  }
}

const canonicalRunbook = [
  "# V1 Operator Freeze Runbook",
  "",
  "## Canonical Operator Freeze Command Order",
  "",
  "node .\\ci\\scripts\\run_registry_seal_freeze.mjs",
  "node .\\ci\\scripts\\run_registry_seal_manifest_verifier.mjs",
  "node .\\ci\\scripts\\run_registry_seal_scope_completeness_verifier.mjs",
  "node .\\ci\\scripts\\run_registry_seal_gate.mjs",
  "node .\\ci\\scripts\\run_registry_seal_drift_diff_reporter.mjs",
  ""
].join("\n");

const canonicalChecklist = [
  "# V1 Release Checklist",
  "",
  "- Review V1_OPERATOR_FREEZE_RUNBOOK.md before release.",
  "- Run node .\\ci\\scripts\\run_registry_seal_freeze.mjs",
  "- Run node .\\ci\\scripts\\run_registry_seal_manifest_verifier.mjs",
  "- Run node .\\ci\\scripts\\run_registry_seal_scope_completeness_verifier.mjs",
  "- Run node .\\ci\\scripts\\run_registry_seal_gate.mjs",
  "- Run node .\\ci\\scripts\\run_registry_seal_drift_diff_reporter.mjs",
  ""
].join("\n");

test("passes when release checklist acknowledges freeze runbook and steps", () => {
  const cwd = setupTempRepo({
    runbookContent: canonicalRunbook,
    checklistContent: canonicalChecklist
  });

  const result = runVerifier(cwd);
  assert.equal(result.status, 0, result.stdout);
  assert.match(result.stdout, /"ok": true/);
});

test("fails when release checklist omits freeze runbook acknowledgement", () => {
  const cwd = setupTempRepo({
    runbookContent: canonicalRunbook,
    checklistContent: [
      "# V1 Release Checklist",
      "",
      "- Run node .\\ci\\scripts\\run_registry_seal_freeze.mjs",
      "- Run node .\\ci\\scripts\\run_registry_seal_manifest_verifier.mjs",
      "- Run node .\\ci\\scripts\\run_registry_seal_scope_completeness_verifier.mjs",
      "- Run node .\\ci\\scripts\\run_registry_seal_gate.mjs",
      "- Run node .\\ci\\scripts\\run_registry_seal_drift_diff_reporter.mjs",
      ""
    ].join("\n")
  });

  const result = runVerifier(cwd);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /CI_OPERATOR_FREEZE_RELEASE_CHECKLIST_BINDING_MISSING/);
  assert.match(result.stdout, /V1_OPERATOR_FREEZE_RUNBOOK\.md/);
});

test("fails when release checklist omits a freeze execution step", () => {
  const cwd = setupTempRepo({
    runbookContent: canonicalRunbook,
    checklistContent: [
      "# V1 Release Checklist",
      "",
      "- Review V1_OPERATOR_FREEZE_RUNBOOK.md before release.",
      "- Run node .\\ci\\scripts\\run_registry_seal_freeze.mjs",
      "- Run node .\\ci\\scripts\\run_registry_seal_manifest_verifier.mjs",
      "- Run node .\\ci\\scripts\\run_registry_seal_scope_completeness_verifier.mjs",
      "- Run node .\\ci\\scripts\\run_registry_seal_gate.mjs",
      ""
    ].join("\n")
  });

  const result = runVerifier(cwd);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /CI_OPERATOR_FREEZE_RELEASE_CHECKLIST_BINDING_MISSING/);
  assert.match(result.stdout, /run_registry_seal_drift_diff_reporter\.mjs/);
});