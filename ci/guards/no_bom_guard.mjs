// @law: Encoding Hygiene
// @severity: high
// @scope: repo
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

function die(msg) {
  console.error(msg);
  process.exit(1);
}

function sh(cmd) {
  return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString("utf8");
}

const exts = new Set([".json", ".mjs", ".js", ".ts", ".md", ".yml", ".yaml", ".sql", ".txt", ".ps1"]);

let files = [];
try {
  files = sh("git ls-files")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
} catch (e) {
  die(`\u274C no_bom_guard: git ls-files failed (${e?.message ?? e})`);
}

const offenders = [];
for (const f of files) {
  const dot = f.lastIndexOf(".");
  const ext = dot >= 0 ? f.slice(dot).toLowerCase() : "";
  if (!exts.has(ext)) continue;

  let buf;
  try {
    buf = readFileSync(f);
  } catch {
    continue; // ignore missing in worktree
  }

  if (buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
    offenders.push(f);
  }
}

if (offenders.length) {
  die(`\u274C no_bom_guard: UTF-8 BOM detected in:\n- ${offenders.join("\n- ")}\nFix by rewriting as UTF-8 without BOM.`);
}

console.log("OK: no_bom_guard");
