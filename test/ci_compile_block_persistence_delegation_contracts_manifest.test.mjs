import test from "node:test";
import assert from "node:assert/strict";
import { composeTestCiFromIndex } from "../ci/scripts/compose_test_ci_from_index.mjs";

test("compile block persistence delegation contracts manifest remains present in composed test:ci command set", () => {
  const repo = process.cwd();
  const { commands } = composeTestCiFromIndex(repo);

  for (const cmd of [
    "node test/api_handlers_compile_block_persistence_delegation.test.mjs",
    "node test/ci_api_block_compile_write_service_contract_wrapper.test.mjs"
  ]) {
    assert.ok(commands.includes(cmd), `expected ${cmd} in composed test:ci command set`);
  }
});