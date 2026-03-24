import test from "node:test";
import assert from "node:assert/strict";
import { composeTestCiFromIndex } from "../ci/scripts/compose_test_ci_from_index.mjs";

const SERVICE_WRAPPER = "ci_api_plan_session_service_contract_wrapper.test.mjs";
const INVALID_BODY_WRAPPER = "ci_api_plan_session_invalid_body_runtime_contract_wrapper.test.mjs";
const UNDECLARED_FIELDS_WRAPPER = "ci_api_plan_session_undeclared_top_level_fields_runtime_contract_wrapper.test.mjs";

test("test:ci composition pins planSession runtime boundary wrappers immediately after the planSession service wrapper", () => {
  const { commands } = composeTestCiFromIndex(process.cwd());

  assert.ok(Array.isArray(commands), "expected composed test:ci commands array");
  assert.ok(commands.length > 0, "expected non-empty composed test:ci commands");

  const serviceIdx = commands.findIndex((cmd) => cmd.includes(SERVICE_WRAPPER));
  const invalidIdx = commands.findIndex((cmd) => cmd.includes(INVALID_BODY_WRAPPER));
  const undeclaredIdx = commands.findIndex((cmd) => cmd.includes(UNDECLARED_FIELDS_WRAPPER));

  assert.notEqual(
    serviceIdx,
    -1,
    "expected planSession service wrapper in composed test:ci commands"
  );

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

  assert.equal(
    invalidIdx,
    serviceIdx + 1,
    "expected invalid-body runtime wrapper immediately after planSession service wrapper in composed test:ci commands"
  );

  assert.equal(
    undeclaredIdx,
    invalidIdx + 1,
    "expected undeclared-fields runtime wrapper immediately after invalid-body runtime wrapper in composed test:ci commands"
  );
});
