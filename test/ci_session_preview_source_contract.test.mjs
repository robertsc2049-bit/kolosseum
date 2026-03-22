import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("session preview source pins summary formatting, intensity formatting, and package entrypoint", () => {
  const repo = process.cwd();

  const scriptPath = path.join(repo, "ci/scripts/session_preview.mjs");
  const source = fs.readFileSync(scriptPath, "utf8");

  assert.match(source, /printHeader\("SUMMARY"\)/);
  assert.match(source, /printHeader\("NOTES"\)/);
  assert.match(source, /printHeader\("SESSION"\)/);
  assert.match(source, /function formatIntensity\(value\)/);
  assert.match(source, /percent_1rm/);
  assert.match(source, /Total work sets:/);
  assert.match(source, /dist\/src\/run_pipeline_cli\.js/);

  const packageJson = JSON.parse(
    fs.readFileSync(path.join(repo, "package.json"), "utf8").replace(/^\uFEFF/, "")
  );

  assert.equal(packageJson.scripts["session:preview"], "node ci/scripts/session_preview.mjs");
});
