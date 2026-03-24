import test from "node:test";
import assert from "node:assert/strict";
import { composeTestCiFromIndex } from "../ci/scripts/compose_test_ci_from_index.mjs";

const EMPTY_BODY_PARITY_WRAPPER = "ci_api_plan_session_empty_body_success_parity_runtime_contract_wrapper.test.mjs";
const DIRECT_VS_EMPTY_BOUNDARY_WRAPPER = "ci_api_plan_session_direct_vs_empty_body_boundary_runtime_contract_wrapper.test.mjs";

test("test:ci composition pins planSession direct-vs-empty boundary runtime wrapper immediately after empty-body success parity runtime wrapper", () => {
  const { commands } = composeTestCiFromIndex(process.cwd());

  assert.ok(Array.isArray(commands), "expected composed test:ci commands array");
  assert.ok(commands.length > 0, "expected non-empty composed test:ci commands");

  const emptyBodyParityIdx = commands.findIndex((cmd) => cmd.includes(EMPTY_BODY_PARITY_WRAPPER));
  const directVsEmptyBoundaryIdx = commands.findIndex((cmd) => cmd.includes(DIRECT_VS_EMPTY_BOUNDARY_WRAPPER));

  assert.notEqual(
    emptyBodyParityIdx,
    -1,
    "expected empty-body success parity runtime wrapper in composed test:ci commands"
  );

  assert.notEqual(
    directVsEmptyBoundaryIdx,
    -1,
    "expected direct-vs-empty boundary runtime wrapper in composed test:ci commands"
  );

  assert.equal(
    directVsEmptyBoundaryIdx,
    emptyBodyParityIdx + 1,
    "expected direct-vs-empty boundary runtime wrapper immediately after empty-body success parity runtime wrapper in composed test:ci commands"
  );
});
