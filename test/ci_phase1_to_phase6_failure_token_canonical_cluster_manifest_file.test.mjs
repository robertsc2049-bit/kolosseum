import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("phase1 to phase6 failure token canonical cluster manifest file is well-formed and pinned to the expected contract tests", () => {
  const repo = process.cwd();
  const manifestPath = path.join(repo, "ci", "contracts", "phase1_to_phase6_failure_token_canonical_ci_cluster.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

  assert.deepEqual(manifest, {
    cluster: [
      "node test/phase1_to_phase6_executable_spine_contract.test.mjs",
      "node test/phase6_output_contract_pin_contract.test.mjs",
      "node test/phase6_unsupported_activity_contract_pin_contract.test.mjs",
      "node test/phase1_to_phase6_failure_token_canonical_contract.test.mjs"
    ]
  });
});
