import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const sealPath = path.resolve("ci/evidence/registry_seal.v1.json");

function runNode(args, options = {}) {
  return spawnSync("node", args, {
    encoding: "utf8",
    ...options
  });
}

function readSeal() {
  return JSON.parse(fs.readFileSync(sealPath, "utf8"));
}

function writeSeal(obj) {
  fs.writeFileSync(sealPath, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

test("P80a: gate allows pre-seal mode", () => {
  const originalSeal = readSeal();

  try {
    writeSeal({
      seal_version: "1.0.0",
      bundle_hash: "UNSEALED",
      sealed_at: null,
      registry_count: null
    });

    const run = runNode(["ci/scripts/run_registry_seal_gate.mjs"]);
    assert.equal(run.status, 0, run.stderr);

    const out = JSON.parse(run.stdout);
    assert.equal(out.ok, true);
    assert.equal(out.mode, "pre_seal");
    assert.equal(out.enforced, false);
  } finally {
    writeSeal(originalSeal);
  }
});

test("P80a: gate enforces sealed match", () => {
  const originalSeal = readSeal();

  try {
    const snapshotRun = runNode(["ci/scripts/run_registry_snapshot_hash.mjs"]);
    assert.equal(snapshotRun.status, 0, snapshotRun.stderr);

    const snapshot = JSON.parse(snapshotRun.stdout);

    writeSeal({
      seal_version: "1.0.0",
      bundle_hash: snapshot.bundle_hash,
      sealed_at: "2026-03-30T00:00:00.000Z",
      registry_count: snapshot.registry_count
    });

    const run = runNode(["ci/scripts/run_registry_seal_gate.mjs"]);
    assert.equal(run.status, 0, run.stderr);

    const out = JSON.parse(run.stdout);
    assert.equal(out.ok, true);
    assert.equal(out.mode, "sealed");
    assert.equal(out.enforced, true);
  } finally {
    writeSeal(originalSeal);
  }
});