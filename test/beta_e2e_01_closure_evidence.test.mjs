// DEV NOTE: BETA-E2E-01 closure evidence and CI-registration guard.

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import test from "node:test";

const evidencePath = "docs/releases/BETA_E2E_01_PERSISTENT_HTTP_PRODUCT_JOURNEY.json";
const manifestPath = "ci/contracts/test_ci_integration_vertical_slice_cluster_manifest.json";
const queryServicePath = "src/api/session_state_query_service.ts";
const restartTestPath = "test/beta_e2e_01_persistent_http_product_journey_restart.integration.test.mjs";
const evidenceCommand = "node test/beta_e2e_01_closure_evidence.test.mjs";
const restartCommand = "node " + restartTestPath;

function sha256File(relativePath) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(relativePath))
    .digest("hex");
}

test("BETA-E2E-01 closure evidence is pinned and CI registered", () => {
  const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));

  assert.equal(evidence.schema_version, "kolosseum.beta_e2e_01.persistent_http_product_journey.v1.0.0");
  assert.equal(evidence.slice_id, "BETA-E2E-01");
  assert.equal(evidence.status, "PASS");
  assert.equal(evidence.implementation_gate, "COMPLETE");
  assert.equal(evidence.live_beta_decision, "NO_GO_PENDING_LATER_ACCEPTANCE_GATES");
  assert.equal(evidence.stored_journey_sha, "d4faf52a781493b68273135e4ef6393d171df510");

  assert.ok(evidence.sha256 && typeof evidence.sha256 === "object");

  for (const [relativePath, expectedHash] of Object.entries(evidence.sha256)) {
    assert.equal(fs.existsSync(relativePath), true, "Missing pinned path: " + relativePath);
    assert.equal(sha256File(relativePath), expectedHash, "Hash drift: " + relativePath);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  assert.equal(manifest.commands.filter((command) => command === evidenceCommand).length, 1);
  assert.equal(manifest.commands.filter((command) => command === restartCommand).length, 1);

  const queryService = fs.readFileSync(queryServicePath, "utf8");
  assert.doesNotMatch(queryService, /UPDATE\s+sessions/iu);
  assert.doesNotMatch(queryService, /client\s*\.\s*query\s*\(/u);
  assert.match(queryService, /A GET must not update/u);

  const restartTest = fs.readFileSync(restartTestPath, "utf8");
  assert.match(restartTest, /spawn\(/u);
  assert.match(restartTest, /assert\.notEqual/u);
  assert.match(restartTest, /Persistent HTTP readbacks changed across fresh-process restart/u);
  assert.match(restartTest, /unassigned coach after restart/u);
  assert.doesNotMatch(restartTest, /beta_product_record_store|beta_product_journey_service/u);
  assert.doesNotMatch(restartTest, /from\s+["'][^"']*src\/db[^"']*["']/u);
});
