import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function repoRoot() {
  return path.resolve(__dirname, "..");
}

function p(...parts) {
  return path.resolve(repoRoot(), ...parts);
}

function runGuard() {
  return spawnSync(
    process.execPath,
    [p("ci/guards/registry_law_guard.mjs")],
    { cwd: repoRoot(), encoding: "utf8" }
  );
}

test("CI: registry_law_guard passes on repo as-is", () => {
  const r = runGuard();

  assert.equal(r.status, 0, `expected registry_law_guard to pass; status=${r.status}`);

  const combined = `${r.stdout || ""}\n${r.stderr || ""}`.trim();
  assert.match(combined, /registry_law_guard:\s*OK/i);
});