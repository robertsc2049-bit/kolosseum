import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const verifierPath = path.join(repoRoot, "ci", "scripts", "run_freeze_evidence_seal_binding_verifier.mjs");

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function runVerifier(manifest, activeSeal) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "p105-freeze-evidence-seal-binding-"));
  const manifestPath = path.join(tempDir, "freeze_evidence_manifest.json");
  const activeSealPath = path.join(tempDir, "active_sealed_registry_state.json");

  writeJson(manifestPath, manifest);
  writeJson(activeSealPath, activeSeal);

  const result = spawnSync(
    process.execPath,
    [verifierPath, manifestPath, activeSealPath],
    {
      cwd: repoRoot,
      encoding: "utf8"
    }
  );

  let stdoutJson = null;
  let stderrJson = null;

  if (result.stdout && result.stdout.trim().startsWith("{")) {
    stdoutJson = JSON.parse(result.stdout);
  }
  if (result.stderr && result.stderr.trim().startsWith("{")) {
    stderrJson = JSON.parse(result.stderr);
  }

  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    stdoutJson,
    stderrJson
  };
}

test("P105 positive: manifest binding matches active sealed registry state", () => {
  const result = runVerifier(
    {
      manifest_id: "freeze_evidence_manifest_v1",
      freeze_evidence_seal_binding: {
        seal_id: "seal_2026_04_01",
        registry_bundle_hash: "sha256:abc123"
      }
    },
    {
      seal_id: "seal_2026_04_01",
      registry_bundle_hash: "sha256:abc123"
    }
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(result.stdoutJson?.ok, true);
  assert.equal(result.stdoutJson?.seal_id, "seal_2026_04_01");
  assert.equal(result.stdoutJson?.registry_bundle_hash, "sha256:abc123");
});

test("P105 negative: seal drift fails when active sealed registry state changes", () => {
  const result = runVerifier(
    {
      manifest_id: "freeze_evidence_manifest_v1",
      freeze_evidence_seal_binding: {
        seal_id: "seal_2026_03_31",
        registry_bundle_hash: "sha256:oldseal"
      }
    },
    {
      seal_id: "seal_2026_04_01",
      registry_bundle_hash: "sha256:newseal"
    }
  );

  assert.equal(result.status, 1, "Verifier should fail on seal drift.");
  assert.equal(result.stderrJson?.ok, false);
  assert.equal(result.stderrJson?.code, "CI_MANIFEST_MISMATCH");
  assert.match(
    result.stderrJson?.message ?? "",
    /does not match active sealed registry state/i
  );
});

test("P105 negative: missing manifest seal binding fails closed", () => {
  const result = runVerifier(
    {
      manifest_id: "freeze_evidence_manifest_v1"
    },
    {
      seal_id: "seal_2026_04_01",
      registry_bundle_hash: "sha256:abc123"
    }
  );

  assert.equal(result.status, 1, "Verifier should fail when manifest binding is missing.");
  assert.equal(result.stderrJson?.ok, false);
  assert.equal(result.stderrJson?.code, "CI_MANIFEST_MISMATCH");
  assert.match(
    result.stderrJson?.message ?? "",
    /missing seal binding/i
  );
});