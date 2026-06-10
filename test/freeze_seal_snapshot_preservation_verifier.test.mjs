import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { verifyFreezeSealSnapshotPreservation } from "../ci/scripts/run_freeze_seal_snapshot_preservation_verifier.mjs";

function writeJson(dir, relativePath, value) {
  const fullPath = path.join(dir, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, JSON.stringify(value, null, 2));
  return fullPath;
}

function makeFixtureRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "freeze-seal-snapshot-preservation-"));
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

test("verifyFreezeSealSnapshotPreservation passes when repeated rebuilds yield byte-identical outputs", () => {
  const rootDir = makeFixtureRoot();
  const componentPaths = buildFixtureComponents(rootDir);

  const result = verifyFreezeSealSnapshotPreservation({
    componentPaths,
    generatedAtUtc: "2026-04-03T12:00:00Z"
  });

  assert.equal(result.ok, true);
  assert.equal(result.byte_parity, true);
});

test("verifyFreezeSealSnapshotPreservation passes when repeated rebuilds yield identical sha256", () => {
  const rootDir = makeFixtureRoot();
  const componentPaths = buildFixtureComponents(rootDir);

  const result = verifyFreezeSealSnapshotPreservation({
    componentPaths,
    generatedAtUtc: "2026-04-03T12:00:00Z"
  });

  assert.equal(result.ok, true);
  assert.equal(result.hash_parity, true);
  assert.match(result.output_sha256, /^[a-f0-9]{64}$/);
});

test("verifyFreezeSealSnapshotPreservation fails when required component set is incomplete", () => {
  const rootDir = makeFixtureRoot();
  const componentPaths = buildFixtureComponents(rootDir);
  delete componentPaths.drift;

  const result = verifyFreezeSealSnapshotPreservation({
    componentPaths,
    generatedAtUtc: "2026-04-03T12:00:00Z"
  });

  assert.equal(result.ok, false);
  assert.equal(result.failures[0].token, "CI_MANIFEST_MISMATCH");
});

test("verifyFreezeSealSnapshotPreservation fails when builder input is invalid", () => {
  const rootDir = makeFixtureRoot();
  const componentPaths = buildFixtureComponents(rootDir);
  fs.writeFileSync(componentPaths.readiness, "{ invalid json");

  const result = verifyFreezeSealSnapshotPreservation({
    componentPaths,
    generatedAtUtc: "2026-04-03T12:00:00Z"
  });

  assert.equal(result.ok, false);
  assert.equal(result.failures[0].token, "CI_MANIFEST_MISMATCH");
});

test("verifyFreezeSealSnapshotPreservation emits JSON-safe success shape", () => {
  const rootDir = makeFixtureRoot();
  const componentPaths = buildFixtureComponents(rootDir);

  const result = verifyFreezeSealSnapshotPreservation({
    componentPaths,
    generatedAtUtc: "2026-04-03T12:00:00Z"
  });

  assert.deepEqual(Object.keys(result).sort(), [
    "byte_parity",
    "generated_at_utc",
    "hash_parity",
    "ok",
    "output_sha256"
  ]);
});

test("verifyFreezeSealSnapshotPreservation repeated success is itself stable", () => {
  const rootDir = makeFixtureRoot();
  const componentPaths = buildFixtureComponents(rootDir);

  const first = verifyFreezeSealSnapshotPreservation({
    componentPaths,
    generatedAtUtc: "2026-04-03T12:00:00Z"
  });

  const second = verifyFreezeSealSnapshotPreservation({
    componentPaths,
    generatedAtUtc: "2026-04-03T12:00:00Z"
  });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.deepEqual(first, second);
});
