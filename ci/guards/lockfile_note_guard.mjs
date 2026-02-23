// @law: LOCKFILE_NOTE
// @severity: ERROR
// @scope: REPO
import { execFileSync } from "node:child_process";
import fs from "node:fs";

function sh(args, opts = {}) {
  const res = execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts });
  return (res ?? "").toString().trimEnd();
}

function trySh(args) {
  try { return sh(args); } catch { return null; }
}

function listChangedNameOnly(rangeArgs) {
  const out = trySh(["diff", "--name-only", ...rangeArgs]);
  if (!out) return [];
  return out.split("\n").map(s => s.trim()).filter(Boolean);
}

function isFileInList(list, name) {
  return list.some(p => p === name);
}

function fileExists(path) {
  try { fs.accessSync(path, fs.constants.F_OK); return true; } catch { return false; }
}

function lfOnly(path) {
  const buf = fs.readFileSync(path);
  // Fail if any CR bytes exist (covers CRLF and lone CR)
  for (const b of buf) if (b === 0x0d) return false;
  return true;
}

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

function ensureFetchedForMergeBase(baseRef) {
  // Some jobs fetch shallow by default; merge-base can fail without history.
  // We won't fetch here (guards should be deterministic and not mutate state),
  // but we will print a clear warning if merge-base fails.
  const mb = trySh(["merge-base", baseRef, "HEAD"]);
  return mb;
}

function fmtBool(b) { return b ? "true" : "false"; }

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

  // Output: always unambiguous, always the same sections.
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

  // Hard fails
  if (requireNoteCommitted && !committedNotePresent) {
    console.error("FAIL: package-lock.json changed in commit range, but LOCKFILE_CHANGE_NOTE.md was not included in that range.");
    console.error("Fix: add + commit LOCKFILE_CHANGE_NOTE.md in the same PR/push where the lockfile changes.");
    process.exit(1);
  }

  if (requireNoteStaged && !noteExists) {
    console.error("FAIL: package-lock.json changed in staged/worktree, but LOCKFILE_CHANGE_NOTE.md does not exist.");
    console.error("Fix: add LOCKFILE_CHANGE_NOTE.md (LF-only) and stage it alongside the lockfile.");
    process.exit(1);
  }

  if (requireNoteStaged && noteExists && !noteLfOk) {
    console.error("FAIL: LOCKFILE_CHANGE_NOTE.md must be LF-only (no CRLF).");
    process.exit(1);
  }

  console.log("OK");
}

main();
