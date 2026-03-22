import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("precommit smart workflow preserves docs fast-path, affected fast-path, and shared full gate", () => {
  const repo = process.cwd();
  const filePath = path.join(repo, "ci", "scripts", "precommit_smart.mjs");
  const source = fs.readFileSync(filePath, "utf8");

  assert.match(
    source,
    /\[pre-commit\] docs-only -> lint:fast/,
    "expected docs-only fast-path log to remain pinned"
  );

  assert.match(
    source,
    /\[pre-commit\] app\/test surface -> build:fast \+ test:affected/,
    "expected app/test surface to use build:fast plus test:affected"
  );

  assert.match(
    source,
    /sh\("npm run test:affected"\);/,
    "expected precommit smart workflow to invoke test:affected"
  );

  assert.match(
    source,
    /\[pre-commit\] shared\/full-risk surface -> green:fast/,
    "expected shared/full-risk surface to remain pinned to green:fast"
  );
});
