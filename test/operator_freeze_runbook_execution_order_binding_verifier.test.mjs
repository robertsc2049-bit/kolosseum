import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const REPO_ROOT = process.cwd();
const SCRIPT = path.join(REPO_ROOT, "ci", "scripts", "run_operator_freeze_runbook_execution_order_binding_verifier.mjs");

const startMarker = "<!-- OPERATOR_FREEZE_COMMAND_ORDER_START -->";
const endMarker = "<!-- OPERATOR_FREEZE_COMMAND_ORDER_END -->";

function setupTempRepo({ runbookContent, executionOrderContent }) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "p99-freeze-binding-"));
  fs.mkdirSync(path.join(tempRoot, "docs", "releases"), { recursive: true });
  fs.mkdirSync(path.join(tempRoot, "ci", "scripts"), { recursive: true });

  fs.writeFileSync(
    path.join(tempRoot, "docs", "releases", "V1_OPERATOR_FREEZE_RUNBOOK.md"),
    runbookContent,
    "utf8"
  );

  fs.writeFileSync(
    path.join(tempRoot, "docs", "releases", "V1_OPERATOR_EXECUTION_ORDER.md"),
    executionOrderContent,
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

function buildRunbook(commands) {
  return [
    "# V1 Operator Freeze Runbook",
    "",
    startMarker,
    "```text",
    ...commands,
    "```",
    endMarker,
    ""
  ].join("\n");
}

function buildExecutionOrder(commands) {
  return [
    "# V1 Operator Execution Order",
    "",
    "Canonical order:",
    ...commands,
    ""
  ].join("\n");
}

const canonicalCommands = [
  "node .\\ci\\scripts\\run_registry_seal_freeze.mjs",
  "node .\\ci\\scripts\\run_registry_seal_manifest_verifier.mjs",
  "node .\\ci\\scripts\\run_registry_seal_scope_completeness_verifier.mjs",
  "node .\\ci\\scripts\\run_registry_seal_gate.mjs",
  "node .\\ci\\scripts\\run_registry_seal_drift_diff_reporter.mjs"
];

test("passes when runbook command order matches execution order document", () => {
  const cwd = setupTempRepo({
    runbookContent: buildRunbook(canonicalCommands),
    executionOrderContent: buildExecutionOrder(canonicalCommands)
  });

  const result = runVerifier(cwd);
  assert.equal(result.status, 0, result.stdout);
  assert.match(result.stdout, /"ok": true/);
  assert.match(result.stdout, /"command_count": 5/);
});

test("fails when runbook order drifts from execution order", () => {
  const driftedRunbookCommands = [
    "node .\\ci\\scripts\\run_registry_seal_manifest_verifier.mjs",
    "node .\\ci\\scripts\\run_registry_seal_freeze.mjs",
    "node .\\ci\\scripts\\run_registry_seal_scope_completeness_verifier.mjs",
    "node .\\ci\\scripts\\run_registry_seal_gate.mjs",
    "node .\\ci\\scripts\\run_registry_seal_drift_diff_reporter.mjs"
  ];

  const cwd = setupTempRepo({
    runbookContent: buildRunbook(driftedRunbookCommands),
    executionOrderContent: buildExecutionOrder(canonicalCommands)
  });

  const result = runVerifier(cwd);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /CI_OPERATOR_FREEZE_RUNBOOK_EXECUTION_ORDER_MISMATCH/);
  assert.match(result.stdout, /run_registry_seal_manifest_verifier\.mjs/);
  assert.match(result.stdout, /run_registry_seal_freeze\.mjs/);
});

test("fails when execution order document has no canonical freeze commands", () => {
  const cwd = setupTempRepo({
    runbookContent: buildRunbook(canonicalCommands),
    executionOrderContent: [
      "# V1 Operator Execution Order",
      "",
      "No canonical commands are present here.",
      ""
    ].join("\n")
  });

  const result = runVerifier(cwd);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /CI_OPERATOR_FREEZE_EXECUTION_ORDER_EMPTY/);
});