import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("handler delegation contracts manifest file remains pinned to the expected handler delegation contract tests", () => {
  const repo = process.cwd();
  const manifestPath = path.join(repo, "ci", "contracts", "handler_delegation_contracts_ci_cluster.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

  assert.equal(manifest.label, "handler delegation contracts ci cluster");
  assert.deepEqual(manifest.cluster, [
    "node test/api_handlers_plan_session_delegation.test.mjs",
    "node test/api_handlers_start_session_delegation.test.mjs",
    "node test/api_handlers_append_runtime_event_delegation.test.mjs"
  ]);
});