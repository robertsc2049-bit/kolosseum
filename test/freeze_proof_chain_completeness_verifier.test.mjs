import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { verifyFreezeProofChainCompleteness } from "../ci/scripts/run_freeze_proof_chain_completeness_verifier.mjs";

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function makeRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kolosseum-freeze-proof-chain-completeness-"));
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

test("passes when proof chain matches required proof ids exactly and in order", () => {
  const repoRoot = makeRepo();

  const proofIds = [
    "p134_freeze_promotion_packet_preservation",
    "p135_freeze_promotion_packet_cleanliness",
    "p136_freeze_rollback_packet_builder",
    "p137_freeze_rollback_packet_compatibility",
    "p138_freeze_mainline_mutation_scope"
  ];

  seedRequiredProofSet(repoRoot, proofIds);
  seedProofChain(repoRoot, proofIds);

  const report = verifyFreezeProofChainCompleteness({ repoRoot });
  assert.equal(report.ok, true);
  assert.equal(report.failures.length, 0);
});

test("fails when proof chain omits a required proof id", () => {
  const repoRoot = makeRepo();

  seedRequiredProofSet(repoRoot, [
    "p134",
    "p135",
    "p136"
  ]);

  seedProofChain(repoRoot, [
    "p134",
    "p136"
  ]);

  const report = verifyFreezeProofChainCompleteness({ repoRoot });
  assert.equal(report.ok, false);
  assert.match(JSON.stringify(report.failures), /FREEZE_PROOF_CHAIN_COMPLETENESS_PROOF_SET_MISSING/);
});

test("fails when proof chain contains an undeclared extra proof id", () => {
  const repoRoot = makeRepo();

  seedRequiredProofSet(repoRoot, [
    "p134",
    "p135"
  ]);

  seedProofChain(repoRoot, [
    "p134",
    "p135",
    "p136"
  ]);

  const report = verifyFreezeProofChainCompleteness({ repoRoot });
  assert.equal(report.ok, false);
  assert.match(JSON.stringify(report.failures), /FREEZE_PROOF_CHAIN_COMPLETENESS_PROOF_SET_EXTRA/);
});

test("fails when proof ids are present but out of order", () => {
  const repoRoot = makeRepo();

  seedRequiredProofSet(repoRoot, [
    "p134",
    "p135",
    "p136"
  ]);

  seedProofChain(repoRoot, [
    "p134",
    "p136",
    "p135"
  ]);

  const report = verifyFreezeProofChainCompleteness({ repoRoot });
  assert.equal(report.ok, false);
  assert.match(JSON.stringify(report.failures), /FREEZE_PROOF_CHAIN_COMPLETENESS_ORDER_MISMATCH/);
});

test("throws when required proof set manifest is missing", () => {
  const repoRoot = makeRepo();

  seedProofChain(repoRoot, [
    "p134"
  ]);

  assert.throws(
    () => verifyFreezeProofChainCompleteness({ repoRoot }),
    (error) => {
      assert.equal(error.code, "FREEZE_PROOF_CHAIN_COMPLETENESS_REQUIRED_SET_MISSING");
      return true;
    }
  );
});