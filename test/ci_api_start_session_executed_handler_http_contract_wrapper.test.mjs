import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";

test("CI wrapper: startSession executed handler http contract test passes with experimental module mocks", () => {
  const repo = process.cwd();
  const target = path.join(repo, "test", "api_start_session_executed_handler_http_contract.test.mjs");

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