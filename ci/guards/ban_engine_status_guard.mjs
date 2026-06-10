// @law: Runtime Boundary
// @severity: high
// @scope: engine

// DEV NOTE: Engine status footgun guard. This script bans the legacy
// scripts/engine-status.ps1 path both on disk and in Git tracking so developers
// cannot accidentally revive an obsolete engine-status entrypoint outside the
// approved runtime-boundary flow.

import { existsSync } from "node:fs";
import { execSync } from "node:child_process";

/**
 * DEV NOTE: Terminate with a stable guard-owned message and non-zero exit code.
 * This keeps expected boundary failures readable in CI instead of exposing an
 * unhandled JavaScript stack trace.
 */
function die(msg) {
  console.error(msg);
  process.exit(1);
}

const banned = "scripts/engine-status.ps1";

// DEV NOTE: Normalise the banned path once so the tracked-file comparison is
// stable across Windows and POSIX path separators.
const bannedNorm = banned.replace(/\\/g, "/").toLowerCase();

// DEV NOTE: Disk presence is checked before Git tracking. An untracked copy is
// still a footgun because local scripts or future commits could invoke it.
if (existsSync(banned)) {
  die(`\u274C BANNED FOOTGUN PRESENT ON DISK: ${banned}`);
}

try {
  // DEV NOTE: Git tracking is checked separately because a removed local file can
  // still be present in the index. The NUL-delimited form avoids path splitting
  // issues and keeps the comparison deterministic.
  const tracked = execSync("git ls-files -z", { stdio: ["ignore", "pipe", "ignore"] })
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .map((p) => p.replace(/\\/g, "/").toLowerCase());

  if (tracked.includes(bannedNorm)) {
    die(`\u274C BANNED FOOTGUN IS TRACKED IN GIT: ${banned}`);
  }
} catch (e) {
  die(`\u274C ban_engine_status_guard: git ls-files failed (${e?.message ?? e})`);
}

// DEV NOTE: Success means the banned path is neither present on disk nor tracked
// by Git. It does not approve any replacement entrypoint by itself.
console.log(`OK: banned footgun not present or tracked (${banned})`);
