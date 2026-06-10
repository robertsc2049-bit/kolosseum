import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { verifyFreezeRunbookClosureBind } from "../ci/scripts/run_freeze_runbook_closure_bind_verifier.mjs";

const REQUIRED_PATHS = [
  "docs/releases/V1_FREEZE_DRIFT_STATUS.json",
  "docs/releases/V1_FREEZE_EXIT_CRITERIA.json",
  "docs/releases/V1_FREEZE_PACK_REBUILD_CLEANLINESS.json",
  "docs/releases/V1_FREEZE_PROOF_CHAIN.json",
  "docs/releases/V1_FREEZE_PROOF_INDEX.json",
  "docs/releases/V1_OPERATOR_FREEZE_BUNDLE_PRESERVATION.json",
  "docs/releases/V1_PROMOTION_READINESS.json"
].sort((a, b) => a.localeCompare(b));

function writeText(root, relativePath, content) {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content.replace(/\r\n/g, "\n"), "utf8");
  return fullPath;
}

function makeRunbook(root, referencedPaths) {
  const lines = [
    "# Operator Freeze Runbook",
    "",
    "Freeze completion depends on the following artefacts:",
    ""
  ];

  for (const relPath of referencedPaths) {
    lines.push(`- ${relPath}`);
  }

  lines.push("");
  return writeText(root, "docs/releases/V1_OPERATOR_FREEZE_RUNBOOK.md", lines.join("\n"));
}

test("passes when runbook references all closure artefacts", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "freeze-runbook-bind-pass-"));
  const runbook = makeRunbook(tempRoot, REQUIRED_PATHS);

  const result = verifyFreezeRunbookClosureBind({
    root: tempRoot,
    runbookPath: path.relative(tempRoot, runbook).replace(/\\/g, "/")
  });

  assert.equal(result.ok, true);
  assert.equal(result.verifier_id, "freeze_runbook_closure_bind_verifier");
  assert.equal(result.required_closure_components.length, 7);
});

test("fails when runbook omits a required closure artefact reference", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "freeze-runbook-bind-missing-"));
  const runbook = makeRunbook(
    tempRoot,
    REQUIRED_PATHS.filter((x) => x !== "docs/releases/V1_PROMOTION_READINESS.json")
  );

  const result = verifyFreezeRunbookClosureBind({
    root: tempRoot,
    runbookPath: path.relative(tempRoot, runbook).replace(/\\/g, "/")
  });

  assert.equal(result.ok, false);
  assert.equal(result.failures[0].token, "CI_MANIFEST_MISMATCH");
  assert.equal(result.failures[0].missing_components.some((x) => x.path === "docs/releases/V1_PROMOTION_READINESS.json"), true);
});

test("fails when runbook uses stale closure artefact path", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "freeze-runbook-bind-stale-"));
  const stalePaths = REQUIRED_PATHS
    .filter((x) => x !== "docs/releases/V1_FREEZE_DRIFT_STATUS.json")
    .concat("docs/releases/V1_FREEZE_DRIFT_REPORT.json")
    .sort((a, b) => a.localeCompare(b));

  const runbook = makeRunbook(tempRoot, stalePaths);

  const result = verifyFreezeRunbookClosureBind({
    root: tempRoot,
    runbookPath: path.relative(tempRoot, runbook).replace(/\\/g, "/")
  });

  assert.equal(result.ok, false);
  assert.equal(result.failures[0].token, "CI_MANIFEST_MISMATCH");
  assert.equal(result.failures[0].missing_components.some((x) => x.path === "docs/releases/V1_FREEZE_DRIFT_STATUS.json"), true);
});

test("emits JSON-safe success shape", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "freeze-runbook-bind-shape-"));
  const runbook = makeRunbook(tempRoot, REQUIRED_PATHS);

  const result = verifyFreezeRunbookClosureBind({
    root: tempRoot,
    runbookPath: path.relative(tempRoot, runbook).replace(/\\/g, "/")
  });

  const serialised = JSON.parse(JSON.stringify(result));

  assert.deepEqual(Object.keys(serialised).sort(), [
    "checked_at_utc",
    "ok",
    "required_closure_components",
    "runbook_path",
    "verifier_id"
  ]);

  assert.equal(serialised.ok, true);
  assert.equal(serialised.required_closure_components.length, 7);
});
