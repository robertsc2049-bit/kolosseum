import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const handlerPath = path.join(repoRoot, "src", "api", "sessions.handlers.ts");

test("planSession source contract: direct body and wrapped input share the same success delegation seam", () => {
  const source = fs.readFileSync(handlerPath, "utf8");

  assert.match(
    source,
    /if\s*\(isRecord\(bodyUnknown\)\)\s*\{[\s\S]*?input = \(body as any\)\.input \?\? body;[\s\S]*?\}/,
    "expected planSession to preserve direct-body and wrapped-input shared delegation seam"
  );

  assert.match(
    source,
    /return res\.status\(200\)\.json\(\{\s*ok: out\?\.ok === true,\s*session: out\?\.result\?\.session \?\? null,\s*trace: out\?\.trace \?\? null\s*\}\);/s,
    "expected planSession to preserve the shared flattened success response contract"
  );
});
