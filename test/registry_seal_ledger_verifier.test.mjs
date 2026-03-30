import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

function runVerifier(cwd) {
  const scriptPath = path.resolve("ci", "scripts", "run_registry_seal_ledger_verifier.mjs");
  return spawnSync(process.execPath, [scriptPath], {
    cwd,
    encoding: "utf8"
  });
}

function makeBaseLedger() {
  return {
    schema_version: "kolosseum.registry_seal_ledger.v1",
    ledger_id: "registry_seal_history",
    ledger_version: "1.0.0",
    seal_scope: "registry_bundle",
    entries: [
      {
        seal_id: "launch_registry_seal",
        seal_version: "1.0.0",
        registry_bundle_hash: "a".repeat(64),
        recorded_at: "2026-03-30T00:00:00.000Z"
      }
    ]
  };
}

test("P82: append-only ledger passes", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "p82-ledger-pass-"));
  const ledgerPath = path.join(cwd, "ci", "evidence", "registry_seal_ledger.v1.json");
  const snapshotPath = path.join(cwd, "ci", "evidence", "registry_seal_ledger.snapshot.json");

  const previous = makeBaseLedger();
  const current = makeBaseLedger();
  current.entries.push({
    seal_id: "launch_registry_seal",
    seal_version: "1.1.0",
    registry_bundle_hash: "b".repeat(64),
    recorded_at: "2026-03-31T00:00:00.000Z"
  });

  writeJson(snapshotPath, previous);
  writeJson(ledgerPath, current);

  const r = runVerifier(cwd);
  assert.equal(r.status, 0, r.stderr);
});

test("P82: duplicate seal identity fails", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "p82-ledger-dup-"));
  const ledgerPath = path.join(cwd, "ci", "evidence", "registry_seal_ledger.v1.json");

  const ledger = makeBaseLedger();
  ledger.entries.push({
    seal_id: "launch_registry_seal",
    seal_version: "1.0.0",
    registry_bundle_hash: "b".repeat(64),
    recorded_at: "2026-03-31T00:00:00.000Z"
  });

  writeJson(ledgerPath, ledger);

  const r = runVerifier(cwd);
  assert.equal(r.status, 1);
  const payload = JSON.parse(r.stderr);
  assert.equal(payload.token, "CI_REGISTRY_SEAL_LEDGER_DUPLICATE");
});

test("P82: overwrite historical entry fails", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "p82-ledger-mutation-"));
  const ledgerPath = path.join(cwd, "ci", "evidence", "registry_seal_ledger.v1.json");
  const snapshotPath = path.join(cwd, "ci", "evidence", "registry_seal_ledger.snapshot.json");

  const previous = makeBaseLedger();
  const current = makeBaseLedger();
  current.entries[0].registry_bundle_hash = "c".repeat(64);

  writeJson(snapshotPath, previous);
  writeJson(ledgerPath, current);

  const r = runVerifier(cwd);
  assert.equal(r.status, 1);
  const payload = JSON.parse(r.stderr);
  assert.equal(payload.token, "CI_REGISTRY_SEAL_LEDGER_MUTATION");
});

test("P82: removal of historical entry fails", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "p82-ledger-remove-"));
  const ledgerPath = path.join(cwd, "ci", "evidence", "registry_seal_ledger.v1.json");
  const snapshotPath = path.join(cwd, "ci", "evidence", "registry_seal_ledger.snapshot.json");

  const previous = {
    schema_version: "kolosseum.registry_seal_ledger.v1",
    ledger_id: "registry_seal_history",
    ledger_version: "1.0.0",
    seal_scope: "registry_bundle",
    entries: [
      {
        seal_id: "launch_registry_seal",
        seal_version: "1.0.0",
        registry_bundle_hash: "a".repeat(64),
        recorded_at: "2026-03-30T00:00:00.000Z"
      },
      {
        seal_id: "launch_registry_seal",
        seal_version: "1.1.0",
        registry_bundle_hash: "b".repeat(64),
        recorded_at: "2026-03-31T00:00:00.000Z"
      }
    ]
  };

  const current = makeBaseLedger();

  writeJson(snapshotPath, previous);
  writeJson(ledgerPath, current);

  const r = runVerifier(cwd);
  assert.equal(r.status, 1);
  const payload = JSON.parse(r.stderr);
  assert.equal(payload.token, "CI_REGISTRY_SEAL_LEDGER_MUTATION");
});

test("P82: reorder of historical entries fails", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "p82-ledger-reorder-"));
  const ledgerPath = path.join(cwd, "ci", "evidence", "registry_seal_ledger.v1.json");
  const snapshotPath = path.join(cwd, "ci", "evidence", "registry_seal_ledger.snapshot.json");

  const previous = {
    schema_version: "kolosseum.registry_seal_ledger.v1",
    ledger_id: "registry_seal_history",
    ledger_version: "1.0.0",
    seal_scope: "registry_bundle",
    entries: [
      {
        seal_id: "launch_registry_seal",
        seal_version: "1.0.0",
        registry_bundle_hash: "a".repeat(64),
        recorded_at: "2026-03-30T00:00:00.000Z"
      },
      {
        seal_id: "launch_registry_seal",
        seal_version: "1.1.0",
        registry_bundle_hash: "b".repeat(64),
        recorded_at: "2026-03-31T00:00:00.000Z"
      }
    ]
  };

  const current = {
    schema_version: "kolosseum.registry_seal_ledger.v1",
    ledger_id: "registry_seal_history",
    ledger_version: "1.0.0",
    seal_scope: "registry_bundle",
    entries: [
      previous.entries[1],
      previous.entries[0]
    ]
  };

  writeJson(snapshotPath, previous);
  writeJson(ledgerPath, current);

  const r = runVerifier(cwd);
  assert.equal(r.status, 1);
  const payload = JSON.parse(r.stderr);
  assert.equal(payload.token, "CI_REGISTRY_SEAL_LEDGER_MUTATION");
});