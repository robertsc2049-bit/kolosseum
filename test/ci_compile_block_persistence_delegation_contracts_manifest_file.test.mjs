import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("compile block persistence delegation contracts manifest file remains pinned to the expected contract tests", () => {
  const repo = process.cwd();
  const manifestPath = path.join(repo, "ci", "contracts", "compile_block_persistence_delegation_contracts_ci_cluster.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

  assert.equal(manifest.label, "compile block persistence delegation contracts ci cluster");
  assert.deepEqual(manifest.cluster, [
    "node test/api_handlers_compile_block_persistence_delegation.test.mjs",
    "node test/api_handlers_compile_block_persistence_args_contract.test.mjs",
    "node test/api_handlers_compile_block_response_contract.test.mjs",
    "node test/api_handlers_compile_block_missing_phase1_input_contract.test.mjs",
    "node test/api_handlers_compile_block_phase_failure_mapping_contract.test.mjs",
    "node test/api_handlers_compile_block_create_session_response_contract.test.mjs",
    "node test/api_handlers_compile_block_runtime_event_error_contract.test.mjs",
    "node test/api_handlers_compile_block_response_allowlist_contract.test.mjs",
    "node test/ci_api_block_compile_write_service_contract_wrapper.test.mjs"
  ]);
});