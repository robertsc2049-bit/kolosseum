import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

test("precommit inspector prints docs route visibly and human-readably", () => {
  const out = execFileSync(
    process.execPath,
    ["ci/scripts/precommit_inspect.mjs", "README.md"],
    { encoding: "utf8" }
  );

  assert.match(out, /== Precommit Route Inspector ==/);
  assert.match(out, /Route kind: docs/);
  assert.match(out, /Banner: \[pre-commit\] docs fast-path -> skip heavy checks/);
  assert.match(out, /Commands:\n\(none\)/);
  assert.match(out, /Files \(1\):\n- README\.md/);
});

test("precommit inspector prints affected route commands visibly", () => {
  const out = execFileSync(
    process.execPath,
    ["ci/scripts/precommit_inspect.mjs", "test/ci_test_affected_composition.test.mjs"],
    { encoding: "utf8" }
  );

  assert.match(out, /Route kind: affected/);
  assert.match(out, /Commands:\n- npm run build:fast\n- npm run test:affected/);
});
