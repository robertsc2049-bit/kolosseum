import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const handlerPath = path.join(repoRoot, "src", "api", "sessions.handlers.ts");

test("planSession source contract: input envelope keeps strict precedence while sibling top-level fields remain rejected and success shape stays pinned for accepted paths", () => {
  const source = fs.readFileSync(handlerPath, "utf8");

  assert.match(
    source,
    /input = \(body as any\)\.input \?\? body;/,
    "expected planSession precedence to remain strict: body.input ?? body"
  );

  assert.match(
    source,
    /Unexpected top-level field\(s\):/,
    "expected planSession to reject unexpected sibling top-level fields when validating the input envelope shape"
  );

  assert.match(
    source,
    /return res\.status\(200\)\.json\(\{\s*ok: out\?\.ok === true,\s*session: out\?\.result\?\.session \?\? null,\s*trace: out\?\.trace \?\? null\s*\}\);/s,
    "expected planSession to preserve the flattened success response contract for accepted paths"
  );
});
