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

function goodChild(pathValue) {
  return {
    path: pathValue,
    ok: true,
    verifier_id: path.basename(pathValue, ".json"),
    checked_at_utc: "2026-04-02T00:00:00.000Z",
    failure_count: 0
  };
}

test("passes when no governed files changed", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "freeze-drift-since-base-pass-nodrift-"));

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

  writeFile(
    tempRoot,
    "docs/releases/V1_FREEZE_DRIFT_REPORT.json",
    JSON.stringify(
      {
        ok: true,
        child_reports: [
          goodChild("docs/releases/V1_FREEZE_ROLLBACK_COMPATIBILITY.json"),
          goodChild("docs/releases/V1_MAINLINE_FREEZE_PRESERVATION.json"),
          goodChild("docs/releases/V1_OPERATOR_FREEZE_BUNDLE_PRESERVATION.json"),
          goodChild("docs/releases/V1_FREEZE_EVIDENCE_MANIFEST_COMPLETENESS.json")
        ]
      },
      null,
      2
    ) + "\n"
  );

  const result = runNode("ci/scripts/run_freeze_drift_since_merge_base_verifier.mjs", [
    "--root", tempRoot,
    "--manifest", "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST.json",
    "--drift-report", "docs/releases/V1_FREEZE_DRIFT_REPORT.json",
    "--changed-file", "src/app.ts",
    "--report", "docs/releases/V1_FREEZE_DRIFT_SINCE_MERGE_BASE.json"
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("passes when governed files changed and aggregate is present with required child proofs", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "freeze-drift-since-base-pass-proof-"));

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

  writeFile(
    tempRoot,
    "docs/releases/V1_FREEZE_DRIFT_REPORT.json",
    JSON.stringify(
      {
        ok: true,
        child_reports: [
          goodChild("docs/releases/V1_FREEZE_ROLLBACK_COMPATIBILITY.json"),
          goodChild("docs/releases/V1_MAINLINE_FREEZE_PRESERVATION.json"),
          goodChild("docs/releases/V1_OPERATOR_FREEZE_BUNDLE_PRESERVATION.json"),
          goodChild("docs/releases/V1_FREEZE_EVIDENCE_MANIFEST_COMPLETENESS.json")
        ]
      },
      null,
      2
    ) + "\n"
  );

  const result = runNode("ci/scripts/run_freeze_drift_since_merge_base_verifier.mjs", [
    "--root", tempRoot,
    "--manifest", "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST.json",
    "--drift-report", "docs/releases/V1_FREEZE_DRIFT_REPORT.json",
    "--changed-file", "docs/releases/V1_FREEZE_STATE.json",
    "--report", "docs/releases/V1_FREEZE_DRIFT_SINCE_MERGE_BASE.json"
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("fails when governed files changed and aggregate report is missing", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "freeze-drift-since-base-missing-report-"));

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

  const result = runNode("ci/scripts/run_freeze_drift_since_merge_base_verifier.mjs", [
    "--root", tempRoot,
    "--manifest", "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST.json",
    "--drift-report", "docs/releases/V1_FREEZE_DRIFT_REPORT.json",
    "--changed-file", "docs/releases/V1_FREEZE_STATE.json",
    "--report", "docs/releases/V1_FREEZE_DRIFT_SINCE_MERGE_BASE.json"
  ]);

  assert.notEqual(result.status, 0, "expected verifier failure");
  const report = JSON.parse(fs.readFileSync(path.join(tempRoot, "docs/releases/V1_FREEZE_DRIFT_SINCE_MERGE_BASE.json"), "utf8"));
  assert.equal(report.failures.some((x) => x.token === "CI_SPINE_MISSING_DOC"), true);
});

test("fails when governed files changed and aggregate report is not ok", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "freeze-drift-since-base-bad-report-"));

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

  writeFile(
    tempRoot,
    "docs/releases/V1_FREEZE_DRIFT_REPORT.json",
    JSON.stringify(
      {
        ok: false,
        child_reports: []
      },
      null,
      2
    ) + "\n"
  );

  const result = runNode("ci/scripts/run_freeze_drift_since_merge_base_verifier.mjs", [
    "--root", tempRoot,
    "--manifest", "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST.json",
    "--drift-report", "docs/releases/V1_FREEZE_DRIFT_REPORT.json",
    "--changed-file", "docs/releases/V1_FREEZE_STATE.json",
    "--report", "docs/releases/V1_FREEZE_DRIFT_SINCE_MERGE_BASE.json"
  ]);

  assert.notEqual(result.status, 0, "expected verifier failure");
  const report = JSON.parse(fs.readFileSync(path.join(tempRoot, "docs/releases/V1_FREEZE_DRIFT_SINCE_MERGE_BASE.json"), "utf8"));
  assert.equal(report.failures.some((x) => x.token === "CI_MISSING_REQUIRED_PROOF"), true);
});

test("fails when governed files changed and aggregate omits required child proof", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "freeze-drift-since-base-missing-child-"));

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

  writeFile(
    tempRoot,
    "docs/releases/V1_FREEZE_DRIFT_REPORT.json",
    JSON.stringify(
      {
        ok: true,
        child_reports: [
          goodChild("docs/releases/V1_FREEZE_ROLLBACK_COMPATIBILITY.json"),
          goodChild("docs/releases/V1_MAINLINE_FREEZE_PRESERVATION.json"),
          goodChild("docs/releases/V1_OPERATOR_FREEZE_BUNDLE_PRESERVATION.json")
        ]
      },
      null,
      2
    ) + "\n"
  );

  const result = runNode("ci/scripts/run_freeze_drift_since_merge_base_verifier.mjs", [
    "--root", tempRoot,
    "--manifest", "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST.json",
    "--drift-report", "docs/releases/V1_FREEZE_DRIFT_REPORT.json",
    "--changed-file", "docs/releases/V1_FREEZE_STATE.json",
    "--report", "docs/releases/V1_FREEZE_DRIFT_SINCE_MERGE_BASE.json"
  ]);

  assert.notEqual(result.status, 0, "expected verifier failure");
  const report = JSON.parse(fs.readFileSync(path.join(tempRoot, "docs/releases/V1_FREEZE_DRIFT_SINCE_MERGE_BASE.json"), "utf8"));
  assert.equal(report.failures.some((x) => x.token === "CI_MISSING_REQUIRED_PROOF"), true);
});