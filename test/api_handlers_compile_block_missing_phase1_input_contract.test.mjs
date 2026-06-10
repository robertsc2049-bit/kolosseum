import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("compileBlock source contract: missing phase1_input fails fast with badRequest before any engine phase work", () => {
  const repo = process.cwd();
  const file = path.join(repo, "src", "api", "blocks.handlers.ts");
  const src = fs.readFileSync(file, "utf8");

  assert.match(
    src,
    /if\s*\(!Object\.prototype\.hasOwnProperty\.call\(body,\s*"phase1_input"\)\)\s*\{\s*throw badRequest\("Missing phase1_input"\);\s*\}/,
    "expected compileBlock to reject missing phase1_input with badRequest('Missing phase1_input')"
  );

  assert.match(
    src,
    /throw badRequest\("Missing phase1_input"\);[\s\S]*const\s+p1\s*=\s*phase1Validate\(body\.phase1_input\);/,
    "expected missing phase1_input guard to run before phase1Validate(body.phase1_input)"
  );
});