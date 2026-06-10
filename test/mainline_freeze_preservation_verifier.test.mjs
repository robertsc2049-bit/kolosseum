import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";

function writeFile(root, relativePath, content) {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content.replace(/\r\n/g, "\n"), "utf8");
}

function sha256(content) {
  return crypto.createHash("sha256").update(Buffer.from(content.replace(/\r\n/g, "\n"), "utf8")).digest("hex");
}

function runVerifier(tempRoot, extraArgs = []) {
  const scriptPath = path.resolve("ci/scripts/run_mainline_freeze_preservation_verifier.mjs");
  return spawnSync(
    process.execPath,
    [scriptPath, "--root", tempRoot, ...extraArgs],
    { encoding: "utf8" }
  );
}

test("passes when mainline preserves all governed artefacts", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mainline-freeze-preserve-pass-"));

  const freezeRunbook = "# freeze runbook\n";
  const freezeState = "{\n  \"ok\": true\n}\n";

  writeFile(tempRoot, "docs/releases/V1_OPERATOR_FREEZE_RUNBOOK.md", freezeRunbook);
  writeFile(tempRoot, "docs/releases/V1_FREEZE_STATE.json", freezeState);

  writeFile(
    tempRoot,
    "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST.json",
    JSON.stringify(
      {
        artefacts: [
          {
            path: "docs/releases/V1_OPERATOR_FREEZE_RUNBOOK.md",
            sha256: sha256(freezeRunbook)
          },
          {
            path: "docs/releases/V1_FREEZE_STATE.json",
            sha256: sha256(freezeState)
          }
        ]
      },
      null,
      2
    ) + "\n"
  );

  const result = runVerifier(tempRoot);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(
    fs.readFileSync(path.join(tempRoot, "docs/releases/V1_MAINLINE_FREEZE_PRESERVATION.json"), "utf8")
  );

  assert.equal(report.ok, true);
  assert.equal(report.failures.length, 0);
  assert.equal(report.governed_artefact_count, 2);
});

test("fails when governed artefact drifts on mainline", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mainline-freeze-preserve-drift-"));

  const sealedContent = "# frozen bytes\n";
  writeFile(tempRoot, "docs/releases/V1_OPERATOR_FREEZE_RUNBOOK.md", "# changed on mainline\n");

  writeFile(
    tempRoot,
    "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST.json",
    JSON.stringify(
      {
        artefacts: [
          {
            path: "docs/releases/V1_OPERATOR_FREEZE_RUNBOOK.md",
            sha256: sha256(sealedContent)
          }
        ]
      },
      null,
      2
    ) + "\n"
  );

  const result = runVerifier(tempRoot);
  assert.notEqual(result.status, 0, "expected verifier failure");

  const report = JSON.parse(
    fs.readFileSync(path.join(tempRoot, "docs/releases/V1_MAINLINE_FREEZE_PRESERVATION.json"), "utf8")
  );

  assert.equal(report.ok, false);
  assert.equal(report.failures.length, 1);
  assert.equal(report.failures[0].token, "CI_MANIFEST_MISMATCH");
});

test("fails when freeze evidence manifest is missing", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mainline-freeze-preserve-missing-"));

  const result = runVerifier(tempRoot);
  assert.notEqual(result.status, 0, "expected verifier failure");

  const report = JSON.parse(
    fs.readFileSync(path.join(tempRoot, "docs/releases/V1_MAINLINE_FREEZE_PRESERVATION.json"), "utf8")
  );

  assert.equal(report.ok, false);
  assert.equal(report.failures[0].token, "CI_SPINE_MISSING_DOC");
});

test("fails when manifest exposes no governed artefacts", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mainline-freeze-preserve-empty-"));

  writeFile(
    tempRoot,
    "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST.json",
    JSON.stringify({ artefacts: [] }, null, 2) + "\n"
  );

  const result = runVerifier(tempRoot);
  assert.notEqual(result.status, 0, "expected verifier failure");

  const report = JSON.parse(
    fs.readFileSync(path.join(tempRoot, "docs/releases/V1_MAINLINE_FREEZE_PRESERVATION.json"), "utf8")
  );

  assert.equal(report.ok, false);
  assert.equal(report.failures[0].token, "CI_MISSING_HARD_FAIL");
});