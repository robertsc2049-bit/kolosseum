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

test("passes when no freeze-governed artefacts changed", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "freeze-mainline-entry-pass-no-governed-"));

  writeFile(
    tempRoot,
    "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST.json",
    JSON.stringify(
      {
        governed_artefacts: [
          { path: "docs/releases/V1_FREEZE_STATE.json", sha256: "a".repeat(64) }
        ]
      },
      null,
      2
    ) + "\n"
  );

  const result = runNode("ci/scripts/run_freeze_mainline_entry_guard.mjs", [
    "--root", tempRoot,
    "--changed-file", "src/app.ts",
    "--manifest", "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST.json",
    "--report", "docs/releases/V1_FREEZE_MAINLINE_ENTRY_GUARD.json"
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("passes when governed artefact changed and all required proofs are ok", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "freeze-mainline-entry-pass-proofs-"));

  writeFile(
    tempRoot,
    "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST.json",
    JSON.stringify(
      {
        governed_artefacts: [
          { path: "docs/releases/V1_FREEZE_STATE.json", sha256: "a".repeat(64) }
        ]
      },
      null,
      2
    ) + "\n"
  );

  writeFile(tempRoot, "docs/releases/V1_MAINLINE_FREEZE_PRESERVATION.json", JSON.stringify({ ok: true }, null, 2) + "\n");
  writeFile(tempRoot, "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST_COMPLETENESS.json", JSON.stringify({ ok: true }, null, 2) + "\n");
  writeFile(tempRoot, "docs/releases/V1_OPERATOR_FREEZE_BUNDLE_PRESERVATION.json", JSON.stringify({ ok: true }, null, 2) + "\n");

  const result = runNode("ci/scripts/run_freeze_mainline_entry_guard.mjs", [
    "--root", tempRoot,
    "--changed-file", "docs/releases/V1_FREEZE_STATE.json",
    "--manifest", "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST.json",
    "--preservation-report", "docs/releases/V1_MAINLINE_FREEZE_PRESERVATION.json",
    "--completeness-report", "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST_COMPLETENESS.json",
    "--pack-report", "docs/releases/V1_OPERATOR_FREEZE_BUNDLE_PRESERVATION.json",
    "--report", "docs/releases/V1_FREEZE_MAINLINE_ENTRY_GUARD.json"
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("fails when governed artefact changed and proof is missing", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "freeze-mainline-entry-fail-missing-proof-"));

  writeFile(
    tempRoot,
    "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST.json",
    JSON.stringify(
      {
        governed_artefacts: [
          { path: "docs/releases/V1_FREEZE_STATE.json", sha256: "a".repeat(64) }
        ]
      },
      null,
      2
    ) + "\n"
  );

  writeFile(tempRoot, "docs/releases/V1_MAINLINE_FREEZE_PRESERVATION.json", JSON.stringify({ ok: true }, null, 2) + "\n");
  writeFile(tempRoot, "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST_COMPLETENESS.json", JSON.stringify({ ok: true }, null, 2) + "\n");

  const result = runNode("ci/scripts/run_freeze_mainline_entry_guard.mjs", [
    "--root", tempRoot,
    "--changed-file", "docs/releases/V1_FREEZE_STATE.json",
    "--manifest", "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST.json",
    "--preservation-report", "docs/releases/V1_MAINLINE_FREEZE_PRESERVATION.json",
    "--completeness-report", "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST_COMPLETENESS.json",
    "--pack-report", "docs/releases/V1_OPERATOR_FREEZE_BUNDLE_PRESERVATION.json",
    "--report", "docs/releases/V1_FREEZE_MAINLINE_ENTRY_GUARD.json"
  ]);

  assert.notEqual(result.status, 0, "expected verifier failure");
  const report = JSON.parse(fs.readFileSync(path.join(tempRoot, "docs/releases/V1_FREEZE_MAINLINE_ENTRY_GUARD.json"), "utf8"));
  assert.equal(report.failures.some((x) => x.token === "CI_MISSING_REQUIRED_PROOF"), true);
});

test("fails when governed artefact changed and proof report exists but is not ok", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "freeze-mainline-entry-fail-bad-proof-"));

  writeFile(
    tempRoot,
    "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST.json",
    JSON.stringify(
      {
        governed_artefacts: [
          { path: "docs/releases/V1_FREEZE_STATE.json", sha256: "a".repeat(64) }
        ]
      },
      null,
      2
    ) + "\n"
  );

  writeFile(tempRoot, "docs/releases/V1_MAINLINE_FREEZE_PRESERVATION.json", JSON.stringify({ ok: true }, null, 2) + "\n");
  writeFile(tempRoot, "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST_COMPLETENESS.json", JSON.stringify({ ok: false }, null, 2) + "\n");
  writeFile(tempRoot, "docs/releases/V1_OPERATOR_FREEZE_BUNDLE_PRESERVATION.json", JSON.stringify({ ok: true }, null, 2) + "\n");

  const result = runNode("ci/scripts/run_freeze_mainline_entry_guard.mjs", [
    "--root", tempRoot,
    "--changed-file", "docs/releases/V1_FREEZE_STATE.json",
    "--manifest", "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST.json",
    "--preservation-report", "docs/releases/V1_MAINLINE_FREEZE_PRESERVATION.json",
    "--completeness-report", "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST_COMPLETENESS.json",
    "--pack-report", "docs/releases/V1_OPERATOR_FREEZE_BUNDLE_PRESERVATION.json",
    "--report", "docs/releases/V1_FREEZE_MAINLINE_ENTRY_GUARD.json"
  ]);

  assert.notEqual(result.status, 0, "expected verifier failure");
  const report = JSON.parse(fs.readFileSync(path.join(tempRoot, "docs/releases/V1_FREEZE_MAINLINE_ENTRY_GUARD.json"), "utf8"));
  assert.equal(report.failures.some((x) => x.token === "CI_MISSING_REQUIRED_PROOF"), true);
});