import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { verifyFreezeGovernanceClosure } from "../ci/scripts/run_freeze_governance_closure_gate.mjs";

function writeJson(baseDir, relativePath, value) {
  const fullPath = path.join(baseDir, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, JSON.stringify(value, null, 2) + "\n", "utf8");
  return fullPath;
}

function makeGreenFixture(baseDir) {
  const proofIndexPath = writeJson(baseDir, "proof_index.json", {
    ok: true,
    verifier_id: "proof-index-v1",
    entries: [
      { id: "proof-001", artifact: "docs/releases/V1_FREEZE_PROOF_INDEX.json" }
    ]
  });

  const proofChainPath = writeJson(baseDir, "proof_chain.json", {
    ok: true,
    proof_index_id: "proof-index-v1",
    chain: [
      { step_id: "chain-001", proof_id: "proof-001" }
    ]
  });

  const driftStatusPath = writeJson(baseDir, "drift_status.json", {
    ok: true,
    verifier_id: "drift-status-v1"
  });

  const packetIntegrityPath = writeJson(baseDir, "packet_integrity.json", {
    ok: true,
    verifier_id: "packet-integrity-v1"
  });

  const cleanlinessPath = writeJson(baseDir, "cleanliness.json", {
    ok: true,
    verifier_id: "cleanliness-v1"
  });

  const exitCriteriaPath = writeJson(baseDir, "exit_criteria.json", {
    ok: true,
    verifier_id: "exit-criteria-v1"
  });

  const promotionReadinessPath = writeJson(baseDir, "promotion_readiness.json", {
    ok: true,
    verifier_id: "promotion-readiness-v1",
    invariant: "promotion_readiness_reports_present",
    checked_at_utc: "2026-04-03T11:00:00Z",
    failures: [],
    required_reports: [
      "docs/releases/V1_FREEZE_PROOF_INDEX.json",
      "docs/releases/V1_FREEZE_PROOF_CHAIN.json",
      "docs/releases/V1_PROMOTION_READINESS.json"
    ]
  });

  return {
    proof_index: proofIndexPath,
    proof_chain: proofChainPath,
    drift_status: driftStatusPath,
    packet_integrity: packetIntegrityPath,
    cleanliness: cleanlinessPath,
    exit_criteria: exitCriteriaPath,
    promotion_readiness: promotionReadinessPath
  };
}

test("verifyFreezeGovernanceClosure passes when all closure components are present and green", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "freeze-governance-closure-"));
  const fixture = makeGreenFixture(tempDir);

  const result = verifyFreezeGovernanceClosure(fixture);

  assert.equal(result.ok, true);
  assert.equal(result.closure_count, 7);
  assert.equal(result.promotion_safe, true);
  assert.equal(result.promotion_payload_kind, "required_reports");
  assert.deepEqual(Object.keys(result.closure_components).sort(), [
    "cleanliness",
    "drift_status",
    "exit_criteria",
    "packet_integrity",
    "promotion_readiness",
    "proof_chain",
    "proof_index"
  ]);
});

test("verifyFreezeGovernanceClosure fails when a required closure component is missing", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "freeze-governance-closure-"));
  const fixture = makeGreenFixture(tempDir);

  fs.unlinkSync(fixture.cleanliness);

  const result = verifyFreezeGovernanceClosure(fixture);

  assert.equal(result.ok, false);
  assert.equal(result.failures[0].token, "missing_closure_component");
  assert.equal(result.failures[0].component, "cleanliness");
});

test("verifyFreezeGovernanceClosure fails when proof index entries are empty", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "freeze-governance-closure-"));
  const fixture = makeGreenFixture(tempDir);

  writeJson(tempDir, "proof_index.json", {
    ok: true,
    verifier_id: "proof-index-v1",
    entries: []
  });

  const result = verifyFreezeGovernanceClosure(fixture);

  assert.equal(result.ok, false);
  assert.equal(result.failures[0].token, "governance_gap_open");
  assert.equal(result.failures[0].component, "proof_index");
});

test("verifyFreezeGovernanceClosure fails when proof chain is empty", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "freeze-governance-closure-"));
  const fixture = makeGreenFixture(tempDir);

  writeJson(tempDir, "proof_chain.json", {
    ok: true,
    proof_index_id: "proof-index-v1",
    chain: []
  });

  const result = verifyFreezeGovernanceClosure(fixture);

  assert.equal(result.ok, false);
  assert.equal(result.failures[0].token, "governance_gap_open");
  assert.equal(result.failures[0].component, "proof_chain");
});

test("verifyFreezeGovernanceClosure fails when proof chain binds to the wrong proof index", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "freeze-governance-closure-"));
  const fixture = makeGreenFixture(tempDir);

  writeJson(tempDir, "proof_chain.json", {
    ok: true,
    proof_index_id: "wrong-proof-index",
    chain: [
      { step_id: "chain-001", proof_id: "proof-001" }
    ]
  });

  const result = verifyFreezeGovernanceClosure(fixture);

  assert.equal(result.ok, false);
  assert.equal(result.failures[0].token, "governance_gap_open");
  assert.equal(result.failures[0].component, "proof_chain");
});

