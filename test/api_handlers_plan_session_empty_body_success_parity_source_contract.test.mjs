import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const handlerPath = path.join(repoRoot, "src", "api", "sessions.handlers.ts");

test("planSession source contract: undefined and null bodies share the same empty-input success seam", () => {
  const source = fs.readFileSync(handlerPath, "utf8");

  assert.match(
    source,
    /else if \(typeof bodyUnknown === "undefined" \|\| bodyUnknown === null\) input = \{\};/,
    "expected planSession to preserve shared {} normalization for undefined and null bodies"
  );

  assert.match(
    source,
    /return res\.status\(200\)\.json\(\{\s*ok: out\?\.ok === true,\s*session: out\?\.result\?\.session \?\? null,\s*trace: out\?\.trace \?\? null\s*\}\);/s,
    "expected planSession to preserve the flattened success response contract for empty accepted bodies"
  );
});
