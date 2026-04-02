import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function setupRepoFixture() {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "freeze-proof-index-completeness-"));
  fs.mkdirSync(path.join(repoRoot, "ci", "scripts"), { recursive: true });
  fs.mkdirSync(path.join(repoRoot, "docs", "releases"), { recursive: true });
  fs.mkdirSync(path.join(repoRoot, "test"), { recursive: true });

  const verifierSourcePath = path.resolve(
    "ci/scripts/run_freeze_proof_index_completeness_verifier.mjs",
  );
  const verifierDestPath = path.join(
    repoRoot,
    "ci",
    "scripts",
    "run_freeze_proof_index_completeness_verifier.mjs",
  );
  fs.copyFileSync(verifierSourcePath, verifierDestPath);

  return { repoRoot, verifierDestPath };
}

test("freeze proof index completeness verifier passes when index exactly covers tracked freeze proof surfaces", () => {
  const { repoRoot, verifierDestPath } = setupRepoFixture();

  writeJson(path.join(repoRoot, "docs", "releases", "V1_FREEZE_PROOF_INDEX.json"), {
    freeze_proof_reports: [
      { path: "docs/releases/V1_FREEZE_ALPHA.json" },
      { path: "docs/releases/V1_FREEZE_BRAVO.json" },
    ],
    freeze_proof_runners: [
      { path: "ci/scripts/run_freeze_alpha_verifier.mjs" },
      { path: "ci/scripts/run_freeze_bravo_verifier.mjs" },
    ],
  });

  writeJson(path.join(repoRoot, "docs", "releases", "V1_PACKAGING_SURFACE_REGISTRY.json"), {
    schema_version: "v1",
    surfaces: [
      { path: "docs/releases/V1_FREEZE_ALPHA.json" },
      { path: "docs/releases/V1_FREEZE_BRAVO.json" },
      { path: "ci/scripts/run_freeze_alpha_verifier.mjs" },
      { path: "ci/scripts/run_freeze_bravo_verifier.mjs" },
      { path: "docs/releases/V1_FREEZE_PROOF_INDEX.json" },
      { path: "ci/scripts/run_freeze_proof_index_completeness_verifier.mjs" },
    ],
  });

  writeJson(path.join(repoRoot, "docs", "releases", "V1_FREEZE_ALPHA.json"), { ok: true });
  writeJson(path.join(repoRoot, "docs", "releases", "V1_FREEZE_BRAVO.json"), { ok: true });
  writeJson(path.join(repoRoot, "ci", "scripts", "run_freeze_alpha_verifier.mjs"), { runner: "alpha" });
  writeJson(path.join(repoRoot, "ci", "scripts", "run_freeze_bravo_verifier.mjs"), { runner: "bravo" });

  const result = spawnSync(process.execPath, [verifierDestPath], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  const outputPath = path.join(repoRoot, "docs", "releases", "V1_FREEZE_PROOF_INDEX_COMPLETENESS.json");
  assert.equal(fs.existsSync(outputPath), true);

  const output = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  assert.equal(output.ok, true);
  assert.deepEqual(output.missing_index_entries, []);
  assert.deepEqual(output.stale_extra_entries, []);
});

test("freeze proof index completeness verifier fails when a tracked freeze proof report is missing from the index", () => {
  const { repoRoot, verifierDestPath } = setupRepoFixture();

  writeJson(path.join(repoRoot, "docs", "releases", "V1_FREEZE_PROOF_INDEX.json"), {
    freeze_proof_reports: [
      { path: "docs/releases/V1_FREEZE_ALPHA.json" },
    ],
    freeze_proof_runners: [
      { path: "ci/scripts/run_freeze_alpha_verifier.mjs" },
    ],
  });

  writeJson(path.join(repoRoot, "docs", "releases", "V1_PACKAGING_SURFACE_REGISTRY.json"), {
    schema_version: "v1",
    surfaces: [
      { path: "docs/releases/V1_FREEZE_ALPHA.json" },
      { path: "docs/releases/V1_FREEZE_BRAVO.json" },
      { path: "ci/scripts/run_freeze_alpha_verifier.mjs" },
    ],
  });

  writeJson(path.join(repoRoot, "docs", "releases", "V1_FREEZE_ALPHA.json"), { ok: true });
  writeJson(path.join(repoRoot, "docs", "releases", "V1_FREEZE_BRAVO.json"), { ok: true });
  writeJson(path.join(repoRoot, "ci", "scripts", "run_freeze_alpha_verifier.mjs"), { runner: "alpha" });

  const result = spawnSync(process.execPath, [verifierDestPath], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /missing_index_entries=docs\/releases\/V1_FREEZE_BRAVO\.json/);

  const outputPath = path.join(repoRoot, "docs", "releases", "V1_FREEZE_PROOF_INDEX_COMPLETENESS.json");
  const output = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  assert.equal(output.ok, false);
  assert.deepEqual(output.missing_index_entries, ["docs/releases/V1_FREEZE_BRAVO.json"]);
});

test("freeze proof index completeness verifier fails when the index contains a stale extra runner entry", () => {
  const { repoRoot, verifierDestPath } = setupRepoFixture();

  writeJson(path.join(repoRoot, "docs", "releases", "V1_FREEZE_PROOF_INDEX.json"), {
    freeze_proof_reports: [
      { path: "docs/releases/V1_FREEZE_ALPHA.json" },
    ],
    freeze_proof_runners: [
      { path: "ci/scripts/run_freeze_alpha_verifier.mjs" },
      { path: "ci/scripts/run_freeze_stale_verifier.mjs" },
    ],
  });

  writeJson(path.join(repoRoot, "docs", "releases", "V1_PACKAGING_SURFACE_REGISTRY.json"), {
    schema_version: "v1",
    surfaces: [
      { path: "docs/releases/V1_FREEZE_ALPHA.json" },
      { path: "ci/scripts/run_freeze_alpha_verifier.mjs" },
    ],
  });

  writeJson(path.join(repoRoot, "docs", "releases", "V1_FREEZE_ALPHA.json"), { ok: true });
  writeJson(path.join(repoRoot, "ci", "scripts", "run_freeze_alpha_verifier.mjs"), { runner: "alpha" });

  const result = spawnSync(process.execPath, [verifierDestPath], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /stale_extra_entries=ci\/scripts\/run_freeze_stale_verifier\.mjs/);

  const outputPath = path.join(repoRoot, "docs", "releases", "V1_FREEZE_PROOF_INDEX_COMPLETENESS.json");
  const output = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  assert.equal(output.ok, false);
  assert.deepEqual(output.stale_extra_entries, ["ci/scripts/run_freeze_stale_verifier.mjs"]);
});