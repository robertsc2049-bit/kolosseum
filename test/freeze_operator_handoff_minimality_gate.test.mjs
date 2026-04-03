import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { verifyFreezeOperatorHandoffMinimality } from "../ci/scripts/run_freeze_operator_handoff_minimality_gate.mjs";

function writeFile(rootDir, relativePath, content) {
  const fullPath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
  return fullPath;
}

function writeJson(rootDir, relativePath, value) {
  return writeFile(rootDir, relativePath, JSON.stringify(value, null, 2));
}

function makeFixtureRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "freeze-operator-handoff-minimality-"));
}

function buildExactFixture(rootDir) {
  writeFile(
    rootDir,
    "docs/releases/V1_OPERATOR_FREEZE_RUNBOOK.md",
    [
      "# Operator Freeze Runbook",
      "",
      "- Execute `ci/scripts/run_postv1_freeze_readiness_runner.mjs`",
      "- Review `docs/releases/V1_FREEZE_READINESS.json`",
      "- Review `docs/releases/V1_FREEZE_PROOF_INDEX.json`"
    ].join("\n")
  );

  writeFile(
    rootDir,
    "docs/releases/V1_ROLLBACK_RUNBOOK.md",
    [
      "# Rollback Runbook",
      "",
      "- Use `docs/releases/V1_ROLLBACK.md`",
      "- Use `ci/scripts/run_postv1_mainline_post_merge_verification.mjs`"
    ].join("\n")
  );

  writeJson(rootDir, "docs/releases/V1_FREEZE_PROOF_INDEX.json", {
    entries: [
      {
        artefact_id: "readiness",
        path: "docs/releases/V1_FREEZE_READINESS.json"
      },
      {
        artefact_id: "rollback",
        path: "docs/releases/V1_ROLLBACK.md"
      }
    ]
  });

  writeJson(rootDir, "docs/releases/V1_FREEZE_READINESS.json", { ok: true });
  writeFile(rootDir, "docs/releases/V1_ROLLBACK.md", "# Rollback\n");
  writeFile(rootDir, "ci/scripts/run_postv1_freeze_readiness_runner.mjs", "console.log('ok');\n");
  writeFile(rootDir, "ci/scripts/run_postv1_mainline_post_merge_verification.mjs", "console.log('ok');\n");

  writeFile(
    rootDir,
    "docs/releases/V1_HANDOFF_INDEX.md",
    [
      "# V1 Handoff Index",
      "",
      "## Operator freeze navigation",
      "",
      "- ci/scripts/run_postv1_freeze_readiness_runner.mjs",
      "- ci/scripts/run_postv1_mainline_post_merge_verification.mjs",
      "- docs/releases/V1_FREEZE_PROOF_INDEX.json",
      "- docs/releases/V1_FREEZE_READINESS.json",
      "- docs/releases/V1_OPERATOR_FREEZE_RUNBOOK.md",
      "- docs/releases/V1_ROLLBACK.md",
      "- docs/releases/V1_ROLLBACK_RUNBOOK.md"
    ].join("\n")
  );

  return {
    operator_runbook: path.join(rootDir, "docs/releases/V1_OPERATOR_FREEZE_RUNBOOK.md"),
    rollback_runbook: path.join(rootDir, "docs/releases/V1_ROLLBACK_RUNBOOK.md"),
    proof_index: path.join(rootDir, "docs/releases/V1_FREEZE_PROOF_INDEX.json"),
    handoff_index: path.join(rootDir, "docs/releases/V1_HANDOFF_INDEX.md")
  };
}

test("verifyFreezeOperatorHandoffMinimality passes when handoff exactly matches sufficiency set", () => {
  const rootDir = makeFixtureRoot();
  const inputs = buildExactFixture(rootDir);

  const previousCwd = process.cwd();
  process.chdir(rootDir);
  try {
    const result = verifyFreezeOperatorHandoffMinimality(inputs);
    assert.equal(result.ok, true);
    assert.equal(result.sufficiency_count, 7);
    assert.equal(result.declared_count, 7);
  } finally {
    process.chdir(previousCwd);
  }
});

