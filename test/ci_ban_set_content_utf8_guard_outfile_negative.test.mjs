import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import test from "node:test";

function getRepoRootAbsSync() {
  const out = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" });
  const root = String(out || "").trim();
  if (!root) throw new Error("test: git rev-parse --show-toplevel returned empty output.");
  return path.resolve(root);
}

function lf(s) {
  return String(s).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

test("CI: ban_set_content_utf8_guard fails on Out-File -Encoding UTF8 in ci/", () => {
  const repo = getRepoRootAbsSync();

  const tmpDirRel = path.join("ci", "_tmp_ban_set_content_utf8_guard");
  const offenderRel = path.join(tmpDirRel, "offender_outfile_utf8.ps1");

  const tmpDir = path.join(repo, tmpDirRel);
  const offender = path.join(repo, offenderRel);

  fs.mkdirSync(tmpDir, { recursive: true });

  const ps = lf(
    [
      "param()",
      '$x = "hi"',
      '$x | Out-File -FilePath "$PSScriptRoot\\out.txt" -Encoding UTF8',
      "",
    ].join("\n")
  );

  fs.writeFileSync(offender, ps, { encoding: "utf8" });

  try {
    const node = process.execPath;
    const r = spawnSync(node, ["ci/guards/ban_set_content_utf8_guard.mjs"], {
      cwd: repo,
      encoding: "utf8",
      stdio: "pipe",
    });

    const out = String(r.stdout || "") + "\n" + String(r.stderr || "");

    assert.notEqual(r.status, 0, "expected guard to fail (non-zero exit)");
    assert.match(out, /ban_set_content_utf8_guard/i, "expected guard name in output");
    assert.match(out, new RegExp(offenderRel.replace(/\\/g, "\\\\").replace(/\./g, "\\."), "i"), "expected offender path listed");
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  }
});