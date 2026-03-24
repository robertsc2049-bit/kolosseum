import test from "node:test";
import assert from "node:assert/strict";
import { composeTestCiFromIndex } from "../ci/scripts/compose_test_ci_from_index.mjs";

const SUCCESS_PARITY_WRAPPER = "ci_api_plan_session_success_parity_runtime_contract_wrapper.test.mjs";
const EMPTY_BODY_PARITY_WRAPPER = "ci_api_plan_session_empty_body_success_parity_runtime_contract_wrapper.test.mjs";

test("test:ci composition pins planSession empty-body success parity runtime wrapper immediately after wrapped-input success parity runtime wrapper", () => {
  const { commands } = composeTestCiFromIndex(process.cwd());

  assert.ok(Array.isArray(commands), "expected composed test:ci commands array");
  assert.ok(commands.length > 0, "expected non-empty composed test:ci commands");

  const successParityIdx = commands.findIndex((cmd) => cmd.includes(SUCCESS_PARITY_WRAPPER));
  const emptyBodyParityIdx = commands.findIndex((cmd) => cmd.includes(EMPTY_BODY_PARITY_WRAPPER));

  assert.notEqual(
    successParityIdx,
    -1,
    "expected wrapped-input success parity runtime wrapper in composed test:ci commands"
  );

  assert.notEqual(
    emptyBodyParityIdx,
    -1,
    "expected empty-body success parity runtime wrapper in composed test:ci commands"
  );

  assert.equal(
    emptyBodyParityIdx,
    successParityIdx + 1,
    "expected empty-body success parity runtime wrapper immediately after wrapped-input success parity runtime wrapper in composed test:ci commands"
  );
});
