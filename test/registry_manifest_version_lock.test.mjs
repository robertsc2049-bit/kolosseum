import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  verifyRegistryManifestVersionLock,
  TOKEN
} from "../ci/scripts/run_registry_manifest_version_lock.mjs";

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function makeManifestFixture(manifest) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "p91-registry-manifest-version-lock-"));
  fs.mkdirSync(path.join(root, "ci", "evidence"), { recursive: true });
  writeJson(path.join(root, "ci", "evidence", "registry_seal.json"), manifest);
  return root;
}

test("passes when manifest_version 1.0.0 is present and scope matches contract", () => {
  const repoRoot = makeManifestFixture({
    manifest_version: "1.0.0",
    seal_id: "seal_launch_v1",
    bundle_hash: "bundle_hash_value",
    registry_hashes: {
      activity_registry_1: "hash_a",
      movement_registry_3: "hash_b"
    },
    scope: {
      bundle_hash_included: true,
      registry_hashes_included: true,
      ordered_registry_scope: true,
      sealed_mode_required: true
    }
  });

  const result = verifyRegistryManifestVersionLock({ repoRoot });

  assert.equal(result.ok, true);
  assert.equal(result.manifest_version, "1.0.0");
});

test("fails when manifest_version is missing", () => {
  const repoRoot = makeManifestFixture({
    seal_id: "seal_launch_v1",
    bundle_hash: "bundle_hash_value",
    registry_hashes: {
      activity_registry_1: "hash_a"
    }
  });

  const result = verifyRegistryManifestVersionLock({ repoRoot });

  assert.equal(result.ok, false);
  assert.ok(
    result.failures.some((failure) => failure.token === TOKEN.CI_REGISTRY_MANIFEST_VERSION_MISSING)
  );
});

test("fails when manifest_version is unknown", () => {
  const repoRoot = makeManifestFixture({
    manifest_version: "9.9.9",
    seal_id: "seal_launch_v1",
    bundle_hash: "bundle_hash_value",
    registry_hashes: {
      activity_registry_1: "hash_a"
    }
  });

  const result = verifyRegistryManifestVersionLock({ repoRoot });

  assert.equal(result.ok, false);
  assert.ok(
    result.failures.some((failure) => failure.token === TOKEN.CI_REGISTRY_MANIFEST_VERSION_UNKNOWN)
  );
});

test("fails when scope changes without version increment", () => {
  const repoRoot = makeManifestFixture({
    manifest_version: "1.0.0",
    seal_id: "seal_launch_v1",
    bundle_hash: "bundle_hash_value",
    registry_hashes: {
      activity_registry_1: "hash_a"
    },
    scope: {
      bundle_hash_included: true,
      registry_hashes_included: true,
      ordered_registry_scope: true,
      sealed_mode_required: true,
      extra_scope_dimension: true
    }
  });

  const result = verifyRegistryManifestVersionLock({ repoRoot });

  assert.equal(result.ok, false);
  assert.ok(
    result.failures.some((failure) => failure.token === TOKEN.CI_REGISTRY_MANIFEST_SCOPE_DRIFT)
  );
});

test("fails when required scope semantics drift under same version", () => {
  const repoRoot = makeManifestFixture({
    manifest_version: "1.0.0",
    seal_id: "seal_launch_v1",
    bundle_hash: "bundle_hash_value",
    registry_hashes: {
      activity_registry_1: "hash_a"
    },
    scope: {
      bundle_hash_included: false,
      registry_hashes_included: true
    }
  });

  const result = verifyRegistryManifestVersionLock({ repoRoot });

  assert.equal(result.ok, false);
  assert.ok(
    result.failures.some((failure) => failure.token === TOKEN.CI_REGISTRY_MANIFEST_SCOPE_DRIFT)
  );
});