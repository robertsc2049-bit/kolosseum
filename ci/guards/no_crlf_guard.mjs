import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

function die(msg) {
  console.error(msg);
  process.exit(1);
}

function sh(cmd) {
  return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString("utf8");
}

const exts = new Set([".json", ".mjs", ".js", ".ts", ".md", ".yml", ".yaml", ".sql", ".txt"]);
let files = [];
try {
  files = sh("git ls-files")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
} catch (e) {
  die(`❌ no_crlf_guard: git ls-files failed (${e?.message ?? e})`);
}

const offenders = [];
for (const f of files) {
  const dot = f.lastIndexOf(".");
  const ext = dot >= 0 ? f.slice(dot).toLowerCase() : "";
  if (!exts.has(ext)) continue;

  let s;
  try {
    s = readFileSync(f, "utf8").replace(/^\uFEFF/, "");
  } catch {
    continue;
  }

  if (s.includes("\r\n")) offenders.push(f);
}

if (offenders.length) {
  die(`❌ no_crlf_guard: CRLF detected in:\n- ${offenders.join("\n- ")}\nNormalize to LF.`);
}

console.log("OK: no_crlf_guard");