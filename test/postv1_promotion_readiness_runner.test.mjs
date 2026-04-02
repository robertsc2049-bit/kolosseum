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

function okReport(verifierId) {
  return JSON.stringify(
    {
      ok: true,
      verifier_id: verifierId,
      checked_at_utc: "2026-04-02T00:00:00.000Z",
      failures: []
    },
    null,
    2
  ) + "\n";
}

test("passes when every bound freeze proof report is present and ok", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "promotion-readiness-pass-"));

  const required = [
    "docs/releases/V1_FREEZE_ROLLBACK_COMPATIBILITY.json",
    "docs/releases/V1_MAINLINE_FREEZE_PRESERVATION.json",
    "docs/releases/V1_OPERATOR_FREEZE_BUNDLE_PRESERVATION.json"
  ];

  for (const relPath of required) {
    writeFile(tempRoot, relPath, okReport(path.basename(relPath, ".json")));
  }

  const result = runNode("ci/scripts/run_postv1_promotion_readiness_runner.mjs", [
    "--root", tempRoot,
    "--replace-required-reports",
    "--required-report", "docs/releases/V1_FREEZE_ROLLBACK_COMPATIBILITY.json",
    "--required-report", "docs/releases/V1_MAINLINE_FREEZE_PRESERVATION.json",
    "--required-report", "docs/releases/V1_OPERATOR_FREEZE_BUNDLE_PRESERVATION.json",
    "--output", "docs/releases/V1_PROMOTION_READINESS.json"
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(
    fs.readFileSync(path.join(tempRoot, "docs/releases/V1_PROMOTION_READINESS.json"), "utf8")
  );

  assert.equal(report.ok, true);
  assert.equal(report.failures.length, 0);
  assert.equal(report.required_reports.length, 3);
});

test("fails when a required freeze proof report is missing", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "promotion-readiness-missing-"));

  writeFile(
    tempRoot,
    "docs/releases/V1_FREEZE_ROLLBACK_COMPATIBILITY.json",
    okReport("freeze_rollback_compatibility_verifier")
  );

  const result = runNode("ci/scripts/run_postv1_promotion_readiness_runner.mjs", [
    "--root", tempRoot,
    "--replace-required-reports",
    "--required-report", "docs/releases/V1_FREEZE_ROLLBACK_COMPATIBILITY.json",
    "--required-report", "docs/releases/V1_MAINLINE_FREEZE_PRESERVATION.json",
    "--output", "docs/releases/V1_PROMOTION_READINESS.json"
  ]);

  assert.notEqual(result.status, 0, "expected readiness failure");

  const report = JSON.parse(
    fs.readFileSync(path.join(tempRoot, "docs/releases/V1_PROMOTION_READINESS.json"), "utf8")
  );

  assert.equal(report.ok, false);
  assert.equal(report.failures.some((x) => x.token === "CI_SPINE_MISSING_DOC"), true);
});

test("fails when a required freeze proof report exists but is not ok", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "promotion-readiness-bad-proof-"));

  writeFile(
    tempRoot,
    "docs/releases/V1_FREEZE_ROLLBACK_COMPATIBILITY.json",
    JSON.stringify(
      {
        ok: false,
        verifier_id: "freeze_rollback_compatibility_verifier",
        checked_at_utc: "2026-04-02T00:00:00.000Z",
        failures: [{ token: "X" }]
      },
      null,
      2
    ) + "\n"
  );

  const result = runNode("ci/scripts/run_postv1_promotion_readiness_runner.mjs", [
    "--root", tempRoot,
    "--replace-required-reports",
    "--required-report", "docs/releases/V1_FREEZE_ROLLBACK_COMPATIBILITY.json",
    "--output", "docs/releases/V1_PROMOTION_READINESS.json"
  ]);

  assert.notEqual(result.status, 0, "expected readiness failure");

  const report = JSON.parse(
    fs.readFileSync(path.join(tempRoot, "docs/releases/V1_PROMOTION_READINESS.json"), "utf8")
  );

  assert.equal(report.ok, false);
  assert.equal(report.failures.some((x) => x.token === "CI_MISSING_REQUIRED_PROOF"), true);
});