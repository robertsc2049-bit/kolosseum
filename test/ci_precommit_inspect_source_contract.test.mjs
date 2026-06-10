import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("precommit inspector source pins visible output shape and package entrypoint", () => {
  const repo = process.cwd();

  const scriptPath = path.join(repo, "ci/scripts/precommit_inspect.mjs");
  const script = fs.readFileSync(scriptPath, "utf8");

  assert.match(script, /== Precommit Route Inspector ==/);
  assert.match(script, /Route kind:/);
  assert.match(script, /Banner:/);
  assert.match(script, /Commands:/);
  assert.match(script, /usage: npm run precommit:inspect -- <file1> <file2> \.\.\./);
  assert.match(script, /getPrecommitRoute/);

  const packageJson = JSON.parse(fs.readFileSync(path.join(repo, "package.json"), "utf8"));
  assert.equal(
    packageJson.scripts["precommit:inspect"],
    "node ci/scripts/precommit_inspect.mjs"
  );
});
