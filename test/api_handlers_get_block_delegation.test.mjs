import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("blocks.handlers source contract: getBlock delegates block_id readback to getBlockByIdQuery and preserves notFound mapping", () => {
  const repo = process.cwd();
  const file = path.join(repo, "src", "api", "blocks.handlers.ts");
  const src = fs.readFileSync(file, "utf8");

  assert.match(
    src,
    /import\s*\{\s*getBlockByIdQuery\s*\}\s*from\s*"\.\/block_query_service\.js"/,
    "expected handler to import getBlockByIdQuery from extracted block query service"
  );

  assert.match(
    src,
    /export\s+async\s+function\s+getBlock\s*\(\s*req:\s*Request\s*,\s*res:\s*Response\s*\)/,
    "expected getBlock handler to exist"
  );

  assert.match(
    src,
    /const\s+block_id\s*=\s*asString\(req\.params\?\.block_id\);/,
    "expected getBlock to read block_id from req.params.block_id"
  );

  assert.match(
    src,
    /const\s+payload\s*=\s*await\s+getBlockByIdQuery\(block_id\);/,
    "expected getBlock to delegate readback to getBlockByIdQuery(block_id)"
  );

  assert.match(
    src,
    /if\s*\(!payload\)\s*throw\s+notFound\("Block not found"\);/,
    "expected getBlock to preserve explicit notFound mapping when no persisted block exists"
  );

  assert.match(
    src,
    /return\s+res\.json\(payload\);/,
    "expected getBlock to preserve JSON response payload from delegated query service"
  );
});