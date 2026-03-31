import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

const REPORTER_SCRIPT = path.resolve("ci", "scripts", "run_registry_seal_drift_diff_reporter.mjs");
const GATE_SCRIPT = path.resolve("ci", "scripts", "run_registry_seal_gate.mjs");

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, "utf8");
}

function sha256Text(value) {
  return crypto.createHash("sha256").update(Buffer.from(value, "utf8")).digest("hex");
}

function writeLifecycle(currentState, cwd) {
  writeJson(path.join(cwd, "ci/evidence/registry_seal_lifecycle.v1.json"), {
    schema_version: "kolosseum.registry_seal_lifecycle.v1",
    lifecycle_id: "launch_registry_seal_lifecycle",
    lifecycle_version: "1.0.0",
    current_state: currentState,
    allowed_transitions: [
      {
        from: "pre_seal",
        to: "sealed"
      }
    ]
  });
}

function runReporter(cwd) {
  return spawnSync(process.execPath, [REPORTER_SCRIPT], {
    cwd,
    encoding: "utf8"
  });
}

function runGate(cwd) {
  return spawnSync(process.execPath, [GATE_SCRIPT], {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      KOLOSSEUM_REGISTRY_SEAL_DRIFT_REPORTER_PATH: REPORTER_SCRIPT
    }
  });
}

test("P87: reporter emits modified file set", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "p87-modified-"));
  const relPath = "registries/registry_bundle.json";
  const sealedBody = "{\n  \"state\": \"sealed\"\n}\n";
  const driftBody = "{\n  \"state\": \"drifted\"\n}\n";

  writeJson(path.join(cwd, "ci/evidence/registry_seal_live_surface.v1.json"), {
    schema_version: "kolosseum.registry_seal_live_surface.v1",
    surface_id: "launch_registry_live_surface",
    surface_version: "1.0.0",
    seal_scope: "registry_bundle",
    entries: [{ path: relPath }]
  });
  writeJson(path.join(cwd, "ci/evidence/registry_seal_snapshot.v1.json"), {
    schema_version: "kolosseum.registry_seal_snapshot.v1",
    snapshot_id: "launch_registry_seal_snapshot",
    snapshot_version: "1.0.0",
    seal_scope: "registry_bundle",
    entries: [{ path: relPath, sha256: sha256Text(sealedBody) }]
  });
  writeText(path.join(cwd, relPath), driftBody);

  const r = runReporter(cwd);
  assert.equal(r.status, 1);

  const payload = JSON.parse(r.stderr);
  assert.equal(payload.token, "CI_REGISTRY_SEAL_DRIFT_DETECTED");
  assert.deepEqual(payload.added, []);
  assert.deepEqual(payload.removed, []);
  assert.equal(payload.modified.length, 1);
  assert.equal(payload.modified[0].path, relPath);
  assert.deepEqual(payload.offending_files, [relPath]);
});

test("P87: reporter emits added file set", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "p87-added-"));
  const relPath = "registries/registry_bundle.json";
  const fileBody = "{\n  \"added\": true\n}\n";

  writeJson(path.join(cwd, "ci/evidence/registry_seal_live_surface.v1.json"), {
    schema_version: "kolosseum.registry_seal_live_surface.v1",
    surface_id: "launch_registry_live_surface",
    surface_version: "1.0.0",
    seal_scope: "registry_bundle",
    entries: [{ path: relPath }]
  });
  writeJson(path.join(cwd, "ci/evidence/registry_seal_snapshot.v1.json"), {
    schema_version: "kolosseum.registry_seal_snapshot.v1",
    snapshot_id: "launch_registry_seal_snapshot",
    snapshot_version: "1.0.0",
    seal_scope: "registry_bundle",
    entries: []
  });
  writeText(path.join(cwd, relPath), fileBody);

  const r = runReporter(cwd);
  assert.equal(r.status, 1);

  const payload = JSON.parse(r.stderr);
  assert.equal(payload.token, "CI_REGISTRY_SEAL_DRIFT_DETECTED");
  assert.deepEqual(payload.modified, []);
  assert.deepEqual(payload.removed, []);
  assert.equal(payload.added.length, 1);
  assert.equal(payload.added[0].path, relPath);
  assert.deepEqual(payload.offending_files, [relPath]);
});

test("P87: reporter emits removed file set", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "p87-removed-"));
  const relPath = "registries/registry_bundle.json";
  const sealedBody = "{\n  \"sealed\": true\n}\n";

  writeJson(path.join(cwd, "ci/evidence/registry_seal_live_surface.v1.json"), {
    schema_version: "kolosseum.registry_seal_live_surface.v1",
    surface_id: "launch_registry_live_surface",
    surface_version: "1.0.0",
    seal_scope: "registry_bundle",
    entries: []
  });
  writeJson(path.join(cwd, "ci/evidence/registry_seal_snapshot.v1.json"), {
    schema_version: "kolosseum.registry_seal_snapshot.v1",
    snapshot_id: "launch_registry_seal_snapshot",
    snapshot_version: "1.0.0",
    seal_scope: "registry_bundle",
    entries: [{ path: relPath, sha256: sha256Text(sealedBody) }]
  });

  const r = runReporter(cwd);
  assert.equal(r.status, 1);

  const payload = JSON.parse(r.stderr);
  assert.equal(payload.token, "CI_REGISTRY_SEAL_DRIFT_DETECTED");
  assert.deepEqual(payload.modified, []);
  assert.deepEqual(payload.added, []);
  assert.equal(payload.removed.length, 1);
  assert.equal(payload.removed[0].path, relPath);
  assert.equal(payload.removed[0].reason, "removed_from_live_surface");
  assert.deepEqual(payload.offending_files, [relPath]);
});

test("P87: sealed mismatch through gate asserts diff output", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "p87-gate-mismatch-"));
  const relPath = "registries/registry_bundle.json";
  const sealedBody = "{\n  \"state\": \"sealed\"\n}\n";
  const driftBody = "{\n  \"state\": \"changed\"\n}\n";

  writeLifecycle("sealed", cwd);
  writeJson(path.join(cwd, "ci/evidence/registry_seal_manifest.v1.json"), {
    schema_version: "kolosseum.registry_seal_manifest.v1",
    manifest_id: "launch_registry_surface",
    manifest_version: "1.0.0",
    seal_scope: "registry_bundle",
    entries: [{ path: relPath }]
  });
  writeJson(path.join(cwd, "ci/evidence/registry_seal_live_surface.v1.json"), {
    schema_version: "kolosseum.registry_seal_live_surface.v1",
    surface_id: "launch_registry_live_surface",
    surface_version: "1.0.0",
    seal_scope: "registry_bundle",
    entries: [{ path: relPath }]
  });
  writeJson(path.join(cwd, "ci/evidence/registry_seal_snapshot.v1.json"), {
    schema_version: "kolosseum.registry_seal_snapshot.v1",
    snapshot_id: "launch_registry_seal_snapshot",
    snapshot_version: "1.0.0",
    seal_scope: "registry_bundle",
    entries: [{ path: relPath, sha256: sha256Text(sealedBody) }]
  });
  writeText(path.join(cwd, "ci/evidence/registry_seal.v1.json"), "{}\n");
  writeText(path.join(cwd, relPath), driftBody);

  const r = runGate(cwd);
  assert.equal(r.status, 1);

  const payload = JSON.parse(r.stderr);
  assert.equal(payload.token, "CI_REGISTRY_SEAL_DRIFT_DETECTED");
  assert.deepEqual(payload.offending_files, [relPath]);
  assert.equal(payload.modified.length, 1);
});