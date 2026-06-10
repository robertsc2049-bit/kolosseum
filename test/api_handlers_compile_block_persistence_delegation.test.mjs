import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("blocks.handlers source contract: compileBlock delegates transactional persistence to persistCompiledBlockAndMaybeCreateSession and preserves response shaping", () => {
  const repo = process.cwd();
  const file = path.join(repo, "src", "api", "blocks.handlers.ts");
  const src = fs.readFileSync(file, "utf8");

  assert.match(
    src,
    /import\s*\{\s*persistCompiledBlockAndMaybeCreateSession\s*\}\s*from\s*"\.\/block_compile_write_service\.js"/,
    "expected handler to import persistCompiledBlockAndMaybeCreateSession from extracted compile write service"
  );

  assert.match(
    src,
    /const\s+phase2_canonical_payload\s*=\s*\{/,
    "expected compileBlock to shape phase2_canonical_payload before delegating"
  );

  assert.match(
    src,
    /const\s+persisted\s*=\s*await\s+persistCompiledBlockAndMaybeCreateSession\(\s*\{[\s\S]*engine_version,[\s\S]*canonical_hash,[\s\S]*canonical_input,[\s\S]*phase2_canonical_payload,[\s\S]*phase3_output:\s*p3\.phase3,[\s\S]*phase4_program:\s*p4\.program,[\s\S]*phase5_adjustments,[\s\S]*planned_session_from_engine,[\s\S]*create_session[\s\S]*\}\s*\)/,
    "expected compileBlock to delegate persistence inputs to persistCompiledBlockAndMaybeCreateSession(...)"
  );

  assert.match(
    src,
    /const\s+status\s*=\s*create_session\s*\?\s*201\s*:\s*\(persisted\.created_block\s*\?\s*201\s*:\s*200\);/,
    "expected compileBlock to preserve status shaping from delegated persistence result"
  );

  assert.match(
    src,
    /block_id:\s*persisted\.persisted_block_id,/,
    "expected compileBlock response to use persisted.persisted_block_id"
  );

  assert.match(
    src,
    /if\s*\(persisted\.session_id\)\s*payload\.session_id\s*=\s*persisted\.session_id;/,
    "expected compileBlock response to preserve optional persisted.session_id"
  );
});