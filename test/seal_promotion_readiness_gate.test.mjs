import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

import {
  verifySealPromotionReadinessGate,
  TOKEN
} from "../ci/scripts/run_seal_promotion_readiness_gate.mjs";

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function hashFile(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function makeBaseRepoFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "p89-seal-promotion-gate-"));

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

  return root;
}

function makePreSealRepoFixture() {
  const root = makeBaseRepoFixture();

  writeJson(path.join(root, "ci", "evidence", "registry_seal.lifecycle.json"), {
    mode: "pre-seal"
  });

  return root;
}

function makeSealedRepoFixture() {
  const root = makeBaseRepoFixture();

  const bundlePath = path.join(root, "registries", "registry_bundle.json");
  const reg1Path = path.join(root, "registries", "activity_registry_1.json");
  const reg2Path = path.join(root, "registries", "movement_registry_3.json");

  writeJson(path.join(root, "ci", "evidence", "registry_seal.lifecycle.json"), {
    mode: "sealed"
  });

  writeJson(path.join(root, "ci", "evidence", "registry_seal.json"), {
    bundle_hash: hashFile(bundlePath),
    registry_hashes: {
      activity_registry_1: hashFile(reg1Path),
      movement_registry_3: hashFile(reg2Path)
    }
  });

  return root;
}

test("pre-seal mode passes normal dev checks", () => {
  const repoRoot = makePreSealRepoFixture();

  const result = verifySealPromotionReadinessGate({
    repoRoot,
    promotion: false
  });

  assert.equal(result.ok, true);
  assert.equal(result.mode, "pre-seal");
  assert.equal(result.enforced, false);
});

test("pre-seal mode fails launch promotion readiness", () => {
  const repoRoot = makePreSealRepoFixture();

  const result = verifySealPromotionReadinessGate({
    repoRoot,
    promotion: true
  });

  assert.equal(result.ok, false);
  assert.equal(result.mode, "pre-seal");
  assert.ok(
    result.failures.some(
      (failure) => failure.token === TOKEN.CI_PROMOTION_REQUIRES_SEALED_REGISTRY_STATE
    )
  );
});

test("sealed promotion path passes when seal verification is valid", () => {
  const repoRoot = makeSealedRepoFixture();

  const result = verifySealPromotionReadinessGate({
    repoRoot,
    promotion: true
  });

  assert.equal(result.ok, true);
  assert.equal(result.mode, "sealed");
  assert.equal(result.enforced, true);
});

test("sealed mode fails when seal-aware bundle verification is invalid", () => {
  const repoRoot = makeSealedRepoFixture();

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

  const result = verifySealPromotionReadinessGate({
    repoRoot,
    promotion: true
  });

  assert.equal(result.ok, false);
  assert.ok(
    result.failures.some((failure) =>
      [
        TOKEN.CI_SEAL_BUNDLE_DRIFT,
        TOKEN.CI_BUNDLE_ONLY_DRIFT,
        TOKEN.CI_REGISTRY_LOAD_ORDER_INVALID
      ].includes(failure.token)
    )
  );
});