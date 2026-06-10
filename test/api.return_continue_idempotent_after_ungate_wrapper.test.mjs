import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

function runNodeTest(relPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--test", relPath],
      {
        cwd: repoRoot,
        env: { ...process.env },
        stdio: ["ignore", "pipe", "pipe"]
      }
    );

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", reject);

    child.on("close", (code) => {
      resolve({
        relPath,
        code: code ?? -1,
        stdout,
        stderr
      });
    });
  });
}

async function assertPass(relPath) {
  const out = await runNodeTest(relPath);
  assert.equal(
    out.code,
    0,
    [
      `expected ${relPath} to pass, got exit code ${out.code}`,
      "",
      "--- stdout ---",
      out.stdout.trim(),
      "",
      "--- stderr ---",
      out.stderr.trim()
    ].join("\n")
  );
}

test("v0 proof: RETURN_CONTINUE is idempotent-rejected after ungate and preserves append-only event/state parity across repeated reloads", async () => {
  await assertPass("test/api.split_decision_idempotent_rejected.regression.test.mjs");
  await assertPass("test/api.return_continue_append_only_history.regression.test.mjs");
  await assertPass("test/api.state_replay_projection_after_split_decisions.regression.test.mjs");
});