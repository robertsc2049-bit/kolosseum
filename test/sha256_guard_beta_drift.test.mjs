import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = path.resolve(".");
const guardPath = path.join(repoRoot, "ci/scripts/sha256_guard.mjs");
const writerPath = path.join(repoRoot, "ci/scripts/write_checksums.mjs");

function write(root, rel, text) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, String(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n"), "utf8");
}

function runNode(script, args) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: repoRoot,
    encoding: "utf8"
  });
}

function stableManifest() {
  return {
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
}

function makeRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "kolosseum-beta02-"));

  write(root, "docs/ARCHITECTURE.md", "# Architecture\n");
  write(root, "docs/GUARDS_INDEX.md", "# Guards\n");
  write(root, "docs/dev/FAILURE_TOKEN_INDEX.md", "# Failure Token Index\n");
  write(root, "spine/BUILD_TARGET_september_beta_2026.md", "# September beta target\n");
  write(root, "spine/BETA_ARTEFACT_MANIFEST.json", `${JSON.stringify(stableManifest(), null, 2)}\n`);

  const writer = runNode(writerPath, ["--root", root, "--write"]);
  assert.equal(writer.status, 0, writer.stderr);

  return root;
}

function runGuard(root) {
  return runNode(guardPath, ["--root", root]);
}

test("BETA-02 clean generated checksum state passes", () => {
  const root = makeRepo();
  const result = runGuard(root);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /sha256_guard: OK/);
});

test("BETA-02 placeholder checksum in beta seal scope fails", () => {
  const root = makeRepo();
  const checksumPath = path.join(root, "docs/checksums.sha256");
  const text = fs.readFileSync(checksumPath, "utf8");
  const changed = text.replace(/^[a-f0-9]{64}  \.\.\/spine\/BETA_ARTEFACT_MANIFEST\.json$/m, `${"0".repeat(64)}  ../spine/BETA_ARTEFACT_MANIFEST.json`);
  assert.notEqual(changed, text, "test fixture failed to replace beta manifest checksum");

  fs.writeFileSync(checksumPath, changed, "utf8");

  const result = runGuard(root);
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /CI_BETA_CHECKSUM_PLACEHOLDER/);
});

test("BETA-02 stale generated index checksum fails", () => {
  const root = makeRepo();
  write(root, "docs/dev/FAILURE_TOKEN_INDEX.md", "# Failure Token Index\n\nstale mutation\n");

  const result = runGuard(root);
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /CI_BETA_GENERATED_DRIFT/);
});

test("BETA-02 stale docs/checksums.sha256 generated output fails", () => {
  const root = makeRepo();
  const checksumPath = path.join(root, "docs/checksums.sha256");
  const lines = fs.readFileSync(checksumPath, "utf8").trimEnd().split("\n");
  lines.pop();
  fs.writeFileSync(checksumPath, `${lines.join("\n")}\n`, "utf8");

  const result = runGuard(root);
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /CI_BETA_GENERATED_DRIFT/);
});
