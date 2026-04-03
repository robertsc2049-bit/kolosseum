import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { verifyFreezeOperatorHandoffSufficiency } from "../ci/scripts/run_freeze_operator_handoff_sufficiency_gate.mjs";

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
  return fs.mkdtempSync(path.join(os.tmpdir(), "freeze-operator-handoff-sufficiency-"));
}

function buildCompleteFixture(rootDir) {
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

  writeJson(rootDir, "docs/releases/V1_FREEZE_READINESS.json", {
    ok: true
  });

  writeFile(rootDir, "docs/releases/V1_ROLLBACK.md", "# Rollback");
  writeFile(rootDir, "ci/scripts/run_postv1_freeze_readiness_runner.mjs", "console.log('ok');\n");
  writeFile(rootDir, "ci/scripts/run_postv1_mainline_post_merge_verification.mjs", "console.log('ok');\n");

  writeFile(
    rootDir,
    "docs/releases/V1_HANDOFF_INDEX.md",
    [
      "# Handoff Index",
      "",
      "- docs/releases/V1_OPERATOR_FREEZE_RUNBOOK.md",
      "- docs/releases/V1_ROLLBACK_RUNBOOK.md",
      "- docs/releases/V1_FREEZE_PROOF_INDEX.json",
      "- ci/scripts/run_postv1_freeze_readiness_runner.mjs",
      "- ci/scripts/run_postv1_mainline_post_merge_verification.mjs",
      "- docs/releases/V1_FREEZE_READINESS.json",
      "- docs/releases/V1_ROLLBACK.md"
    ].join("\n")
  );

  return {
    operator_runbook: path.join(rootDir, "docs/releases/V1_OPERATOR_FREEZE_RUNBOOK.md"),
    rollback_runbook: path.join(rootDir, "docs/releases/V1_ROLLBACK_RUNBOOK.md"),
    proof_index: path.join(rootDir, "docs/releases/V1_FREEZE_PROOF_INDEX.json"),
    handoff_index: path.join(rootDir, "docs/releases/V1_HANDOFF_INDEX.md")
  };
}

test("verifyFreezeOperatorHandoffSufficiency passes on complete handoff", () => {
  const rootDir = makeFixtureRoot();
  const inputs = buildCompleteFixture(rootDir);

  const previousCwd = process.cwd();
  process.chdir(rootDir);
  try {
    const result = verifyFreezeOperatorHandoffSufficiency(inputs);
    assert.equal(result.ok, true);
    assert.equal(result.required_dependency_count, 7);
    assert.equal(result.declared_dependency_count, 7);
  } finally {
    process.chdir(previousCwd);
  }
});

test("verifyFreezeOperatorHandoffSufficiency fails when operator runbook dependency is missing from handoff", () => {
  const rootDir = makeFixtureRoot();
  const inputs = buildCompleteFixture(rootDir);

  writeFile(
    rootDir,
    "docs/releases/V1_HANDOFF_INDEX.md",
    [
      "# Handoff Index",
      "",
      "- docs/releases/V1_OPERATOR_FREEZE_RUNBOOK.md",
      "- docs/releases/V1_ROLLBACK_RUNBOOK.md",
      "- docs/releases/V1_FREEZE_PROOF_INDEX.json",
      "- ci/scripts/run_postv1_mainline_post_merge_verification.mjs",
      "- docs/releases/V1_FREEZE_READINESS.json",
      "- docs/releases/V1_ROLLBACK.md"
    ].join("\n")
  );

  const previousCwd = process.cwd();
  process.chdir(rootDir);
  try {
    const result = verifyFreezeOperatorHandoffSufficiency(inputs);
    assert.equal(result.ok, false);
    assert.equal(result.failures[0].token, "missing_operational_dependency");
  } finally {
    process.chdir(previousCwd);
  }
});

