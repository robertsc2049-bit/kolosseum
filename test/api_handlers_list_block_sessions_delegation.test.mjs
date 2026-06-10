import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("blocks.handlers source contract: listBlockSessions delegates block_id to listBlockSessionsQuery and preserves JSON payload", () => {
  const repo = process.cwd();
  const file = path.join(repo, "src", "api", "blocks.handlers.ts");
  const src = fs.readFileSync(file, "utf8");

  assert.match(
    src,
    /import\s*\{\s*listBlockSessionsQuery\s*\}\s*from\s*"\.\/block_session_query_service\.js"/,
    "expected handler to import listBlockSessionsQuery from extracted block session query service"
  );

  assert.match(
    src,
    /export\s+async\s+function\s+listBlockSessions\s*\(\s*req:\s*Request\s*,\s*res:\s*Response\s*\)/,
    "expected listBlockSessions handler to exist"
  );

  assert.match(
    src,
    /const\s+block_id\s*=\s*asString\(req\.params\?\.block_id\);/,
    "expected listBlockSessions to read block_id from req.params.block_id"
  );

  assert.match(
    src,
    /const\s+payload\s*=\s*await\s+listBlockSessionsQuery\(block_id\);/,
    "expected listBlockSessions to delegate to listBlockSessionsQuery(block_id)"
  );

  assert.match(
    src,
    /return\s+res\.json\(payload\);/,
    "expected listBlockSessions to preserve JSON payload response"
  );
});