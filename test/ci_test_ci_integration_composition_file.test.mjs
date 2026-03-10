import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  TEST_CI_INTEGRATION_COMPOSITION_PATH,
  composeTestCiIntegrationCommands
} from "../ci/scripts/compose_test_ci_integration_from_index.mjs";

test("test:ci:integration composition file is well-formed and expands to unique node-test-only commands", () => {
  const raw = fs.readFileSync(TEST_CI_INTEGRATION_COMPOSITION_PATH, "utf8");
  const index = JSON.parse(raw);

  assert.ok(index && typeof index === "object" && !Array.isArray(index), "expected composition object");
  assert.ok(Array.isArray(index.items), "expected composition.items array");
  assert.ok(index.items.length > 0, "expected non-empty composition.items");

  for (const item of index.items) {
    assert.equal(typeof item.id, "string", "expected item.id");
    assert.equal(typeof item.manifest, "string", "expected item.manifest");
    assert.ok(fs.existsSync(path.resolve(item.manifest)), `expected manifest to exist: ${item.manifest}`);
    assert.ok(Array.isArray(item.guards), `expected guards array for ${item.id}`);
    assert.equal(item.guards.length, 2, `expected adjacent guard pair for ${item.id}`);
    for (const command of item.guards) {
      assert.match(command, /^node test\/.+\.test\.mjs$/, `expected node-test-only guard command: ${command}`);
    }
  }

  const commands = composeTestCiIntegrationCommands();
  assert.ok(commands.length > 0, "expected non-empty composed commands");

  const uniqueCommands = new Set(commands);
  assert.equal(uniqueCommands.size, commands.length, "expected unique composed commands");

  for (const command of commands) {
    assert.match(command, /^node test\/.+\.test\.mjs$/, `expected node-test-only command: ${command}`);
  }
});