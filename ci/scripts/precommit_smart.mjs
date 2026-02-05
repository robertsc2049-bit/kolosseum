import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execSync } from "node:child_process";

function sh(cmd, inherit = true) {
  execSync(cmd, { stdio: inherit ? "inherit" : ["ignore", "pipe", "ignore"] });
}
function out(cmd) {
  return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString("utf8");
}

function normalizeToLf(s) {
  return s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function writeUtf8NoBomLf(absPath, text) {
  const dir = path.dirname(absPath);
  if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const lf = normalizeToLf(text);
  fs.writeFileSync(absPath, lf, { encoding: "utf8" });

  // Hard assert: no CR remains
  const probe = fs.readFileSync(absPath, "utf8");
  if (probe.includes("\r")) {
    throw new Error(`precommit_smart: CR detected after write (expected LF-only): ${absPath}`);
  }
}

function ensureLockfileNoteIfNeeded(stagedFiles) {
  const lockfile = "package-lock.json";
  if (!stagedFiles.includes(lockfile)) return;

  const noteRel = "LOCKFILE_CHANGE_NOTE.md";
  const noteAbs = path.resolve(process.cwd(), noteRel);

  const today = new Date();
  const yyyy = String(today.getFullYear());
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const dateStamp = `${yyyy}-${mm}-${dd}`;

  const msgRaw = (process.env.KOLOSSEUM_LOCKFILE_NOTE || "").trim();
  const msg =
    msgRaw.length > 0
      ? msgRaw
      : "package-lock.json updated (auto-note). If this is non-trivial, set KOLOSSEUM_LOCKFILE_NOTE to a better message.";

  const line = `${dateStamp}: ${msg}\n`;

  const existing = fs.existsSync(noteAbs) ? fs.readFileSync(noteAbs, "utf8") : "";
  const next = normalizeToLf(existing) + normalizeToLf(line);

  writeUtf8NoBomLf(noteAbs, next);

  // Stage it automatically
  sh(`git add -- "${noteRel}"`);
  console.log(`[pre-commit] lockfile staged -> ensured + staged ${noteRel}`);
}

const files = out("git diff --name-only --cached")
  .split(/\r?\n/)
  .map((s) => s.trim())
  .filter(Boolean);

console.log(`[pre-commit] staged files: ${files.length}`);

if (files.length === 0) {
  console.log("[pre-commit] nothing staged -> OK");
  process.exit(0);
}

// If the lockfile is staged, ensure the note exists (LF-only) and is staged too.
ensureLockfileNoteIfNeeded(files);

const isDoc = (f) => f.startsWith("docs/") || /\.(md|txt)$/i.test(f);

const touchesEngine = (f) => f.startsWith("engine/") || f.startsWith("cli/") || f.startsWith("src/");

const touchesContracts = (f) =>
  f === "ENGINE_CONTRACT.md" ||
  f === "schema.sql" ||
  f.startsWith("ci/schemas/") ||
  f.startsWith("registries/") ||
  /contract|schema/i.test(f);

const touchesCIInfra = (f) => f.startsWith(".github/workflows/") || f.startsWith("ci/") || f.startsWith("scripts/") || f.startsWith("tools/");

const touchesBuildMeta = (f) =>
  f === "package.json" || f === "package-lock.json" || f === "tsconfig.json" || f === ".npmrc" || f === ".nvmrc";

const DOC_ONLY = files.every(isDoc);
const RISK = files.some(touchesEngine) || files.some(touchesContracts) || files.some(touchesCIInfra) || files.some(touchesBuildMeta);

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

// Refuse any hook side-effects that left unstaged changes behind.
// (Staged changes are fine; this is about the hook mutating the working tree unexpectedly.)
const unstaged = out("git diff --name-only").trim();
if (unstaged.length > 0) {
  console.error("❌ pre-commit produced unstaged changes. Fix and re-stage before committing.");
  console.error(unstaged);
  process.exit(1);
}

console.log("[pre-commit] OK");