import test from "node:test";
import assert from "node:assert/strict";
import { composeTestCiFromIndex } from "../ci/scripts/compose_test_ci_from_index.mjs";

const INVALID_BODY_WRAPPER = "ci_api_plan_session_invalid_body_runtime_contract_wrapper.test.mjs";
const UNDECLARED_FIELDS_WRAPPER = "ci_api_plan_session_undeclared_top_level_fields_runtime_contract_wrapper.test.mjs";
const SUCCESS_PARITY_WRAPPER = "ci_api_plan_session_success_parity_runtime_contract_wrapper.test.mjs";

test("test:ci composition pins planSession success parity runtime wrapper immediately after undeclared-fields runtime wrapper", () => {
  const { commands } = composeTestCiFromIndex(process.cwd());

  assert.ok(Array.isArray(commands), "expected composed test:ci commands array");
  assert.ok(commands.length > 0, "expected non-empty composed test:ci commands");

  const invalidIdx = commands.findIndex((cmd) => cmd.includes(INVALID_BODY_WRAPPER));
  const undeclaredIdx = commands.findIndex((cmd) => cmd.includes(UNDECLARED_FIELDS_WRAPPER));
  const parityIdx = commands.findIndex((cmd) => cmd.includes(SUCCESS_PARITY_WRAPPER));

  assert.notEqual(
    invalidIdx,
    -1,
    "expected invalid-body runtime wrapper in composed test:ci commands"
  );

  assert.notEqual(
    undeclaredIdx,
    -1,
    "expected undeclared-fields runtime wrapper in composed test:ci commands"
  );

  assert.notEqual(
    parityIdx,
    -1,
    "expected success parity runtime wrapper in composed test:ci commands"
  );

  assert.equal(
    undeclaredIdx,
    invalidIdx + 1,
    "expected undeclared-fields runtime wrapper immediately after invalid-body runtime wrapper in composed test:ci commands"
  );

  assert.equal(
    parityIdx,
    undeclaredIdx + 1,
    "expected success parity runtime wrapper immediately after undeclared-fields runtime wrapper in composed test:ci commands"
  );
});
