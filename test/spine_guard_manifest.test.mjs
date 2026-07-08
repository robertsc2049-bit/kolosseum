import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const guardPath = path.resolve("ci/scripts/spine_guard.mjs");

function write(root, rel, text) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, String(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n"), "utf8");
}

function baseManifest(overrides = {}) {
  const manifest = {
    schema_version: "kolosseum.beta.spine_artefact_manifest.v1.0.0",
    manifest_id: "BETA-01",
    build_target: "september_controlled_beta_2026",
    required_version: "0.1.24",
    engine_compatibility: "0.1.24",
    resolution_policy: {
      explicit_manifest_only: true,
      no_fallback: true,
      no_discovery: true,
      no_inference: true,
      no_defaults: true,
      unknown_reference_hard_fail: true
    },
    phase_policy: {
      standard_phases: [1, 2, 3, 4, 5, 6],
      beta_only_phases: [7, 8],
      beta_target_required: "september_controlled_beta_2026",
      phase_7_8_ship_scope_allowed: false
    },
    orphan_scope_roots: ["spine/"],
    spine_references: [
      { path: "spine/BUILD_TARGET_september_beta_2026.md", required: true },
      { path: "spine/BETA_ARTEFACT_MANIFEST.json", required: true }
    ],
    dependency_order: ["beta_build_target", "beta_spine_artefact_manifest"],
    artefacts: [
      {
        id: "beta_build_target",
        path: "spine/BUILD_TARGET_september_beta_2026.md",
        scope: "beta",
        version: "0.1.24",
        engine_compatibility: "0.1.24",
        phase_range: [1, 8],
        beta_only: true,
        ship_scope: false,
        dependencies: []
      },
      {
        id: "beta_spine_artefact_manifest",
        path: "spine/BETA_ARTEFACT_MANIFEST.json",
        scope: "beta",
        version: "0.1.24",
        engine_compatibility: "0.1.24",
        phase_range: [1, 8],
        beta_only: true,
        ship_scope: false,
        dependencies: ["beta_build_target"]
      }
    ]
  };

  return Object.assign(manifest, overrides);
}

function makeRepo(mutator = () => {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "kolosseum-beta01-"));

  write(root, "package.json", JSON.stringify({ version: "0.1.24", type: "module" }, null, 2) + "\n");
  write(root, "docs/SPINE.md", "# Spine\n\n**CORE.md**\n");
  write(root, "docs/CORE.md", "# Core\n");
  write(root, "spine/BUILD_TARGET_september_beta_2026.md", "# Beta target\n\nPhase 7 and Phase 8 are beta-only.\n");

  const manifest = baseManifest();
  mutator(root, manifest);
  write(root, "spine/BETA_ARTEFACT_MANIFEST.json", JSON.stringify(manifest, null, 2) + "\n");

  return root;
}

function runGuard(root) {
  return spawnSync(process.execPath, [
    guardPath,
    "--root",
    root,
    "--spine",
    "docs/SPINE.md",
    "--manifest",
    "spine/BETA_ARTEFACT_MANIFEST.json"
  ], {
    cwd: path.resolve("."),
    encoding: "utf8"
  });
}

function expectFailure(mutator, token) {
  const root = makeRepo(mutator);
  const result = runGuard(root);
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, new RegExp(token));
}

test("BETA-01 spine artefact manifest guard passes valid manifest", () => {
  const root = makeRepo();
  const result = runGuard(root);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /spine_guard: OK/);
  assert.match(result.stdout, /CI_BETA_SPINE_ARTEFACT_MANIFEST/);
});

test("BETA-01 fails missing referenced artefact", () => {
  expectFailure((root) => {
    fs.unlinkSync(path.join(root, "spine/BUILD_TARGET_september_beta_2026.md"));
  }, "CI_BETA_SPINE_MISSING_ARTEFACT");
});

test("BETA-01 fails orphan beta-scope artefact", () => {
  expectFailure((root) => {
    write(root, "spine/UNDECLARED_BETA_ARTEFACT.md", "# orphan\n");
  }, "CI_BETA_SPINE_ORPHAN_ARTEFACT");
});

test("BETA-01 fails version mismatch", () => {
  expectFailure((root, manifest) => {
    manifest.artefacts[0].version = "0.1.23";
  }, "CI_BETA_SPINE_VERSION_MISMATCH");
});

test("BETA-01 fails engine compatibility mismatch", () => {
  expectFailure((root, manifest) => {
    manifest.artefacts[0].engine_compatibility = "0.1.23";
  }, "CI_BETA_SPINE_ENGINE_COMPATIBILITY_MISMATCH");
});

test("BETA-01 fails Phase 7/8 outside beta-only scope", () => {
  expectFailure((root, manifest) => {
    manifest.artefacts[0].scope = "ship";
    manifest.artefacts[0].beta_only = false;
    manifest.artefacts[0].ship_scope = true;
  }, "CI_BETA_SPINE_PHASE_SCOPE_VIOLATION");
});

test("BETA-01 fails nondeterministic dependency order", () => {
  expectFailure((root, manifest) => {
    manifest.dependency_order = ["beta_spine_artefact_manifest", "beta_build_target"];
  }, "CI_BETA_SPINE_DEPENDENCY_ORDER");
});

test("BETA-01 fails fallback/discovery/inference policy drift", () => {
  expectFailure((root, manifest) => {
    manifest.resolution_policy.no_fallback = false;
  }, "CI_BETA_SPINE_FORBIDDEN_RESOLUTION");
});
