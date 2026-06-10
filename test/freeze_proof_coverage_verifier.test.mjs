import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { verifyFreezeProofCoverage } from "../ci/scripts/run_freeze_proof_coverage_verifier.mjs";

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function makeRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kolosseum-freeze-proof-coverage-"));
}

function seedGovernedSurface(repoRoot, governedArtefactPaths) {
  writeJson(path.join(repoRoot, "docs/releases/V1_FREEZE_GOVERNED_ARTEFACT_SET.json"), {
    schema_version: "kolosseum.freeze.governed_surface.v1",
    governed_artefacts: governedArtefactPaths.map((item) => ({ path: item }))
  });
}

function seedBindings(repoRoot, proofSurfaces, bindings) {
  writeJson(path.join(repoRoot, "docs/releases/V1_FREEZE_SURFACE_TO_PROOF_BINDINGS.json"), {
    schema_version: "kolosseum.freeze.surface_to_proof_bindings.v1",
    proof_surfaces: proofSurfaces.map((proof_surface_id) => ({ proof_surface_id })),
    surface_to_proof_bindings: bindings
  });
}

test("passes when every governed artefact has explicit proof coverage", () => {
  const repoRoot = makeRepo();

  seedGovernedSurface(repoRoot, [
    "docs/releases/V1_FREEZE_CHAIN_ORDER.json",
    "docs/releases/V1_FREEZE_PROOF_REPORT_SET.json"
  ]);

  seedBindings(
    repoRoot,
    ["chain_order_verifier", "proof_freshness_verifier"],
    [
      {
        governed_artefact_path: "docs/releases/V1_FREEZE_CHAIN_ORDER.json",
        proof_surface_id: "chain_order_verifier"
      },
      {
        governed_artefact_path: "docs/releases/V1_FREEZE_PROOF_REPORT_SET.json",
        proof_surface_id: "proof_freshness_verifier"
      }
    ]
  );

  const report = verifyFreezeProofCoverage({ repoRoot });
  assert.equal(report.ok, true);
  assert.equal(report.failures.length, 0);
  assert.equal(report.coverage.length, 2);
});

test("fails when a governed artefact has no proof coverage", () => {
  const repoRoot = makeRepo();

  seedGovernedSurface(repoRoot, [
    "docs/releases/V1_FREEZE_CHAIN_ORDER.json",
    "docs/releases/V1_FREEZE_PROOF_REPORT_SET.json"
  ]);

  seedBindings(
    repoRoot,
    ["chain_order_verifier"],
    [
      {
        governed_artefact_path: "docs/releases/V1_FREEZE_CHAIN_ORDER.json",
        proof_surface_id: "chain_order_verifier"
      }
    ]
  );

  const report = verifyFreezeProofCoverage({ repoRoot });
  assert.equal(report.ok, false);
  assert.match(JSON.stringify(report.failures), /FREEZE_GOVERNED_ARTEFACT_UNCOVERED/);
});

test("fails when a binding targets a non-governed artefact", () => {
  const repoRoot = makeRepo();

  seedGovernedSurface(repoRoot, [
    "docs/releases/V1_FREEZE_CHAIN_ORDER.json"
  ]);

  seedBindings(
    repoRoot,
    ["chain_order_verifier"],
    [
      {
        governed_artefact_path: "docs/releases/not-governed.json",
        proof_surface_id: "chain_order_verifier"
      }
    ]
  );

  const report = verifyFreezeProofCoverage({ repoRoot });
  assert.equal(report.ok, false);
  assert.match(JSON.stringify(report.failures), /FREEZE_PROOF_BINDING_DANGLING_GOVERNED_ARTEFACT/);
});

test("fails when a binding references an unknown proof surface", () => {
  const repoRoot = makeRepo();

  seedGovernedSurface(repoRoot, [
    "docs/releases/V1_FREEZE_CHAIN_ORDER.json"
  ]);

  seedBindings(
    repoRoot,
    ["proof_freshness_verifier"],
    [
      {
        governed_artefact_path: "docs/releases/V1_FREEZE_CHAIN_ORDER.json",
        proof_surface_id: "chain_order_verifier"
      }
    ]
  );

  const report = verifyFreezeProofCoverage({ repoRoot });
  assert.equal(report.ok, false);
  assert.match(JSON.stringify(report.failures), /FREEZE_PROOF_BINDING_UNKNOWN_PROOF_SURFACE/);
});

test("fails when a proof surface is declared but unused", () => {
  const repoRoot = makeRepo();

  seedGovernedSurface(repoRoot, [
    "docs/releases/V1_FREEZE_CHAIN_ORDER.json"
  ]);

  seedBindings(
    repoRoot,
    ["chain_order_verifier", "proof_freshness_verifier"],
    [
      {
        governed_artefact_path: "docs/releases/V1_FREEZE_CHAIN_ORDER.json",
        proof_surface_id: "chain_order_verifier"
      }
    ]
  );

  const report = verifyFreezeProofCoverage({ repoRoot });
  assert.equal(report.ok, false);
  assert.match(JSON.stringify(report.failures), /FREEZE_PROOF_SURFACE_UNUSED/);
});

test("fails fast on duplicate governed/proof binding pairs", () => {
  const repoRoot = makeRepo();

  seedGovernedSurface(repoRoot, [
    "docs/releases/V1_FREEZE_CHAIN_ORDER.json"
  ]);

  seedBindings(
    repoRoot,
    ["chain_order_verifier"],
    [
      {
        governed_artefact_path: "docs/releases/V1_FREEZE_CHAIN_ORDER.json",
        proof_surface_id: "chain_order_verifier"
      },
      {
        governed_artefact_path: "docs/releases/V1_FREEZE_CHAIN_ORDER.json",
        proof_surface_id: "chain_order_verifier"
      }
    ]
  );

  assert.throws(
    () => verifyFreezeProofCoverage({ repoRoot }),
    (error) => {
      assert.equal(error.code, "FREEZE_PROOF_BINDING_DUPLICATE");
      return true;
    }
  );
});