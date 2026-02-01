import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, rmSync, existsSync, mkdtempSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";

const bannedPath = "scripts/engine-status.ps1";
const guardPath = "ci/guards/ban_engine_status_guard.mjs";

function runNode(args, env) {
  return spawnSync(process.execPath, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: env ? { ...process.env, ...env } : process.env,
  });
}

function runGit(args, env, input) {
  const r = spawnSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: env ? { ...process.env, ...env } : process.env,
    input,
  });
  if (r.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${r.stderr || r.stdout || "(no output)"}`);
  }
  return (r.stdout ?? "").trim();
}

test("CI: ban_engine_status_guard fails when banned footgun exists (disk)", () => {
  mkdirSync(dirname(bannedPath), { recursive: true });
  writeFileSync(bannedPath, "# intentionally created by CI test\n", "utf8");
  assert.ok(existsSync(bannedPath), "precondition: banned file should exist");

  try {
    const r = runNode([guardPath]);

    assert.notEqual(r.status, 0, "guard should exit non-zero when banned file exists");
    const out = `${r.stdout ?? ""}\n${r.stderr ?? ""}`;
    assert.match(out, /BANNED FOOTGUN PRESENT ON DISK/i);
    assert.match(out, /scripts\/engine-status\.ps1/i);
  } finally {
    try { rmSync(bannedPath, { force: true }); } catch {}
  }
});

test("CI: ban_engine_status_guard fails when banned footgun is tracked (temp index, no disk file)", () => {
  // Ensure disk path is absent so we exercise the tracked-path branch
  try { rmSync(bannedPath, { force: true }); } catch {}

  const tempDir = mkdtempSync(join(tmpdir(), "kolosseum-gitindex-"));
  const tempIndex = join(tempDir, "index");
  const env = { GIT_INDEX_FILE: tempIndex };

  try {
    // Create an empty blob (object written to normal object store; index is temp)
    const emptyBlob = runGit(["hash-object", "-t", "blob", "--stdin"], env, "");

    // Mark banned path as tracked in the TEMP index only
    runGit(["update-index", "--add", "--cacheinfo", "100644", emptyBlob, "scripts/engine-status.ps1"], env);

    const r = runNode([guardPath], env);

    assert.notEqual(r.status, 0, "guard should exit non-zero when banned path is tracked in temp index");
    const out = `${r.stdout ?? ""}\n${r.stderr ?? ""}`;
    assert.match(out, /BANNED FOOTGUN IS TRACKED IN GIT/i);
    assert.match(out, /scripts\/engine-status\.ps1/i);
  } finally {
    try { rmSync(tempDir, { recursive: true, force: true }); } catch {}
  }
});