import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

import { verifyFreezePromotionPacketCleanliness } from "../ci/scripts/run_freeze_promotion_packet_cleanliness_guard.mjs";

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, "utf8");
}

function run(cmd, args, cwd) {
  return execFileSync(cmd, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}

function makeRepo() {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "kolosseum-freeze-packet-cleanliness-"));
  run("git", ["init"], repoRoot);
  run("git", ["config", "user.name", "Kolosseum Test"], repoRoot);
  run("git", ["config", "user.email", "test@example.com"], repoRoot);
  return repoRoot;
}

function seedPacketSet(repoRoot, packetFiles) {
  writeJson(path.join(repoRoot, "docs/releases/V1_FREEZE_PROMOTION_PACKET_SET.json"), {
    schema_version: "kolosseum.freeze.promotion_packet_set.v1",
    packet_files: packetFiles
  });
}

function commitAll(repoRoot, message) {
  run("git", ["add", "."], repoRoot);
  run("git", ["commit", "-m", message], repoRoot);
}

test("passes when disposable promotion packet build leaves repo clean", () => {
  const repoRoot = makeRepo();

  writeText(path.join(repoRoot, "docs/releases/freeze-readiness.json"), '{"ok":true}\n');
  writeText(path.join(repoRoot, "docs/releases/freeze-proof-report.json"), '{"proof":"ok"}\n');

  seedPacketSet(repoRoot, [
    {
      source_path: "docs/releases/freeze-readiness.json",
      packet_path: "freeze-readiness.json"
    },
    {
      source_path: "docs/releases/freeze-proof-report.json",
      packet_path: "proof/freeze-proof-report.json"
    }
  ]);

  commitAll(repoRoot, "seed");

  const report = verifyFreezePromotionPacketCleanliness({ repoRoot });
  assert.equal(report.ok, true);
  assert.equal(report.repo_clean_before, true);
  assert.equal(report.repo_clean_after, true);
  assert.equal(fs.existsSync(path.join(repoRoot, ".tmp/freeze-promotion-packet-cleanliness")), false);
  assert.equal(run("git", ["status", "--short"], repoRoot), "");
});

test("fails when repo is already dirty before cleanliness verification", () => {
  const repoRoot = makeRepo();

  writeText(path.join(repoRoot, "docs/releases/freeze-readiness.json"), '{"ok":true}\n');
  seedPacketSet(repoRoot, [
    {
      source_path: "docs/releases/freeze-readiness.json",
      packet_path: "freeze-readiness.json"
    }
  ]);

  commitAll(repoRoot, "seed");

  writeText(path.join(repoRoot, "dirty.txt"), "dirty\n");

  assert.throws(
    () => verifyFreezePromotionPacketCleanliness({ repoRoot }),
    (error) => {
      assert.equal(error.code, "FREEZE_PROMOTION_PACKET_CLEANLINESS_REPO_NOT_CLEAN_BEFORE");
      return true;
    }
  );
});

test("fails through builder when required packet source is missing", () => {
  const repoRoot = makeRepo();

  seedPacketSet(repoRoot, [
    {
      source_path: "docs/releases/missing.json",
      packet_path: "missing.json"
    }
  ]);

  commitAll(repoRoot, "seed");

  assert.throws(
    () => verifyFreezePromotionPacketCleanliness({ repoRoot }),
    (error) => {
      assert.equal(error.code, "FREEZE_PROMOTION_PACKET_REQUIRED_SOURCE_MISSING");
      return true;
    }
  );
});

test("cleans disposable directory even when builder fails", () => {
  const repoRoot = makeRepo();

  seedPacketSet(repoRoot, [
    {
      source_path: "docs/releases/missing.json",
      packet_path: "missing.json"
    }
  ]);

  commitAll(repoRoot, "seed");

  assert.throws(
    () =>
      verifyFreezePromotionPacketCleanliness({
        repoRoot,
        disposableOutputDir: ".tmp/custom-cleanliness-output"
      }),
    (error) => {
      assert.equal(error.code, "FREEZE_PROMOTION_PACKET_REQUIRED_SOURCE_MISSING");
      return true;
    }
  );

  assert.equal(fs.existsSync(path.join(repoRoot, ".tmp/custom-cleanliness-output")), false);
});