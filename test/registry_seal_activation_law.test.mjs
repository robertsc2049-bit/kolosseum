import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

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

function runGate(cwd, args = []) {
  const scriptPath = path.resolve("ci", "scripts", "run_registry_seal_gate.mjs");
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      KOLOSSEUM_REGISTRY_SEAL_DRIFT_REPORTER_PATH: REPORTER_SCRIPT
    }
  });
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

test("P85: lifecycle document exists", () => {
  const docPath = path.resolve("docs", "releases", "V1_REGISTRY_SEAL_LIFECYCLE.md");
  assert.equal(fs.existsSync(docPath), true);
});

test("P85: passive pre-seal mode is explicit and machine-checkable", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "p85-pre-seal-"));
  writeJson(path.join(cwd, "ci/evidence/registry_seal_lifecycle.v1.json"), makeLifecycle("pre_seal"));

  const r = runGate(cwd);
  assert.equal(r.status, 0, r.stderr);

  const payload = JSON.parse(r.stdout);
  assert.equal(payload.mode, "pre_seal");
  assert.equal(payload.enforced, false);
});

test("P85: pre-seal to sealed is the only lawful transition", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "p85-transition-ok-"));
  writeJson(path.join(cwd, "ci/evidence/registry_seal_lifecycle.v1.json"), makeLifecycle("pre_seal"));

  const r = runGate(cwd, ["--transition-to", "sealed"]);
  assert.equal(r.status, 0, r.stderr);

  const payload = JSON.parse(r.stdout);
  assert.equal(payload.transition_requested, "sealed");
  assert.equal(payload.transition_legal, true);
});

test("P85: pre-seal to pre-seal is rejected", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "p85-transition-noop-"));
  writeJson(path.join(cwd, "ci/evidence/registry_seal_lifecycle.v1.json"), makeLifecycle("pre_seal"));

  const r = runGate(cwd, ["--transition-to", "pre_seal"]);
  assert.equal(r.status, 1);

  const payload = JSON.parse(r.stderr);
  assert.equal(payload.token, "CI_REGISTRY_SEAL_LIFECYCLE_ILLEGAL_TRANSITION");
});

test("P85: sealed to pre-seal is rejected", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "p85-transition-reverse-"));
  writeJson(path.join(cwd, "ci/evidence/registry_seal_lifecycle.v1.json"), makeLifecycle("sealed"));

  const r = runGate(cwd, ["--transition-to", "pre_seal"]);
  assert.equal(r.status, 1);

  const payload = JSON.parse(r.stderr);
  assert.equal(payload.token, "CI_REGISTRY_SEAL_LIFECYCLE_ILLEGAL_TRANSITION");
});

test("P85: sealed to sealed is rejected", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "p85-transition-repeat-"));
  writeJson(path.join(cwd, "ci/evidence/registry_seal_lifecycle.v1.json"), makeLifecycle("sealed"));

  const r = runGate(cwd, ["--transition-to", "sealed"]);
  assert.equal(r.status, 1);

  const payload = JSON.parse(r.stderr);
  assert.equal(payload.token, "CI_REGISTRY_SEAL_LIFECYCLE_ILLEGAL_TRANSITION");
});

test("P85: sealed mode requires sealed artefacts", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "p85-sealed-missing-"));
  writeJson(path.join(cwd, "ci/evidence/registry_seal_lifecycle.v1.json"), makeLifecycle("sealed"));

  const r = runGate(cwd);
  assert.equal(r.status, 1);

  const payload = JSON.parse(r.stderr);
  assert.equal(payload.token, "CI_REGISTRY_SEAL_LIFECYCLE_SEALED_MISSING_ARTEFACT");
});

test("P85: sealed mode passes when sealed artefacts exist", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "p85-sealed-pass-"));
  const relPath = "registries/registry_bundle.json";
  const fileBody = "{\n  \"ok\": true\n}\n";

  writeJson(path.join(cwd, "ci/evidence/registry_seal_lifecycle.v1.json"), makeLifecycle("sealed"));
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

  const r = runGate(cwd);
  assert.equal(r.status, 0, r.stderr);

  const payload = JSON.parse(r.stdout);
  assert.equal(payload.mode, "sealed");
  assert.equal(payload.enforced, true);
});