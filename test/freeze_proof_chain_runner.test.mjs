import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { runFreezeProofChain } from "../ci/scripts/run_freeze_proof_chain.mjs";

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, "utf8");
}

function makeRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kolosseum-freeze-proof-chain-"));
}

function seedChain(repoRoot, steps) {
  writeJson(path.join(repoRoot, "docs/releases/V1_FREEZE_PROOF_CHAIN.json"), {
    schema_version: "kolosseum.freeze.proof_chain.v1",
    proof_steps: steps
  });
}

function seedOkScript(repoRoot, relPath, schemaVersion = "child.report.v1") {
  writeText(
    path.join(repoRoot, relPath),
    [
      `const report = { ok: true, schema_version: "${schemaVersion}" };`,
      'process.stdout.write(JSON.stringify(report, null, 2) + "\\n");'
    ].join("\n") + "\n"
  );
}

function seedBadJsonScript(repoRoot, relPath) {
  writeText(
    path.join(repoRoot, relPath),
    'process.stdout.write("not-json\\n");\n'
  );
}

function seedFailingScript(repoRoot, relPath) {
  writeText(
    path.join(repoRoot, relPath),
    [
      'const report = { ok: false, schema_version: "child.report.v1" };',
      'process.stdout.write(JSON.stringify(report, null, 2) + "\\n");',
      'process.exit(1);'
    ].join("\n") + "\n"
  );
}

test("passes when all declared child proofs exist and return ok=true in order", () => {
  const repoRoot = makeRepo();
  const runnerStageIds = ["p134", "p135", "p136"];

  seedOkScript(repoRoot, "ci/scripts/p134.mjs", "p134.report.v1");
  seedOkScript(repoRoot, "ci/scripts/p135.mjs", "p135.report.v1");
  seedOkScript(repoRoot, "ci/scripts/p136.mjs", "p136.report.v1");

  seedChain(repoRoot, [
    { proof_id: "p134", script_path: "ci/scripts/p134.mjs" },
    { proof_id: "p135", script_path: "ci/scripts/p135.mjs" },
    { proof_id: "p136", script_path: "ci/scripts/p136.mjs" }
  ]);

  const report = runFreezeProofChain({ repoRoot, runnerStageIds });
  assert.equal(report.ok, true);
  assert.equal(report.proof_count, 3);
  assert.deepEqual(
    report.results.map((item) => item.proof_id),
    ["p134", "p135", "p136"]
  );
});

test("fails when proof chain order drifts from runner stage order", () => {
  const repoRoot = makeRepo();
  const runnerStageIds = ["p134", "p135", "p136"];

  seedOkScript(repoRoot, "ci/scripts/p134.mjs");
  seedOkScript(repoRoot, "ci/scripts/p136.mjs");
  seedOkScript(repoRoot, "ci/scripts/p135.mjs");

  seedChain(repoRoot, [
    { proof_id: "p134", script_path: "ci/scripts/p134.mjs" },
    { proof_id: "p136", script_path: "ci/scripts/p136.mjs" },
    { proof_id: "p135", script_path: "ci/scripts/p135.mjs" }
  ]);

  assert.throws(
    () => runFreezeProofChain({ repoRoot, runnerStageIds }),
    (error) => {
      assert.equal(error.code, "FREEZE_PROOF_CHAIN_RUNNER_ORDER_MISMATCH");
      return true;
    }
  );
});

test("fails when child proof script is missing", () => {
  const repoRoot = makeRepo();
  const runnerStageIds = ["p134"];

  seedChain(repoRoot, [
    { proof_id: "p134", script_path: "ci/scripts/missing.mjs" }
  ]);

  assert.throws(
    () => runFreezeProofChain({ repoRoot, runnerStageIds }),
    (error) => {
      assert.equal(error.code, "FREEZE_PROOF_CHAIN_CHILD_SCRIPT_MISSING");
      return true;
    }
  );
});

test("fails when child proof exits non-zero", () => {
  const repoRoot = makeRepo();
  const runnerStageIds = ["p134"];

  seedFailingScript(repoRoot, "ci/scripts/p134.mjs");
  seedChain(repoRoot, [
    { proof_id: "p134", script_path: "ci/scripts/p134.mjs" }
  ]);

  assert.throws(
    () => runFreezeProofChain({ repoRoot, runnerStageIds }),
    (error) => {
      assert.equal(error.code, "FREEZE_PROOF_CHAIN_CHILD_NONZERO_EXIT");
      return true;
    }
  );
});

test("fails when child proof emits invalid json", () => {
  const repoRoot = makeRepo();
  const runnerStageIds = ["p134"];

  seedBadJsonScript(repoRoot, "ci/scripts/p134.mjs");
  seedChain(repoRoot, [
    { proof_id: "p134", script_path: "ci/scripts/p134.mjs" }
  ]);

  assert.throws(
    () => runFreezeProofChain({ repoRoot, runnerStageIds }),
    (error) => {
      assert.equal(error.code, "FREEZE_PROOF_CHAIN_CHILD_OUTPUT_INVALID_JSON");
      return true;
    }
  );
});

test("fails on duplicate proof ids in chain manifest", () => {
  const repoRoot = makeRepo();
  const runnerStageIds = ["p134", "p135"];

  seedOkScript(repoRoot, "ci/scripts/p134a.mjs");
  seedOkScript(repoRoot, "ci/scripts/p134b.mjs");

  seedChain(repoRoot, [
    { proof_id: "p134", script_path: "ci/scripts/p134a.mjs" },
    { proof_id: "p134", script_path: "ci/scripts/p134b.mjs" }
  ]);

  assert.throws(
    () => runFreezeProofChain({ repoRoot, runnerStageIds }),
    (error) => {
      assert.equal(error.code, "FREEZE_PROOF_CHAIN_DUPLICATE_PROOF_ID");
      return true;
    }
  );
});