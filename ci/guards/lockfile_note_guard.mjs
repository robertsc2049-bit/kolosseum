// @law: LOCKFILE_NOTE
// @severity: ERROR
// @scope: REPO

// DEV NOTE: Lockfile note guard. This script protects dependency-change review by
// requiring LOCKFILE_CHANGE_NOTE.md when package-lock.json changes. The note gives
// future reviewers a visible reason for lockfile movement instead of forcing them
// to infer whether the dependency graph changed intentionally.

import { execFileSync } from "node:child_process";
import fs from "node:fs";

/**
 * DEV NOTE: Run a git command and return trimmed UTF-8 stdout.
 * This guard reads git state only; it must not mutate the repo while checking
 * lockfile/note coverage.
 */
function sh(args, opts = {}) {
  const res = execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts });
  return (res ?? "").toString().trimEnd();
}

/**
 * DEV NOTE: Best-effort git command wrapper for optional probes.
 * Returning null lets the caller distinguish unavailable git information from an
 * empty command result without throwing an unhandled stack trace.
 */
function trySh(args) {
  try { return sh(args); } catch { return null; }
}

/**
 * DEV NOTE: Return changed paths from a git diff name-only query.
 * Empty output is treated as no changed files. Paths are compared exactly so only
 * root package-lock.json and root LOCKFILE_CHANGE_NOTE.md satisfy this contract.
 */
function listChangedNameOnly(rangeArgs) {
  const out = trySh(["diff", "--name-only", ...rangeArgs]);
  if (!out) return [];
  return out.split("\n").map(s => s.trim()).filter(Boolean);
}

/**
 * DEV NOTE: Exact path membership check.
 * Do not broaden this to suffix matching because nested lockfiles or note files
 * should not satisfy the root lockfile review contract.
 */
function isFileInList(list, name) {
  return list.some(p => p === name);
}

/**
 * DEV NOTE: Filesystem existence helper for the local note file.
 * A note must physically exist before LF-only validation can run.
 */
function fileExists(path) {
  try { fs.accessSync(path, fs.constants.F_OK); return true; } catch { return false; }
}

/**
 * DEV NOTE: Confirm a note file is LF-only by scanning raw bytes.
 * Any CR byte fails, covering both CRLF and lone CR. This keeps the note stable
 * across Windows and CI without depending on text-mode normalisation.
 */
function lfOnly(path) {
  const buf = fs.readFileSync(path);
  // Fail if any CR bytes exist (covers CRLF and lone CR)
  for (const b of buf) if (b === 0x0d) return false;
  return true;
}

/**
 * DEV NOTE: Pick the comparison base for committed-range checks.
 * PR jobs prefer GITHUB_BASE_REF. Local/non-PR checks prefer origin/main, then
 * origin/HEAD. Returning null disables committed-range checks but still allows
 * staged/worktree checks to protect local edits.
 */
function pickBaseRef() {
  const baseRef = process.env.GITHUB_BASE_REF?.trim();
  if (baseRef) return `origin/${baseRef}`;

  // Non-PR: prefer origin/main, else origin/HEAD
  const hasOriginMain = trySh(["show-ref", "--verify", "--quiet", "refs/remotes/origin/main"]) !== null;
  if (hasOriginMain) return "origin/main";

  // Last resort: resolve origin/HEAD -> a real branch ref
  const originHead = trySh(["symbolic-ref", "-q", "refs/remotes/origin/HEAD"]);
  if (originHead) return originHead.trim();

  return null;
}

/**
 * DEV NOTE: Resolve merge-base without fetching.
 * Guards should be deterministic and should not mutate checkout state. If history
 * is too shallow, the committed-range section is disabled and the printed summary
 * shows that clearly.
 */
function ensureFetchedForMergeBase(baseRef) {
  // Some jobs fetch shallow by default; merge-base can fail without history.
  // We won't fetch here (guards should be deterministic and not mutate state),
  // but we will print a clear warning if merge-base fails.
  const mb = trySh(["merge-base", baseRef, "HEAD"]);
  return mb;
}

/**
 * DEV NOTE: Stable boolean formatting for summary output.
 * The guard always prints the same sections so failures can be read quickly in CI.
 */
function fmtBool(b) { return b ? "true" : "false"; }

/**
 * DEV NOTE: Main lockfile-note proof.
 * The guard checks three surfaces: committed range, staged changes, and worktree
 * changes. Committed lockfile changes require the note in the same range; staged
 * or worktree lockfile changes require a present LF-only note before the change is
 * allowed to proceed.
 */
