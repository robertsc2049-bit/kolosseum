import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("compileBlock source contract: create_session branch preserves 201 semantics and optional session_id emission", () => {
  const repo = process.cwd();
  const file = path.join(repo, "src", "api", "blocks.handlers.ts");
  const src = fs.readFileSync(file, "utf8");

  assert.match(
    src,
    /const\s+create_session\s*=\s*asBoolQuery\(\(req\.query as any\)\?\.create_session\);/,
    "expected compileBlock to derive create_session from the querystring"
  );

  assert.match(
    src,
    /const\s+status\s*=\s*create_session\s*\?\s*201\s*:\s*\(persisted\.created_block\s*\?\s*201\s*:\s*200\);/,
    "expected create_session=true to force 201 regardless of created_block"
  );

  assert.match(
    src,
    /if\s*\(persisted\.session_id\)\s*payload\.session_id\s*=\s*persisted\.session_id;/,
    "expected compileBlock to emit session_id only when persistence returned one"
  );
});