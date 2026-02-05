import { execSync } from "node:child_process";

function sh(cmd, inherit = true) {
  execSync(cmd, { stdio: inherit ? "inherit" : ["ignore", "pipe", "ignore"] });
}
function out(cmd) {
  return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString("utf8");
}

function stagedFiles() {
  return out("git diff --name-only --cached")
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean);
}

let files = stagedFiles();

console.log(`[pre-commit] staged files: ${files.length}`);

if (files.length === 0) {
  console.log("[pre-commit] nothing staged -> OK");
  process.exit(0);
}

// Single source of truth: if package-lock.json is staged, this writes LF-only note + stages it.
sh("node scripts/lockfile_note.mjs --staged");

// Re-read staged files after the helper potentially staged the note.
files = stagedFiles();

const isDoc = (f) =>
  f.startsWith("docs/") ||
  /\.(md|txt)$/i.test(f);

const touchesEngine = (f) =>
  f.startsWith("engine/") ||
  f.startsWith("cli/") ||
  f.startsWith("src/");

const touchesContracts = (f) =>
  f === "ENGINE_CONTRACT.md" ||
  f === "schema.sql" ||
  f.startsWith("ci/schemas/") ||
  f.startsWith("registries/") ||
  /contract|schema/i.test(f);

const touchesCIInfra = (f) =>
  f.startsWith(".github/workflows/") ||
  f.startsWith("ci/") ||
  f.startsWith("scripts/") ||
  f.startsWith("tools/");

const touchesBuildMeta = (f) =>
  f === "package.json" ||
  f === "package-lock.json" ||
  f === "tsconfig.json" ||
  f === ".npmrc" ||
  f === ".nvmrc";

const DOC_ONLY = files.every(isDoc);
const RISK =
  files.some(touchesEngine) ||
  files.some(touchesContracts) ||
  files.some(touchesCIInfra) ||
  files.some(touchesBuildMeta);

if (DOC_ONLY) {
  console.log("[pre-commit] docs-only -> lint:fast");
  sh("npm run lint:fast");
} else if (!RISK) {
  console.log("[pre-commit] low-risk change -> lint:fast");
  sh("npm run lint:fast");
} else {
  console.log("[pre-commit] risk surface touched -> full lint");
  sh("npm run lint");
}

// Refuse hook side-effects that left unstaged changes behind.
const unstaged = out("git diff --name-only").trim();
if (unstaged.length > 0) {
  console.error("❌ pre-commit produced unstaged changes. Fix and re-stage before committing.");
  console.error(unstaged);
  process.exit(1);
}

console.log("[pre-commit] OK");