/* test/api.blocks_compile_runtime_trace_contract.regression.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("API regression: compile runtime_trace is allowlisted and does not leak legacy gate fields", async () => {
  const repo = process.cwd();
  const target = path.join(repo, "src", "api", "blocks.handlers.ts");
  const src = fs.readFileSync(target, "utf8");

  assert.match(
    src,
    /const\s*\{\s*[\s\S]*split_active:\s*_legacySplitActive[\s\S]*remaining_at_split_ids:\s*_legacyRemainingAtSplitIds[\s\S]*return_gate_required:\s*_legacyReturnGateRequired[\s\S]*return_decision_required:\s*_derivedReturnDecisionRequired[\s\S]*return_decision_options:\s*_derivedReturnDecisionOptions[\s\S]*\.\.\.traceBase[\s\S]*\}\s*=\s*rt\s+as\s+Record<string,\s*any>;/,
    "expected compile handler to rebuild runtime_trace from an allowlisted projection"
  );

  assert.match(
    src,
    /const\s+runtime_trace_from_engine\s*=\s*\{\s*[\s\S]*remaining_ids,\s*[\s\S]*completed_ids,\s*[\s\S]*dropped_ids,\s*[\s\S]*return_decision_required,\s*[\s\S]*return_decision_options\s*[\s\S]*\};/,
    "expected compile response runtime_trace to contain only explicit public fields"
  );

  assert.doesNotMatch(
    src,
    /delete\s+runtime_state\.split_active|delete\s+runtime_state\.remaining_at_split_ids|delete\s+runtime_state\.return_gate_required|delete\s+rt\.split_active|delete\s+rt\.remaining_at_split_ids|delete\s+rt\.return_gate_required/,
    "compile handler must not rely on delete-style legacy field cleanup"
  );
});