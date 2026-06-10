import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildFreezePromotionPacket } from "../ci/scripts/build_freeze_promotion_packet.mjs";

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, "utf8");
}

function makeRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kolosseum-freeze-promotion-packet-"));
}

function seedPacketSet(repoRoot, packetFiles) {
  writeJson(path.join(repoRoot, "docs/releases/V1_FREEZE_PROMOTION_PACKET_SET.json"), {
    schema_version: "kolosseum.freeze.promotion_packet_set.v1",
    packet_files: packetFiles
  });
}

test("builds deterministic packet with only declared files", () => {
  const repoRoot = makeRepo();

  writeText(path.join(repoRoot, "docs/releases/freeze-readiness.json"), '{"ok":true}\n');
  writeText(path.join(repoRoot, "docs/releases/freeze-proof-report.json"), '{"ok":true}\n');

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

  const report = buildFreezePromotionPacket({
    repoRoot,
    outputDir: "artifacts/freeze-promotion-packet"
  });

  assert.equal(report.ok, true);
  assert.equal(report.file_count, 2);

  const outputRoot = path.join(repoRoot, "artifacts/freeze-promotion-packet");
  const fileA = path.join(outputRoot, "freeze-readiness.json");
  const fileB = path.join(outputRoot, "proof/freeze-proof-report.json");

  assert.equal(fs.existsSync(fileA), true);
  assert.equal(fs.existsSync(fileB), true);
  assert.equal(fs.readFileSync(fileA, "utf8"), '{"ok":true}\n');
  assert.equal(fs.readFileSync(fileB, "utf8"), '{"ok":true}\n');
});

test("fails when required packet source is missing", () => {
  const repoRoot = makeRepo();

  seedPacketSet(repoRoot, [
    {
      source_path: "docs/releases/missing.json",
      packet_path: "missing.json"
    }
  ]);

  assert.throws(
    () =>
      buildFreezePromotionPacket({
        repoRoot,
        outputDir: "artifacts/freeze-promotion-packet"
      }),
    (error) => {
      assert.equal(error.code, "FREEZE_PROMOTION_PACKET_REQUIRED_SOURCE_MISSING");
      return true;
    }
  );
});

test("fails when a packet source is not a file", () => {
  const repoRoot = makeRepo();

  fs.mkdirSync(path.join(repoRoot, "docs/releases/not-a-file"), { recursive: true });

  seedPacketSet(repoRoot, [
    {
      source_path: "docs/releases/not-a-file",
      packet_path: "not-a-file"
    }
  ]);

  assert.throws(
    () =>
      buildFreezePromotionPacket({
        repoRoot,
        outputDir: "artifacts/freeze-promotion-packet"
      }),
    (error) => {
      assert.equal(error.code, "FREEZE_PROMOTION_PACKET_SOURCE_NOT_FILE");
      return true;
    }
  );
});

test("fails on duplicate packet destination", () => {
  const repoRoot = makeRepo();

  writeText(path.join(repoRoot, "docs/releases/a.json"), "A\n");
  writeText(path.join(repoRoot, "docs/releases/b.json"), "B\n");

  seedPacketSet(repoRoot, [
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
      buildFreezePromotionPacket({
        repoRoot,
        outputDir: "artifacts/freeze-promotion-packet"
      }),
    (error) => {
      assert.equal(error.code, "FREEZE_PROMOTION_PACKET_DUPLICATE_DESTINATION");
      return true;
    }
  );
});

test("rebuild is deterministic for identical inputs", () => {
  const repoRoot = makeRepo();

  writeText(path.join(repoRoot, "docs/releases/freeze-readiness.json"), '{"ok":true}\n');
  writeText(path.join(repoRoot, "docs/releases/freeze-proof-report.json"), '{"ok":true}\n');

  seedPacketSet(repoRoot, [
    {
      source_path: "docs/releases/freeze-proof-report.json",
      packet_path: "proof/freeze-proof-report.json"
    },
    {
      source_path: "docs/releases/freeze-readiness.json",
      packet_path: "freeze-readiness.json"
    }
  ]);

  const first = buildFreezePromotionPacket({
    repoRoot,
    outputDir: "artifacts/freeze-promotion-packet"
  });

  const second = buildFreezePromotionPacket({
    repoRoot,
    outputDir: "artifacts/freeze-promotion-packet"
  });

  assert.deepEqual(first, second);
});