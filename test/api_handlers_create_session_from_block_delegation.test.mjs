import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("blocks.handlers source contract: createSessionFromBlock delegates block_id + planned_session to createSessionFromBlockMutation and returns 201", () => {
  const repo = process.cwd();
  const file = path.join(repo, "src", "api", "blocks.handlers.ts");
  const src = fs.readFileSync(file, "utf8");

  assert.match(
    src,
    /import\s*\{\s*createSessionFromBlockMutation\s*\}\s*from\s*"\.\/block_session_write_service\.js"/,
    "expected handler to import createSessionFromBlockMutation from extracted block session write service"
  );

  assert.match(
    src,
    /export\s+async\s+function\s+createSessionFromBlock\s*\(\s*req:\s*Request\s*,\s*res:\s*Response\s*\)/,
    "expected createSessionFromBlock handler to exist"
  );

  assert.match(
    src,
    /const\s+block_id\s*=\s*asString\(req\.params\?\.block_id\);/,
    "expected createSessionFromBlock to read block_id from req.params.block_id"
  );

  assert.match(
    src,
    /const\s+planned_session\s*=\s*\(req\.body\s+as\s+any\)\?\.planned_session\s+as\s+Phase6SessionOutput\s+\|\s+undefined;/,
    "expected createSessionFromBlock to read planned_session from req.body.planned_session"
  );

  assert.match(
    src,
    /const\s+result\s*=\s*await\s+createSessionFromBlockMutation\(block_id,\s*planned_session\);/,
    "expected createSessionFromBlock to delegate to createSessionFromBlockMutation(block_id, planned_session)"
  );

  assert.match(
    src,
    /return\s+res\.status\(201\)\.json\(result\);/,
    "expected createSessionFromBlock to preserve 201 JSON response"
  );
});