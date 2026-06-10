import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { verifyFreezeMainlineMutationScope } from "../ci/scripts/run_freeze_mainline_mutation_scope_verifier.mjs";

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function makeRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kolosseum-freeze-mainline-mutation-scope-"));
}

function seedScope(repoRoot, freezeScopePaths, allowlistedPaths = []) {
  writeJson(path.join(repoRoot, "docs/releases/V1_FREEZE_MAINLINE_MUTATION_SCOPE.json"), {
    schema_version: "kolosseum.freeze.mainline_mutation_scope.v1",
    freeze_scope_paths: freezeScopePaths,
    allowlisted_paths: allowlistedPaths
  });
}

test("passes when all changed files are inside declared freeze scope", () => {
  const repoRoot = makeRepo();

  seedScope(
    repoRoot,
    [
      "ci/scripts/run_freeze_mainline_mutation_scope_verifier.mjs",
      "test/freeze_mainline_mutation_scope_verifier.test.mjs"
    ],
    []
  );

  const report = verifyFreezeMainlineMutationScope({
    repoRoot,
    changedFiles: [
      "test/freeze_mainline_mutation_scope_verifier.test.mjs",
      "ci/scripts/run_freeze_mainline_mutation_scope_verifier.mjs"
    ]
  });

  assert.equal(report.ok, true);
  assert.deepEqual(report.spillover, []);
});

test("passes when spillover file is explicitly allowlisted", () => {
  const repoRoot = makeRepo();

  seedScope(
    repoRoot,
    [
      "ci/scripts/run_freeze_mainline_mutation_scope_verifier.mjs"
    ],
    [
      "LOCKFILE_CHANGE_NOTE.md"
    ]
  );

  const report = verifyFreezeMainlineMutationScope({
    repoRoot,
    changedFiles: [
      "ci/scripts/run_freeze_mainline_mutation_scope_verifier.mjs",
      "LOCKFILE_CHANGE_NOTE.md"
    ]
  });

  assert.equal(report.ok, true);
  assert.deepEqual(report.spillover, []);
});

test("fails when changed file is outside freeze scope and not allowlisted", () => {
  const repoRoot = makeRepo();

  seedScope(
    repoRoot,
    [
      "ci/scripts/run_freeze_mainline_mutation_scope_verifier.mjs"
    ],
    [
      "LOCKFILE_CHANGE_NOTE.md"
    ]
  );

  assert.throws(
    () =>
      verifyFreezeMainlineMutationScope({
        repoRoot,
        changedFiles: [
          "ci/scripts/run_freeze_mainline_mutation_scope_verifier.mjs",
          "src/api/sessions.handlers.ts"
        ]
      }),
    (error) => {
      assert.equal(error.code, "FREEZE_MAINLINE_MUTATION_SCOPE_SPILLOVER_DETECTED");
      assert.match(JSON.stringify(error.details), /src\/api\/sessions\.handlers\.ts/);
      return true;
    }
  );
});

test("fails when scope manifest has overlap between freeze scope and allowlist", () => {
  const repoRoot = makeRepo();

  seedScope(
    repoRoot,
    [
      "ci/scripts/run_freeze_mainline_mutation_scope_verifier.mjs"
    ],
    [
      "ci/scripts/run_freeze_mainline_mutation_scope_verifier.mjs"
    ]
  );

  assert.throws(
    () =>
      verifyFreezeMainlineMutationScope({
        repoRoot,
        changedFiles: [
          "ci/scripts/run_freeze_mainline_mutation_scope_verifier.mjs"
        ]
      }),
    (error) => {
      assert.equal(error.code, "FREEZE_MAINLINE_MUTATION_SCOPE_OVERLAP_INVALID");
      return true;
    }
  );
});