import test from "node:test";
import assert from "node:assert/strict";

import { composeTestAffectedFromChangedFiles } from "../ci/scripts/compose_test_affected_from_changed_files.mjs";

test("test:affected mode=affected returns the tight mapped handler subset", () => {
  const repo = process.cwd();
  const out = composeTestAffectedFromChangedFiles(repo, [
    "src/api/sessions.handlers.ts",
    "test/api_handlers_plan_session_delegation.test.mjs",
    "ci/contracts/handler_delegation_contracts_ci_cluster.json"
  ]);

  assert.equal(out.mode, "affected");
  assert.ok(Array.isArray(out.commands));
  assert.ok(out.commands.length >= 4);
  assert.ok(out.commands.includes("node test/api_handlers_plan_session_delegation.test.mjs"));
  assert.ok(out.commands.includes("node test/ci_handler_delegation_contracts_cluster_manifest_file.test.mjs"));
  assert.ok(out.commands.includes("node test/ci_handler_delegation_contracts_cluster_manifest.test.mjs"));
  assert.ok(out.commands.includes("node test/ci_handler_delegation_contracts_manifest_file.test.mjs"));
  assert.ok(!out.commands.includes("npm run test:ci"));
  assert.ok(out.commands.every((cmd) => typeof cmd === "string" && cmd.startsWith("node test/")));
});

test("test:affected mode=empty returns no commands for docs-only changes", () => {
  const repo = process.cwd();
  const out = composeTestAffectedFromChangedFiles(repo, [
    "README.md",
    "docs/some_note.md"
  ]);

  assert.equal(out.mode, "empty");
  assert.deepEqual(out.commands, []);
  assert.equal(out.script, "");
});

test("test:affected mode=full expands to the concrete node-test CI command set", () => {
  const repo = process.cwd();
  const out = composeTestAffectedFromChangedFiles(repo, [
    "ci/scripts/precommit_smart.mjs"
  ]);

  assert.equal(out.mode, "full");
  assert.ok(Array.isArray(out.commands));
  assert.ok(out.commands.length > 10);
  assert.ok(out.commands.every((cmd) => typeof cmd === "string" && cmd.startsWith("node test/")));
  assert.ok(out.commands.some((cmd) => cmd.includes("ci_test_ci_composition.test.mjs")));
  assert.ok(out.commands.some((cmd) => cmd.includes("api_handlers_plan_session_delegation.test.mjs")));
  assert.ok(!out.commands.includes("npm run test:ci"));
});
