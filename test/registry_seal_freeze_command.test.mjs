import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

const FREEZE_SCRIPT = path.resolve("ci", "scripts", "run_registry_seal_freeze.mjs");
const GATE_SCRIPT = path.resolve("ci", "scripts", "run_registry_seal_gate.mjs");
const REPORTER_SCRIPT = path.resolve("ci", "scripts", "run_registry_seal_drift_diff_reporter.mjs");

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

function makeLifecycle(currentState) {
  return {
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
  };
}

function writeRequiredSealedArtefacts(cwd) {
  const relPath = "registries/registry_bundle.json";
  const fileBody = "{\n  \"ok\": true\n}\n";

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
    entries: [{ path: relPath, sha256: sha256Text(fileBody) }]
  });
  writeText(path.join(cwd, "ci/evidence/registry_seal.v1.json"), "{}\n");
  writeText(path.join(cwd, relPath), fileBody);
}

function runFreeze(cwd, extraEnv = {}) {
  return spawnSync(process.execPath, [FREEZE_SCRIPT], {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      KOLOSSEUM_REGISTRY_SEAL_GATE_PATH: GATE_SCRIPT,
      KOLOSSEUM_REGISTRY_SEAL_DRIFT_REPORTER_PATH: REPORTER_SCRIPT,
      ...extraEnv
    }
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

test("P86: freeze command writes seal fields deterministically", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "p86-freeze-deterministic-"));
  writeJson(path.join(cwd, "ci/evidence/registry_seal_lifecycle.v1.json"), makeLifecycle("pre_seal"));
  writeRequiredSealedArtefacts(cwd);

  const r1 = runFreeze(cwd);
  assert.equal(r1.status, 0, r1.stderr);

  const written1 = fs.readFileSync(path.join(cwd, "ci/evidence/registry_seal_lifecycle.v1.json"), "utf8");
  const payload1 = JSON.parse(r1.stdout);
  assert.equal(payload1.action, "activated");
  assert.equal(payload1.current_state, "sealed");

  writeJson(path.join(cwd, "ci/evidence/registry_seal_lifecycle.v1.json"), makeLifecycle("pre_seal"));

  const r2 = runFreeze(cwd);
  assert.equal(r2.status, 0, r2.stderr);

  const written2 = fs.readFileSync(path.join(cwd, "ci/evidence/registry_seal_lifecycle.v1.json"), "utf8");
  assert.equal(written1, written2);
});

test("P86: freeze command immediately verifies post-write", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "p86-freeze-verify-"));
  writeJson(path.join(cwd, "ci/evidence/registry_seal_lifecycle.v1.json"), makeLifecycle("pre_seal"));
  writeRequiredSealedArtefacts(cwd);

  const r = runFreeze(cwd);
  assert.equal(r.status, 0, r.stderr);

  const payload = JSON.parse(r.stdout);
  assert.equal(payload.verified_mode, "sealed");
  assert.equal(payload.verified_enforced, true);

  const gate = runGate(cwd);
  assert.equal(gate.status, 0, gate.stderr);

  const gatePayload = JSON.parse(gate.stdout);
  assert.equal(gatePayload.mode, "sealed");
  assert.equal(gatePayload.enforced, true);
});

test("P86: rerun on sealed state is a lawful no-op", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "p86-freeze-noop-"));
  writeJson(path.join(cwd, "ci/evidence/registry_seal_lifecycle.v1.json"), makeLifecycle("sealed"));
  writeRequiredSealedArtefacts(cwd);

  const before = fs.readFileSync(path.join(cwd, "ci/evidence/registry_seal_lifecycle.v1.json"), "utf8");
  const r = runFreeze(cwd);
  assert.equal(r.status, 0, r.stderr);

  const after = fs.readFileSync(path.join(cwd, "ci/evidence/registry_seal_lifecycle.v1.json"), "utf8");
  const payload = JSON.parse(r.stdout);

  assert.equal(payload.action, "no_op");
  assert.equal(payload.current_state, "sealed");
  assert.equal(after, before);
});

test("P86: freeze command fails if post-write verification cannot prove sealed state", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "p86-freeze-postwrite-fail-"));
  writeJson(path.join(cwd, "ci/evidence/registry_seal_lifecycle.v1.json"), makeLifecycle("pre_seal"));

  const r = runFreeze(cwd);
  assert.equal(r.status, 1);

  const payload = JSON.parse(r.stderr);
  assert.equal(payload.token, "CI_REGISTRY_SEAL_FREEZE_POSTWRITE_VERIFY_FAILED");
});