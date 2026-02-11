import { execSync } from "node:child_process";

function die(msg) {
  console.error(msg);
  process.exit(1);
}

function sh(cmd) {
  return execSync(cmd, { stdio: ["ignore", "pipe", "pipe"] }).toString("utf8");
}

const FORCE = process.env.FORCE === "1" || process.env.FORCE === "true";

console.log("golden:update:safe -> running tools/run_golden_update.mjs");
try {
  execSync("node tools/run_golden_update.mjs", { stdio: "inherit" });
} catch (e) {
  die(`golden:update:safe: golden update command failed (${e?.message ?? e})`);
}

let stat = "";
try {
  stat = sh("git diff --stat");
} catch (e) {
  die(`golden:update:safe: git diff --stat failed (${e?.message ?? e})`);
}

if (!stat.trim()) {
  console.log("golden:update:safe: no changes.");
  process.exit(0);
}

console.log("---- git diff --stat ----");
console.log(stat.trim());
console.log("-------------------------");

// Rough size heuristic: count changed files + total changed lines from --numstat
let filesChanged = 0;
let linesChanged = 0;

try {
  const num = sh("git diff --numstat");
  const rows = num.split(/\r?\n/).filter(Boolean);
  filesChanged = rows.length;
  for (const r of rows) {
    const [a, d] = r.split(/\s+/);
    const add = a === "-" ? 0 : Number(a);
    const del = d === "-" ? 0 : Number(d);
    if (!Number.isFinite(add) || !Number.isFinite(del)) continue;
    linesChanged += add + del;
  }
} catch {
  // If numstat fails, fall back to stat-only (still safe)
}

const MAX_FILES = 30;
const MAX_LINES = 800;

if (!FORCE && (filesChanged > MAX_FILES || linesChanged > MAX_LINES)) {
  die(
    `ERROR: golden:update:safe blocked a large diff (files=${filesChanged}, lines=${linesChanged}). ` +
    `If intentional, re-run with FORCE=1.`
  );
}

console.log(`OK: golden:update:safe diff size acceptable (files=${filesChanged}, lines=${linesChanged}, FORCE=${FORCE})`);
