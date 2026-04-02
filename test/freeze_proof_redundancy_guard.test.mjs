import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { verifyFreezeProofRedundancy } from "../ci/scripts/run_freeze_proof_redundancy_guard.mjs";

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function makeRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kolosseum-freeze-proof-redundancy-"));
}

function seedProofIndex(repoRoot, proofSurfaces) {
  writeJson(path.join(repoRoot, "docs/releases/V1_FREEZE_PROOF_SURFACE_INDEX.json"), {
    schema_version: "kolosseum.freeze.proof_surface_index.v1",
    proof_surfaces: proofSurfaces
  });
}

function seedBindings(repoRoot, bindings) {
  writeJson(path.join(repoRoot, "docs/releases/V1_FREEZE_SURFACE_TO_PROOF_BINDINGS.json"), {
    schema_version: "kolosseum.freeze.surface_to_proof_bindings.v1",
    proof_surfaces: [],
    surface_to_proof_bindings: bindings
  });
}

function seedExceptions(repoRoot, exceptions) {
  writeJson(path.join(repoRoot, "docs/releases/V1_FREEZE_PROOF_REDUNDANCY_EXCEPTIONS.json"), {
    schema_version: "kolosseum.freeze.proof_redundancy_exceptions.v1",
    exceptions
  });
}

test("passes when proof surfaces assert distinct invariants or distinct scope", () => {
  const repoRoot = makeRepo();

  seedProofIndex(repoRoot, [
    {
      proof_surface_id: "proof_a",
      asserted_invariant_ids: ["freshness"]
    },
    {
      proof_surface_id: "proof_b",
      asserted_invariant_ids: ["coverage"]
    },
    {
      proof_surface_id: "proof_c",
      asserted_invariant_ids: ["freshness"]
    }
  ]);

  seedBindings(repoRoot, [
    {
      governed_artefact_path: "docs/releases/a.json",
      proof_surface_id: "proof_a"
    },
    {
      governed_artefact_path: "docs/releases/a.json",
      proof_surface_id: "proof_b"
    },
    {
      governed_artefact_path: "docs/releases/b.json",
      proof_surface_id: "proof_c"
    }
  ]);

  const report = verifyFreezeProofRedundancy({ repoRoot });
  assert.equal(report.ok, true);
  assert.equal(report.failures.length, 0);
});

test("fails when two proof surfaces assert the same invariant over identical scope without exception", () => {
  const repoRoot = makeRepo();

  seedProofIndex(repoRoot, [
    {
      proof_surface_id: "proof_a",
      asserted_invariant_ids: ["freshness"]
    },
    {
      proof_surface_id: "proof_b",
      asserted_invariant_ids: ["freshness"]
    }
  ]);

  seedBindings(repoRoot, [
    {
      governed_artefact_path: "docs/releases/a.json",
      proof_surface_id: "proof_a"
    },
    {
      governed_artefact_path: "docs/releases/a.json",
      proof_surface_id: "proof_b"
    }
  ]);

  const report = verifyFreezeProofRedundancy({ repoRoot });
  assert.equal(report.ok, false);
  assert.match(JSON.stringify(report.failures), /FREEZE_PROOF_REDUNDANCY_UNSANCTIONED_DUPLICATE/);
});

test("passes when identical invariant and scope has an explicit redundancy exception with reason", () => {
  const repoRoot = makeRepo();

  seedProofIndex(repoRoot, [
    {
      proof_surface_id: "proof_a",
      asserted_invariant_ids: ["freshness"]
    },
    {
      proof_surface_id: "proof_b",
      asserted_invariant_ids: ["freshness"]
    }
  ]);

  seedBindings(repoRoot, [
    {
      governed_artefact_path: "docs/releases/a.json",
      proof_surface_id: "proof_a"
    },
    {
      governed_artefact_path: "docs/releases/a.json",
      proof_surface_id: "proof_b"
    }
  ]);

  seedExceptions(repoRoot, [
    {
      proof_surface_ids: ["proof_a", "proof_b"],
      invariant_id: "freshness",
      reason: "independent implementation cross-check"
    }
  ]);

  const report = verifyFreezeProofRedundancy({ repoRoot });
  assert.equal(report.ok, true);
  assert.equal(report.failures.length, 0);
});

test("fails when redundancy exception references an unknown proof surface", () => {
  const repoRoot = makeRepo();

  seedProofIndex(repoRoot, [
    {
      proof_surface_id: "proof_a",
      asserted_invariant_ids: ["freshness"]
    },
    {
      proof_surface_id: "proof_b",
      asserted_invariant_ids: ["freshness"]
    }
  ]);

  seedBindings(repoRoot, [
    {
      governed_artefact_path: "docs/releases/a.json",
      proof_surface_id: "proof_a"
    },
    {
      governed_artefact_path: "docs/releases/a.json",
      proof_surface_id: "proof_b"
    }
  ]);

  seedExceptions(repoRoot, [
    {
      proof_surface_ids: ["proof_a", "proof_missing"],
      invariant_id: "freshness",
      reason: "bad exception"
    }
  ]);

  const report = verifyFreezeProofRedundancy({ repoRoot });
  assert.equal(report.ok, false);
  assert.match(JSON.stringify(report.failures), /FREEZE_PROOF_REDUNDANCY_EXCEPTION_UNKNOWN_PROOF_SURFACE/);
});

test("fails when redundancy exception has no actual shared invariant redundancy", () => {
  const repoRoot = makeRepo();

  seedProofIndex(repoRoot, [
    {
      proof_surface_id: "proof_a",
      asserted_invariant_ids: ["freshness"]
    },
    {
      proof_surface_id: "proof_b",
      asserted_invariant_ids: ["coverage"]
    }
  ]);

  seedBindings(repoRoot, [
    {
      governed_artefact_path: "docs/releases/a.json",
      proof_surface_id: "proof_a"
    },
    {
      governed_artefact_path: "docs/releases/a.json",
      proof_surface_id: "proof_b"
    }
  ]);

  seedExceptions(repoRoot, [
    {
      proof_surface_ids: ["proof_a", "proof_b"],
      invariant_id: "freshness",
      reason: "not actually shared"
    }
  ]);

  const report = verifyFreezeProofRedundancy({ repoRoot });
  assert.equal(report.ok, false);
  assert.match(JSON.stringify(report.failures), /FREEZE_PROOF_REDUNDANCY_EXCEPTION_NOT_REDUNDANT/);
});

test("fails when bindings reference unknown proof surfaces", () => {
  const repoRoot = makeRepo();

  seedProofIndex(repoRoot, [
    {
      proof_surface_id: "proof_a",
      asserted_invariant_ids: ["freshness"]
    }
  ]);

  seedBindings(repoRoot, [
    {
      governed_artefact_path: "docs/releases/a.json",
      proof_surface_id: "proof_missing"
    }
  ]);

  const report = verifyFreezeProofRedundancy({ repoRoot });
  assert.equal(report.ok, false);
  assert.match(JSON.stringify(report.failures), /FREEZE_PROOF_REDUNDANCY_UNKNOWN_PROOF_SURFACE_IN_BINDINGS/);
});