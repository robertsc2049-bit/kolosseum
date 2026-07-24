import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function run(args) {
  return spawnSync(process.execPath, args, {
    cwd: root,
    encoding: "utf8"
  });
}

test("FULL-UI-01 completion guard passes the canonical inventory", () => {
  const result = run(["ci/guards/full_ui_completion_guard.mjs"]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /OK: FULL-UI-01 completion guard/u);
});

test("FULL-UI-01 deterministic gap report is current", () => {
  const result = run(["scripts/full_ui_gap_report.mjs", "--check"]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
