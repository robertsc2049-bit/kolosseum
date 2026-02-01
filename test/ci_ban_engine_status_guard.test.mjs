import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { spawnSync } from "node:child_process";

const bannedPath = "scripts/engine-status.ps1";
const guardPath = "ci/guards/ban_engine_status_guard.mjs";

test("CI: ban_engine_status_guard fails when banned footgun exists (disk)", () => {
  mkdirSync(dirname(bannedPath), { recursive: true });
  writeFileSync(bannedPath, "# intentionally created by CI test\n", "utf8");
  assert.ok(existsSync(bannedPath), "precondition: banned file should exist");

  try {
    const r = spawnSync(process.execPath, [guardPath], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });

    assert.notEqual(r.status, 0, "guard should exit non-zero when banned file exists");
    const out = `${r.stdout ?? ""}\n${r.stderr ?? ""}`;
    assert.match(out, /BANNED FOOTGUN PRESENT ON DISK/i);
    assert.match(out, /scripts\/engine-status\.ps1/i);
  } finally {
    try { rmSync(bannedPath, { force: true }); } catch {}
  }
});