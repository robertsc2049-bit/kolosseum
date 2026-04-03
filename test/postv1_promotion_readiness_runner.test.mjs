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

function writeJson(root, relativePath, value) {
  writeFile(root, relativePath, JSON.stringify(value, null, 2) + "\n");
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
      checked_at_utc: "2026-04-03T00:00:00.000Z",
      failures: []
    },
    null,
    2
  ) + "\n";
}

function writeClosureOkFixtures(root) {
  writeJson(root, "docs/releases/V1_FREEZE_PROOF_INDEX.json", {
    ok: true,
    verifier_id: "freeze_proof_index_verifier",
    entries: [
      { proof_id: "proof-001", artifact: "docs/releases/V1_FREEZE_PROOF_INDEX.json" }
    ]
  });

  writeJson(root, "docs/releases/V1_FREEZE_PROOF_CHAIN.json", {
    ok: true,
    verifier_id: "freeze_proof_chain_verifier",
    proof_index_id: "freeze_proof_index_verifier",
    chain: [
      { step_id: "chain-001", proof_id: "proof-001" }
    ]
  });

  writeJson(root, "docs/releases/V1_FREEZE_DRIFT_STATUS.json", {
    ok: true,
    verifier_id: "freeze_drift_status_verifier",
    failures: []
  });

  writeJson(root, "docs/releases/V1_OPERATOR_FREEZE_BUNDLE_PRESERVATION.json", {
    ok: true,
    verifier_id: "operator_freeze_bundle_preservation_verifier",
    failures: []
  });

  writeJson(root, "docs/releases/V1_FREEZE_PACK_REBUILD_CLEANLINESS.json", {
    ok: true,
    verifier_id: "freeze_pack_rebuild_cleanliness_verifier",
    failures: []
  });

  writeJson(root, "docs/releases/V1_FREEZE_EXIT_CRITERIA.json", {
    ok: true,
    verifier_id: "freeze_exit_criteria_verifier",
    failures: []
  });
}

test("passes when required freeze reports are present and closure gate also passes", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "promotion-readiness-pass-"));

  writeClosureOkFixtures(tempRoot);

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
  assert.equal(report.closure_gate.invoked, true);
  assert.equal(report.closure_gate.ok, true);
  assert.equal(report.closure_gate.verifier_id, "freeze_governance_closure_gate");
});

test("fails when a required freeze proof report is missing", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "promotion-readiness-missing-"));

  writeClosureOkFixtures(tempRoot);

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
  assert.equal(report.closure_gate.invoked, false);
});

test("fails when a required freeze proof report exists but is not ok", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "promotion-readiness-bad-proof-"));

  writeClosureOkFixtures(tempRoot);

  writeJson(tempRoot, "docs/releases/V1_FREEZE_ROLLBACK_COMPATIBILITY.json", {
    ok: false,
    verifier_id: "freeze_rollback_compatibility_verifier",
    checked_at_utc: "2026-04-03T00:00:00.000Z",
    failures: [{ token: "X" }]
  });

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
  assert.equal(report.closure_gate.invoked, false);
});

test("fails when required freeze reports pass but closure gate is broken, proving invocation is mandatory", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "promotion-readiness-closure-mandatory-"));

  writeClosureOkFixtures(tempRoot);
  fs.unlinkSync(path.join(tempRoot, "docs/releases/V1_FREEZE_PROOF_INDEX.json"));

  writeFile(
    tempRoot,
    "docs/releases/V1_FREEZE_ROLLBACK_COMPATIBILITY.json",
    okReport("freeze_rollback_compatibility_verifier")
  );

  writeFile(
    tempRoot,
    "docs/releases/V1_MAINLINE_FREEZE_PRESERVATION.json",
    okReport("mainline_freeze_preservation_verifier")
  );

  writeFile(
    tempRoot,
    "docs/releases/V1_OPERATOR_FREEZE_BUNDLE_PRESERVATION.json",
    okReport("operator_freeze_bundle_preservation_verifier")
  );

  const result = runNode("ci/scripts/run_postv1_promotion_readiness_runner.mjs", [
    "--root", tempRoot,
    "--replace-required-reports",
    "--required-report", "docs/releases/V1_FREEZE_ROLLBACK_COMPATIBILITY.json",
    "--required-report", "docs/releases/V1_MAINLINE_FREEZE_PRESERVATION.json",
    "--required-report", "docs/releases/V1_OPERATOR_FREEZE_BUNDLE_PRESERVATION.json",
    "--output", "docs/releases/V1_PROMOTION_READINESS.json"
  ]);

  assert.notEqual(result.status, 0, "expected readiness failure from closure gate");

  const report = JSON.parse(
    fs.readFileSync(path.join(tempRoot, "docs/releases/V1_PROMOTION_READINESS.json"), "utf8")
  );

  assert.equal(report.ok, false);
  assert.equal(report.closure_gate.invoked, true);
  assert.equal(report.closure_gate.ok, false);
  assert.equal(report.failures.some((x) => x.verifier_id === "freeze_governance_closure_gate"), true);
});
