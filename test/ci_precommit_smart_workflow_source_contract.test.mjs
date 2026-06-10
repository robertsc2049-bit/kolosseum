import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("precommit smart source pins docs fast-path, affected fast-path, workflow-contract affected routing, and shared full gate", () => {
  const repo = process.cwd();
  const sourcePath = path.join(repo, "ci/scripts/precommit_smart.mjs");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /\[pre-commit\] docs fast-path -> skip heavy checks/);
  assert.match(source, /\[pre-commit\] app\/test surface -> build:fast \+ test:affected/);
  assert.match(source, /\[pre-commit\] affected-workflow contract tests -> build:fast \+ test:affected/);
  assert.match(source, /\[pre-commit\] shared\/full-risk surface -> green:fast/);

  assert.match(source, /AFFECTED_WORKFLOW_CONTRACT_TESTS/);
  assert.match(source, /SHARED_FULL_RISK_FILES/);
  assert.match(source, /test\/ci_precommit_smart_routing_contract\.test\.mjs/);
  assert.match(source, /test\/ci_test_affected_mode_semantics_source_contract\.test\.mjs/);
  assert.match(source, /ci\/scripts\/compose_test_affected_from_changed_files\.mjs/);
  assert.match(source, /ci\/scripts\/run_test_affected_from_changed_files\.mjs/);
});
