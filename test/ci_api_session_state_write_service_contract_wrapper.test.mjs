
// DEV NOTE: Human-maintained repo surface. Keep this file aligned with canonical contracts,
// deterministic checks, and developer handover standards. Do not introduce hidden defaults,
// broad discovery, or unreviewed boundary changes.

import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

function runWrapped(target) {
  return spawnSync(
    process.execPath,
    ["--test", "--experimental-test-module-mocks", target],
    {
      cwd: process.cwd(),
      encoding: "utf8"
    }
  );
}

test("CI wrapper: session-state write service contract test passes with experimental module mocks", () => {
  const target = "test/api_session_state_write_service.contract.test.mjs";
  const r = runWrapped(target);

  assert.equal(
    r.status,
    0,
    `expected wrapped test to pass: ${target}\nstdout:\n${r.stdout ?? ""}\nstderr:\n${r.stderr ?? ""}`
  );
});
