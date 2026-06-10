// @law: Repo Hygiene
// @severity: high
// @scope: repo

// DEV NOTE: Clean-tree guard. This script protects release, promotion, and CI
// orchestration from running over untracked or unstaged repo drift. Non-strict
// mode allows staged-only changes so intentional patch batches can still be
// checked before commit; strict mode forbids staged changes too.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import process from "node:process";

/**
 * DEV NOTE: Terminate with a stable guard-owned message and non-zero exit code.
 * Expected dirty-tree failures should be readable in CI and PowerShell output
 * rather than surfacing as unhandled JavaScript stack traces.
 */
function die(msg, code = 1) {
  process.stderr.write(String(msg).trimEnd() + "\n");
  process.exit(code);
}

/**
 * DEV NOTE: Emit successful guard status with a final LF. Keep success text stable
 * because orchestration scripts and humans use it to confirm which mode ran.
 */
function ok(msg) {
  process.stdout.write(String(msg).trimEnd() + "\n");
}

/**
 * DEV NOTE: Run git commands without shell expansion and fail closed on non-zero
 * status. This guard depends on Git porcelain output as the source of truth for
 * tracked, staged, unstaged, and untracked repo state.
 */
function git(args) {
  const r = spawnSync("git", args, { encoding: "utf8", shell: false, windowsHide: true });
  if (r.status !== 0) {
    const out = (r.stdout || "") + (r.stderr || "");
    die(`\u274C clean_tree_guard: git ${args.join(" ")} failed\n${out}`.trim(), r.status ?? 1);
  }
  return (r.stdout || "").toString();
}

/**
 * DEV NOTE: Allow GREEN orchestration to skip redundant nested clean-tree checks
 * only when a nonce is proven by reading a temp file. Environment variables alone
 * are not trusted because they can be accidentally exported or manually poisoned.
 */
function canSkipUnderGreen() {
  // Policy:
  // - We allow a "green nonce verified" skip to prevent redundant checks when GREEN orchestrates
  //   many nested scripts.
  // - BUT: callers may force enforcement even under GREEN by setting KOLOSSEUM_CLEAN_TREE_ENFORCE=1.
  //
  // This makes dev:fast able to behave like "standard checks" (fail on DIRTY) while still using
  // the green-style nonce handshake for safety.

  if (process.env.KOLOSSEUM_CLEAN_TREE_ENFORCE === "1") return false;

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

/**
 * DEV NOTE: Strict mode is opt-in via KOLOSSEUM_CLEAN_TREE_STRICT=1.
 * Non-strict mode blocks untracked and unstaged drift but allows staged-only
 * changes so a developer can validate an intentional staged patch before commit.
 */
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

// DEV NOTE: Parse porcelain v1 status explicitly. The X column represents index
// state and the Y column represents working-tree state; ?? is handled separately
// because untracked files do not follow the same two-column contract.
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

/**
 * DEV NOTE: Limit long dirty-tree lists so CI logs remain usable when a branch has
 * large drift. The omitted count still makes the scale of the problem visible.
 */
function renderList(arr, limit = 200) {
  const limited = arr.slice(0, limit);
  const suffix = arr.length > limit ? `\n... (${arr.length - limit} more)` : "";
  return { limited, suffix };
}

/**
 * DEV NOTE: Best-effort diff-name helper for richer failure output. It is allowed
 * to return an empty string because the primary failure signal already comes from
 * git status porcelain above.
 */
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

// DEV NOTE: Untracked files are always forbidden because they can hide generated
// artefacts, local scratch files, or unreviewed repo content from checks and PRs.
if (untracked.length) {
  const { limited, suffix } = renderList(untracked);
  parts.push("");
  parts.push("Untracked entries:");
  for (const l of limited) parts.push(" " + l);
  if (suffix) parts.push(suffix);
}

// DEV NOTE: Unstaged changes are always forbidden because checks would run against
// local drift that may not match what is committed or reviewed.
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

// DEV NOTE: Staged-only changes are allowed in non-strict mode but still reported
// on dirty failure paths. In strict mode, staged-only changes are forbidden.
if (stagedOnly.length) {
  const { limited, suffix } = renderList(stagedOnly);
  parts.push("");
  parts.push("Staged-only entries:");
  for (const l of limited) parts.push(" " + l);
  if (suffix) parts.push(suffix);

  const stagedNames = safeGitDiffNameOnly(["diff", "--cached", "--name-only"]);
  if (stagedNames) {
    parts.push("");
    parts.push("Staged files (git diff --cached --name-only):");
    for (const f of stagedNames.split(/\r?\n/).filter(Boolean)) parts.push(" " + f);
  }

  if (!strict) {
    parts.push("");
    parts.push("NOTE: staged-only is allowed in non-strict mode.");
    parts.push("      To forbid staged changes too: set KOLOSSEUM_CLEAN_TREE_STRICT=1.");
  }
}

die(parts.join("\n"), 1);
