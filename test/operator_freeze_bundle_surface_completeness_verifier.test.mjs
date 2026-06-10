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

function runNode(scriptRelative, args = []) {
  const scriptPath = path.resolve(scriptRelative);
  return spawnSync(process.execPath, [scriptPath, ...args], { encoding: "utf8" });
}

test("passes when bundle artefact set exactly matches operator law references", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "operator-freeze-bundle-surface-pass-"));

  writeFile(tempRoot, "docs/releases/V1_OPERATOR_FREEZE_RUNBOOK.md", [
    "# Freeze Runbook",
    "",
    "Use docs/releases/V1_OPERATOR_EXECUTION_ORDER.md",
    "Use ci/scripts/run_operator_freeze_check.mjs"
  ].join("\n"));

  writeFile(tempRoot, "docs/releases/V1_ROLLBACK_RUNBOOK.md", [
    "# Rollback Runbook",
    "",
    "See docs/releases/V1_OPERATOR_FREEZE_RUNBOOK.md"
  ].join("\n"));

  writeFile(tempRoot, "docs/releases/V1_OPERATOR_EXECUTION_ORDER.md", "# order\n");
  writeFile(tempRoot, "ci/scripts/run_operator_freeze_check.mjs", "export {};\n");

  writeFile(tempRoot, "docs/releases/V1_OPERATOR_FREEZE_COMMAND_ORDER.json", JSON.stringify({
    steps: [
      { surface: "docs/releases/V1_OPERATOR_FREEZE_RUNBOOK.md" },
      { script: "ci/scripts/run_operator_freeze_check.mjs" }
    ]
  }, null, 2) + "\n");

  writeFile(tempRoot, "docs/releases/V1_OPERATOR_FREEZE_ARTEFACT_SET.json", JSON.stringify({
    artefacts: [
      "docs/releases/V1_OPERATOR_FREEZE_RUNBOOK.md",
      "docs/releases/V1_ROLLBACK_RUNBOOK.md",
      "docs/releases/V1_OPERATOR_EXECUTION_ORDER.md",
      "docs/releases/V1_OPERATOR_FREEZE_COMMAND_ORDER.json",
      "ci/scripts/run_operator_freeze_check.mjs"
    ]
  }, null, 2) + "\n");

  const result = runNode("ci/scripts/run_operator_freeze_bundle_surface_completeness_verifier.mjs", [
    "--root", tempRoot,
    "--bundle-set", "docs/releases/V1_OPERATOR_FREEZE_ARTEFACT_SET.json",
    "--freeze-runbook", "docs/releases/V1_OPERATOR_FREEZE_RUNBOOK.md",
    "--command-order", "docs/releases/V1_OPERATOR_FREEZE_COMMAND_ORDER.json",
    "--rollback-runbook", "docs/releases/V1_ROLLBACK_RUNBOOK.md",
    "--report", "docs/releases/V1_OPERATOR_FREEZE_BUNDLE_SURFACE_COMPLETENESS.json"
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("fails when referenced operator surface is missing from bundle set", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "operator-freeze-bundle-surface-missing-"));

  writeFile(tempRoot, "docs/releases/V1_OPERATOR_FREEZE_RUNBOOK.md", "Use ci/scripts/run_operator_freeze_check.mjs\n");
  writeFile(tempRoot, "docs/releases/V1_ROLLBACK_RUNBOOK.md", "# rollback\n");
  writeFile(tempRoot, "docs/releases/V1_OPERATOR_FREEZE_COMMAND_ORDER.json", JSON.stringify({ steps: [] }, null, 2) + "\n");
  writeFile(tempRoot, "ci/scripts/run_operator_freeze_check.mjs", "export {};\n");

  writeFile(tempRoot, "docs/releases/V1_OPERATOR_FREEZE_ARTEFACT_SET.json", JSON.stringify({
    artefacts: [
      "docs/releases/V1_OPERATOR_FREEZE_RUNBOOK.md",
      "docs/releases/V1_ROLLBACK_RUNBOOK.md",
      "docs/releases/V1_OPERATOR_FREEZE_COMMAND_ORDER.json"
    ]
  }, null, 2) + "\n");

  const result = runNode("ci/scripts/run_operator_freeze_bundle_surface_completeness_verifier.mjs", [
    "--root", tempRoot,
    "--bundle-set", "docs/releases/V1_OPERATOR_FREEZE_ARTEFACT_SET.json",
    "--freeze-runbook", "docs/releases/V1_OPERATOR_FREEZE_RUNBOOK.md",
    "--command-order", "docs/releases/V1_OPERATOR_FREEZE_COMMAND_ORDER.json",
    "--rollback-runbook", "docs/releases/V1_ROLLBACK_RUNBOOK.md",
    "--report", "docs/releases/V1_OPERATOR_FREEZE_BUNDLE_SURFACE_COMPLETENESS.json"
  ]);

  assert.notEqual(result.status, 0, "expected verifier failure");
  const report = JSON.parse(fs.readFileSync(path.join(tempRoot, "docs/releases/V1_OPERATOR_FREEZE_BUNDLE_SURFACE_COMPLETENESS.json"), "utf8"));
  assert.equal(report.failures.some((x) => x.details.includes("missing from operator freeze bundle artefact set")), true);
});

test("fails when bundle set contains undeclared extra surface", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "operator-freeze-bundle-surface-extra-"));

  writeFile(tempRoot, "docs/releases/V1_OPERATOR_FREEZE_RUNBOOK.md", "# runbook\n");
  writeFile(tempRoot, "docs/releases/V1_ROLLBACK_RUNBOOK.md", "# rollback\n");
  writeFile(tempRoot, "docs/releases/V1_OPERATOR_FREEZE_COMMAND_ORDER.json", JSON.stringify({ steps: [] }, null, 2) + "\n");
  writeFile(tempRoot, "docs/releases/EXTRA.md", "# extra\n");

  writeFile(tempRoot, "docs/releases/V1_OPERATOR_FREEZE_ARTEFACT_SET.json", JSON.stringify({
    artefacts: [
      "docs/releases/V1_OPERATOR_FREEZE_RUNBOOK.md",
      "docs/releases/V1_ROLLBACK_RUNBOOK.md",
      "docs/releases/V1_OPERATOR_FREEZE_COMMAND_ORDER.json",
      "docs/releases/EXTRA.md"
    ]
  }, null, 2) + "\n");

  const result = runNode("ci/scripts/run_operator_freeze_bundle_surface_completeness_verifier.mjs", [
    "--root", tempRoot,
    "--bundle-set", "docs/releases/V1_OPERATOR_FREEZE_ARTEFACT_SET.json",
    "--freeze-runbook", "docs/releases/V1_OPERATOR_FREEZE_RUNBOOK.md",
    "--command-order", "docs/releases/V1_OPERATOR_FREEZE_COMMAND_ORDER.json",
    "--rollback-runbook", "docs/releases/V1_ROLLBACK_RUNBOOK.md",
    "--report", "docs/releases/V1_OPERATOR_FREEZE_BUNDLE_SURFACE_COMPLETENESS.json"
  ]);

  assert.notEqual(result.status, 0, "expected verifier failure");
  const report = JSON.parse(fs.readFileSync(path.join(tempRoot, "docs/releases/V1_OPERATOR_FREEZE_BUNDLE_SURFACE_COMPLETENESS.json"), "utf8"));
  assert.equal(report.failures.some((x) => x.details.includes("Undeclared extra surface")), true);
});