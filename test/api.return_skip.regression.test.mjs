import assert from "node:assert/strict";
import test from "node:test";

// NOTE: align imports/helpers with existing api.return_gate.regression.test.mjs
import { compileRuntimeTrace } from "../src/phase6/compile_runtime_trace.js";
import { applyRuntimeEvents } from "../src/phase6/apply_runtime_events.js";

test("API regression: split return decision gate accepts RETURN_SKIP and advances without re-opening the same gate", () => {
  const compiled = compileRuntimeTrace({
    // copy the fixture/setup style from api.return_gate.regression.test.mjs
  });

  assert.ok(compiled.return_decision, "expected explicit return decision gate");

  const afterSkip = applyRuntimeEvents(compiled, [
    { type: "RETURN_SKIP" }
  ]);

  assert.equal(afterSkip.return_decision ?? null, null, "expected return gate cleared");
  assert.notDeepEqual(afterSkip, compiled, "expected state to advance");
});