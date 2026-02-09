import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function lf(s){ return String(s).replace(/\r\n/g, "\n"); }
function fail(msg){ throw new Error(msg); }
function assert(cond, msg){ if (!cond) fail("ASSERT FAILED: " + msg); }

const repo = process.cwd();
const guard = path.join(repo, "ci", "guards", "ban_direct_node_e_ref_guard.mjs");

// Guard scans scripts/ for .ps1/.psm1. Create a temp offender under scripts/ and ensure guard fails.
const tmpRel = path.join("scripts", "__CI_NEGATIVE__ban_direct_node_e_ref__pwsh_file_node_runner.ps1");
const tmpAbs = path.join(repo, tmpRel);

// Minimal offender: reference node_runner.ps1 via pwsh -File
const offenderLine =
  'pwsh -NoProfile -ExecutionPolicy Bypass -File ".\\\\scripts\\\\_impl\\\\node_runner.ps1" -JsB64 "AAAA"';

const offender = [
  '$ErrorActionPreference="Stop"',
  "",
  "# Intentionally forbidden: should be caught by ban_direct_node_e_ref_guard",
  offenderLine,
  ""
].join("\n");

try {
  if (fs.existsSync(tmpAbs)) fs.unlinkSync(tmpAbs);

  // Explicit LF enforcement for cross-platform determinism
  fs.writeFileSync(tmpAbs, lf(offender), "utf8");

  const r = spawnSync(process.execPath, [guard], { cwd: repo, encoding: "utf8" });

  // Expect failure
  assert(r.status !== 0, "Guard unexpectedly succeeded. status=" + r.status);

  const out = String((r.stdout || "") + "\n" + (r.stderr || ""));

  // Guard name should appear
  assert(/ban_direct_node_e_ref_guard/i.test(out), "Output should mention guard name.");

  // Must reference the temp offender file
  assert(
    out.includes(tmpRel) || out.includes(path.basename(tmpRel)),
    "Output must reference the temp offender file we created."
  );

  // Must reference the forbidden target
  assert(/node_runner\.ps1/i.test(out), "Output should mention node_runner.ps1.");

  // Optional coherence check if command fragments are printed
  const looksLikeItPrintsCommands =
    /-ExecutionPolicy\b/i.test(out) || /\bNoProfile\b/i.test(out) || /\b-JsB64\b/i.test(out);

  if (looksLikeItPrintsCommands) {
    assert(
      /(pwsh|powershell)/i.test(out) && /-File/i.test(out) && /node_runner\.ps1/i.test(out),
      "Output prints command excerpts, but they are incoherent."
    );
  }

  console.log("OK: negative test proves guard blocks node_runner.ps1 references (LF-forced)");
} finally {
  try { if (fs.existsSync(tmpAbs)) fs.unlinkSync(tmpAbs); } catch {}
}
