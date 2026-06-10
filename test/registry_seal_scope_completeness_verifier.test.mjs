import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, "utf8");
}

function runVerifier(cwd) {
  const scriptPath = path.resolve("ci", "scripts", "run_registry_seal_scope_completeness_verifier.mjs");
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
    entries: paths.map((entryPath) => ({ path: entryPath }))
  };
}

function makeLiveSurface(paths) {
  return {
    schema_version: "kolosseum.registry_seal_live_surface.v1",
    surface_id: "launch_registry_live_surface",
    surface_version: "1.0.0",
    seal_scope: "registry_bundle",
    entries: paths.map((entryPath) => ({ path: entryPath }))
  };
}

test("P84: completeness verifier passes on exact set match", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "p84-complete-pass-"));
  const files = [
    "registries/registry_bundle.json",
    "ci/schemas/registry_seal.v1.schema.json",
    "ci/evidence/registry_seal.v1.json"
  ];

  for (const filePath of files) {
    writeText(path.join(cwd, filePath), `${filePath}\n`);
  }

  writeJson(path.join(cwd, "ci/evidence/registry_seal_manifest.v1.json"), makeManifest(files));
  writeJson(path.join(cwd, "ci/evidence/registry_seal_live_surface.v1.json"), makeLiveSurface(files));

  const r = runVerifier(cwd);
  assert.equal(r.status, 0, r.stderr);
});

test("P84: unlisted live registry file fails", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "p84-complete-unlisted-"));
  const manifestFiles = [
    "registries/registry_bundle.json",
    "ci/schemas/registry_seal.v1.schema.json"
  ];
  const liveFiles = [
    "registries/registry_bundle.json",
    "ci/schemas/registry_seal.v1.schema.json",
    "ci/evidence/registry_seal.v1.json"
  ];

  for (const filePath of liveFiles) {
    writeText(path.join(cwd, filePath), `${filePath}\n`);
  }

  writeJson(path.join(cwd, "ci/evidence/registry_seal_manifest.v1.json"), makeManifest(manifestFiles));
  writeJson(path.join(cwd, "ci/evidence/registry_seal_live_surface.v1.json"), makeLiveSurface(liveFiles));

  const r = runVerifier(cwd);
  assert.equal(r.status, 1);
  const payload = JSON.parse(r.stderr);
  assert.equal(payload.token, "CI_REGISTRY_SEAL_SCOPE_UNLISTED_LIVE_FILE");
});

test("P84: stale manifest entry fails", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "p84-complete-stale-"));
  const manifestFiles = [
    "registries/registry_bundle.json",
    "ci/schemas/registry_seal.v1.schema.json",
    "ci/evidence/registry_seal.v1.json"
  ];
  const liveFiles = [
    "registries/registry_bundle.json",
    "ci/schemas/registry_seal.v1.schema.json"
  ];

  for (const filePath of manifestFiles) {
    writeText(path.join(cwd, filePath), `${filePath}\n`);
  }

  writeJson(path.join(cwd, "ci/evidence/registry_seal_manifest.v1.json"), makeManifest(manifestFiles));
  writeJson(path.join(cwd, "ci/evidence/registry_seal_live_surface.v1.json"), makeLiveSurface(liveFiles));

  const r = runVerifier(cwd);
  assert.equal(r.status, 1);
  const payload = JSON.parse(r.stderr);
  assert.equal(payload.token, "CI_REGISTRY_SEAL_SCOPE_STALE_MANIFEST_ENTRY");
});

test("P84: duplicate manifest path fails", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "p84-complete-dup-manifest-"));
  const filePath = "registries/registry_bundle.json";

  writeText(path.join(cwd, filePath), `${filePath}\n`);

  writeJson(path.join(cwd, "ci/evidence/registry_seal_manifest.v1.json"), {
    schema_version: "kolosseum.registry_seal_manifest.v1",
    manifest_id: "launch_registry_surface",
    manifest_version: "1.0.0",
    seal_scope: "registry_bundle",
    entries: [
      { path: filePath },
      { path: filePath }
    ]
  });

  writeJson(path.join(cwd, "ci/evidence/registry_seal_live_surface.v1.json"), makeLiveSurface([filePath]));

  const r = runVerifier(cwd);
  assert.equal(r.status, 1);
  const payload = JSON.parse(r.stderr);
  assert.equal(payload.token, "CI_REGISTRY_SEAL_SCOPE_DUPLICATE");
});

test("P84: duplicate live surface path fails", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "p84-complete-dup-live-"));
  const filePath = "registries/registry_bundle.json";

  writeText(path.join(cwd, filePath), `${filePath}\n`);

  writeJson(path.join(cwd, "ci/evidence/registry_seal_manifest.v1.json"), makeManifest([filePath]));

  writeJson(path.join(cwd, "ci/evidence/registry_seal_live_surface.v1.json"), {
    schema_version: "kolosseum.registry_seal_live_surface.v1",
    surface_id: "launch_registry_live_surface",
    surface_version: "1.0.0",
    seal_scope: "registry_bundle",
    entries: [
      { path: filePath },
      { path: filePath }
    ]
  });

  const r = runVerifier(cwd);
  assert.equal(r.status, 1);
  const payload = JSON.parse(r.stderr);
  assert.equal(payload.token, "CI_REGISTRY_SEAL_SCOPE_DUPLICATE");
});