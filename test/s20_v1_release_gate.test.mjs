
// DEV NOTE: Human-maintained repo surface. Keep this file aligned with canonical contracts,
// deterministic checks, and developer handover standards. Do not introduce hidden defaults,
// broad discovery, or unreviewed boundary changes.

import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("S20: v1 release gate passes full composition", () => {
  const result = spawnSync(
    process.execPath,
    ["ci/scripts/run_v1_release_gate.mjs"],
    { encoding: "utf8" }
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
});
