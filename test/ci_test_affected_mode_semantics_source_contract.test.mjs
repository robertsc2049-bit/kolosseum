import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("compose_test_affected_from_changed_files source pins explicit empty/affected/full semantics", () => {
  const repo = process.cwd();
  const sourcePath = path.join(repo, "ci/scripts/compose_test_affected_from_changed_files.mjs");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /mode:\s*"empty"/);
  assert.match(source, /mode:\s*"affected"/);
  assert.match(source, /mode:\s*"full"/);

  assert.match(source, /commands:\s*\[\]/);
  assert.match(source, /script:\s*""/);

  assert.match(source, /composeTestCiFromIndex\(repo\)/);

  assert.doesNotMatch(source, /\[\s*"npm run test:ci"\s*\]/);
});
