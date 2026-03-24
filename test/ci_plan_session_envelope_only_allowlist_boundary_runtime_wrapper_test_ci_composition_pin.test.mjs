import test from "node:test";
import assert from "node:assert/strict";
import { composeTestCiFromIndex } from "../ci/scripts/compose_test_ci_from_index.mjs";

const NESTED_INPUT_PRECEDENCE_WRAPPER = "ci_api_plan_session_nested_input_precedence_boundary_runtime_contract_wrapper.test.mjs";
const ENVELOPE_ONLY_ALLOWLIST_WRAPPER = "ci_api_plan_session_envelope_only_allowlist_boundary_runtime_contract_wrapper.test.mjs";

test("test:ci composition pins planSession envelope-only allowlist wrapper immediately after nested-input precedence wrapper", () => {
  const { commands } = composeTestCiFromIndex(process.cwd());

  assert.ok(Array.isArray(commands), "expected composed test:ci commands array");
  assert.ok(commands.length > 0, "expected non-empty composed test:ci commands");

  const nestedInputPrecedenceIdx = commands.findIndex((cmd) => cmd.includes(NESTED_INPUT_PRECEDENCE_WRAPPER));
  const envelopeOnlyAllowlistIdx = commands.findIndex((cmd) => cmd.includes(ENVELOPE_ONLY_ALLOWLIST_WRAPPER));

  assert.notEqual(
    nestedInputPrecedenceIdx,
    -1,
    "expected nested-input precedence runtime wrapper in composed test:ci commands"
  );

  assert.notEqual(
    envelopeOnlyAllowlistIdx,
    -1,
    "expected envelope-only allowlist runtime wrapper in composed test:ci commands"
  );

  assert.equal(
    envelopeOnlyAllowlistIdx,
    nestedInputPrecedenceIdx + 1,
    "expected envelope-only allowlist runtime wrapper immediately after nested-input precedence runtime wrapper in composed test:ci commands"
  );
});
