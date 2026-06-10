import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("block handler delegation contracts manifest file remains pinned to the expected handler delegation contract tests", () => {
  const repo = process.cwd();
  const manifestPath = path.join(repo, "ci", "contracts", "block_handler_delegation_contracts_ci_cluster.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

  assert.equal(manifest.label, "block handler delegation contracts ci cluster");
  assert.deepEqual(manifest.cluster, [
    "node test/api_handlers_get_block_delegation.test.mjs",
    "node test/api_handlers_create_session_from_block_delegation.test.mjs",
    "node test/api_handlers_list_block_sessions_delegation.test.mjs",
    "node test/ci_api_get_block_executed_handler_http_contract_wrapper.test.mjs",
    "node test/ci_api_create_session_from_block_executed_handler_http_contract_wrapper.test.mjs",
    "node test/ci_api_list_block_sessions_executed_handler_http_contract_wrapper.test.mjs"
  ]);
});