import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const scriptPath = path.join(repoRoot, "ci", "scripts", "run_postv1_freeze_evidence_manifest_verifier.mjs");

function writeUtf8Lf(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content.replace(/\r\n/g, "\n").replace(/\r/g, "\n"), "utf8");
}

function runVerifier(rootDir) {
  return spawnSync(
    process.execPath,
    [
      scriptPath,
      "--root",
      rootDir,
      "--manifest",
      "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST.json",
    ],
    {
      cwd: repoRoot,
      encoding: "utf8",
    }
  );
}

function makeManifest() {
  return JSON.stringify(
    {
      schema_version: "kolosseum.release.freeze_evidence_manifest.v1",
      manifest_id: "v1_freeze_evidence_manifest",
      release_id: "V1",
      scope: "freeze_phase",
      artefacts: [
        {
          evidence_id: "packaging_surface_registry",
          path: "docs/releases/V1_PACKAGING_SURFACE_REGISTRY.json",
          content_type: "json",
          required: true,
        },
      ],
      discovery: {
        include_globs: ["docs/releases/V1_FREEZE_*.json"],
        exclude_paths: [
          "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST.json",
          "docs/releases/V1_FREEZE_READINESS.json",
        ],
      },
    },
    null,
    2
  ) + "\n";
}

test("freeze evidence manifest verifier passes when declared evidence exists and no undeclared freeze evidence is present", () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "kolosseum-freeze-evidence-pass-"));

  writeUtf8Lf(
    path.join(rootDir, "docs", "releases", "V1_FREEZE_EVIDENCE_MANIFEST.json"),
    makeManifest()
  );
  writeUtf8Lf(
    path.join(rootDir, "docs", "releases", "V1_PACKAGING_SURFACE_REGISTRY.json"),
    JSON.stringify({ ok: true, surfaces: [] }, null, 2) + "\n"
  );
  writeUtf8Lf(
    path.join(rootDir, "docs", "releases", "V1_FREEZE_READINESS.json"),
    JSON.stringify({ ok: true, checks: [] }, null, 2) + "\n"
  );

  const result = runVerifier(rootDir);
  assert.equal(result.status, 0, result.stdout + result.stderr);

  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.evidence_count, 1);
});

test("freeze evidence manifest verifier fails when required evidence is missing", () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "kolosseum-freeze-evidence-missing-"));

  writeUtf8Lf(
    path.join(rootDir, "docs", "releases", "V1_FREEZE_EVIDENCE_MANIFEST.json"),
    makeManifest()
  );

  const result = runVerifier(rootDir);
  assert.notEqual(result.status, 0);

  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, false);
  assert.equal(payload.message, "missing_required_evidence");
});

test("freeze evidence manifest verifier fails when undeclared freeze evidence is present", () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "kolosseum-freeze-evidence-undeclared-"));

  writeUtf8Lf(
    path.join(rootDir, "docs", "releases", "V1_FREEZE_EVIDENCE_MANIFEST.json"),
    makeManifest()
  );
  writeUtf8Lf(
    path.join(rootDir, "docs", "releases", "V1_PACKAGING_SURFACE_REGISTRY.json"),
    JSON.stringify({ ok: true, surfaces: [] }, null, 2) + "\n"
  );
  writeUtf8Lf(
    path.join(rootDir, "docs", "releases", "V1_FREEZE_READINESS.json"),
    JSON.stringify({ ok: true, checks: [] }, null, 2) + "\n"
  );
  writeUtf8Lf(
    path.join(rootDir, "docs", "releases", "V1_FREEZE_STRAY.json"),
    JSON.stringify({ ok: true }, null, 2) + "\n"
  );

  const result = runVerifier(rootDir);
  assert.notEqual(result.status, 0);

  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, false);
  assert.equal(payload.message, "undeclared_freeze_evidence");
  assert.deepEqual(payload.undeclared_paths, ["docs/releases/V1_FREEZE_STRAY.json"]);
});