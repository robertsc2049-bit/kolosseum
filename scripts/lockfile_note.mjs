import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execSync } from "node:child_process";

function sh(cmd) {
  return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trimEnd();
}
function die(msg) {
  console.error(msg);
  process.exit(1);
}

function repoRootOrDie() {
  try {
    return sh("git rev-parse --show-toplevel");
  } catch (e) {
    die("lockfile:note: not in a git repo (git rev-parse failed).");
  }
}

function isUnstagedOrUntrackedClean() {
  // Porcelain: lines starting with "??" are untracked.
  // Lines where first column is space and second is not space are unstaged changes (e.g. " M file").
  const out = sh("git status --porcelain");
  if (!out) return true;

  const lines = out.split(/\r?\n/).filter(Boolean);

  // allow staged changes; disallow *unstaged* changes or untracked files
  for (const l of lines) {
    if (l.startsWith("?? ")) return false;          // untracked
    const x = l[0];
    const y = l[1];
    if (x === " " && y !== " ") return false;       // unstaged
  }
  return true;
}

function isFileStaged(rel) {
  const out = sh("git diff --cached --name-only");
  if (!out) return false;
  const files = out.split(/\r?\n/).filter(Boolean);
  return files.includes(rel);
}

function normalizeLf(s) {
  return s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function writeUtf8NoBomLf(absPath, text) {
  const dir = path.dirname(absPath);
  fs.mkdirSync(dir, { recursive: true });
  const lf = normalizeLf(text);
  fs.writeFileSync(absPath, lf, { encoding: "utf8" }); // Node utf8 has no BOM by default
  const probe = fs.readFileSync(absPath, "utf8");
  if (probe.includes("\r")) die(`lockfile:note: CRLF detected after write (must be LF-only): ${absPath}`);
}

function main() {
  const root = repoRootOrDie();
  process.chdir(root);

  const msg = process.argv.slice(2).join(" ").trim();
  if (!msg) {
    die("lockfile:note: missing message. Usage:\n  npm run lockfile:note -- \"why the lockfile changed\"");
  }

  if (!isUnstagedOrUntrackedClean()) {
    die("lockfile:note: refused â€” working tree has UNSTAGED changes or untracked files. Stage or revert them first.");
  }

  if (!isFileStaged("package-lock.json")) {
    die("lockfile:note: refused â€” package-lock.json is not staged. Stage it first, then run lockfile:note.");
  }

  const noteRel = "LOCKFILE_CHANGE_NOTE.md";
  const noteAbs = path.join(root, noteRel);

  let existing = "";
  if (fs.existsSync(noteAbs)) existing = fs.readFileSync(noteAbs, "utf8");

  const today = new Date().toISOString().slice(0, 10);
  const line = `${today}: ${msg}\n`;

  // append, normalize to LF, enforce UTF-8 no BOM (node default) + LF-only
  const combined = existing ? (normalizeLf(existing).replace(/\n?$/, "\n") + line) : line;
  writeUtf8NoBomLf(noteAbs, combined);

  // stage the note automatically
  sh(`git add "${noteRel}"`);

  // re-check cleanliness (still no unstaged/untracked)
  if (!isUnstagedOrUntrackedClean()) {
    die("lockfile:note: wrote/staged note, but working tree is now dirty (unstaged/untracked). Fix that before committing.");
  }

  console.log("OK: wrote + staged LOCKFILE_CHANGE_NOTE.md (LF-only).");
}

main();