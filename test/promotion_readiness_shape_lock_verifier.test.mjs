import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { verifyPromotionReadinessShapeLock } from "../ci/scripts/run_promotion_readiness_shape_lock_verifier.mjs";

function writeJson(root, relativePath, value) {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, JSON.stringify(value, null, 2) + "\n", "utf8");
  return fullPath;
}

function basePromotionReadiness(requiredReports) {
  return {
    ok: true,
    verifier_id: "postv1_promotion_readiness_runner",
    checked_at_utc: "2026-04-03T16:00:00.000Z",
    invariant: "promotion readiness must depend on completed freeze proof chain",
    required_reports: requiredReports,
    failures: [],
    closure_gate: {
      invoked: true,
      ok: true,
      verifier_id: "freeze_governance_closure_gate",
      closure_count: 7,
      promotion_payload_kind: "required_reports"
    }
  };
}

test("passes when required_reports uses frozen array report-summary shape", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "promotion-shape-array-"));

  const inputPath = writeJson(
    tempRoot,
    "docs/releases/V1_PROMOTION_READINESS.json",
    basePromotionReadiness([
      {
        path: "docs/releases/V1_FREEZE_EXIT_CRITERIA.json",
        ok: true,
        verifier_id: "freeze_exit_criteria_verifier",
        checked_at_utc: "2026-04-03T16:00:00.000Z",
        failure_count: 0
      }
    ])
  );

  const result = verifyPromotionReadinessShapeLock({
    root: tempRoot,
    inputPath: path.relative(tempRoot, inputPath).replace(/\\/g, "/")
  });

  assert.equal(result.ok, true);
  assert.equal(result.required_reports_kind, "array");
});

test("passes when required_reports uses frozen object-map shape", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "promotion-shape-object-"));

  const inputPath = writeJson(
    tempRoot,
    "docs/releases/V1_PROMOTION_READINESS.json",
    basePromotionReadiness({
      proof_index: "docs/releases/V1_FREEZE_PROOF_INDEX.json",
      proof_chain: "docs/releases/V1_FREEZE_PROOF_CHAIN.json",
      promotion_readiness: "docs/releases/V1_PROMOTION_READINESS.json"
    })
  );

  const result = verifyPromotionReadinessShapeLock({
    root: tempRoot,
    inputPath: path.relative(tempRoot, inputPath).replace(/\\/g, "/")
  });

  assert.equal(result.ok, true);
  assert.equal(result.required_reports_kind, "object");
});

test("fails when top-level shape drifts with unknown key", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "promotion-shape-drift-top-"));

  const payload = basePromotionReadiness([
    {
      path: "docs/releases/V1_FREEZE_EXIT_CRITERIA.json",
      ok: true,
      verifier_id: "freeze_exit_criteria_verifier",
      checked_at_utc: "2026-04-03T16:00:00.000Z",
      failure_count: 0
    }
  ]);
  payload.extra_field = "drift";

  const inputPath = writeJson(tempRoot, "docs/releases/V1_PROMOTION_READINESS.json", payload);

  const result = verifyPromotionReadinessShapeLock({
    root: tempRoot,
    inputPath: path.relative(tempRoot, inputPath).replace(/\\/g, "/")
  });

  assert.equal(result.ok, false);
  assert.equal(result.failures[0].token, "CI_MANIFEST_MISMATCH");
});

test("fails when required_reports array entry shape is stale", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "promotion-shape-drift-array-"));

  const inputPath = writeJson(
    tempRoot,
    "docs/releases/V1_PROMOTION_READINESS.json",
    basePromotionReadiness([
      {
        path: "docs/releases/V1_FREEZE_EXIT_CRITERIA.json",
        ok: true,
        verifier_id: "freeze_exit_criteria_verifier",
        checked_at_utc: "2026-04-03T16:00:00.000Z"
      }
    ])
  );

  const result = verifyPromotionReadinessShapeLock({
    root: tempRoot,
    inputPath: path.relative(tempRoot, inputPath).replace(/\\/g, "/")
  });

  assert.equal(result.ok, false);
  assert.equal(result.failures[0].token, "CI_MANIFEST_MISMATCH");
});

test("fails when closure_gate contains unknown key", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "promotion-shape-drift-closure-"));

  const payload = basePromotionReadiness([
    {
      path: "docs/releases/V1_FREEZE_EXIT_CRITERIA.json",
      ok: true,
      verifier_id: "freeze_exit_criteria_verifier",
      checked_at_utc: "2026-04-03T16:00:00.000Z",
      failure_count: 0
    }
  ]);
  payload.closure_gate.extra = "drift";

  const inputPath = writeJson(tempRoot, "docs/releases/V1_PROMOTION_READINESS.json", payload);

  const result = verifyPromotionReadinessShapeLock({
    root: tempRoot,
    inputPath: path.relative(tempRoot, inputPath).replace(/\\/g, "/")
  });

  assert.equal(result.ok, false);
  assert.equal(result.failures[0].token, "CI_MANIFEST_MISMATCH");
});

test("emits JSON-safe success shape", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "promotion-shape-success-shape-"));

  const inputPath = writeJson(
    tempRoot,
    "docs/releases/V1_PROMOTION_READINESS.json",
    basePromotionReadiness([
      {
        path: "docs/releases/V1_FREEZE_EXIT_CRITERIA.json",
        ok: true,
        verifier_id: "freeze_exit_criteria_verifier",
        checked_at_utc: "2026-04-03T16:00:00.000Z",
        failure_count: 0
      }
    ])
  );

  const result = verifyPromotionReadinessShapeLock({
    root: tempRoot,
    inputPath: path.relative(tempRoot, inputPath).replace(/\\/g, "/")
  });

  const serialised = JSON.parse(JSON.stringify(result));

  assert.deepEqual(Object.keys(serialised).sort(), [
    "allowed_closure_gate_keys",
    "allowed_top_level_keys",
    "checked_at_utc",
    "input_path",
    "ok",
    "required_reports_kind",
    "verifier_id"
  ]);

  assert.equal(serialised.ok, true);
});
