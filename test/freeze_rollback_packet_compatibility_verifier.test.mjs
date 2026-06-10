import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { verifyFreezeRollbackPacketCompatibility } from "../ci/scripts/run_freeze_rollback_packet_compatibility_verifier.mjs";

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function makeRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kolosseum-freeze-rollback-packet-compat-"));
}

function seedRollbackPacketSet(repoRoot, sourcePaths) {
  writeJson(path.join(repoRoot, "docs/releases/V1_FREEZE_ROLLBACK_PACKET_SET.json"), {
    schema_version: "kolosseum.freeze.rollback_packet_set.v1",
    rollback_files: sourcePaths.map((source_path, index) => ({
      source_path,
      packet_path: `packet-${index + 1}.json`
    }))
  });
}

function seedRollbackRunbook(repoRoot, rollbackSurfacePaths, commandIds) {
  writeJson(path.join(repoRoot, "docs/releases/V1_FREEZE_ROLLBACK_RUNBOOK.json"), {
    schema_version: "kolosseum.freeze.rollback_runbook.v1",
    rollback_surface_paths: rollbackSurfacePaths,
    rollback_commands: commandIds.map((command_id) => ({ command_id }))
  });
}

function seedFreezeState(repoRoot, rollbackSurfacePaths, commandIds) {
  writeJson(path.join(repoRoot, "docs/releases/V1_FREEZE_STATE.json"), {
    schema_version: "kolosseum.freeze.state.v1",
    rollback_surface_paths: rollbackSurfacePaths,
    rollback_command_ids: commandIds
  });
}

test("passes when rollback packet surfaces and command order match runbook and sealed freeze state", () => {
  const repoRoot = makeRepo();

  const surfaces = [
    "docs/releases/freeze-seal.json",
    "docs/releases/freeze-manifest.json"
  ];

  const commands = [
    "freeze.rollback.validate",
    "freeze.rollback.execute",
    "freeze.rollback.verify"
  ];

  seedRollbackPacketSet(repoRoot, surfaces);
  seedRollbackRunbook(repoRoot, surfaces, commands);
  seedFreezeState(repoRoot, surfaces, commands);

  const report = verifyFreezeRollbackPacketCompatibility({ repoRoot });
  assert.equal(report.ok, true);
  assert.equal(report.failures.length, 0);
});

test("fails when rollback packet surfaces drift from rollback runbook", () => {
  const repoRoot = makeRepo();

  seedRollbackPacketSet(repoRoot, [
    "docs/releases/freeze-seal.json"
  ]);
  seedRollbackRunbook(repoRoot, [
    "docs/releases/freeze-seal.json",
    "docs/releases/freeze-manifest.json"
  ], [
    "freeze.rollback.validate"
  ]);
  seedFreezeState(repoRoot, [
    "docs/releases/freeze-seal.json"
  ], [
    "freeze.rollback.validate"
  ]);

  const report = verifyFreezeRollbackPacketCompatibility({ repoRoot });
  assert.equal(report.ok, false);
  assert.match(JSON.stringify(report.failures), /FREEZE_ROLLBACK_PACKET_COMPAT_RUNBOOK_SURFACE_MISSING/);
});

test("fails when rollback packet surfaces drift from sealed freeze state", () => {
  const repoRoot = makeRepo();

  seedRollbackPacketSet(repoRoot, [
    "docs/releases/freeze-seal.json"
  ]);
  seedRollbackRunbook(repoRoot, [
    "docs/releases/freeze-seal.json"
  ], [
    "freeze.rollback.validate"
  ]);
  seedFreezeState(repoRoot, [
    "docs/releases/freeze-seal.json",
    "docs/releases/freeze-manifest.json"
  ], [
    "freeze.rollback.validate"
  ]);

  const report = verifyFreezeRollbackPacketCompatibility({ repoRoot });
  assert.equal(report.ok, false);
  assert.match(JSON.stringify(report.failures), /FREEZE_ROLLBACK_PACKET_COMPAT_FREEZE_STATE_SURFACE_MISSING/);
});

test("fails when rollback command ids drift from sealed freeze state", () => {
  const repoRoot = makeRepo();

  seedRollbackPacketSet(repoRoot, [
    "docs/releases/freeze-seal.json"
  ]);
  seedRollbackRunbook(repoRoot, [
    "docs/releases/freeze-seal.json"
  ], [
    "freeze.rollback.validate",
    "freeze.rollback.execute"
  ]);
  seedFreezeState(repoRoot, [
    "docs/releases/freeze-seal.json"
  ], [
    "freeze.rollback.validate",
    "freeze.rollback.finalize"
  ]);

  const report = verifyFreezeRollbackPacketCompatibility({ repoRoot });
  assert.equal(report.ok, false);
  assert.match(JSON.stringify(report.failures), /FREEZE_ROLLBACK_PACKET_COMPAT_COMMAND_SET_MISSING|FREEZE_ROLLBACK_PACKET_COMPAT_COMMAND_SET_EXTRA/);
});

test("fails when rollback command order differs even if command ids match", () => {
  const repoRoot = makeRepo();

  seedRollbackPacketSet(repoRoot, [
    "docs/releases/freeze-seal.json"
  ]);
  seedRollbackRunbook(repoRoot, [
    "docs/releases/freeze-seal.json"
  ], [
    "freeze.rollback.execute",
    "freeze.rollback.verify"
  ]);
  seedFreezeState(repoRoot, [
    "docs/releases/freeze-seal.json"
  ], [
    "freeze.rollback.verify",
    "freeze.rollback.execute"
  ]);

  const report = verifyFreezeRollbackPacketCompatibility({ repoRoot });
  assert.equal(report.ok, false);
  assert.match(JSON.stringify(report.failures), /FREEZE_ROLLBACK_PACKET_COMPAT_COMMAND_ORDER_MISMATCH/);
});

test("throws when freeze state manifest is missing", () => {
  const repoRoot = makeRepo();

  seedRollbackPacketSet(repoRoot, [
    "docs/releases/freeze-seal.json"
  ]);
  seedRollbackRunbook(repoRoot, [
    "docs/releases/freeze-seal.json"
  ], [
    "freeze.rollback.validate"
  ]);

  assert.throws(
    () => verifyFreezeRollbackPacketCompatibility({ repoRoot }),
    (error) => {
      assert.equal(error.code, "FREEZE_ROLLBACK_PACKET_COMPAT_FREEZE_STATE_MISSING");
      return true;
    }
  );
});