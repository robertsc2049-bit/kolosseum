import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";

test("CI wrapper: block-session query service contract test passes with experimental module mocks", () => {
  const repo = process.cwd();
  const testFile = path.join(repo, "test", "api_block_session_query_service.contract.test.mjs");

  const run = spawnSync(
    process.execPath,
    ["--experimental-test-module-mocks", "--test", testFile],
    {
      cwd: repo,
      encoding: "utf8",
      env: process.env
    }
  );

  if ((run.stdout ?? "").trim()) process.stdout.write(run.stdout);
  if ((run.stderr ?? "").trim()) process.stderr.write(run.stderr);

  assert.equal(run.status, 0, `expected wrapper child process to pass (exit=${run.status})`);
});