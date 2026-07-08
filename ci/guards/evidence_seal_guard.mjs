// @law: Repo Governance
// @severity: medium
// @scope: repo

// DEV NOTE: Evidence seal wrapper guard. This script keeps the CI guard entrypoint
// small and delegates the actual evidence envelope/seal verification to
// ci/scripts/evidence_seal.mjs --check. The wrapper exists so guard indexing and
// package scripts can call one stable guard path.

import process from "node:process";
import { spawnSync } from "node:child_process";

/**
 * DEV NOTE: Terminate with a stable guard-owned message and non-zero exit code.
 * Evidence seal failures should remain readable in CI and PowerShell output while
 * preserving the detailed message emitted by the delegated evidence_seal script.
 */
function die(msg) {
  console.error(msg);
  process.exit(1);
}

/**
 * DEV NOTE: Delegate to the evidence seal checker using the current Node runtime.
 * stdio is inherited deliberately so the underlying script can print the exact
 * stale envelope/seal details before this wrapper reports the guard failure.
 */
function main() {
  const r = spawnSync(
    process.execPath,
    ["ci/scripts/evidence_seal.mjs", "--check"],
    { stdio: "inherit" }
  );

  // DEV NOTE: Any non-zero delegated status means the recorded evidence envelope
  // or seal is out of date. Do not bypass this wrapper; regenerate or update the
  // evidence artefacts through the approved evidence_seal flow.
  if (r.status !== 0) {
    die("evidence_seal_guard: FAILED (envelope/seal out of date). See message above.");
  }
}

// DEV NOTE: Success is intentionally quiet beyond the delegated checker output.
// This file does not define evidence semantics; it only enforces that the checker
// runs through the stable guard entrypoint.
main();
