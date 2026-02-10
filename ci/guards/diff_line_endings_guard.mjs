// @law: Encoding Hygiene
// @severity: high
// @scope: repo
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

function sh(args, opts = {}) {
  return execFileSync(args[0], args.slice(1), {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...opts,
  }).trim();
}

function die(msg) {
  console.error(msg);
  process.exit(1);
}

const base = (process.env.BASE_SHA || "").trim();
const head = (process.env.HEAD_SHA || "").trim();

if (!base || !head) {
  console.log("diff_line_endings_guard: SKIP (BASE_SHA/HEAD_SHA not set).");
  process.exit(0);
}

let names = "";
try {
  names = sh(["git", "diff", "--name-only", "--diff-filter=ACMRT", base, head]);
} catch {
  die(`diff_line_endings_guard: FAILED to compute git diff (${base}..${head}).`);
}

const files = names
  .split("\n")
  .map((s) => s.trim())
  .filter(Boolean);

if (files.length === 0) {
  console.log("diff_line_endings_guard: OK (no changed files).");
  process.exit(0);
}

function isBinaryByNumstat(file) {
  try {
    const out = sh(["git", "diff", "--numstat", base, head, "--", file]);
    if (!out) return false;
    const first = out.split("\n")[0].split("\t")[0];
    return first === "-";
  } catch {
    return false;
  }
}

const offenders = [];

for (const f of files) {
  if (!existsSync(f)) continue;
  if (isBinaryByNumstat(f)) continue;

  const buf = readFileSync(f);

  const hasBom =
    buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;

  let crlfCount = 0;
  for (let i = 0; i < buf.length - 1; i++) {
    if (buf[i] === 0x0d && buf[i + 1] === 0x0a) crlfCount++;
  }

  if (hasBom || crlfCount > 0) {
    offenders.push({ file: f, bom: hasBom, crlf: crlfCount });
  }
}

if (offenders.length) {
  console.error("\u274C diff_line_endings_guard failed. New violations detected:");
  for (const o of offenders) {
    const parts = [];
    if (o.bom) parts.push("UTF-8 BOM");
    if (o.crlf) parts.push(`CRLF x${o.crlf}`);
    console.error(`- ${o.file}: ${parts.join(", ")}`);
  }
  console.error("");
  console.error("Fix: ensure UTF-8 (no BOM) and LF-only line endings.");
  process.exit(1);
}

console.log(`diff_line_endings_guard: OK (${files.length} changed files checked).`);
process.exit(0);
