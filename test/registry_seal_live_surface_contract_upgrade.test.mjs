import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "p94a-live-surface-"));
}

function runVerifier(root) {
  return spawnSync(
    process.execPath,
    [path.resolve("ci/scripts/run_registry_seal_scope_completeness_verifier.mjs")],
    {
      cwd: root,
      encoding: "utf8"
    }
  );
}

test("passes when manifest and live surface both enumerate exact registry files", () => {
  const root = makeRoot();

  const paths = [
    "registries/activity/activity.registry.json",
    "registries/exercise/exercise.registry.json",
    "registries/exercise/exercise_substitution_graph.json",
    "registries/exercise/exercise_warmup_mapping.registry.json",
    "registries/movement/movement.registry.json",
    "registries/program/program.registry.json"
  ];

  for (const rel of paths) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, "{}\n");
  }

  writeJson(path.join(root, "ci", "evidence", "registry_seal_manifest.v1.json"), {
    schema_version: "kolosseum.registry_seal_manifest.v1",
    manifest_id: "launch_registry_surface",
    manifest_version: "1.0.0",
    seal_scope: "registry_bundle",
    entries: paths.map((p) => ({ path: p }))
  });

  writeJson(path.join(root, "ci", "evidence", "registry_seal_live_surface.v1.json"), {
    schema_version: "kolosseum.registry_seal_live_surface.v1",
    surface_id: "launch_registry_live_surface",
    surface_version: "1.0.0",
    seal_scope: "registry_bundle",
    entries: paths.map((p) => ({ path: p }))
  });

  const result = runVerifier(root);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.manifest_entry_count, paths.length);
  assert.equal(payload.live_surface_entry_count, paths.length);
});

test("fails when live surface contains an exact registry file not in manifest", () => {
  const root = makeRoot();

  const manifestPaths = [
    "registries/activity/activity.registry.json"
  ];

  const livePaths = [
    "registries/activity/activity.registry.json",
    "registries/movement/movement.registry.json"
  ];

  for (const rel of livePaths) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, "{}\n");
  }

  writeJson(path.join(root, "ci", "evidence", "registry_seal_manifest.v1.json"), {
    schema_version: "kolosseum.registry_seal_manifest.v1",
    manifest_id: "launch_registry_surface",
    manifest_version: "1.0.0",
    seal_scope: "registry_bundle",
    entries: manifestPaths.map((p) => ({ path: p }))
  });

  writeJson(path.join(root, "ci", "evidence", "registry_seal_live_surface.v1.json"), {
    schema_version: "kolosseum.registry_seal_live_surface.v1",
    surface_id: "launch_registry_live_surface",
    surface_version: "1.0.0",
    seal_scope: "registry_bundle",
    entries: livePaths.map((p) => ({ path: p }))
  });

  const result = runVerifier(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Live launch registry surface file 'registries\/movement\/movement\.registry\.json' is not listed in seal manifest/);
});