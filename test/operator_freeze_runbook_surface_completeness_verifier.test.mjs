import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const REPO_ROOT = process.cwd();
const SCRIPT = path.join(REPO_ROOT, "ci", "scripts", "run_operator_freeze_runbook_surface_completeness_verifier.mjs");

function setupTempRepo(runbookContent, extraFiles = {}) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "p97-freeze-runbook-"));
  fs.mkdirSync(path.join(tempRoot, "docs", "releases"), { recursive: true });
  fs.mkdirSync(path.join(tempRoot, "ci", "scripts"), { recursive: true });

  fs.writeFileSync(
    path.join(tempRoot, "docs", "releases", "V1_OPERATOR_FREEZE_RUNBOOK.md"),
    runbookContent,
    "utf8"
  );

  for (const [relativePath, content] of Object.entries(extraFiles)) {
    const fullPath = path.join(tempRoot, ...relativePath.split("/"));
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, "utf8");
  }

  return tempRoot;
}

function runVerifier(cwd) {
  try {
    const stdout = execFileSync(process.execPath, [SCRIPT], {
      cwd,
      encoding: "utf8",
    });
    return { status: 0, stdout };
  } catch (error) {
    return {
      status: error.status ?? 1,
      stdout: error.stdout?.toString() ?? "",
      stderr: error.stderr?.toString() ?? "",
    };
  }
}

test("passes when every referenced freeze surface exists", () => {
  const cwd = setupTempRepo(
    [
      "# V1 Operator Freeze Runbook",
      "",
      "Run these:",
      "node .\\ci\\scripts\\run_registry_seal_gate.mjs",
      "node .\\ci\\scripts\\run_registry_seal_manifest_verifier.mjs",
      "",
      "Reference docs:",
      "docs/releases/V1_OPERATOR_EXECUTION_ORDER.md",
      "docs/releases/V1_RELEASE_CHECKLIST.md",
      "",
    ].join("\n"),
    {
      "ci/scripts/run_registry_seal_gate.mjs": "export {};",
      "ci/scripts/run_registry_seal_manifest_verifier.mjs": "export {};",
      "docs/releases/V1_OPERATOR_EXECUTION_ORDER.md": "# order\n",
      "docs/releases/V1_RELEASE_CHECKLIST.md": "# checklist\n",
    }
  );

  const result = runVerifier(cwd);
  assert.equal(result.status, 0, result.stdout);
  assert.match(result.stdout, /"ok": true/);
  assert.match(result.stdout, /"checked_count": 4/);
});

test("fails when a referenced script surface is missing", () => {
  const cwd = setupTempRepo(
    [
      "# V1 Operator Freeze Runbook",
      "",
      "node .\\ci\\scripts\\run_registry_seal_gate.mjs",
      "node .\\ci\\scripts\\run_registry_seal_manifest_verifier.mjs",
      "",
    ].join("\n"),
    {
      "ci/scripts/run_registry_seal_gate.mjs": "export {};",
    }
  );

  const result = runVerifier(cwd);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /CI_OPERATOR_FREEZE_RUNBOOK_SURFACE_MISSING/);
  assert.match(result.stdout, /run_registry_seal_manifest_verifier\.mjs/);
});

test("fails when no freeze artefact surfaces are referenced", () => {
  const cwd = setupTempRepo(
    [
      "# V1 Operator Freeze Runbook",
      "",
      "This document says what to do but contains no concrete surfaces.",
      "",
    ].join("\n")
  );

  const result = runVerifier(cwd);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /CI_OPERATOR_FREEZE_RUNBOOK_SURFACE_EMPTY/);
});