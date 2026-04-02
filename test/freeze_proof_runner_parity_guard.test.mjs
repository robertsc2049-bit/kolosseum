import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { verifyFreezeProofRunnerParity } from "../ci/scripts/run_freeze_proof_runner_parity_guard.mjs";

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function makeRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kolosseum-freeze-proof-runner-parity-"));
}

function seedRequiredProofSet(repoRoot, proofIds) {
  writeJson(path.join(repoRoot, "docs/releases/V1_FREEZE_REQUIRED_PROOF_SET.json"), {
    schema_version: "kolosseum.freeze.required_proof_set.v1",
    required_proof_ids_in_order: proofIds
  });
}

function seedProofChain(repoRoot, proofIds) {
  writeJson(path.join(repoRoot, "docs/releases/V1_FREEZE_PROOF_CHAIN.json"), {
    schema_version: "kolosseum.freeze.proof_chain.v1",
    proof_steps: proofIds.map((proof_id, index) => ({
      proof_id,
      script_path: `ci/scripts/step-${index + 1}.mjs`
    }))
  });
}

test("passes when runner stages match proof chain and required proof set exactly", () => {
  const repoRoot = makeRepo();
  const proofIds = ["p134", "p135", "p136"];

  seedRequiredProofSet(repoRoot, proofIds);
  seedProofChain(repoRoot, proofIds);

  const report = verifyFreezeProofRunnerParity({
    repoRoot,
    runnerStageIds: proofIds
  });

  assert.equal(report.ok, true);
  assert.equal(report.failures.length, 0);
});

test("fails when runner stages omit a chain step", () => {
  const repoRoot = makeRepo();

  seedRequiredProofSet(repoRoot, ["p134", "p135", "p136"]);
  seedProofChain(repoRoot, ["p134", "p135", "p136"]);

  const report = verifyFreezeProofRunnerParity({
    repoRoot,
    runnerStageIds: ["p134", "p136"]
  });

  assert.equal(report.ok, false);
  assert.match(JSON.stringify(report.failures), /FREEZE_PROOF_RUNNER_PARITY_CHAIN_MISSING/);
});

test("fails when runner stages differ from required proof set", () => {
  const repoRoot = makeRepo();

  seedRequiredProofSet(repoRoot, ["p134", "p135"]);
  seedProofChain(repoRoot, ["p134", "p135"]);

  const report = verifyFreezeProofRunnerParity({
    repoRoot,
    runnerStageIds: ["p134", "p135", "p136"]
  });

  assert.equal(report.ok, false);
  assert.match(JSON.stringify(report.failures), /FREEZE_PROOF_RUNNER_PARITY_REQUIRED_SET_EXTRA/);
});

test("fails when runner stages are out of order", () => {
  const repoRoot = makeRepo();

  seedRequiredProofSet(repoRoot, ["p134", "p135", "p136"]);
  seedProofChain(repoRoot, ["p134", "p135", "p136"]);

  const report = verifyFreezeProofRunnerParity({
    repoRoot,
    runnerStageIds: ["p134", "p136", "p135"]
  });

  assert.equal(report.ok, false);
  assert.match(JSON.stringify(report.failures), /FREEZE_PROOF_RUNNER_PARITY_CHAIN_ORDER_MISMATCH/);
  assert.match(JSON.stringify(report.failures), /FREEZE_PROOF_RUNNER_PARITY_REQUIRED_SET_ORDER_MISMATCH/);
});

test("throws when required proof set manifest is missing", () => {
  const repoRoot = makeRepo();

  seedProofChain(repoRoot, ["p134"]);

  assert.throws(
    () => verifyFreezeProofRunnerParity({ repoRoot, runnerStageIds: ["p134"] }),
    (error) => {
      assert.equal(error.code, "FREEZE_PROOF_RUNNER_PARITY_REQUIRED_SET_MISSING");
      return true;
    }
  );
});