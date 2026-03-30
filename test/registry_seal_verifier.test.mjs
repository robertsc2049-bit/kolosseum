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

test("P80: snapshot hash runs against existing registry surface", () => {
  const r = runNode(["ci/scripts/run_registry_snapshot_hash.mjs"]);
  assert.equal(r.status, 0, r.stderr);

  const out = JSON.parse(r.stdout);
  assert.equal(out.ok, true);
  assert.ok(Number.isInteger(out.registry_count));
  assert.ok(out.registry_count > 0);
  assert.ok(typeof out.bundle_hash === "string" && out.bundle_hash.length === 64);
  assert.ok(Array.isArray(out.entries));
  assert.equal(out.entries.length, out.registry_count);
  assert.ok(out.entries.some((entry) => entry.file === "registries/registry_bundle.json"));
});

test("P80: seal verifier fails if seal is unsealed", () => {
  const originalSeal = readSeal();

  try {
    writeSeal({
      seal_version: "1.0.0",
      bundle_hash: "UNSEALED",
      sealed_at: null,
      registry_count: null
    });

    const snapshot = runNode(["ci/scripts/run_registry_snapshot_hash.mjs"]);
    assert.equal(snapshot.status, 0, snapshot.stderr);

    const verify = runNode(
      ["ci/scripts/run_registry_seal_verifier.mjs"],
      { input: snapshot.stdout }
    );

    assert.notEqual(verify.status, 0);
    assert.match(verify.stderr, /Registry not sealed/);
  } finally {
    writeSeal(originalSeal);
  }
});

test("P80: seal verifier passes when bundle hash matches sealed snapshot", () => {
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

    const verify = runNode(
      ["ci/scripts/run_registry_seal_verifier.mjs"],
      { input: snapshotRun.stdout }
    );

    assert.equal(verify.status, 0, verify.stderr);
    assert.match(verify.stdout, /OK: registry seal verified/);
  } finally {
    writeSeal(originalSeal);
  }
});