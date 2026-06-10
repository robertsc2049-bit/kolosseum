import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("compileBlock source contract: response allowlist stays stable after persistence delegation", () => {
  const repo = process.cwd();
  const file = path.join(repo, "src", "api", "blocks.handlers.ts");
  const src = fs.readFileSync(file, "utf8");

  assert.match(
    src,
    /const\s+payload:\s*any\s*=\s*\{[\s\S]*block_id:\s*persisted\.persisted_block_id,[\s\S]*engine_version,[\s\S]*canonical_hash,[\s\S]*planned_session:\s*planned_session_applied,[\s\S]*runtime_trace:\s*runtime_trace_from_engine[\s\S]*\};/,
    "expected compileBlock payload allowlist to stay limited to block_id, engine_version, canonical_hash, planned_session, and runtime_trace"
  );

  assert.doesNotMatch(
    src,
    /const\s+payload:\s*any\s*=\s*\{[\s\S]*phase1_input[\s\S]*\};/,
    "compileBlock response payload must not leak phase1_input"
  );

  assert.doesNotMatch(
    src,
    /const\s+payload:\s*any\s*=\s*\{[\s\S]*phase2_canonical_payload[\s\S]*\};/,
    "compileBlock response payload must not leak phase2_canonical_payload"
  );

  assert.doesNotMatch(
    src,
    /const\s+payload:\s*any\s*=\s*\{[\s\S]*phase3_output[\s\S]*\};/,
    "compileBlock response payload must not leak phase3_output"
  );

  assert.doesNotMatch(
    src,
    /const\s+payload:\s*any\s*=\s*\{[\s\S]*phase4_program[\s\S]*\};/,
    "compileBlock response payload must not leak phase4_program"
  );

  assert.doesNotMatch(
    src,
    /const\s+payload:\s*any\s*=\s*\{[\s\S]*phase5_adjustments[\s\S]*\};/,
    "compileBlock response payload must not leak phase5_adjustments"
  );

  assert.doesNotMatch(
    src,
    /const\s+payload:\s*any\s*=\s*\{[\s\S]*runtime_state[\s\S]*\};/,
    "compileBlock response payload must not leak raw runtime_state"
  );
});