
// DEV NOTE: Human-maintained repo surface. Keep this file aligned with canonical contracts,
// deterministic checks, and developer handover standards. Do not introduce hidden defaults,
// broad discovery, or unreviewed boundary changes.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const runnerPath = path.join(repoRoot, "ci", "scripts", "run_test_affected_from_changed_files.mjs");

test("run_test_affected_from_changed_files source contract: compose helper receives repo root string, not an object wrapper", () => {
  const source = fs.readFileSync(runnerPath, "utf8");

  assert.match(
    source,
    /composeTestAffectedFromChangedFiles\(repo\)/,
    "affected runner must pass the repo root string directly"
  );

  assert.doesNotMatch(
    source,
    /composeTestAffectedFromChangedFiles\(\{\s*repoRoot:\s*repo\s*\}\)/,
    "affected runner must not pass an object wrapper"
  );
});
