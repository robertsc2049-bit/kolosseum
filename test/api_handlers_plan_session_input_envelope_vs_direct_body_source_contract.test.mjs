import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const handlerPath = path.join(repoRoot, "src", "api", "sessions.handlers.ts");

test("planSession source contract: explicit input envelope and direct body preserve parity while success shape stays flattened", () => {
  const source = fs.readFileSync(handlerPath, "utf8");

  assert.match(
    source,
    /input = \(body as any\)\.input \?\? body;/,
    "expected planSession to prefer body.input when present and otherwise delegate the direct body"
  );

  assert.match(
    source,
    /return res\.status\(200\)\.json\(\{\s*ok: out\?\.ok === true,\s*session: out\?\.result\?\.session \?\? null,\s*trace: out\?\.trace \?\? null\s*\}\);/s,
    "expected planSession to preserve the flattened success response contract"
  );
});
