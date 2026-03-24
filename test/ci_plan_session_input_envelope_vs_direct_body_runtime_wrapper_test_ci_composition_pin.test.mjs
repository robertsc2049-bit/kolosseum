import test from "node:test";
import assert from "node:assert/strict";
import { composeTestCiFromIndex } from "../ci/scripts/compose_test_ci_from_index.mjs";

const DIRECT_VS_EMPTY_BOUNDARY_WRAPPER = "ci_api_plan_session_direct_vs_empty_body_boundary_runtime_contract_wrapper.test.mjs";
const INPUT_ENVELOPE_VS_DIRECT_BODY_WRAPPER = "ci_api_plan_session_input_envelope_vs_direct_body_runtime_contract_wrapper.test.mjs";

test("test:ci composition pins planSession input-envelope vs direct-body wrapper immediately after direct-vs-empty boundary wrapper", () => {
  const { commands } = composeTestCiFromIndex(process.cwd());

  assert.ok(Array.isArray(commands), "expected composed test:ci commands array");
  assert.ok(commands.length > 0, "expected non-empty composed test:ci commands");

  const directVsEmptyIdx = commands.findIndex((cmd) => cmd.includes(DIRECT_VS_EMPTY_BOUNDARY_WRAPPER));
  const inputEnvelopeIdx = commands.findIndex((cmd) => cmd.includes(INPUT_ENVELOPE_VS_DIRECT_BODY_WRAPPER));

  assert.notEqual(
    directVsEmptyIdx,
    -1,
    "expected direct-vs-empty boundary runtime wrapper in composed test:ci commands"
  );

  assert.notEqual(
    inputEnvelopeIdx,
    -1,
    "expected input-envelope vs direct-body runtime wrapper in composed test:ci commands"
  );

  assert.equal(
    inputEnvelopeIdx,
    directVsEmptyIdx + 1,
    "expected input-envelope vs direct-body runtime wrapper immediately after direct-vs-empty boundary runtime wrapper in composed test:ci commands"
  );
});
