import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function setupRepoFixture() {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "freeze-proof-chain-order-"));
  fs.mkdirSync(path.join(repoRoot, "ci", "scripts"), { recursive: true });
  fs.mkdirSync(path.join(repoRoot, "docs", "releases"), { recursive: true });
  fs.mkdirSync(path.join(repoRoot, "test"), { recursive: true });

  const verifierSourcePath = path.resolve(
    "ci/scripts/run_freeze_proof_chain_order_verifier.mjs",
  );
  const verifierDestPath = path.join(
    repoRoot,
    "ci",
    "scripts",
    "run_freeze_proof_chain_order_verifier.mjs",
  );
  fs.copyFileSync(verifierSourcePath, verifierDestPath);

  return { repoRoot, verifierDestPath };
}

test("freeze proof chain order verifier passes for a lawful dependency chain", () => {
  const { repoRoot, verifierDestPath } = setupRepoFixture();

  writeJson(path.join(repoRoot, "docs", "releases", "V1_FREEZE_PROOF_INDEX.json"), {
    freeze_proof_chain: [
      {
        path: "docs/releases/V1_FREEZE_STATE.json",
        upstream_paths: [],
      },
      {
        path: "docs/releases/V1_FREEZE_READINESS.json",
        upstream_paths: ["docs/releases/V1_FREEZE_STATE.json"],
      },
      {
        path: "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST.json",
        upstream_paths: ["docs/releases/V1_FREEZE_READINESS.json"],
      },
    ],
  });

  writeJson(path.join(repoRoot, "docs", "releases", "V1_FREEZE_STATE.json"), { ok: true });
  writeJson(path.join(repoRoot, "docs", "releases", "V1_FREEZE_READINESS.json"), { ok: true });
  writeJson(path.join(repoRoot, "docs", "releases", "V1_FREEZE_EVIDENCE_MANIFEST.json"), { ok: true });

  const result = spawnSync(process.execPath, [verifierDestPath], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);

  const outputPath = path.join(repoRoot, "docs", "releases", "V1_FREEZE_PROOF_CHAIN_ORDER.json");
  const output = JSON.parse(fs.readFileSync(outputPath, "utf8"));

  assert.equal(output.ok, true);
  assert.deepEqual(output.orphan_proofs, []);
  assert.deepEqual(output.missing_upstream_nodes, []);
  assert.deepEqual(output.out_of_order_dependencies, []);
});

test("freeze proof chain order verifier fails on orphan proof", () => {
  const { repoRoot, verifierDestPath } = setupRepoFixture();

  writeJson(path.join(repoRoot, "docs", "releases", "V1_FREEZE_PROOF_INDEX.json"), {
    freeze_proof_chain: [
      {
        path: "docs/releases/V1_FREEZE_STATE.json",
        upstream_paths: [],
      },
      {
        path: "docs/releases/V1_FREEZE_READINESS.json",
        upstream_paths: [],
      },
    ],
  });

  writeJson(path.join(repoRoot, "docs", "releases", "V1_FREEZE_STATE.json"), { ok: true });
  writeJson(path.join(repoRoot, "docs", "releases", "V1_FREEZE_READINESS.json"), { ok: true });

  const result = spawnSync(process.execPath, [verifierDestPath], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /orphan_proofs=docs\/releases\/V1_FREEZE_READINESS\.json/);

  const outputPath = path.join(repoRoot, "docs", "releases", "V1_FREEZE_PROOF_CHAIN_ORDER.json");
  const output = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  assert.equal(output.ok, false);
  assert.deepEqual(output.orphan_proofs, ["docs/releases/V1_FREEZE_READINESS.json"]);
});

test("freeze proof chain order verifier fails on out-of-order dependency", () => {
  const { repoRoot, verifierDestPath } = setupRepoFixture();

  writeJson(path.join(repoRoot, "docs", "releases", "V1_FREEZE_PROOF_INDEX.json"), {
    freeze_proof_chain: [
      {
        path: "docs/releases/V1_FREEZE_READINESS.json",
        upstream_paths: ["docs/releases/V1_FREEZE_STATE.json"],
      },
      {
        path: "docs/releases/V1_FREEZE_STATE.json",
        upstream_paths: [],
      },
    ],
  });

  writeJson(path.join(repoRoot, "docs", "releases", "V1_FREEZE_STATE.json"), { ok: true });
  writeJson(path.join(repoRoot, "docs", "releases", "V1_FREEZE_READINESS.json"), { ok: true });

  const result = spawnSync(process.execPath, [verifierDestPath], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /out_of_order_dependencies=docs\/releases\/V1_FREEZE_READINESS\.json->docs\/releases\/V1_FREEZE_STATE\.json/);

  const outputPath = path.join(repoRoot, "docs", "releases", "V1_FREEZE_PROOF_CHAIN_ORDER.json");
  const output = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  assert.equal(output.ok, false);
  assert.equal(output.out_of_order_dependencies.length, 1);
});

test("freeze proof chain order verifier fails on missing upstream proof node", () => {
  const { repoRoot, verifierDestPath } = setupRepoFixture();

  writeJson(path.join(repoRoot, "docs", "releases", "V1_FREEZE_PROOF_INDEX.json"), {
    freeze_proof_chain: [
      {
        path: "docs/releases/V1_FREEZE_STATE.json",
        upstream_paths: [],
      },
      {
        path: "docs/releases/V1_FREEZE_READINESS.json",
        upstream_paths: ["docs/releases/V1_FREEZE_MISSING.json"],
      },
    ],
  });

  writeJson(path.join(repoRoot, "docs", "releases", "V1_FREEZE_STATE.json"), { ok: true });
  writeJson(path.join(repoRoot, "docs", "releases", "V1_FREEZE_READINESS.json"), { ok: true });

  const result = spawnSync(process.execPath, [verifierDestPath], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /missing_upstream_nodes=docs\/releases\/V1_FREEZE_READINESS\.json->docs\/releases\/V1_FREEZE_MISSING\.json/);

  const outputPath = path.join(repoRoot, "docs", "releases", "V1_FREEZE_PROOF_CHAIN_ORDER.json");
  const output = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  assert.equal(output.ok, false);
  assert.equal(output.missing_upstream_nodes.length, 1);
});