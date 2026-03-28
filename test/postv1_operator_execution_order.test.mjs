import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const DOC_PATH = "docs/releases/V1_OPERATOR_EXECUTION_ORDER.md";

const EXPECTED_SEQUENCE = [
  "ci/scripts/build_postv1_packaging_evidence.mjs",
  "ci/scripts/run_postv1_packaging_evidence_manifest_verifier.mjs",
  "ci/scripts/run_postv1_final_acceptance_gate.mjs",
  "ci/scripts/run_release_claim_validator.mjs",
  "ci/scripts/run_postv1_merge_readiness_verifier.mjs",
  "ci/scripts/run_postv1_mainline_post_merge_verification.mjs"
];

test("P39: execution order doc exists", () => {
  assert.ok(fs.existsSync(DOC_PATH), "execution order doc must exist");
});

test("P39: execution order is linear and exact", () => {
  const content = fs.readFileSync(DOC_PATH, "utf8");

  const found = EXPECTED_SEQUENCE.map(step => {
    const idx = content.indexOf(step);
    assert.notEqual(idx, -1, `missing step in doc: ${step}`);
    return { step, idx };
  });

  // ensure strict ordering
  for (let i = 1; i < found.length; i++) {
    assert.ok(
      found[i].idx > found[i - 1].idx,
      `execution order violated: ${found[i].step}`
    );
  }

  // ensure no duplicates
  const unique = new Set(EXPECTED_SEQUENCE);
  assert.equal(unique.size, EXPECTED_SEQUENCE.length, "duplicate steps not allowed");
});