import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildFreezeRollbackPacket } from "../ci/scripts/build_freeze_rollback_packet.mjs";

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, "utf8");
}

function makeRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kolosseum-freeze-rollback-packet-"));
}

function seedRollbackPacketSet(repoRoot, rollbackFiles) {
  writeJson(path.join(repoRoot, "docs/releases/V1_FREEZE_ROLLBACK_PACKET_SET.json"), {
    schema_version: "kolosseum.freeze.rollback_packet_set.v1",
    rollback_files: rollbackFiles
  });
}

test("builds deterministic rollback packet with only declared files", () => {
  const repoRoot = makeRepo();

  writeText(path.join(repoRoot, "docs/releases/freeze-seal.json"), '{"sealed":true}\n');
  writeText(path.join(repoRoot, "docs/releases/freeze-manifest.json"), '{"version":"rollback"}\n');

  seedRollbackPacketSet(repoRoot, [
    {
      source_path: "docs/releases/freeze-seal.json",
      packet_path: "freeze-seal.json"
    },
    {
      source_path: "docs/releases/freeze-manifest.json",
      packet_path: "manifests/freeze-manifest.json"
    }
  ]);

  const report = buildFreezeRollbackPacket({
    repoRoot,
    outputDir: "artifacts/freeze-rollback-packet"
  });

  assert.equal(report.ok, true);
  assert.equal(report.file_count, 2);

  const outputRoot = path.join(repoRoot, "artifacts/freeze-rollback-packet");
  const fileA = path.join(outputRoot, "freeze-seal.json");
  const fileB = path.join(outputRoot, "manifests/freeze-manifest.json");

  assert.equal(fs.existsSync(fileA), true);
  assert.equal(fs.existsSync(fileB), true);
  assert.equal(fs.readFileSync(fileA, "utf8"), '{"sealed":true}\n');
  assert.equal(fs.readFileSync(fileB, "utf8"), '{"version":"rollback"}\n');
});

test("fails when required rollback surface is missing", () => {
  const repoRoot = makeRepo();

  seedRollbackPacketSet(repoRoot, [
    {
      source_path: "docs/releases/missing-rollback-surface.json",
      packet_path: "missing.json"
    }
  ]);

  assert.throws(
    () =>
      buildFreezeRollbackPacket({
        repoRoot,
        outputDir: "artifacts/freeze-rollback-packet"
      }),
    (error) => {
      assert.equal(error.code, "FREEZE_ROLLBACK_PACKET_REQUIRED_SOURCE_MISSING");
      return true;
    }
  );
});

test("fails when rollback packet source is not a file", () => {
  const repoRoot = makeRepo();

  fs.mkdirSync(path.join(repoRoot, "docs/releases/not-a-file"), { recursive: true });

  seedRollbackPacketSet(repoRoot, [
    {
      source_path: "docs/releases/not-a-file",
      packet_path: "not-a-file"
    }
  ]);

  assert.throws(
    () =>
      buildFreezeRollbackPacket({
        repoRoot,
        outputDir: "artifacts/freeze-rollback-packet"
      }),
    (error) => {
      assert.equal(error.code, "FREEZE_ROLLBACK_PACKET_SOURCE_NOT_FILE");
      return true;
    }
  );
});

test("fails on duplicate rollback packet destination", () => {
  const repoRoot = makeRepo();

  writeText(path.join(repoRoot, "docs/releases/a.json"), "A\n");
  writeText(path.join(repoRoot, "docs/releases/b.json"), "B\n");

  seedRollbackPacketSet(repoRoot, [
    {
      source_path: "docs/releases/a.json",
      packet_path: "same.json"
    },
    {
      source_path: "docs/releases/b.json",
      packet_path: "same.json"
    }
  ]);

  assert.throws(
    () =>
      buildFreezeRollbackPacket({
        repoRoot,
        outputDir: "artifacts/freeze-rollback-packet"
      }),
    (error) => {
      assert.equal(error.code, "FREEZE_ROLLBACK_PACKET_DUPLICATE_DESTINATION");
      return true;
    }
  );
});

test("rebuild is deterministic for identical rollback inputs", () => {
  const repoRoot = makeRepo();

  writeText(path.join(repoRoot, "docs/releases/freeze-seal.json"), '{"sealed":true}\n');
  writeText(path.join(repoRoot, "docs/releases/freeze-manifest.json"), '{"version":"rollback"}\n');

  seedRollbackPacketSet(repoRoot, [
    {
      source_path: "docs/releases/freeze-manifest.json",
      packet_path: "manifests/freeze-manifest.json"
    },
    {
      source_path: "docs/releases/freeze-seal.json",
      packet_path: "freeze-seal.json"
    }
  ]);

  const first = buildFreezeRollbackPacket({
    repoRoot,
    outputDir: "artifacts/freeze-rollback-packet"
  });

  const second = buildFreezeRollbackPacket({
    repoRoot,
    outputDir: "artifacts/freeze-rollback-packet"
  });

  assert.deepEqual(first, second);
});