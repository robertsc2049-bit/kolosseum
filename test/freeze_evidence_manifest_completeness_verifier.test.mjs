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

test("passes when governed_artefacts fully matches expected governed set", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "freeze-manifest-complete-pass-"));

  writeFile(tempRoot, "docs/releases/V1_FREEZE_STATE.json", "{\n  \"ok\": true\n}\n");
  writeFile(tempRoot, "docs/releases/V1_OPERATOR_FREEZE_RUNBOOK.md", "# runbook\n");
  writeFile(tempRoot, "docs/releases/V1_FREEZE_ARTEFACT_SET.json", JSON.stringify({
    artefacts: [
      "docs/releases/V1_OPERATOR_FREEZE_RUNBOOK.md"
    ]
  }, null, 2) + "\n");

  writeFile(tempRoot, "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST.json", JSON.stringify({
    artefacts: [
      {
        evidence_id: "freeze_artefact_set",
        path: "docs/releases/V1_FREEZE_ARTEFACT_SET.json",
        content_type: "json",
        required: true
      }
    ],
    discovery: {
      include_globs: ["docs/releases/V1_FREEZE_*.json"],
      exclude_paths: ["docs/releases/V1_FREEZE_EVIDENCE_MANIFEST.json"]
    },
    governed_artefacts: [
      { path: "docs/releases/V1_FREEZE_ARTEFACT_SET.json", sha256: "a".repeat(64) },
      { path: "docs/releases/V1_FREEZE_STATE.json", sha256: "b".repeat(64) },
      { path: "docs/releases/V1_OPERATOR_FREEZE_RUNBOOK.md", sha256: "c".repeat(64) }
    ]
  }, null, 2) + "\n");

  const result = runNode("ci/scripts/run_freeze_evidence_manifest_completeness_verifier.mjs", [
    "--root", tempRoot,
    "--manifest", "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST.json",
    "--artefact-set", "docs/releases/V1_FREEZE_ARTEFACT_SET.json",
    "--report", "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST_COMPLETENESS.json"
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(fs.readFileSync(path.join(tempRoot, "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST_COMPLETENESS.json"), "utf8"));
  assert.equal(report.ok, true);
  assert.equal(report.failures.length, 0);
});

test("fails when a governed entry is missing", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "freeze-manifest-complete-missing-"));

  writeFile(tempRoot, "docs/releases/V1_FREEZE_STATE.json", "{\n  \"ok\": true\n}\n");
  writeFile(tempRoot, "docs/releases/V1_FREEZE_ARTEFACT_SET.json", JSON.stringify({
    artefacts: []
  }, null, 2) + "\n");

  writeFile(tempRoot, "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST.json", JSON.stringify({
    artefacts: [],
    discovery: {
      include_globs: ["docs/releases/V1_FREEZE_*.json"],
      exclude_paths: ["docs/releases/V1_FREEZE_EVIDENCE_MANIFEST.json"]
    },
    governed_artefacts: []
  }, null, 2) + "\n");

  const result = runNode("ci/scripts/run_freeze_evidence_manifest_completeness_verifier.mjs", [
    "--root", tempRoot,
    "--manifest", "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST.json",
    "--artefact-set", "docs/releases/V1_FREEZE_ARTEFACT_SET.json",
    "--report", "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST_COMPLETENESS.json"
  ]);

  assert.notEqual(result.status, 0, "expected verifier failure");
  const report = JSON.parse(fs.readFileSync(path.join(tempRoot, "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST_COMPLETENESS.json"), "utf8"));
  assert.equal(report.ok, false);
  assert.equal(report.failures.some((x) => x.details.includes("missing from governed_artefacts")), true);
});

test("fails when a stale extra governed entry exists", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "freeze-manifest-complete-stale-"));

  writeFile(tempRoot, "docs/releases/V1_FREEZE_ARTEFACT_SET.json", JSON.stringify({
    artefacts: []
  }, null, 2) + "\n");

  writeFile(tempRoot, "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST.json", JSON.stringify({
    artefacts: [],
    discovery: {
      include_globs: [],
      exclude_paths: []
    },
    governed_artefacts: [
      { path: "docs/releases/STALE.json", sha256: "a".repeat(64) }
    ]
  }, null, 2) + "\n");

  const result = runNode("ci/scripts/run_freeze_evidence_manifest_completeness_verifier.mjs", [
    "--root", tempRoot,
    "--manifest", "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST.json",
    "--artefact-set", "docs/releases/V1_FREEZE_ARTEFACT_SET.json",
    "--report", "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST_COMPLETENESS.json"
  ]);

  assert.notEqual(result.status, 0, "expected verifier failure");
  const report = JSON.parse(fs.readFileSync(path.join(tempRoot, "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST_COMPLETENESS.json"), "utf8"));
  assert.equal(report.ok, false);
  assert.equal(report.failures.some((x) => x.details.includes("Stale extra governed_artefacts")), true);
});

test("fails when governed_artefacts contains duplicate paths", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "freeze-manifest-complete-duplicate-"));

  writeFile(tempRoot, "docs/releases/V1_FREEZE_ARTEFACT_SET.json", JSON.stringify({
    artefacts: []
  }, null, 2) + "\n");

  writeFile(tempRoot, "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST.json", JSON.stringify({
    artefacts: [],
    discovery: {
      include_globs: [],
      exclude_paths: []
    },
    governed_artefacts: [
      { path: "docs/releases/X.json", sha256: "a".repeat(64) },
      { path: "docs/releases/X.json", sha256: "b".repeat(64) }
    ]
  }, null, 2) + "\n");

  const result = runNode("ci/scripts/run_freeze_evidence_manifest_completeness_verifier.mjs", [
    "--root", tempRoot,
    "--manifest", "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST.json",
    "--artefact-set", "docs/releases/V1_FREEZE_ARTEFACT_SET.json",
    "--report", "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST_COMPLETENESS.json"
  ]);

  assert.notEqual(result.status, 0, "expected verifier failure");
  const report = JSON.parse(fs.readFileSync(path.join(tempRoot, "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST_COMPLETENESS.json"), "utf8"));
  assert.equal(report.ok, false);
  assert.equal(report.failures.some((x) => x.details.includes("Duplicate governed_artefacts path")), true);
});