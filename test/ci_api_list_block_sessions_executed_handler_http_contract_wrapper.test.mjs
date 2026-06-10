
// DEV NOTE: Human-maintained repo surface. Keep this file aligned with canonical contracts,
// deterministic checks, and developer handover standards. Do not introduce hidden defaults,
// broad discovery, or unreviewed boundary changes.

import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";

test("CI wrapper: listBlockSessions executed handler http contract test passes with experimental module mocks", () => {
  const repo = process.cwd();
  const target = path.join(repo, "test", "api_list_block_sessions_executed_handler_http_contract.test.mjs");

  const out = spawnSync(
    process.execPath,
    [
      "--experimental-test-module-mocks",
      "--test",
      target
    ],
    {
      cwd: repo,
      encoding: "utf8"
    }
  );

  if (out.status !== 0) {
    console.error(out.stdout);
    console.error(out.stderr);
  }

  assert.equal(out.status, 0);
});
