import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  HASH_FIELD,
  computeFreezeSealSnapshotSelfHash,
  verifyFreezeSealSnapshotSelfHash
} from "../ci/scripts/run_freeze_seal_snapshot_self_hash_verifier.mjs";

function writeJson(dir, relativePath, value) {
  const fullPath = path.join(dir, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, JSON.stringify(value, null, 2));
  return fullPath;
}

function makeFixtureRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "freeze-seal-snapshot-self-hash-"));
}

function buildValidSnapshot() {
  const snapshot = {
    completeness: {
      all_present: true,
      required_components: [
        "proof_index",
        "readiness",
        "drift",
        "mainline_guard"
      ]
    },
    engine_compatibility: "EB2-1.0.0",
    freeze_state: {
      drift: {
        ok: true,
        path: "docs/releases/V1_FREEZE_DRIFT_STATUS.json",
        sha256: "c60ea7dd699fa085cc90d9ade62305f4894752e220ad0e02720f900d0d6932ff"
      },
      mainline_guard: {
        ok: true,
        path: "docs/releases/V1_FREEZE_MAINLINE_GUARD_STATE.json",
        sha256: "753fa1225dabaae34d140e73dbec2bf391ddaeb5958988bbc5873876ad86b4cc"
      },
      proof_index: {
        path: "docs/releases/V1_FREEZE_PROOF_INDEX.json",
        sha256: "9da3f99113197b7415784ed3d4eeae64303094fff1ea09cece7ffcc8c12a60f6"
      },
      readiness: {
        ok: true,
        path: "docs/releases/V1_FREEZE_READINESS.json",
        sha256: "3ebaf741342e8c494277bebd2836bf9f87472d00400dd3483be5401c36d7b0d3"
      }
    },
    generated_at_utc: "2026-04-03T12:00:00Z",
    snapshot_id: "v1_freeze_seal_snapshot",
    snapshot_version: "1.0.0"
  };

  snapshot[HASH_FIELD] = computeFreezeSealSnapshotSelfHash(snapshot).sha256;
  return snapshot;
}

test("verifyFreezeSealSnapshotSelfHash passes when embedded self-hash matches canonical recompute", () => {
  const rootDir = makeFixtureRoot();
  const snapshotPath = writeJson(rootDir, "V1_FREEZE_SEAL_SNAPSHOT.json", buildValidSnapshot());

  const result = verifyFreezeSealSnapshotSelfHash(snapshotPath);

  assert.equal(result.ok, true);
  assert.equal(result.embedded_hash, result.recomputed_hash);
});

test("verifyFreezeSealSnapshotSelfHash fails when embedded self-hash is missing", () => {
  const rootDir = makeFixtureRoot();
  const snapshot = buildValidSnapshot();
  delete snapshot[HASH_FIELD];
  const snapshotPath = writeJson(rootDir, "V1_FREEZE_SEAL_SNAPSHOT.json", snapshot);

  const result = verifyFreezeSealSnapshotSelfHash(snapshotPath);

  assert.equal(result.ok, false);
  assert.equal(result.failures[0].token, "CI_MANIFEST_MISMATCH");
});

test("verifyFreezeSealSnapshotSelfHash fails when embedded self-hash is malformed", () => {
  const rootDir = makeFixtureRoot();
  const snapshot = buildValidSnapshot();
  snapshot[HASH_FIELD] = "not-a-real-hash";
  const snapshotPath = writeJson(rootDir, "V1_FREEZE_SEAL_SNAPSHOT.json", snapshot);

  const result = verifyFreezeSealSnapshotSelfHash(snapshotPath);

  assert.equal(result.ok, false);
  assert.equal(result.failures[0].token, "invalid_format");
});

test("verifyFreezeSealSnapshotSelfHash fails when any non-hash field drifts after issuance", () => {
  const rootDir = makeFixtureRoot();
  const snapshot = buildValidSnapshot();
  snapshot.freeze_state.readiness.ok = false;
  const snapshotPath = writeJson(rootDir, "V1_FREEZE_SEAL_SNAPSHOT.json", snapshot);

  const result = verifyFreezeSealSnapshotSelfHash(snapshotPath);

  assert.equal(result.ok, false);
  assert.equal(result.failures[0].token, "content_hash_mismatch");
});

test("verifyFreezeSealSnapshotSelfHash fails when top-level shape changes", () => {
  const rootDir = makeFixtureRoot();
  const snapshot = buildValidSnapshot();
  snapshot.extra_field = true;
  const snapshotPath = writeJson(rootDir, "V1_FREEZE_SEAL_SNAPSHOT.json", snapshot);

  const result = verifyFreezeSealSnapshotSelfHash(snapshotPath);

  assert.equal(result.ok, false);
  assert.equal(result.failures[0].token, "CI_MANIFEST_MISMATCH");
});

test("computeFreezeSealSnapshotSelfHash is byte-stable across repeated runs", () => {
  const snapshot = buildValidSnapshot();

  const first = computeFreezeSealSnapshotSelfHash(snapshot);
  const second = computeFreezeSealSnapshotSelfHash(snapshot);

  assert.equal(first.sha256, second.sha256);
  assert.equal(Buffer.compare(first.canonical_bytes, second.canonical_bytes), 0);
});
