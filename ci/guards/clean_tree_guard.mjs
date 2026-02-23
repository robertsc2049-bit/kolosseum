// @law: Repo Hygiene
// @severity: high
// @scope: repo
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import process from "node:process";

function die(msg, code = 1) {
  process.stderr.write(String(msg).trimEnd() + "\n");
  process.exit(code);
}

function ok(msg) {
  process.stdout.write(String(msg).trimEnd() + "\n");
}

function git(args) {
  const r = spawnSync("git", args, { encoding: "utf8", shell: false, windowsHide: true });
  if (r.status !== 0) {
    const out = (r.stdout || "") + (r.stderr || "");
    die(`\u274C clean_tree_guard: git ${args.join(" ")} failed\n${out}`.trim(), r.status ?? 1);
  }
  return (r.stdout || "").toString();
}

function canSkipUnderGreen() {
  // Only skip when invoked by GREEN with a nonce proven via a temp-file handshake.
  // This prevents accidental env poisoning (e.g., someone exporting KOLOSSEUM_GREEN_* manually).
  if (process.env.KOLOSSEUM_GREEN !== "1") return false;

  const nonce = process.env.KOLOSSEUM_GREEN_NONCE || "";
  const file = process.env.KOLOSSEUM_GREEN_NONCE_FILE || "";
  if (!nonce || !file) return false;

  try {
    const disk = fs.readFileSync(file, "utf8").trim();
    return disk === nonce;
  } catch {
    return false;
  }
}

function isStrict() {
  // Strict means: no staged, no unstaged, no untracked.
  // Default (non-strict): allow staged-only changes (X != ' ' and Y == ' ').
  return process.env.KOLOSSEUM_CLEAN_TREE_STRICT === "1";
}

if (canSkipUnderGreen()) {
  ok("OK: clean_tree_guard (skipped: green nonce verified)");
  process.exit(0);
}

const strict = isStrict();

// We forbid:
//  - untracked files (??)
//  - unstaged changes in the working tree (Y column in porcelain is not space)
// In strict mode we ALSO forbid:
//  - staged changes (X column is not space)
const porcelain = git(["status", "--porcelain=v1", "--untracked-files=normal"]).trimEnd();

if (!porcelain) {
  ok(`OK: clean_tree_guard (WORKING TREE: CLEAN${strict ? "; strict" : ""})`);
  process.exit(0);
}

const lines = porcelain.split(/\r?\n/).filter(Boolean);

const untracked = [];
const unstaged = [];
const stagedOnly = [];

for (const l of lines) {
  if (l.startsWith("??")) {
    untracked.push(l);
    continue;
  }

  const x = l.length >= 1 ? l[0] : " ";
  const y = l.length >= 2 ? l[1] : " ";

  if (y !== " ") {
    unstaged.push(l);
    continue;
  }

  if (x !== " ") {
    stagedOnly.push(l);
    continue;
  }

  // Defensive: unexpected format = treat as drift.
  unstaged.push(l);
}

if (!strict && untracked.length === 0 && unstaged.length === 0) {
  ok("OK: clean_tree_guard (WORKING TREE: CLEAN; staged changes allowed)");
  process.exit(0);
}

if (strict && untracked.length === 0 && unstaged.length === 0 && stagedOnly.length === 0) {
  ok("OK: clean_tree_guard (WORKING TREE: CLEAN; strict)");
  process.exit(0);
}

function renderList(arr, limit = 200) {
  const limited = arr.slice(0, limit);
  const suffix = arr.length > limit ? `\n... (${arr.length - limit} more)` : "";
  return { limited, suffix };
}

function safeGitDiffNameOnly(args) {
  try {
    const out = git(args).trimEnd();
    return out ? out : "";
  } catch {
    return "";
  }
}

const parts = [];
parts.push(`\u274C clean_tree_guard: WORKING TREE: DIRTY${strict ? " (strict)" : ""}`);

if (untracked.length) {
  const { limited, suffix } = renderList(untracked);
  parts.push("");
  parts.push("Untracked entries:");
  for (const l of limited) parts.push(" " + l);
  if (suffix) parts.push(suffix);
}

if (unstaged.length) {
  const { limited, suffix } = renderList(unstaged);
  parts.push("");
  parts.push("Unstaged entries (working tree drift):");
  for (const l of limited) parts.push(" " + l);
  if (suffix) parts.push(suffix);

  const diffNames = safeGitDiffNameOnly(["diff", "--name-only"]);
  if (diffNames) {
    parts.push("");
    parts.push("Unstaged files (git diff --name-only):");
    for (const f of diffNames.split(/\r?\n/).filter(Boolean)) parts.push(" " + f);
  }
}

if (stagedOnly.length) {
  const { limited, suffix } = renderList(stagedOnly);
  parts.push("");
  parts.push("Staged entries:");
  for (const l of limited) parts.push(" " + l);
  if (suffix) parts.push(suffix);

  const stagedNames = safeGitDiffNameOnly(["diff", "--cached", "--name-only"]);
  if (stagedNames) {
    parts.push("");
    parts.push("Staged files (git diff --cached --name-only):");
    for (const f of stagedNames.split(/\r?\n/).filter(Boolean)) parts.push(" " + f);
  }
}

parts.push("");
parts.push("Fix:");

if (untracked.length) {
  parts.push("  - remove untracked files (or add them), OR");
  parts.push("  - discard untracked with: git clean -fd");
}

if (unstaged.length) {
  parts.push("  - stage what you intended, OR");
  parts.push("  - discard with: git restore -- .");
}

if (strict && stagedOnly.length) {
  parts.push("  - commit staged changes, OR");
  parts.push("  - unstage with: git restore --staged -- .");
}

die(parts.join("\n").trimEnd(), 1);