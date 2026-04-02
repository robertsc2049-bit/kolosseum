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

function goodReport(verifierId) {
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

function requiredReportPaths() {
  return [
    "docs/releases/V1_FREEZE_ROLLBACK_COMPATIBILITY.json",
    "docs/releases/V1_MAINLINE_FREEZE_PRESERVATION.json",
    "docs/releases/V1_OPERATOR_FREEZE_BUNDLE_PRESERVATION.json",
    "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST_COMPLETENESS.json",
    "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST_SELF_HASH.json",
    "docs/releases/V1_OPERATOR_FREEZE_BUNDLE_SURFACE_COMPLETENESS.json",
    "docs/releases/V1_FREEZE_COMMAND_SEQUENCE_GATE.json",
    "docs/releases/V1_FREEZE_MAINLINE_ENTRY_GUARD.json",
    "docs/releases/V1_FREEZE_DRIFT_REPORT.json",
    "docs/releases/V1_FREEZE_DRIFT_SINCE_MERGE_BASE.json"
  ];
}

test("passes when freeze state is sealed and every required freeze proof report is present and ok", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "freeze-exit-criteria-pass-"));

  writeFile(
    tempRoot,
    "docs/releases/V1_FREEZE_STATE.json",
    JSON.stringify(
      {
        freeze_state: "sealed",
        freeze_declared: true
      },
      null,
      2
    ) + "\n"
  );

  for (const relPath of requiredReportPaths()) {
    writeFile(tempRoot, relPath, goodReport(path.basename(relPath, ".json")));
  }

  const result = runNode("ci/scripts/run_freeze_exit_criteria_verifier.mjs", [
    "--root", tempRoot,
    "--freeze-state", "docs/releases/V1_FREEZE_STATE.json",
    "--report", "docs/releases/V1_FREEZE_EXIT_CRITERIA.json"
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(
    fs.readFileSync(path.join(tempRoot, "docs/releases/V1_FREEZE_EXIT_CRITERIA.json"), "utf8")
  );

  assert.equal(report.ok, true);
  assert.equal(report.failures.length, 0);
  assert.equal(report.required_freeze_proof_reports.length, 10);
});

test("fails when a required freeze proof report is missing", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "freeze-exit-criteria-missing-"));

  writeFile(
    tempRoot,
    "docs/releases/V1_FREEZE_STATE.json",
    JSON.stringify(
      {
        freeze_state: "sealed",
        freeze_declared: true
      },
      null,
      2
    ) + "\n"
  );

  const paths = requiredReportPaths();
  for (let i = 0; i < paths.length - 1; i += 1) {
    writeFile(tempRoot, paths[i], goodReport(path.basename(paths[i], ".json")));
  }

  const result = runNode("ci/scripts/run_freeze_exit_criteria_verifier.mjs", [
    "--root", tempRoot,
    "--freeze-state", "docs/releases/V1_FREEZE_STATE.json",
    "--report", "docs/releases/V1_FREEZE_EXIT_CRITERIA.json"
  ]);

  assert.notEqual(result.status, 0, "expected verifier failure");

  const report = JSON.parse(
    fs.readFileSync(path.join(tempRoot, "docs/releases/V1_FREEZE_EXIT_CRITERIA.json"), "utf8")
  );

  assert.equal(report.ok, false);
  assert.equal(report.failures.some((x) => x.token === "CI_SPINE_MISSING_DOC"), true);
});

test("fails when a required freeze proof report exists but is not ok", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "freeze-exit-criteria-bad-proof-"));

  writeFile(
    tempRoot,
    "docs/releases/V1_FREEZE_STATE.json",
    JSON.stringify(
      {
        freeze_state: "sealed",
        freeze_declared: true
      },
      null,
      2
    ) + "\n"
  );

  const paths = requiredReportPaths();
  for (const relPath of paths) {
    writeFile(tempRoot, relPath, goodReport(path.basename(relPath, ".json")));
  }

  writeFile(
    tempRoot,
    "docs/releases/V1_FREEZE_DRIFT_REPORT.json",
    JSON.stringify(
      {
        ok: false,
        verifier_id: "freeze_drift_report_builder",
        checked_at_utc: "2026-04-02T00:00:00.000Z",
        failures: [{ token: "X" }]
      },
      null,
      2
    ) + "\n"
  );

  const result = runNode("ci/scripts/run_freeze_exit_criteria_verifier.mjs", [
    "--root", tempRoot,
    "--freeze-state", "docs/releases/V1_FREEZE_STATE.json",
    "--report", "docs/releases/V1_FREEZE_EXIT_CRITERIA.json"
  ]);

  assert.notEqual(result.status, 0, "expected verifier failure");

  const report = JSON.parse(
    fs.readFileSync(path.join(tempRoot, "docs/releases/V1_FREEZE_EXIT_CRITERIA.json"), "utf8")
  );

  assert.equal(report.ok, false);
  assert.equal(report.failures.some((x) => x.token === "CI_MISSING_REQUIRED_PROOF"), true);
});

test("fails when freeze state is not sealed", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "freeze-exit-criteria-state-"));

  writeFile(
    tempRoot,
    "docs/releases/V1_FREEZE_STATE.json",
    JSON.stringify(
      {
        freeze_state: "pre_seal",
        freeze_declared: true
      },
      null,
      2
    ) + "\n"
  );

  for (const relPath of requiredReportPaths()) {
    writeFile(tempRoot, relPath, goodReport(path.basename(relPath, ".json")));
  }

  const result = runNode("ci/scripts/run_freeze_exit_criteria_verifier.mjs", [
    "--root", tempRoot,
    "--freeze-state", "docs/releases/V1_FREEZE_STATE.json",
    "--report", "docs/releases/V1_FREEZE_EXIT_CRITERIA.json"
  ]);

  assert.notEqual(result.status, 0, "expected verifier failure");

  const report = JSON.parse(
    fs.readFileSync(path.join(tempRoot, "docs/releases/V1_FREEZE_EXIT_CRITERIA.json"), "utf8")
  );

  assert.equal(report.ok, false);
  assert.equal(report.failures.some((x) => x.details.includes("freeze_state to be sealed")), true);
});