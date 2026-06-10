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

test("CI wrapper: session-events query service contract test passes with experimental module mocks", () => {
  const target = "test/api_session_events_query_service.contract.test.mjs";
  const r = runWrapped(target);

  assert.equal(
    r.status,
    0,
    `expected wrapped test to pass: ${target}\nstdout:\n${r.stdout ?? ""}\nstderr:\n${r.stderr ?? ""}`
  );
});