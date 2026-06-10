// @law: Repo Hygiene
// @severity: high
// @scope: ci/guards
// @rationale:
//   Critical CI runners/entrypoints must never be missing or empty.
//   We already saw an accidental zero-byte runner; this guard prevents recurrence.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function die(msg) {
  process.stderr.write(String(msg) + "\n");
  process.exit(1);
}

function ok(msg) {
  process.stdout.write(String(msg) + "\n");
}

function repoRoot() {
  // This file lives at ci/guards/*.mjs
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..", "..");
}

function statNonEmpty(absPath) {
  try {
    const st = fs.statSync(absPath);
    return { exists: true, size: Number(st.size || 0) };
  } catch {
    return { exists: false, size: 0 };
  }
}

function main() {
  const root = repoRoot();

  // Policy list: keep explicit + small.
  // Only include paths that exist in this repo.
  const critical = [
    "ci/scripts/green_fast.mjs",
    "ci/scripts/spine_guard.mjs",
  ];

  const failures = [];

  for (const rel of critical) {
    const abs = path.join(root, rel);
    const st = statNonEmpty(abs);

    if (!st.exists) failures.push(`${rel} :: MISSING`);
    else if (st.size <= 0) failures.push(`${rel} :: EMPTY (0 bytes)`);
  }

  if (failures.length > 0) {
    die(
      [
        "nonempty_critical_ci_files_guard: FAIL",
        "===================================",
        ...failures,
        "===================================",
        "Fix: restore the file(s) with non-empty content, then re-run lint:fast.",
      ].join("\n")
    );
  }

  ok("OK: nonempty_critical_ci_files_guard (critical runners are present + non-empty)");
}

main();