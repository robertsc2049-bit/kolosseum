// @law: CI Integrity
// @severity: high
// @scope: repo

// DEV NOTE: Green entrypoint guard. This script protects CI and local validation
// integrity by blocking ad-hoc partial npm runs unless they are invoked through an
// approved top-level script or through the canonical green runner. This prevents a
// developer from trusting a narrow command path that may skip required checks.

import process from "node:process";

/**
 * DEV NOTE: Terminate with a stable guard-owned message and non-zero exit code.
 * Entrypoint failures should be readable in npm, CI, and PowerShell output rather
 * than surfacing as unhandled JavaScript stack traces.
 */
function die(msg) {
  console.error(msg);
  process.exit(1);
}

// DEV NOTE: This guard prevents ad-hoc partial runs that can hide implicit writes.
// Authoritative human entrypoints are listed below. Internal commands may run only
// when reached through the approved entrypoint flow or explicitly allowlisted here.

const lifecycle = String(process.env.npm_lifecycle_event || "");
const fromGreen = process.env.KOLOSSEUM_GREEN_ENTRYPOINT === "1";

// DEV NOTE: The green runner sets KOLOSSEUM_GREEN_ENTRYPOINT=1 for commands it
// owns. That environment marker proves the command is part of the canonical green
// path rather than a manually selected partial run.

// DEV NOTE: Allowlist contains two categories only:
// 1. authoritative human-facing entrypoints; and
// 2. internal steps required by those entrypoints.
// Additions should be deliberate because each new lifecycle name becomes a trusted
// way to bypass the ad-hoc-run block.
const allowed = new Set([
  // entrypoints
  "green",
  "green:fast",
  "ci",
  "ci:parity",
  "dev:fast",
  "dev:status",
  "dev:status:full",
  "dev:prepush:smart",

  // internal steps used by green/dev:fast/ci/green:fast
  "lint:fast",
  "test:unit",
  "test:ci",
  "build:fast",
  "e2e:golden",
]);

// DEV NOTE: Commands invoked from the canonical green runner are allowed even when
// their npm lifecycle name is not independently trusted. The runner is responsible
// for selecting the full validation path.
if (fromGreen) process.exit(0);

// DEV NOTE: Direct human invocation is allowed only for known authoritative
// entrypoints and explicitly listed internal steps. Unknown lifecycle names fail
// closed to preserve CI integrity.
if (allowed.has(lifecycle)) process.exit(0);

// DEV NOTE: Failure means the developer attempted an unapproved partial run.
// Fix by using an authoritative entrypoint or by updating this allowlist only when
// the release/check boundary intentionally changes.
die(
  "CI_GREEN_ENTRYPOINT_REQUIRED\n" +
    "Use an authoritative entry point:\n" +
    "  npm run green\n" +
    "  npm run green:fast\n" +
    "  npm run dev:fast\n" +
    "  npm run ci:parity\n" +
    "\nThis guard blocks ad-hoc partial runs and implicit writes.\n" +
    `Blocked: npm_lifecycle_event=${lifecycle || "(unknown)"}`
);