test("verifyFreezeOperatorHandoffMinimality fails when handoff contains extra operator surface", () => {
  const rootDir = makeFixtureRoot();
  const inputs = buildExactFixture(rootDir);

  writeFile(rootDir, "docs/releases/V1_UNUSED_EXTRA.md", "# unused\n");
  writeFile(
    rootDir,
    "docs/releases/V1_HANDOFF_INDEX.md",
    [
      "# V1 Handoff Index",
      "",
      "## Operator freeze navigation",
      "",
      "- ci/scripts/run_postv1_freeze_readiness_runner.mjs",
      "- ci/scripts/run_postv1_mainline_post_merge_verification.mjs",
      "- docs/releases/V1_FREEZE_PROOF_INDEX.json",
      "- docs/releases/V1_FREEZE_READINESS.json",
      "- docs/releases/V1_OPERATOR_FREEZE_RUNBOOK.md",
      "- docs/releases/V1_ROLLBACK.md",
      "- docs/releases/V1_ROLLBACK_RUNBOOK.md",
      "- docs/releases/V1_UNUSED_EXTRA.md"
    ].join("\n")
  );

  const previousCwd = process.cwd();
  process.chdir(rootDir);
  try {
    const result = verifyFreezeOperatorHandoffMinimality(inputs);
    assert.equal(result.ok, false);
    assert.equal(result.failures[0].token, "extra_operator_surface");
  } finally {
    process.chdir(previousCwd);
  }
});

test("verifyFreezeOperatorHandoffMinimality fails when handoff declares non-existent entry", () => {
  const rootDir = makeFixtureRoot();
  const inputs = buildExactFixture(rootDir);

  writeFile(
    rootDir,
    "docs/releases/V1_HANDOFF_INDEX.md",
    [
      "# V1 Handoff Index",
      "",
      "## Operator freeze navigation",
      "",
      "- ci/scripts/run_postv1_freeze_readiness_runner.mjs",
      "- ci/scripts/run_postv1_mainline_post_merge_verification.mjs",
      "- docs/releases/V1_FREEZE_PROOF_INDEX.json",
      "- docs/releases/V1_FREEZE_READINESS.json",
      "- docs/releases/V1_OPERATOR_FREEZE_RUNBOOK.md",
      "- docs/releases/V1_ROLLBACK.md",
      "- docs/releases/V1_ROLLBACK_RUNBOOK.md",
      "- docs/releases/V1_DOES_NOT_EXIST.json"
    ].join("\n")
  );

  const previousCwd = process.cwd();
  process.chdir(rootDir);
  try {
    const result = verifyFreezeOperatorHandoffMinimality(inputs);
    assert.equal(result.ok, false);
    assert.equal(result.failures[0].token, "CI_MANIFEST_MISMATCH");
  } finally {
    process.chdir(previousCwd);
  }
});

test("verifyFreezeOperatorHandoffMinimality emits JSON-safe success shape", () => {
  const rootDir = makeFixtureRoot();
  const inputs = buildExactFixture(rootDir);

  const previousCwd = process.cwd();
  process.chdir(rootDir);
  try {
    const result = verifyFreezeOperatorHandoffMinimality(inputs);
    assert.deepEqual(Object.keys(result).sort(), [
      "declared_count",
      "handoff_index",
      "ok",
      "operator_runbook",
      "proof_index",
      "rollback_runbook",
      "sufficiency_count"
    ]);
  } finally {
    process.chdir(previousCwd);
  }
});

test("verifyFreezeOperatorHandoffMinimality repeated success is stable", () => {
  const rootDir = makeFixtureRoot();
  const inputs = buildExactFixture(rootDir);

  const previousCwd = process.cwd();
  process.chdir(rootDir);
  try {
    const first = verifyFreezeOperatorHandoffMinimality(inputs);
    const second = verifyFreezeOperatorHandoffMinimality(inputs);
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.deepEqual(first, second);
  } finally {
    process.chdir(previousCwd);
  }
});
