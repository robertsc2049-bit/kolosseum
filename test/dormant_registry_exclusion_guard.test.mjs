import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { verifyDormantRegistryExclusionGuard } from "../ci/scripts/run_dormant_registry_exclusion_guard.mjs";

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "p94b-dormant-exclusion-"));
}

function writeClassification(root, classification) {
  writeJson(path.join(root, "registries", "registry_surface_classification.json"), {
    registry_surface_classification: {
      version: "1.0.0",
      engine_compatibility: "EB2-1.0.0",
      classification
    }
  });
}

function writeLiveSurface(root, paths) {
  writeJson(path.join(root, "ci", "evidence", "registry_seal_live_surface.v1.json"), {
    schema_version: "kolosseum.registry_seal_live_surface.v1",
    surface_id: "launch_registry_live_surface",
    surface_version: "1.0.0",
    seal_scope: "registry_bundle",
    entries: paths.map((entryPath) => ({ path: entryPath }))
  });
}

function writeManifest(root, paths) {
  writeJson(path.join(root, "ci", "evidence", "registry_seal_manifest.v1.json"), {
    schema_version: "kolosseum.registry_seal_manifest.v1",
    manifest_id: "launch_registry_surface",
    manifest_version: "1.0.0",
    seal_scope: "registry_bundle",
    entries: paths.map((entryPath) => ({ path: entryPath }))
  });
}

function writeRegistryFile(root, relativePath, documentId) {
  writeJson(path.join(root, relativePath), {
    registry_header: {
      document_id: documentId,
      document_type: "registry",
      document_version: "1.0.0",
      engine_compatibility: "EB2-1.0.0",
      scope_class: "closed_world",
      rewrite_policy: "rewrite_only"
    },
    entries: []
  });
}

function writeRegistryFiles(root, relativePaths) {
  for (const relativePath of relativePaths) {
    const documentId =
      relativePath === "registries/activity/activity.registry.json" ? "activity.registry" :
      relativePath === "registries/exercise/exercise.registry.json" ? "exercise.registry" :
      relativePath === "registries/exercise/exercise_substitution_graph.json" ? "exercise_substitution_graph" :
      relativePath === "registries/exercise/exercise_warmup_mapping.registry.json" ? "exercise_warmup_mapping_registry" :
      relativePath === "registries/movement/movement.registry.json" ? "movement.registry" :
      relativePath === "registries/program/program.registry.json" ? "program.registry" :
      relativePath === "registries/registry_index.json" ? "registry_index" :
      path.basename(relativePath, ".json");

    writeRegistryFile(root, relativePath, documentId);
  }
}

test("passes when launch-critical files are in exact seal scope and dormant/excluded are absent", () => {
  const root = makeRoot();

  writeClassification(root, [
    { document_id: "activity.registry", class: "launch_critical" },
    { document_id: "exercise.registry", class: "launch_critical" },
    { document_id: "registry_index", class: "excluded" }
  ]);

  const scopePaths = [
    "registries/activity/activity.registry.json",
    "registries/exercise/exercise.registry.json"
  ];

  writeRegistryFiles(root, scopePaths);
  writeLiveSurface(root, scopePaths);
  writeManifest(root, scopePaths);

  const report = verifyDormantRegistryExclusionGuard(root);
  assert.equal(report.ok, true);
  assert.deepEqual(report.failures, []);
});

test("fails when dormant-class file is present in exact seal scope", () => {
  const root = makeRoot();

  writeClassification(root, [
    { document_id: "activity.registry", class: "launch_critical" },
    { document_id: "exercise_substitution_graph", class: "dormant" }
  ]);

  const scopePaths = [
    "registries/activity/activity.registry.json",
    "registries/exercise/exercise_substitution_graph.json"
  ];

  writeRegistryFiles(root, scopePaths);
  writeLiveSurface(root, scopePaths);
  writeManifest(root, scopePaths);

  const report = verifyDormantRegistryExclusionGuard(root);
  assert.equal(report.ok, false);
  assert.match(JSON.stringify(report.failures), /Dormant registry surface 'exercise_substitution_graph' is present in exact seal scope/);
});

test("fails when active-class omission occurs", () => {
  const root = makeRoot();

  writeClassification(root, [
    { document_id: "activity.registry", class: "launch_critical" },
    { document_id: "movement.registry", class: "launch_critical" }
  ]);

  const scopePaths = [
    "registries/activity/activity.registry.json"
  ];

  writeRegistryFiles(root, scopePaths);
  writeLiveSurface(root, scopePaths);
  writeManifest(root, scopePaths);

  const report = verifyDormantRegistryExclusionGuard(root);
  assert.equal(report.ok, false);
  assert.match(JSON.stringify(report.failures), /Launch-critical registry surface 'movement.registry' is missing from exact seal scope/);
});

test("fails when exact seal scope contains unclassified registry surface", () => {
  const root = makeRoot();

  writeClassification(root, [
    { document_id: "activity.registry", class: "launch_critical" }
  ]);

  const scopePaths = [
    "registries/activity/activity.registry.json",
    "registries/program/program.registry.json"
  ];

  writeRegistryFiles(root, scopePaths);
  writeLiveSurface(root, scopePaths);
  writeManifest(root, scopePaths);

  const report = verifyDormantRegistryExclusionGuard(root);
  assert.equal(report.ok, false);
  assert.match(JSON.stringify(report.failures), /unclassified registry surface 'program.registry'/);
});

test("fails when live surface and manifest drift apart", () => {
  const root = makeRoot();

  writeClassification(root, [
    { document_id: "activity.registry", class: "launch_critical" }
  ]);

  const livePaths = [
    "registries/activity/activity.registry.json"
  ];

  const manifestPaths = [
    "registries/movement/movement.registry.json"
  ];

  writeRegistryFiles(root, [...new Set([...livePaths, ...manifestPaths])]);
  writeLiveSurface(root, livePaths);
  writeManifest(root, manifestPaths);

  const report = verifyDormantRegistryExclusionGuard(root);
  assert.equal(report.ok, false);
  assert.match(JSON.stringify(report.failures), /Live surface path 'registries\/activity\/activity\.registry\.json' is not present in manifest/);
  assert.match(JSON.stringify(report.failures), /Manifest path 'registries\/movement\/movement\.registry\.json' is not present in live surface/);
});