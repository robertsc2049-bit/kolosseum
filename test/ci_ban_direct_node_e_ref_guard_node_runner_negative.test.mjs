import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function die(msg){
  console.error(msg);
  process.exit(1);
}

function assert(cond, msg){
  if (!cond) die("ASSERT FAILED: " + msg);
}

const repo = process.cwd();
const guard = path.join(repo, "ci", "guards", "ban_direct_node_e_ref_guard.mjs");

// Guard scans scripts/ for .ps1/.psm1. Create a temp offender under scripts/ and ensure guard fails.
const tmpRel = path.join("scripts", "__tmp_guard_probe_node_runner.ps1");
const tmpAbs = path.join(repo, tmpRel);

const offender = [
  '$ErrorActionPreference="Stop"',
  '',
  '# Intentionally forbidden: should be caught by ban_direct_node_e_ref_guard',
  'pwsh -NoProfile -ExecutionPolicy Bypass -File ".\\scripts\\_impl\\node_runner.ps1" -JsB64 "AAAA"',
  ''
].join("\n");

try {
  // Ensure clean slate if a prior run crashed
  if (fs.existsSync(tmpAbs)) fs.unlinkSync(tmpAbs);

  fs.writeFileSync(tmpAbs, offender, "utf8");

  const r = spawnSync(process.execPath, [guard], {
    cwd: repo,
    encoding: "utf8"
  });

  // We expect failure
  assert(r.status !== 0, "Guard unexpectedly succeeded. status=" + r.status);

  const out = String((r.stdout || "") + "\n" + (r.stderr || ""));
  assert(/ban_direct_node_e_ref_guard/i.test(out), "Output should mention guard name.");
  assert(/node_runner\.ps1/i.test(out), "Output should mention node_runner.ps1.");
  assert(/pwsh|powershell/i.test(out), "Output should mention pwsh/powershell pattern (or include it in offenders list).");

  console.log("OK: negative test proves guard blocks pwsh -File ...node_runner.ps1");
} finally {
  // Cleanup: repo must not be mutated by tests
  try { if (fs.existsSync(tmpAbs)) fs.unlinkSync(tmpAbs); } catch {}
}
