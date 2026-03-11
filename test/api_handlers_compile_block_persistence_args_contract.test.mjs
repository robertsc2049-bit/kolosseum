import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("blocks.handlers source contract: compileBlock delegates the full plain-args persistence seam without engine recompute drift", () => {
  const repo = process.cwd();
  const file = path.join(repo, "src", "api", "blocks.handlers.ts");
  const src = fs.readFileSync(file, "utf8");

  assert.match(
    src,
    /const\s+phase2_canonical_payload\s*=\s*\{\s*[\s\S]*phase2_canonical_json:\s*p2\.phase2\.phase2_canonical_json,\s*[\s\S]*phase2_hash:\s*p2\.phase2\.phase2_hash,\s*[\s\S]*canonical_input_hash:\s*p2\.phase2\.canonical_input_hash[\s\S]*\}/,
    "expected compileBlock to shape phase2_canonical_payload once before persistence delegation"
  );

  const callMatch = src.match(
    /persistCompiledBlockAndMaybeCreateSession\(\s*\{[\s\S]*?\}\s*\)/m
  );

  assert.ok(callMatch, "expected compileBlock to call persistCompiledBlockAndMaybeCreateSession({...})");

  const callSrc = callMatch[0];

  assert.match(
    callSrc,
    /engine_version/,
    "expected persistence seam to include engine_version"
  );
  assert.match(
    callSrc,
    /canonical_hash/,
    "expected persistence seam to include canonical_hash"
  );
  assert.match(
    callSrc,
    /canonical_input/,
    "expected persistence seam to include canonical_input"
  );
  assert.match(
    callSrc,
    /phase2_canonical_payload/,
    "expected persistence seam to include phase2_canonical_payload"
  );
  assert.match(
    callSrc,
    /phase3_output:\s*p3\.phase3/,
    "expected persistence seam to include phase3_output: p3.phase3"
  );
  assert.match(
    callSrc,
    /phase4_program:\s*p4\.program/,
    "expected persistence seam to include phase4_program: p4.program"
  );
  assert.match(
    callSrc,
    /phase5_adjustments/,
    "expected persistence seam to include phase5_adjustments"
  );
  assert.match(
    callSrc,
    /planned_session_from_engine/,
    "expected persistence seam to include planned_session_from_engine"
  );
  assert.match(
    callSrc,
    /create_session/,
    "expected persistence seam to include create_session"
  );

  assert.doesNotMatch(
    callSrc,
    /phase1_input/,
    "compileBlock must not pass raw phase1_input into the persistence seam"
  );
  assert.doesNotMatch(
    callSrc,
    /runtime_state/,
    "compileBlock must not pass runtime_state into the persistence seam"
  );
  assert.doesNotMatch(
    callSrc,
    /planned_session_applied/,
    "compileBlock must not pass response-shaped planned_session_applied into the persistence seam"
  );
});