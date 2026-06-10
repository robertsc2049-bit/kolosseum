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

test("passes when all required child reports exist and are ok", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "freeze-drift-report-pass-"));

  writeFile(tempRoot, "docs/releases/a.json", JSON.stringify({
    ok: true,
    verifier_id: "a",
    checked_at_utc: "2026-04-02T00:00:00.000Z",
    failures: []
  }, null, 2) + "\n");

  writeFile(tempRoot, "docs/releases/b.json", JSON.stringify({
    ok: true,
    verifier_id: "b",
    checked_at_utc: "2026-04-02T00:00:01.000Z",
    failures: []
  }, null, 2) + "\n");

  const result = runNode("ci/scripts/build_freeze_drift_report.mjs", [
    "--root", tempRoot,
    "--replace-child-reports",
    "--child-report", "docs/releases/a.json",
    "--child-report", "docs/releases/b.json",
    "--report", "docs/releases/V1_FREEZE_DRIFT_REPORT.json"
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(fs.readFileSync(path.join(tempRoot, "docs/releases/V1_FREEZE_DRIFT_REPORT.json"), "utf8"));
  assert.equal(report.ok, true);
  assert.equal(report.child_report_count, 2);
  assert.equal(report.child_reports.length, 2);
});

test("fails when child report is missing", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "freeze-drift-report-missing-"));

  const result = runNode("ci/scripts/build_freeze_drift_report.mjs", [
    "--root", tempRoot,
    "--replace-child-reports",
    "--child-report", "docs/releases/missing.json",
    "--report", "docs/releases/V1_FREEZE_DRIFT_REPORT.json"
  ]);

  assert.notEqual(result.status, 0, "expected builder failure");

  const report = JSON.parse(fs.readFileSync(path.join(tempRoot, "docs/releases/V1_FREEZE_DRIFT_REPORT.json"), "utf8"));
  assert.equal(report.ok, false);
  assert.equal(report.failures.some((x) => x.token === "CI_SPINE_MISSING_DOC"), true);
});

test("fails when child report exists but is not ok", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "freeze-drift-report-notok-"));

  writeFile(tempRoot, "docs/releases/a.json", JSON.stringify({
    ok: false,
    verifier_id: "a",
    failures: [{ token: "X" }]
  }, null, 2) + "\n");

  const result = runNode("ci/scripts/build_freeze_drift_report.mjs", [
    "--root", tempRoot,
    "--replace-child-reports",
    "--child-report", "docs/releases/a.json",
    "--report", "docs/releases/V1_FREEZE_DRIFT_REPORT.json"
  ]);

  assert.notEqual(result.status, 0, "expected builder failure");

  const report = JSON.parse(fs.readFileSync(path.join(tempRoot, "docs/releases/V1_FREEZE_DRIFT_REPORT.json"), "utf8"));
  assert.equal(report.ok, false);
  assert.equal(report.failures.some((x) => x.token === "CI_MISSING_REQUIRED_PROOF"), true);
});