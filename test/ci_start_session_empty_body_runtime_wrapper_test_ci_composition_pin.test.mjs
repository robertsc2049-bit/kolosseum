import test from "node:test";
import assert from "node:assert/strict";
import { composeTestCiFromIndex } from "../ci/scripts/compose_test_ci_from_index.mjs";

const PLAN_SESSION_ENVELOPE_ONLY_ALLOWLIST_WRAPPER = "ci_api_plan_session_envelope_only_allowlist_boundary_runtime_contract_wrapper.test.mjs";
const START_SESSION_EMPTY_BODY_WRAPPER = "ci_api_start_session_empty_body_boundary_runtime_contract_wrapper.test.mjs";

test("test:ci composition pins startSession empty-body wrapper immediately after the final planSession envelope-only allowlist wrapper", () => {
  const { commands } = composeTestCiFromIndex(process.cwd());

  assert.ok(Array.isArray(commands), "expected composed test:ci commands array");
  assert.ok(commands.length > 0, "expected non-empty composed test:ci commands");

  const planSessionEnvelopeIdx = commands.findIndex((cmd) => cmd.includes(PLAN_SESSION_ENVELOPE_ONLY_ALLOWLIST_WRAPPER));
  const startSessionEmptyBodyIdx = commands.findIndex((cmd) => cmd.includes(START_SESSION_EMPTY_BODY_WRAPPER));

  assert.notEqual(
    planSessionEnvelopeIdx,
    -1,
    "expected planSession envelope-only allowlist runtime wrapper in composed test:ci commands"
  );

  assert.notEqual(
    startSessionEmptyBodyIdx,
    -1,
    "expected startSession empty-body runtime wrapper in composed test:ci commands"
  );

  assert.equal(
    startSessionEmptyBodyIdx,
    planSessionEnvelopeIdx + 1,
    "expected startSession empty-body runtime wrapper immediately after the final planSession envelope-only allowlist runtime wrapper"
  );
});
