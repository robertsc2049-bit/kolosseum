import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const REPO_ROOT = process.cwd();
const SCRIPT = path.join(REPO_ROOT, "ci", "scripts", "run_operator_freeze_command_order_verifier.mjs");

const startMarker = "<!-- OPERATOR_FREEZE_COMMAND_ORDER_START -->";
const endMarker = "<!-- OPERATOR_FREEZE_COMMAND_ORDER_END -->";
const fence = String.fromCharCode(96).repeat(3);

function setupTempRepo({ runbookContent, registryContent }) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "p98-freeze-command-order-"));
  fs.mkdirSync(path.join(tempRoot, "docs", "releases"), { recursive: true });
  fs.mkdirSync(path.join(tempRoot, "ci", "scripts"), { recursive: true });
  fs.writeFileSync(path.join(tempRoot, "docs", "releases", "V1_OPERATOR_FREEZE_RUNBOOK.md"), runbookContent, "utf8");
  fs.writeFileSync(path.join(tempRoot, "docs", "releases", "V1_OPERATOR_FREEZE_COMMAND_ORDER.json"), JSON.stringify(registryContent, null, 2), "utf8");
  return tempRoot;
}

function runVerifier(cwd) {
  try {
    const stdout = execFileSync(process.execPath, [SCRIPT], { cwd, encoding: "utf8" });
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
    "Reference mentions outside the canonical block should be ignored:",
    "node .\\ci\\scripts\\run_registry_seal_gate.mjs",
    "",
    startMarker,
    fence + "text",
    ...commands,
    fence,
    endMarker,
    "",
    "Another mention outside the canonical block should also be ignored:",
    "node .\\ci\\scripts\\run_registry_seal_drift_diff_reporter.mjs",
    ""
  ].join("\n");
}

function buildRegistry(commands) {
  return {
    runbook_path: "docs/releases/V1_OPERATOR_FREEZE_RUNBOOK.md",
    start_marker: startMarker,
    end_marker: endMarker,
    commands
  };
}

const canonicalCommands = [
  "node .\\ci\\scripts\\run_registry_seal_freeze.mjs",
  "node .\\ci\\scripts\\run_registry_seal_manifest_verifier.mjs",
  "node .\\ci\\scripts\\run_registry_seal_scope_completeness_verifier.mjs",
  "node .\\ci\\scripts\\run_registry_seal_gate.mjs",
  "node .\\ci\\scripts\\run_registry_seal_drift_diff_reporter.mjs"
];

test("passes when marked canonical block matches the pinned command order", () => {
  const cwd = setupTempRepo({
    runbookContent: buildRunbook(canonicalCommands),
    registryContent: buildRegistry(canonicalCommands)
  });
  const result = runVerifier(cwd);
  assert.equal(result.status, 0, result.stdout);
  assert.match(result.stdout, /"ok": true/);
  assert.match(result.stdout, /"command_count": 5/);
});

test("fails when two commands are swapped inside the marked canonical block", () => {
  const swappedCommands = [
    "node .\\ci\\scripts\\run_registry_seal_freeze.mjs",
    "node .\\ci\\scripts\\run_registry_seal_scope_completeness_verifier.mjs",
    "node .\\ci\\scripts\\run_registry_seal_manifest_verifier.mjs",
    "node .\\ci\\scripts\\run_registry_seal_gate.mjs",
    "node .\\ci\\scripts\\run_registry_seal_drift_diff_reporter.mjs"
  ];
  const cwd = setupTempRepo({
    runbookContent: buildRunbook(swappedCommands),
    registryContent: buildRegistry(canonicalCommands)
  });
  const result = runVerifier(cwd);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /CI_OPERATOR_FREEZE_COMMAND_ORDER_MISMATCH/);
});

test("fails when the canonical command order markers are missing", () => {
  const cwd = setupTempRepo({
    runbookContent: [
      "# V1 Operator Freeze Runbook",
      "",
      "node .\\ci\\scripts\\run_registry_seal_freeze.mjs",
      "node .\\ci\\scripts\\run_registry_seal_manifest_verifier.mjs",
      ""
    ].join("\n"),
    registryContent: buildRegistry(canonicalCommands)
  });
  const result = runVerifier(cwd);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /CI_OPERATOR_FREEZE_COMMAND_ORDER_MARKERS_MISSING/);
});