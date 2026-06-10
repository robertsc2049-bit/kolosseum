import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  verifyRegistryFileIdentityLock,
  TOKEN
} from "../ci/scripts/run_registry_file_identity_lock.mjs";

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function makeBaseRepoFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "p92-registry-file-identity-lock-"));

  fs.mkdirSync(path.join(root, "registries"), { recursive: true });
  fs.mkdirSync(path.join(root, "docs", "moved"), { recursive: true });

  writeJson(path.join(root, "registries", "activity_registry_1.json"), {
    registry_header: { document_id: "activity_registry_1" },
    entries: [{ activity_id: "powerlifting" }]
  });

  writeJson(path.join(root, "registries", "movement_registry_3.json"), {
    registry_header: { document_id: "movement_registry_3" },
    entries: [{ movement_family_id: "squat" }]
  });

  writeJson(path.join(root, "registries", "registry_bundle.json"), {
    registries: [
      {
        registry_id: "activity_registry_1",
        canonical_path: "registries/activity_registry_1.json"
      },
      {
        registry_id: "movement_registry_3",
        canonical_path: "registries/movement_registry_3.json"
      }
    ]
  });

  return root;
}

test("passes when all registries exist only at canonical paths", () => {
  const repoRoot = makeBaseRepoFixture();

  const result = verifyRegistryFileIdentityLock({ repoRoot });

  assert.equal(result.ok, true);
  assert.deepEqual(result.failures, []);
});

test("fails when canonical registry path is removed", () => {
  const repoRoot = makeBaseRepoFixture();

  fs.rmSync(path.join(repoRoot, "registries", "activity_registry_1.json"));

  const result = verifyRegistryFileIdentityLock({ repoRoot });

  assert.equal(result.ok, false);
  assert.ok(
    result.failures.some((failure) => failure.token === TOKEN.CI_REGISTRY_CANONICAL_PATH_MISSING)
  );
});

test("fails when same hash appears at different non-canonical path", () => {
  const repoRoot = makeBaseRepoFixture();

  fs.copyFileSync(
    path.join(repoRoot, "registries", "activity_registry_1.json"),
    path.join(repoRoot, "docs", "moved", "activity_registry_1.json")
  );

  const result = verifyRegistryFileIdentityLock({ repoRoot });

  assert.equal(result.ok, false);
  assert.ok(
    result.failures.some((failure) => failure.token === TOKEN.CI_REGISTRY_FILE_IDENTITY_MISMATCH)
  );
});

test("fails when registry is renamed/moved and canonical path disappears", () => {
  const repoRoot = makeBaseRepoFixture();

  fs.renameSync(
    path.join(repoRoot, "registries", "activity_registry_1.json"),
    path.join(repoRoot, "docs", "moved", "activity_registry_1_renamed.json")
  );

  const result = verifyRegistryFileIdentityLock({ repoRoot });

  assert.equal(result.ok, false);
  assert.ok(
    result.failures.some((failure) => failure.token === TOKEN.CI_REGISTRY_CANONICAL_PATH_MISSING)
  );
});