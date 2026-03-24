import test from "node:test";
import assert from "node:assert/strict";
import { composeTestCiFromIndex } from "../ci/scripts/compose_test_ci_from_index.mjs";

const INPUT_ENVELOPE_VS_DIRECT_BODY_WRAPPER = "ci_api_plan_session_input_envelope_vs_direct_body_runtime_contract_wrapper.test.mjs";
const NESTED_INPUT_PRECEDENCE_WRAPPER = "ci_api_plan_session_nested_input_precedence_boundary_runtime_contract_wrapper.test.mjs";

test("test:ci composition pins planSession nested-input precedence wrapper immediately after input-envelope vs direct-body wrapper", () => {
  const { commands } = composeTestCiFromIndex(process.cwd());

  assert.ok(Array.isArray(commands), "expected composed test:ci commands array");
  assert.ok(commands.length > 0, "expected non-empty composed test:ci commands");

  const inputEnvelopeIdx = commands.findIndex((cmd) => cmd.includes(INPUT_ENVELOPE_VS_DIRECT_BODY_WRAPPER));
  const nestedInputPrecedenceIdx = commands.findIndex((cmd) => cmd.includes(NESTED_INPUT_PRECEDENCE_WRAPPER));

  assert.notEqual(
    inputEnvelopeIdx,
    -1,
    "expected input-envelope vs direct-body runtime wrapper in composed test:ci commands"
  );

  assert.notEqual(
    nestedInputPrecedenceIdx,
    -1,
    "expected nested-input precedence runtime wrapper in composed test:ci commands"
  );

  assert.equal(
    nestedInputPrecedenceIdx,
    inputEnvelopeIdx + 1,
    "expected nested-input precedence runtime wrapper immediately after input-envelope vs direct-body runtime wrapper in composed test:ci commands"
  );
});
