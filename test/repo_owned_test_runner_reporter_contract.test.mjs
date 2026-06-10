import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

const runners = [
  "ci/scripts/run_test_ci_from_index.mjs",
  "ci/scripts/run_test_affected_from_changed_files.mjs"
];

test("repo-owned node test runners source the centralized reporter seam", () => {
  for (const relPath of runners) {
    const source = fs.readFileSync(path.join(repoRoot, relPath), "utf8");

    assert.match(
      source,
      /import \{ applyDefaultNodeTestReporterEnv \} from "\.\/test_reporter_env\.mjs";/,
      `${relPath} must import the reporter helper`
    );

    assert.match(
      source,
      /applyDefaultNodeTestReporterEnv\(\);/,
      `${relPath} must apply the reporter helper`
    );
  }
});
