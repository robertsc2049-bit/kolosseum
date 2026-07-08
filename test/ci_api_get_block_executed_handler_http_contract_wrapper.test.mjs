
// DEV NOTE: Human-maintained repo surface. Keep this file aligned with canonical contracts,
// deterministic checks, and developer handover standards. Do not introduce hidden defaults,
// broad discovery, or unreviewed boundary changes.

import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";

test("CI wrapper: getBlock executed handler http contract test passes with experimental module mocks", () => {
  const repo = process.cwd();
  const target = path.join(repo, "test", "api_get_block_executed_handler_http_contract.test.mjs");

  const inheritedExecArgv = Array.isArray(process.execArgv) ? process.execArgv : [];
  const childArgs = [
    ...inheritedExecArgv,
    "--experimental-test-module-mocks",
    "--test",
    target
  ];

  const result = spawnSync(process.execPath, childArgs, {
    cwd: repo,
    encoding: "utf8",
    env: {
      ...process.env
    }
  });

  assert.equal(
    result.status,
    0,
    `expected getBlock executed handler contract wrapper to pass` +
      `\nCMD: ${process.execPath} ${childArgs.join(" ")}` +
      `\nSTDOUT:\n${result.stdout}` +
      `\nSTDERR:\n${result.stderr}`
  );
});
