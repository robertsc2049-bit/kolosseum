import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("S19a: repo-callable copy guard runner passes for org data product files", () => {
  const result = spawnSync(
    process.execPath,
    ["ci/scripts/run_no_inference_copy_guard.mjs"],
    { encoding: "utf8" }
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
});