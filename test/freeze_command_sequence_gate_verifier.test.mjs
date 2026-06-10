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

test("passes when freeze command order is lawful", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "freeze-sequence-pass-"));

  writeFile(
    tempRoot,
    "docs/releases/V1_OPERATOR_FREEZE_COMMAND_ORDER.json",
    JSON.stringify(
      {
        steps: [
          { script: "docs/releases/V1_FREEZE_STATE.json" },
          { script: "ci/scripts/run_freeze_evidence_manifest_completeness_verifier.mjs" },
          { script: "ci/scripts/run_freeze_evidence_manifest_self_hash_verifier.mjs" },
          { script: "ci/scripts/run_mainline_freeze_preservation_verifier.mjs" },
          { script: "ci/scripts/build_operator_freeze_pack.mjs" },
          { script: "ci/scripts/run_operator_freeze_pack_composition_verifier.mjs" },
          { script: "ci/scripts/run_operator_freeze_bundle_preservation_verifier.mjs" },
          { script: "ci/scripts/run_operator_freeze_bundle_surface_completeness_verifier.mjs" }
        ]
      },
      null,
      2
    ) + "\n"
  );

  const result = runNode("ci/scripts/run_freeze_command_sequence_gate_verifier.mjs", [
    "--root", tempRoot,
    "--command-order", "docs/releases/V1_OPERATOR_FREEZE_COMMAND_ORDER.json",
    "--report", "docs/releases/V1_FREEZE_COMMAND_SEQUENCE_GATE.json"
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("fails when required step is missing", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "freeze-sequence-missing-"));

  writeFile(
    tempRoot,
    "docs/releases/V1_OPERATOR_FREEZE_COMMAND_ORDER.json",
    JSON.stringify(
      {
        steps: [
          { script: "docs/releases/V1_FREEZE_STATE.json" },
          { script: "ci/scripts/build_operator_freeze_pack.mjs" }
        ]
      },
      null,
      2
    ) + "\n"
  );

  const result = runNode("ci/scripts/run_freeze_command_sequence_gate_verifier.mjs", [
    "--root", tempRoot,
    "--command-order", "docs/releases/V1_OPERATOR_FREEZE_COMMAND_ORDER.json",
    "--report", "docs/releases/V1_FREEZE_COMMAND_SEQUENCE_GATE.json"
  ]);

  assert.notEqual(result.status, 0, "expected verifier failure");
  const report = JSON.parse(fs.readFileSync(path.join(tempRoot, "docs/releases/V1_FREEZE_COMMAND_SEQUENCE_GATE.json"), "utf8"));
  assert.equal(report.failures.some((x) => x.details.includes("Required freeze command sequence step missing")), true);
});

test("fails when steps are out of order", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "freeze-sequence-order-"));

  writeFile(
    tempRoot,
    "docs/releases/V1_OPERATOR_FREEZE_COMMAND_ORDER.json",
    JSON.stringify(
      {
        steps: [
          { script: "ci/scripts/build_operator_freeze_pack.mjs" },
          { script: "docs/releases/V1_FREEZE_STATE.json" },
          { script: "ci/scripts/run_freeze_evidence_manifest_completeness_verifier.mjs" },
          { script: "ci/scripts/run_freeze_evidence_manifest_self_hash_verifier.mjs" },
          { script: "ci/scripts/run_mainline_freeze_preservation_verifier.mjs" },
          { script: "ci/scripts/run_operator_freeze_pack_composition_verifier.mjs" },
          { script: "ci/scripts/run_operator_freeze_bundle_preservation_verifier.mjs" },
          { script: "ci/scripts/run_operator_freeze_bundle_surface_completeness_verifier.mjs" }
        ]
      },
      null,
      2
    ) + "\n"
  );

  const result = runNode("ci/scripts/run_freeze_command_sequence_gate_verifier.mjs", [
    "--root", tempRoot,
    "--command-order", "docs/releases/V1_OPERATOR_FREEZE_COMMAND_ORDER.json",
    "--report", "docs/releases/V1_FREEZE_COMMAND_SEQUENCE_GATE.json"
  ]);

  assert.notEqual(result.status, 0, "expected verifier failure");
  const report = JSON.parse(fs.readFileSync(path.join(tempRoot, "docs/releases/V1_FREEZE_COMMAND_SEQUENCE_GATE.json"), "utf8"));
  assert.equal(report.failures.some((x) => x.token === "CI_ORDER_VIOLATION"), true);
});