import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("blocks.handlers source contract: compileBlock preserves delegated persistence response contract without drift", () => {
  const repo = process.cwd();
  const file = path.join(repo, "src", "api", "blocks.handlers.ts");
  const src = fs.readFileSync(file, "utf8");

  assert.match(
    src,
    /const\s+persisted\s*=\s*await\s+persistCompiledBlockAndMaybeCreateSession\(/,
    "expected compileBlock to source its persistence result from persistCompiledBlockAndMaybeCreateSession(...)"
  );

  assert.match(
    src,
    /const\s+status\s*=\s*create_session\s*\?\s*201\s*:\s*\(persisted\.created_block\s*\?\s*201\s*:\s*200\);/,
    "expected compileBlock to preserve 201\/200 response status mapping from delegated persistence result"
  );

  assert.match(
    src,
    /const\s+payload:\s*any\s*=\s*\{[\s\S]*block_id:\s*persisted\.persisted_block_id,[\s\S]*engine_version,[\s\S]*canonical_hash,[\s\S]*planned_session:\s*planned_session_applied,[\s\S]*runtime_trace:\s*runtime_trace_from_engine[\s\S]*\};/,
    "expected compileBlock response payload to preserve block_id, engine_version, canonical_hash, planned_session, and runtime_trace after delegation"
  );

  assert.match(
    src,
    /if\s*\(persisted\.session_id\)\s*payload\.session_id\s*=\s*persisted\.session_id;/,
    "expected compileBlock to preserve optional persisted.session_id in the response payload"
  );

  assert.match(
    src,
    /return\s+res\.status\(status\)\.json\(payload\);/,
    "expected compileBlock to preserve status+json response emission after delegation"
  );
});