import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

import {
  verifySealAwareRegistryBundleGuard,
  TOKEN
} from "../ci/scripts/run_seal_aware_registry_bundle_guard.mjs";

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function hashFile(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function makeRepoFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "p88-seal-aware-bundle-"));
  fs.mkdirSync(path.join(root, "registries"), { recursive: true });
  fs.mkdirSync(path.join(root, "ci", "evidence"), { recursive: true });

  writeJson(path.join(root, "registries", "activity_registry_1.json"), {
    registry_header: { document_id: "activity_registry_1" },
    entries: [{ activity_id: "powerlifting" }]
  });

  writeJson(path.join(root, "registries", "movement_registry_3.json"), {
    registry_header: { document_id: "movement_registry_3" },
    entries: [{ movement_family_id: "squat" }]
  });

  writeJson(path.join(root, "registries", "registry_bundle.json"), {
    registry_ids: [
      "activity_registry_1",
      "movement_registry_3"
    ],
    registries: [
      {
        registry_id: "activity_registry_1",
        path: "registries/activity_registry_1.json"
      },
      {
        registry_id: "movement_registry_3",
        path: "registries/movement_registry_3.json"
      }
    ]
  });

  const bundlePath = path.join(root, "registries", "registry_bundle.json");
  const reg1Path = path.join(root, "registries", "activity_registry_1.json");
  const reg2Path = path.join(root, "registries", "movement_registry_3.json");

  writeJson(path.join(root, "ci", "evidence", "registry_seal.json"), {
    bundle_hash: hashFile(bundlePath),
    registry_hashes: {
      activity_registry_1: hashFile(reg1Path),
      movement_registry_3: hashFile(reg2Path)
    }
  });

  return root;
}

test("passes when bundle and registries match the sealed snapshot", () => {
  const repoRoot = makeRepoFixture();
  const result = verifySealAwareRegistryBundleGuard({
    repoRoot,
    bundlePath: path.join(repoRoot, "registries", "registry_bundle.json"),
    sealPath: path.join(repoRoot, "ci", "evidence", "registry_seal.json")
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.failures, []);
});

test("fails when bundle hash is missing from seal scope", () => {
  const repoRoot = makeRepoFixture();
  writeJson(path.join(repoRoot, "ci", "evidence", "registry_seal.json"), {
    registry_hashes: {
      activity_registry_1: "x",
      movement_registry_3: "y"
    }
  });

  const result = verifySealAwareRegistryBundleGuard({
    repoRoot,
    bundlePath: path.join(repoRoot, "registries", "registry_bundle.json"),
    sealPath: path.join(repoRoot, "ci", "evidence", "registry_seal.json")
  });

  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.token === TOKEN.CI_SEAL_SCOPE_INCOMPLETE));
});

test("fails on bundle-only drift after seal", () => {
  const repoRoot = makeRepoFixture();
  writeJson(path.join(repoRoot, "registries", "registry_bundle.json"), {
    registry_ids: [
      "movement_registry_3",
      "activity_registry_1"
    ],
    registries: [
      {
        registry_id: "movement_registry_3",
        path: "registries/movement_registry_3.json"
      },
      {
        registry_id: "activity_registry_1",
        path: "registries/activity_registry_1.json"
      }
    ]
  });

  const result = verifySealAwareRegistryBundleGuard({
    repoRoot,
    bundlePath: path.join(repoRoot, "registries", "registry_bundle.json"),
    sealPath: path.join(repoRoot, "ci", "evidence", "registry_seal.json")
  });

  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.token === TOKEN.CI_SEAL_BUNDLE_DRIFT));
  assert.ok(result.failures.some((failure) => failure.token === TOKEN.CI_BUNDLE_ONLY_DRIFT));
});

test("fails on registry drift after seal", () => {
  const repoRoot = makeRepoFixture();
  writeJson(path.join(repoRoot, "registries", "movement_registry_3.json"), {
    registry_header: { document_id: "movement_registry_3" },
    entries: [{ movement_family_id: "hinge" }]
  });

  const result = verifySealAwareRegistryBundleGuard({
    repoRoot,
    bundlePath: path.join(repoRoot, "registries", "registry_bundle.json"),
    sealPath: path.join(repoRoot, "ci", "evidence", "registry_seal.json")
  });

  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.token === TOKEN.CI_SEAL_REGISTRY_DRIFT));
});

test("fails on registry plus bundle scope mismatch", () => {
  const repoRoot = makeRepoFixture();
  writeJson(path.join(repoRoot, "registries", "registry_bundle.json"), {
    registry_ids: [
      "activity_registry_1",
      "movement_registry_3",
      "exercise_registry_3a"
    ],
    registries: [
      {
        registry_id: "activity_registry_1",
        path: "registries/activity_registry_1.json"
      },
      {
        registry_id: "movement_registry_3",
        path: "registries/movement_registry_3.json"
      },
      {
        registry_id: "exercise_registry_3a",
        path: "registries/exercise_registry_3a.json"
      }
    ]
  });

  writeJson(path.join(repoRoot, "registries", "exercise_registry_3a.json"), {
    registry_header: { document_id: "exercise_registry_3a" },
    entries: [{ exercise_id: "back_squat" }]
  });

  const result = verifySealAwareRegistryBundleGuard({
    repoRoot,
    bundlePath: path.join(repoRoot, "registries", "registry_bundle.json"),
    sealPath: path.join(repoRoot, "ci", "evidence", "registry_seal.json")
  });

  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.token === TOKEN.CI_BUNDLE_REGISTRY_MISMATCH));
});