test("verifyFreezeOperatorHandoffSufficiency fails when rollback dependency is missing from handoff", () => {
  const rootDir = makeFixtureRoot();
  const inputs = buildCompleteFixture(rootDir);

  writeFile(
    rootDir,
    "docs/releases/V1_HANDOFF_INDEX.md",
    [
      "# Handoff Index",
      "",
      "- docs/releases/V1_OPERATOR_FREEZE_RUNBOOK.md",
      "- docs/releases/V1_ROLLBACK_RUNBOOK.md",
      "- docs/releases/V1_FREEZE_PROOF_INDEX.json",
      "- ci/scripts/run_postv1_freeze_readiness_runner.mjs",
      "- docs/releases/V1_FREEZE_READINESS.json",
      "- docs/releases/V1_ROLLBACK.md"
    ].join("\n")
  );

  const previousCwd = process.cwd();
  process.chdir(rootDir);
  try {
    const result = verifyFreezeOperatorHandoffSufficiency(inputs);
    assert.equal(result.ok, false);
    assert.equal(result.failures[0].token, "missing_operational_dependency");
  } finally {
    process.chdir(previousCwd);
  }
});

test("verifyFreezeOperatorHandoffSufficiency fails when proof index operational artefact is absent from handoff", () => {
  const rootDir = makeFixtureRoot();
  const inputs = buildCompleteFixture(rootDir);

  writeFile(
    rootDir,
    "docs/releases/V1_HANDOFF_INDEX.md",
    [
      "# Handoff Index",
      "",
      "- docs/releases/V1_OPERATOR_FREEZE_RUNBOOK.md",
      "- docs/releases/V1_ROLLBACK_RUNBOOK.md",
      "- docs/releases/V1_FREEZE_PROOF_INDEX.json",
      "- ci/scripts/run_postv1_freeze_readiness_runner.mjs",
      "- ci/scripts/run_postv1_mainline_post_merge_verification.mjs",
      "- docs/releases/V1_ROLLBACK.md"
    ].join("\n")
  );

  const previousCwd = process.cwd();
  process.chdir(rootDir);
  try {
    const result = verifyFreezeOperatorHandoffSufficiency(inputs);
    assert.equal(result.ok, false);
    assert.equal(result.failures[0].token, "missing_operational_dependency");
  } finally {
    process.chdir(previousCwd);
  }
});

test("verifyFreezeOperatorHandoffSufficiency fails on stale or orphan handoff entry", () => {
  const rootDir = makeFixtureRoot();
  const inputs = buildCompleteFixture(rootDir);

  writeFile(rootDir, "docs/releases/V1_UNUSED_EXTRA.md", "# unused");

  writeFile(
    rootDir,
    "docs/releases/V1_HANDOFF_INDEX.md",
    [
      "# Handoff Index",
      "",
      "- docs/releases/V1_OPERATOR_FREEZE_RUNBOOK.md",
      "- docs/releases/V1_ROLLBACK_RUNBOOK.md",
      "- docs/releases/V1_FREEZE_PROOF_INDEX.json",
      "- ci/scripts/run_postv1_freeze_readiness_runner.mjs",
      "- ci/scripts/run_postv1_mainline_post_merge_verification.mjs",
      "- docs/releases/V1_FREEZE_READINESS.json",
      "- docs/releases/V1_ROLLBACK.md",
      "- docs/releases/V1_UNUSED_EXTRA.md"
    ].join("\n")
  );

  const previousCwd = process.cwd();
  process.chdir(rootDir);
  try {
    const result = verifyFreezeOperatorHandoffSufficiency(inputs);
    assert.equal(result.ok, false);
    assert.equal(result.failures[0].token, "orphan_handoff_entry");
  } finally {
    process.chdir(previousCwd);
  }
});

test("verifyFreezeOperatorHandoffSufficiency emits JSON-safe success shape", () => {
  const rootDir = makeFixtureRoot();
  const inputs = buildCompleteFixture(rootDir);

  const previousCwd = process.cwd();
  process.chdir(rootDir);
  try {
    const result = verifyFreezeOperatorHandoffSufficiency(inputs);
    assert.deepEqual(Object.keys(result).sort(), [
      "declared_dependency_count",
      "handoff_index",
      "ok",
      "operator_runbook",
      "proof_index",
      "required_dependency_count",
      "rollback_runbook"
    ]);
  } finally {
    process.chdir(previousCwd);
  }
});
