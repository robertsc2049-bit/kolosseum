import test from "node:test";
import assert from "node:assert/strict";

import { composeTestAffectedFromChangedFiles } from "../ci/scripts/compose_test_affected_from_changed_files.mjs";

test("test:affected composes a tight handler subset for mapped handler/test/manifest changes", () => {
  const repo = process.cwd();
  const out = composeTestAffectedFromChangedFiles(repo, [
    "src/api/sessions.handlers.ts",
    "test/api_handlers_plan_session_delegation.test.mjs",
    "ci/contracts/handler_delegation_contracts_ci_cluster.json"
  ]);

  assert.equal(out.mode, "affected");
  assert.ok(out.commands.includes("node test/api_handlers_plan_session_delegation.test.mjs"));
  assert.ok(out.commands.includes("node test/ci_handler_delegation_contracts_cluster_manifest_file.test.mjs"));
  assert.ok(out.commands.includes("node test/ci_handler_delegation_contracts_cluster_manifest.test.mjs"));
  assert.ok(out.commands.includes("node test/ci_handler_delegation_contracts_manifest_file.test.mjs"));
  assert.ok(!out.commands.includes("npm run test:ci"));
});

test("test:affected returns empty for docs-only changes", () => {
  const repo = process.cwd();
  const out = composeTestAffectedFromChangedFiles(repo, [
    "README.md",
    "docs/some_note.md"
  ]);

  assert.equal(out.mode, "empty");
  assert.deepEqual(out.commands, []);
});

test("test:affected falls back to full test:ci for shared workflow infra changes", () => {
  const repo = process.cwd();
  const out = composeTestAffectedFromChangedFiles(repo, [
    "ci/scripts/precommit_smart.mjs"
  ]);

  assert.equal(out.mode, "full");

  // correct contract: full expansion, not wrapper
  assert.ok(Array.isArray(out.commands));
  assert.ok(out.commands.length > 10);

  // sanity: must include known CI test
  assert.ok(out.commands.some(cmd => cmd.includes("ci_test_ci_composition.test.mjs")));
});
