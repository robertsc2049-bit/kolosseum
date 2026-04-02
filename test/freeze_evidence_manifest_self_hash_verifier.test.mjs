import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

function writeFile(root, relativePath, content) {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content.replace(/\r\n/g, "\n"), "utf8");
}

function sha256Bytes(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function stable(value) {
  if (Array.isArray(value)) {
    return value.map(stable);
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = stable(value[key]);
    }
    return out;
  }
  return value;
}

function manifestSelfHash(manifest) {
  const cloned = structuredClone(manifest);
  delete cloned.manifest_self_hash;
  return sha256Bytes(Buffer.from(JSON.stringify(stable(cloned)), "utf8"));
}

function runNode(scriptRelative, args = []) {
  const scriptPath = path.resolve(scriptRelative);
  return spawnSync(process.execPath, [scriptPath, ...args], { encoding: "utf8" });
}

test("passes when embedded manifest self hash and governed hashes match live state", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "freeze-manifest-selfhash-pass-"));

  const frozenState = "{\n  \"ok\": true\n}\n";
  writeFile(tempRoot, "docs/releases/V1_FREEZE_STATE.json", frozenState);

  const liveSha = sha256Bytes(Buffer.from(frozenState, "utf8"));
  const manifest = {
    schema_version: "kolosseum.release.freeze_evidence_manifest.v1",
    artefacts: [],
    discovery: { include_globs: [], exclude_paths: [] },
    governed_artefacts: [
      {
        path: "docs/releases/V1_FREEZE_STATE.json",
        sha256: liveSha
      }
    ]
  };
  manifest.manifest_self_hash = manifestSelfHash(manifest);

  writeFile(
    tempRoot,
    "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST.json",
    JSON.stringify(manifest, null, 2) + "\n"
  );

  const result = runNode("ci/scripts/run_freeze_evidence_manifest_self_hash_verifier.mjs", [
    "--root", tempRoot,
    "--manifest", "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST.json",
    "--report", "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST_SELF_HASH.json"
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("fails when manifest self hash is stale", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "freeze-manifest-selfhash-stale-self-"));

  const frozenState = "{\n  \"ok\": true\n}\n";
  writeFile(tempRoot, "docs/releases/V1_FREEZE_STATE.json", frozenState);

  const manifest = {
    schema_version: "kolosseum.release.freeze_evidence_manifest.v1",
    artefacts: [],
    discovery: { include_globs: [], exclude_paths: [] },
    governed_artefacts: [
      {
        path: "docs/releases/V1_FREEZE_STATE.json",
        sha256: sha256Bytes(Buffer.from(frozenState, "utf8"))
      }
    ],
    manifest_self_hash: "0".repeat(64)
  };

  writeFile(
    tempRoot,
    "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST.json",
    JSON.stringify(manifest, null, 2) + "\n"
  );

  const result = runNode("ci/scripts/run_freeze_evidence_manifest_self_hash_verifier.mjs", [
    "--root", tempRoot,
    "--manifest", "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST.json",
    "--report", "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST_SELF_HASH.json"
  ]);

  assert.notEqual(result.status, 0, "expected verifier failure");
  const report = JSON.parse(fs.readFileSync(path.join(tempRoot, "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST_SELF_HASH.json"), "utf8"));
  assert.equal(report.failures.some((x) => x.details.includes("self hash does not match canonical recompute")), true);
});

test("fails when embedded governed hash is stale", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "freeze-manifest-selfhash-stale-governed-"));

  const frozenState = "{\n  \"ok\": true\n}\n";
  writeFile(tempRoot, "docs/releases/V1_FREEZE_STATE.json", frozenState);

  const manifest = {
    schema_version: "kolosseum.release.freeze_evidence_manifest.v1",
    artefacts: [],
    discovery: { include_globs: [], exclude_paths: [] },
    governed_artefacts: [
      {
        path: "docs/releases/V1_FREEZE_STATE.json",
        sha256: "f".repeat(64)
      }
    ]
  };
  manifest.manifest_self_hash = manifestSelfHash(manifest);

  writeFile(
    tempRoot,
    "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST.json",
    JSON.stringify(manifest, null, 2) + "\n"
  );

  const result = runNode("ci/scripts/run_freeze_evidence_manifest_self_hash_verifier.mjs", [
    "--root", tempRoot,
    "--manifest", "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST.json",
    "--report", "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST_SELF_HASH.json"
  ]);

  assert.notEqual(result.status, 0, "expected verifier failure");
  const report = JSON.parse(fs.readFileSync(path.join(tempRoot, "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST_SELF_HASH.json"), "utf8"));
  assert.equal(report.failures.some((x) => x.details.includes("does not match embedded manifest hash")), true);
});

test("fails when manifest_self_hash is missing", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "freeze-manifest-selfhash-missing-"));

  writeFile(tempRoot, "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST.json", JSON.stringify({
    governed_artefacts: []
  }, null, 2) + "\n");

  const result = runNode("ci/scripts/run_freeze_evidence_manifest_self_hash_verifier.mjs", [
    "--root", tempRoot,
    "--manifest", "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST.json",
    "--report", "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST_SELF_HASH.json"
  ]);

  assert.notEqual(result.status, 0, "expected verifier failure");
  const report = JSON.parse(fs.readFileSync(path.join(tempRoot, "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST_SELF_HASH.json"), "utf8"));
  assert.equal(report.failures.some((x) => x.details.includes("must contain manifest_self_hash")), true);
});