function main() {
  const headSha = sh(["rev-parse", "HEAD"]);
  const headShort = sh(["rev-parse", "--short", "HEAD"]);

  const baseRef = pickBaseRef();
  let mergeBase = null;
  if (baseRef) mergeBase = ensureFetchedForMergeBase(baseRef);

  const rangeArgs = (mergeBase ? [`${mergeBase}..HEAD`] : []);
  const rangeDesc = (mergeBase ? `${mergeBase}..HEAD` : "(no merge-base; range check disabled)");

  const committedChanged = mergeBase ? listChangedNameOnly([rangeDesc]) : [];
  const committedLockChanged = mergeBase ? isFileInList(committedChanged, "package-lock.json") : false;
  const committedNotePresent = mergeBase ? isFileInList(committedChanged, "LOCKFILE_CHANGE_NOTE.md") : false;

  const stagedChanged = listChangedNameOnly(["--cached", "HEAD"]);
  const stagedLockChanged = isFileInList(stagedChanged, "package-lock.json");
  const stagedNotePresent = isFileInList(stagedChanged, "LOCKFILE_CHANGE_NOTE.md");

  const wtChanged = listChangedNameOnly(["HEAD"]);
  const wtLockChanged = isFileInList(wtChanged, "package-lock.json");
  const wtNotePresent = isFileInList(wtChanged, "LOCKFILE_CHANGE_NOTE.md");

  const noteExists = fileExists("LOCKFILE_CHANGE_NOTE.md");
  const noteLfOk = noteExists ? lfOnly("LOCKFILE_CHANGE_NOTE.md") : false;

  const requireNoteCommitted = committedLockChanged;
  const requireNoteStaged = stagedLockChanged || wtLockChanged;

  // DEV NOTE: Output is always unambiguous and uses the same sections. This makes
  // the guard useful as a diagnostic as well as a blocker when lockfile movement is
  // detected.
  console.log("lockfile_note_guard");
  console.log("========================================");
  console.log(`HEAD: ${headShort} (${headSha})`);
  console.log(`baseRef: ${baseRef ?? "(none)"}`);
  console.log(`mergeBase: ${mergeBase ?? "(none)"}`);
  console.log(`commitRange: ${rangeDesc}`);
  console.log("----------------------------------------");
  console.log(`committed: lockfileChanged=${fmtBool(committedLockChanged)} noteInRange=${fmtBool(committedNotePresent)}`);
  console.log(`staged:    lockfileChanged=${fmtBool(stagedLockChanged)} noteStaged=${fmtBool(stagedNotePresent)}`);
  console.log(`worktree:  lockfileChanged=${fmtBool(wtLockChanged)} noteChanged=${fmtBool(wtNotePresent)}`);
  console.log("----------------------------------------");
  console.log(`noteExists=${fmtBool(noteExists)} noteLfOnly=${fmtBool(noteLfOk)}`);
  console.log(`requireNoteCommitted=${fmtBool(requireNoteCommitted)} requireNoteStagedOrWT=${fmtBool(requireNoteStaged)}`);
  console.log("========================================");

  // DEV NOTE: A committed lockfile change must carry the note in the same commit
  // range. This prevents lockfile movement being reviewed without its explanation.
  if (requireNoteCommitted && !committedNotePresent) {
    console.error("FAIL: package-lock.json changed in commit range, but LOCKFILE_CHANGE_NOTE.md was not included in that range.");
    console.error("Fix: add + commit LOCKFILE_CHANGE_NOTE.md in the same PR/push where the lockfile changes.");
    process.exit(1);
  }

  // DEV NOTE: Local staged/worktree lockfile changes require the note to exist
  // before promotion. The note may be staged separately, but it must be present for
  // the developer to explain the dependency-lock movement.
  if (requireNoteStaged && !noteExists) {
    console.error("FAIL: package-lock.json changed in staged/worktree, but LOCKFILE_CHANGE_NOTE.md does not exist.");
    console.error("Fix: add LOCKFILE_CHANGE_NOTE.md (LF-only) and stage it alongside the lockfile.");
    process.exit(1);
  }

  // DEV NOTE: The note must remain LF-only to avoid platform-specific line-ending
  // churn in the review record.
  if (requireNoteStaged && noteExists && !noteLfOk) {
    console.error("FAIL: LOCKFILE_CHANGE_NOTE.md must be LF-only (no CRLF).");
    process.exit(1);
  }

  // DEV NOTE: Success means the current lockfile movement, if any, has the required
  // note coverage for committed and local surfaces. It does not approve dependency
  // content or package manager behaviour by itself.
  console.log("OK");
}

main();
