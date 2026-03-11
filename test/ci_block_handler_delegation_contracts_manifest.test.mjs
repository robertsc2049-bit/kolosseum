import test from "node:test";
import assert from "node:assert/strict";
import { composeTestCiFromIndex } from "../ci/scripts/compose_test_ci_from_index.mjs";

test("block handler delegation contracts manifest remains present in composed test:ci command set", () => {
  const repo = process.cwd();
  const { commands } = composeTestCiFromIndex(repo);

  for (const cmd of [
    "node test/api_handlers_create_session_from_block_delegation.test.mjs",
    "node test/api_handlers_list_block_sessions_delegation.test.mjs"
  ]) {
    assert.ok(commands.includes(cmd), `expected ${cmd} in composed test:ci command set`);
  }
});