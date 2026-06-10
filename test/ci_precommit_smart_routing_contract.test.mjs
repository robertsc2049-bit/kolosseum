import test from "node:test";
import assert from "node:assert/strict";

import { getPrecommitRoute } from "../ci/scripts/precommit_smart.mjs";

test("precommit smart keeps pure affected-workflow contract tests on the affected fast path", () => {
  const out = getPrecommitRoute([
    "test/ci_test_affected_composition.test.mjs",
    "test/ci_test_affected_script.test.mjs",
    "test/ci_test_affected_mode_semantics_source_contract.test.mjs",
    "test/ci_precommit_smart_workflow_source_contract.test.mjs",
    "test/ci_precommit_smart_routing_contract.test.mjs"
  ]);

  assert.equal(out.kind, "affected");
  assert.deepEqual(out.commands, [
    "npm run build:fast",
    "npm run test:affected"
  ]);
  assert.match(out.banner, /affected-workflow contract tests/);
});

test("precommit smart escalates to full when actual workflow engine files change", () => {
  const out = getPrecommitRoute([
    "test/ci_precommit_smart_routing_contract.test.mjs",
    "ci/scripts/compose_test_affected_from_changed_files.mjs"
  ]);

  assert.equal(out.kind, "full");
  assert.deepEqual(out.commands, ["npm run green:fast"]);
  assert.match(out.banner, /shared\/full-risk surface/);
});

test("precommit smart keeps docs-only changes on the docs fast path", () => {
  const out = getPrecommitRoute([
    "README.md",
    "docs/workflows/precommit.md"
  ]);

  assert.equal(out.kind, "docs");
  assert.deepEqual(out.commands, []);
  assert.match(out.banner, /docs fast-path/);
});
