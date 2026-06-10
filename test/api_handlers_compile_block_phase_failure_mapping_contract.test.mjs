import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("compileBlock source contract: phase failure branches preserve explicit badRequest failure-token mapping", () => {
  const repo = process.cwd();
  const file = path.join(repo, "src", "api", "blocks.handlers.ts");
  const src = fs.readFileSync(file, "utf8");

  assert.match(
    src,
    /if\s*\(!p1\.ok\)\s*\{\s*throw badRequest\("Phase 1 failed",\s*\{\s*failure_token:\s*p1\.failure_token,\s*details:\s*p1\.details\s*\}\);\s*\}/,
    "expected Phase 1 failure branch to preserve failure_token/details mapping"
  );

  assert.match(
    src,
    /if\s*\(!p2\.ok\)\s*\{\s*throw badRequest\("Phase 2 failed",\s*\{\s*failure_token:\s*p2\.failure_token,\s*details:\s*p2\.details\s*\}\);\s*\}/,
    "expected Phase 2 failure branch to preserve failure_token/details mapping"
  );

  assert.match(
    src,
    /if\s*\(!p3\.ok\)\s*\{\s*throw badRequest\("Phase 3 failed",\s*\{\s*failure_token:\s*p3\.failure_token,\s*details:\s*p3\.details\s*\}\);\s*\}/,
    "expected Phase 3 failure branch to preserve failure_token/details mapping"
  );

  assert.match(
    src,
    /if\s*\(!p4\.ok\)\s*\{\s*throw badRequest\("Phase 4 failed",\s*\{\s*failure_token:\s*p4\.failure_token,\s*details:\s*p4\.details\s*\}\);\s*\}/,
    "expected Phase 4 failure branch to preserve failure_token/details mapping"
  );

  assert.match(
    src,
    /if\s*\(!p6\.ok\)\s*\{\s*throw badRequest\("Phase 6 failed",\s*\{\s*failure_token:\s*p6\.failure_token,\s*details:\s*p6\.details\s*\}\);\s*\}/,
    "expected Phase 6 failure branch to preserve failure_token/details mapping"
  );

  assert.match(
    src,
    /if\s*\(apply_phase5\)\s*\{\s*throw badRequest\("Phase 5 compile not implemented",\s*\{\s*failure_token:\s*"phase5_compile_not_implemented"\s*\}\);\s*\}/,
    "expected apply_phase5 branch to preserve the explicit phase5_compile_not_implemented contract"
  );
});