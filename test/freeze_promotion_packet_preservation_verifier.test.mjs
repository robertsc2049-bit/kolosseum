import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { verifyFreezePromotionPacketPreservation } from "../ci/scripts/run_freeze_promotion_packet_preservation_verifier.mjs";

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, "utf8");
}

function makeRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kolosseum-freeze-packet-preservation-"));
}

function seedPacketSet(repoRoot, packetFiles) {
  writeJson(path.join(repoRoot, "docs/releases/V1_FREEZE_PROMOTION_PACKET_SET.json"), {
    schema_version: "kolosseum.freeze.promotion_packet_set.v1",
    packet_files: packetFiles
  });
}

test("passes when promotion packet rebuild is byte-stable across reruns", () => {
  const repoRoot = makeRepo();

  writeText(path.join(repoRoot, "docs/releases/freeze-readiness.json"), '{"ok":true}\n');
  writeText(path.join(repoRoot, "docs/releases/freeze-proof-report.json"), '{"proof":"stable"}\n');

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

  const report = verifyFreezePromotionPacketPreservation({ repoRoot });
  assert.equal(report.ok, true);
  assert.equal(report.file_count, 2);
});

test("fails when packet manifest references a missing source during preservation run", () => {
  const repoRoot = makeRepo();

  seedPacketSet(repoRoot, [
    {
      source_path: "docs/releases/missing.json",
      packet_path: "missing.json"
    }
  ]);

  assert.throws(
    () => verifyFreezePromotionPacketPreservation({ repoRoot }),
    (error) => {
      assert.equal(error.code, "FREEZE_PROMOTION_PACKET_REQUIRED_SOURCE_MISSING");
      return true;
    }
  );
});

test("preservation verifier reflects deterministic file ordering", () => {
  const repoRoot = makeRepo();

  writeText(path.join(repoRoot, "docs/releases/zeta.json"), 'Z\n');
  writeText(path.join(repoRoot, "docs/releases/alpha.json"), 'A\n');

  seedPacketSet(repoRoot, [
    {
      source_path: "docs/releases/zeta.json",
      packet_path: "zeta.json"
    },
    {
      source_path: "docs/releases/alpha.json",
      packet_path: "alpha.json"
    }
  ]);

  const report = verifyFreezePromotionPacketPreservation({ repoRoot });
  assert.equal(report.ok, true);
  assert.deepEqual(
    report.files.map((item) => item.relative_path),
    ["alpha.json", "zeta.json"]
  );
});