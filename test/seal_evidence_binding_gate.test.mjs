import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

import {
  verifySealEvidenceBindingGate,
  TOKEN
} from "../ci/scripts/run_seal_evidence_binding_gate.mjs";

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function hashFile(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function makeBaseRepoFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "p90-seal-evidence-binding-"));

  fs.mkdirSync(path.join(root, "registries"), { recursive: true });
  fs.mkdirSync(path.join(root, "ci", "evidence"), { recursive: true });
  fs.mkdirSync(path.join(root, "docs", "releases"), { recursive: true });

  writeJson(path.join(root, "ci", "evidence", "registry_seal.lifecycle.json"), {
    mode: "sealed"
  });

  writeJson(path.join(root, "registries", "registry_bundle.json"), {
    registry_ids: [
      "activity_registry_1",
      "movement_registry_3"
    ]
  });

  const bundlePath = path.join(root, "registries", "registry_bundle.json");
  const bundleHash = hashFile(bundlePath);

  writeJson(path.join(root, "ci", "evidence", "registry_seal.json"), {
    seal_id: "seal_launch_v1",
    bundle_hash: bundleHash,
    registry_hashes: {
      activity_registry_1: "hash_a",
      movement_registry_3: "hash_b"
    }
  });

  return { root, bundleHash };
}

test("passes when release evidence names the exact active seal identity", () => {
  const { root, bundleHash } = makeBaseRepoFixture();

  writeJson(path.join(root, "ci", "evidence", "promotion_readiness.evidence.json"), {
    seal_binding: {
      seal_id: "seal_launch_v1",
      bundle_hash: bundleHash
    }
  });

  const result = verifySealEvidenceBindingGate({ repoRoot: root });

  assert.equal(result.ok, true);
  assert.equal(result.mode, "sealed");
  assert.equal(result.evidence_surface.seal_id, "seal_launch_v1");
  assert.equal(result.evidence_surface.bundle_hash, bundleHash);
});

test("fails when release evidence omits seal binding", () => {
  const { root } = makeBaseRepoFixture();

  writeJson(path.join(root, "ci", "evidence", "promotion_readiness.evidence.json"), {
    evidence_id: "promotion_v1"
  });

  const result = verifySealEvidenceBindingGate({ repoRoot: root });

  assert.equal(result.ok, false);
  assert.ok(
    result.failures.some((failure) => failure.token === TOKEN.CI_EVIDENCE_SEAL_BINDING_MISSING)
  );
});

test("fails when release evidence seal_id mismatches active seal", () => {
  const { root, bundleHash } = makeBaseRepoFixture();

  writeJson(path.join(root, "ci", "evidence", "promotion_readiness.evidence.json"), {
    seal_binding: {
      seal_id: "seal_wrong",
      bundle_hash: bundleHash
    }
  });

  const result = verifySealEvidenceBindingGate({ repoRoot: root });

  assert.equal(result.ok, false);
  assert.ok(
    result.failures.some((failure) => failure.token === TOKEN.CI_EVIDENCE_SEAL_BINDING_MISMATCH)
  );
});

test("fails when release evidence bundle_hash mismatches active seal", () => {
  const { root } = makeBaseRepoFixture();

  writeJson(path.join(root, "ci", "evidence", "promotion_readiness.evidence.json"), {
    seal_binding: {
      seal_id: "seal_launch_v1",
      bundle_hash: "broken_bundle_hash"
    }
  });

  const result = verifySealEvidenceBindingGate({ repoRoot: root });

  assert.equal(result.ok, false);
  assert.ok(
    result.failures.some((failure) => failure.token === TOKEN.CI_EVIDENCE_SEAL_BINDING_MISMATCH)
  );
});