test("verifyFreezeGovernanceClosure fails when drift status is not green", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "freeze-governance-closure-"));
  const fixture = makeGreenFixture(tempDir);

  writeJson(tempDir, "drift_status.json", {
    ok: false,
    verifier_id: "drift-status-v1"
  });

  const result = verifyFreezeGovernanceClosure(fixture);

  assert.equal(result.ok, false);
  assert.equal(result.failures[0].token, "governance_gap_open");
  assert.equal(result.failures[0].component, "drift_status");
});

test("verifyFreezeGovernanceClosure fails when packet integrity is not green", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "freeze-governance-closure-"));
  const fixture = makeGreenFixture(tempDir);

  writeJson(tempDir, "packet_integrity.json", {
    ok: false,
    verifier_id: "packet-integrity-v1"
  });

  const result = verifyFreezeGovernanceClosure(fixture);

  assert.equal(result.ok, false);
  assert.equal(result.failures[0].token, "governance_gap_open");
  assert.equal(result.failures[0].component, "packet_integrity");
});

test("verifyFreezeGovernanceClosure fails when cleanliness is not green", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "freeze-governance-closure-"));
  const fixture = makeGreenFixture(tempDir);

  writeJson(tempDir, "cleanliness.json", {
    ok: false,
    verifier_id: "cleanliness-v1"
  });

  const result = verifyFreezeGovernanceClosure(fixture);

  assert.equal(result.ok, false);
  assert.equal(result.failures[0].token, "governance_gap_open");
  assert.equal(result.failures[0].component, "cleanliness");
});

test("verifyFreezeGovernanceClosure fails when exit criteria is not green", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "freeze-governance-closure-"));
  const fixture = makeGreenFixture(tempDir);

  writeJson(tempDir, "exit_criteria.json", {
    ok: false,
    verifier_id: "exit-criteria-v1"
  });

  const result = verifyFreezeGovernanceClosure(fixture);

  assert.equal(result.ok, false);
  assert.equal(result.failures[0].token, "governance_gap_open");
  assert.equal(result.failures[0].component, "exit_criteria");
});

test("verifyFreezeGovernanceClosure fails when promotion readiness is not green", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "freeze-governance-closure-"));
  const fixture = makeGreenFixture(tempDir);

  writeJson(tempDir, "promotion_readiness.json", {
    ok: false,
    verifier_id: "promotion-readiness-v1",
    required_reports: ["docs/releases/V1_PROMOTION_READINESS.json"]
  });

  const result = verifyFreezeGovernanceClosure(fixture);

  assert.equal(result.ok, false);
  assert.equal(result.failures[0].token, "governance_gap_open");
  assert.equal(result.failures[0].component, "promotion_readiness");
});

test("verifyFreezeGovernanceClosure fails when promotion readiness prerequisites object is missing", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "freeze-governance-closure-"));
  const fixture = makeGreenFixture(tempDir);

  writeJson(tempDir, "promotion_readiness.json", {
    ok: true,
    verifier_id: "promotion-readiness-v1"
  });

  const result = verifyFreezeGovernanceClosure(fixture);

  assert.equal(result.ok, false);
  assert.equal(result.failures[0].token, "CI_MANIFEST_MISMATCH");
  assert.equal(result.failures[0].component, "promotion_readiness");
});

test("verifyFreezeGovernanceClosure accepts promotion readiness with required_reports object", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "freeze-governance-closure-"));
  const fixture = makeGreenFixture(tempDir);

  writeJson(tempDir, "promotion_readiness.json", {
    ok: true,
    verifier_id: "promotion-readiness-v1",
    required_reports: {
      proof_index: "docs/releases/V1_FREEZE_PROOF_INDEX.json",
      proof_chain: "docs/releases/V1_FREEZE_PROOF_CHAIN.json",
      promotion_readiness: "docs/releases/V1_PROMOTION_READINESS.json"
    }
  });

  const result = verifyFreezeGovernanceClosure(fixture);

  assert.equal(result.ok, true);
  assert.equal(result.promotion_payload_kind, "required_reports_object");
});

test("verifyFreezeGovernanceClosure emits JSON-safe success shape", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "freeze-governance-closure-"));
  const fixture = makeGreenFixture(tempDir);

  const result = verifyFreezeGovernanceClosure(fixture);
  const serialised = JSON.parse(JSON.stringify(result));

  assert.deepEqual(Object.keys(serialised).sort(), [
    "closure_components",
    "closure_count",
    "ok",
    "promotion_payload_kind",
    "promotion_safe"
  ]);

  assert.equal(serialised.ok, true);
  assert.equal(serialised.closure_count, 7);
  assert.equal(serialised.promotion_payload_kind, "required_reports");
  assert.equal(serialised.promotion_safe, true);
});
