import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  buildFreezeSealSnapshot,
  stableStringify,
  sha256Hex
} from "../ci/scripts/run_freeze_seal_snapshot_builder.mjs";

function writeJson(dir, relativePath, value) {
  const fullPath = path.join(dir, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, JSON.stringify(value, null, 2));
  return fullPath;
}

function makeFixtureRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "freeze-seal-snapshot-"));
}

function buildFixtureComponents(rootDir) {
  const proofIndexPath = writeJson(rootDir, "fixtures/V1_FREEZE_PROOF_INDEX.json", {
    component_id: "proof_index",
    engine_compatibility: "EB2-1.0.0",
    entries: [
      {
        artefact_id: "freeze_exit_criteria",
        path: "docs/releases/V1_FREEZE_EXIT_CRITERIA.json",
        sha256: "1111111111111111111111111111111111111111111111111111111111111111"
      },
      {
        artefact_id: "packaging_surface_registry",
        path: "docs/releases/V1_PACKAGING_SURFACE_REGISTRY.json",
        sha256: "2222222222222222222222222222222222222222222222222222222222222222"
      }
    ]
  });

  const readinessPath = writeJson(rootDir, "fixtures/V1_FREEZE_READINESS.json", {
    component_id: "readiness",
    engine_compatibility: "EB2-1.0.0",
    ok: true,
    status: "ready"
  });

  const driftPath = writeJson(rootDir, "fixtures/V1_FREEZE_DRIFT_STATUS.json", {
    component_id: "drift",
    engine_compatibility: "EB2-1.0.0",
    ok: true,
    drift_detected: false
  });

  const mainlineGuardPath = writeJson(rootDir, "fixtures/V1_FREEZE_MAINLINE_GUARD_STATE.json", {
    component_id: "mainline_guard",
    engine_compatibility: "EB2-1.0.0",
    ok: true,
    branch: "main",
    guard_status: "green"
  });

  return {
    proof_index: proofIndexPath,
    readiness: readinessPath,
    drift: driftPath,
    mainline_guard: mainlineGuardPath
  };
}

test("buildFreezeSealSnapshot succeeds when all required freeze governance inputs exist", () => {
  const rootDir = makeFixtureRoot();
  const componentPaths = buildFixtureComponents(rootDir);
  const outputPath = path.join(rootDir, "out", "V1_FREEZE_SEAL_SNAPSHOT.json");

  const result = buildFreezeSealSnapshot({
    componentPaths,
    generatedAtUtc: "2026-04-03T12:00:00Z",
    outputPath
  });

  assert.equal(result.ok, true);
  assert.equal(fs.existsSync(outputPath), true);
  assert.deepEqual(Object.keys(result.output).sort(), [
    "completeness",
    "engine_compatibility",
    "freeze_state",
    "generated_at_utc",
    "snapshot_id",
    "snapshot_version"
  ]);

  const proofIndexCanonical = Buffer.from(stableStringify(JSON.parse(fs.readFileSync(componentPaths.proof_index, "utf8"))), "utf8");
  const readinessCanonical = Buffer.from(stableStringify(JSON.parse(fs.readFileSync(componentPaths.readiness, "utf8"))), "utf8");
  const driftCanonical = Buffer.from(stableStringify(JSON.parse(fs.readFileSync(componentPaths.drift, "utf8"))), "utf8");
  const mainlineGuardCanonical = Buffer.from(stableStringify(JSON.parse(fs.readFileSync(componentPaths.mainline_guard, "utf8"))), "utf8");

  assert.equal(result.output.freeze_state.proof_index.sha256, sha256Hex(proofIndexCanonical));
  assert.equal(result.output.freeze_state.readiness.sha256, sha256Hex(readinessCanonical));
  assert.equal(result.output.freeze_state.drift.sha256, sha256Hex(driftCanonical));
  assert.equal(result.output.freeze_state.mainline_guard.sha256, sha256Hex(mainlineGuardCanonical));
});

test("buildFreezeSealSnapshot fails when proof index is missing", () => {
  const rootDir = makeFixtureRoot();
  const componentPaths = buildFixtureComponents(rootDir);
  fs.rmSync(componentPaths.proof_index);

  const result = buildFreezeSealSnapshot({
    componentPaths,
    generatedAtUtc: "2026-04-03T12:00:00Z"
  });

  assert.equal(result.ok, false);
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].token, "CI_MANIFEST_MISMATCH");
  assert.equal(result.failures[0].component, "proof_index");
});

test("buildFreezeSealSnapshot fails when a required input contains invalid JSON", () => {
  const rootDir = makeFixtureRoot();
  const componentPaths = buildFixtureComponents(rootDir);
  fs.writeFileSync(componentPaths.drift, "{ invalid json");

  const result = buildFreezeSealSnapshot({
    componentPaths,
    generatedAtUtc: "2026-04-03T12:00:00Z"
  });

  assert.equal(result.ok, false);
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].token, "CI_MANIFEST_MISMATCH");
  assert.equal(result.failures[0].component, "drift");
});

test("buildFreezeSealSnapshot fails on duplicate required-component mapping", () => {
  const rootDir = makeFixtureRoot();
  const componentPaths = buildFixtureComponents(rootDir);

  const result = buildFreezeSealSnapshot({
    componentPaths: {
      proof_index: componentPaths.proof_index,
      readiness: componentPaths.readiness,
      drift: componentPaths.readiness,
      mainline_guard: componentPaths.mainline_guard
    },
    generatedAtUtc: "2026-04-03T12:00:00Z"
  });

  assert.equal(result.ok, false);
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].token, "CI_MANIFEST_MISMATCH");
});

test("buildFreezeSealSnapshot fails on engine compatibility mismatch", () => {
  const rootDir = makeFixtureRoot();
  const componentPaths = buildFixtureComponents(rootDir);

  writeJson(rootDir, "fixtures/V1_FREEZE_MAINLINE_GUARD_STATE.json", {
    component_id: "mainline_guard",
    engine_compatibility: "EB2-1.0.1",
    ok: true,
    branch: "main",
    guard_status: "green"
  });

  const result = buildFreezeSealSnapshot({
    componentPaths,
    generatedAtUtc: "2026-04-03T12:00:00Z"
  });

  assert.equal(result.ok, false);
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].token, "version_mismatch");
  assert.equal(result.failures[0].component, "mainline_guard");
});

test("buildFreezeSealSnapshot output is byte-stable across repeated identical runs", () => {
  const rootDir = makeFixtureRoot();
  const componentPaths = buildFixtureComponents(rootDir);

  const first = buildFreezeSealSnapshot({
    componentPaths,
    generatedAtUtc: "2026-04-03T12:00:00Z"
  });

  const second = buildFreezeSealSnapshot({
    componentPaths,
    generatedAtUtc: "2026-04-03T12:00:00Z"
  });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(first.output_sha256, second.output_sha256);
  assert.equal(Buffer.compare(first.output_bytes, second.output_bytes), 0);
});