import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

function sha256Hex(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, "utf8");
}

function runVerifier(cwd) {
  const scriptPath = path.resolve("ci", "scripts", "run_registry_seal_manifest_verifier.mjs");
  return spawnSync(process.execPath, [scriptPath], {
    cwd,
    encoding: "utf8"
  });
}

function makeManifest(paths) {
  return {
    schema_version: "kolosseum.registry_seal_manifest.v1",
    manifest_id: "launch_registry_surface",
    manifest_version: "1.0.0",
    seal_scope: "registry_bundle",
    entries: paths.map((filePath) => ({ path: filePath }))
  };
}

function makeSnapshot(paths, cwd) {
  return {
    schema_version: "kolosseum.registry_seal_snapshot.v1",
    manifest_id: "launch_registry_surface",
    manifest_version: "1.0.0",
    seal_scope: "registry_bundle",
    entries: paths.map((filePath) => {
      const fullPath = path.join(cwd, filePath);
      const bytes = fs.readFileSync(fullPath);
      return {
        path: filePath,
        sha256: sha256Hex(bytes)
      };
    })
  };
}

test("P83: manifest-driven snapshot passes", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "p83-manifest-pass-"));
  const files = [
    "registries/registry_bundle.json",
    "ci/schemas/registry_seal.v1.schema.json",
    "ci/evidence/registry_seal.v1.json"
  ];

  writeText(path.join(cwd, files[0]), '{"bundle":"ok"}\n');
  writeText(path.join(cwd, files[1]), '{"schema":"ok"}\n');
  writeText(path.join(cwd, files[2]), '{"seal":"ok"}\n');

  writeJson(path.join(cwd, "ci/evidence/registry_seal_manifest.v1.json"), makeManifest(files));
  writeJson(path.join(cwd, "ci/evidence/registry_seal_snapshot.v1.json"), makeSnapshot(files, cwd));

  const r = runVerifier(cwd);
  assert.equal(r.status, 0, r.stderr);
});

test("P83: missing manifest entry target fails", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "p83-manifest-missing-"));
  const files = [
    "registries/registry_bundle.json",
    "ci/schemas/registry_seal.v1.schema.json",
    "ci/evidence/registry_seal.v1.json"
  ];

  writeText(path.join(cwd, files[0]), '{"bundle":"ok"}\n');
  writeText(path.join(cwd, files[2]), '{"seal":"ok"}\n');

  writeJson(path.join(cwd, "ci/evidence/registry_seal_manifest.v1.json"), makeManifest(files));
  writeJson(path.join(cwd, "ci/evidence/registry_seal_snapshot.v1.json"), {
    schema_version: "kolosseum.registry_seal_snapshot.v1",
    manifest_id: "launch_registry_surface",
    manifest_version: "1.0.0",
    seal_scope: "registry_bundle",
    entries: []
  });

  const r = runVerifier(cwd);
  assert.equal(r.status, 1);
  const payload = JSON.parse(r.stderr);
  assert.equal(payload.token, "CI_REGISTRY_SEAL_MANIFEST_MISSING_ENTRY");
});

test("P83: extra sealed file outside manifest fails", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "p83-manifest-extra-"));
  const files = [
    "registries/registry_bundle.json",
    "ci/schemas/registry_seal.v1.schema.json",
    "ci/evidence/registry_seal.v1.json"
  ];

  writeText(path.join(cwd, files[0]), '{"bundle":"ok"}\n');
  writeText(path.join(cwd, files[1]), '{"schema":"ok"}\n');
  writeText(path.join(cwd, files[2]), '{"seal":"ok"}\n');

  const extraPath = "ci/evidence/not_in_manifest.json";
  writeText(path.join(cwd, extraPath), '{"extra":"nope"}\n');

  const snapshot = makeSnapshot(files, cwd);
  snapshot.entries.push({
    path: extraPath,
    sha256: sha256Hex(fs.readFileSync(path.join(cwd, extraPath)))
  });

  writeJson(path.join(cwd, "ci/evidence/registry_seal_manifest.v1.json"), makeManifest(files));
  writeJson(path.join(cwd, "ci/evidence/registry_seal_snapshot.v1.json"), snapshot);

  const r = runVerifier(cwd);
  assert.equal(r.status, 1);
  const payload = JSON.parse(r.stderr);
  assert.equal(payload.token, "CI_REGISTRY_SEAL_MANIFEST_EXTRA_FILE");
});

test("P83: duplicate manifest path fails", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "p83-manifest-dup-"));
  const filePath = "registries/registry_bundle.json";

  writeText(path.join(cwd, filePath), '{"bundle":"ok"}\n');

  const manifest = {
    schema_version: "kolosseum.registry_seal_manifest.v1",
    manifest_id: "launch_registry_surface",
    manifest_version: "1.0.0",
    seal_scope: "registry_bundle",
    entries: [
      { path: filePath },
      { path: filePath }
    ]
  };

  writeJson(path.join(cwd, "ci/evidence/registry_seal_manifest.v1.json"), manifest);
  writeJson(path.join(cwd, "ci/evidence/registry_seal_snapshot.v1.json"), {
    schema_version: "kolosseum.registry_seal_snapshot.v1",
    manifest_id: "launch_registry_surface",
    manifest_version: "1.0.0",
    seal_scope: "registry_bundle",
    entries: []
  });

  const r = runVerifier(cwd);
  assert.equal(r.status, 1);
  const payload = JSON.parse(r.stderr);
  assert.equal(payload.token, "CI_REGISTRY_SEAL_MANIFEST_DUPLICATE");
});

test("P83: hash mismatch fails", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "p83-manifest-hash-"));
  const files = [
    "registries/registry_bundle.json",
    "ci/schemas/registry_seal.v1.schema.json",
    "ci/evidence/registry_seal.v1.json"
  ];

  writeText(path.join(cwd, files[0]), '{"bundle":"ok"}\n');
  writeText(path.join(cwd, files[1]), '{"schema":"ok"}\n');
  writeText(path.join(cwd, files[2]), '{"seal":"ok"}\n');

  const snapshot = makeSnapshot(files, cwd);
  snapshot.entries[1].sha256 = "0".repeat(64);

  writeJson(path.join(cwd, "ci/evidence/registry_seal_manifest.v1.json"), makeManifest(files));
  writeJson(path.join(cwd, "ci/evidence/registry_seal_snapshot.v1.json"), snapshot);

  const r = runVerifier(cwd);
  assert.equal(r.status, 1);
  const payload = JSON.parse(r.stderr);
  assert.equal(payload.token, "CI_REGISTRY_SEAL_MANIFEST_HASH_MISMATCH");
});