import assert from "node:assert/strict";
import test from "node:test";

// NOTE: update these imports to match the repo's existing return-gate test file.
import { compileRuntimeTrace } from "../src/phase6/compile_runtime_trace.js";
import { applyRuntimeEvents } from "../src/phase6/apply_runtime_events.js";

test("Phase6 runtime trace: return_skip clears explicit return decision contract and advances state with partial/skip semantics", () => {
  const compiled = compileRuntimeTrace({
    // mirror the arrange block from the existing RETURN_CONTINUE test
    // so this test differs only in event choice + assertions
  });

  assert.ok(compiled, "expected compiled runtime trace");
  assert.ok(compiled.return_decision, "expected explicit return decision gate before skip");

  const afterSkip = applyRuntimeEvents(compiled, [
    { type: "RETURN_SKIP" }
  ]);

  assert.ok(afterSkip, "expected runtime trace after skip");
  assert.equal(afterSkip.return_decision ?? null, null, "expected return gate cleared after skip");

  // tighten these once you align to repo structure
  assert.ok(
    afterSkip.current_step || afterSkip.current_block || afterSkip.state,
    "expected deterministic advanced state after skip"
  );

  const asJson = JSON.stringify(afterSkip);
  assert.equal(asJson.includes('"return_decision"'), false, "expected no lingering explicit return gate field after skip");
});