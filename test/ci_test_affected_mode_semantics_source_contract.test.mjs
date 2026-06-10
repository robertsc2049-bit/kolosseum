
// DEV NOTE: Human-maintained repo surface. Keep this file aligned with canonical contracts,
// deterministic checks, and developer handover standards. Do not introduce hidden defaults,
// broad discovery, or unreviewed boundary changes.

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
