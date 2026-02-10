// @law: CI Integrity
// @severity: high
// @scope: repo
import process from "node:process";

function die(msg) {
  console.error(msg);
  process.exit(1);
}

// Guard: prevent ad-hoc partial runs that can hide implicit writes.
// Allowed:
//  - top-level authoritative entrypoints (human-invoked)
//  - anything invoked from the canonical green runner (sets KOLOSSEUM_GREEN_ENTRYPOINT=1)

const lifecycle = String(process.env.npm_lifecycle_event || "");
const fromGreen = process.env.KOLOSSEUM_GREEN_ENTRYPOINT === "1";

// Allowlist:
// - Entrypoints (intended human invocations)
// - Internal steps required by those entrypoints (so green/dev:fast/ci/green:fast can actually run)
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

if (fromGreen) process.exit(0);
if (allowed.has(lifecycle)) process.exit(0);

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
