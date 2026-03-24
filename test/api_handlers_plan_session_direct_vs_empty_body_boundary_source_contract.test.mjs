import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const handlerPath = path.join(repoRoot, "src", "api", "sessions.handlers.ts");

test("planSession source contract: non-empty direct body remains distinct from empty accepted bodies while sharing the same success shape", () => {
  const source = fs.readFileSync(handlerPath, "utf8");

  assert.match(
    source,
    /if\s*\(isRecord\(bodyUnknown\)\)\s*\{[\s\S]*?input = \(body as any\)\.input \?\? body;[\s\S]*?\}/,
    "expected planSession to preserve direct-body delegation for non-empty record bodies"
  );

  assert.match(
    source,
    /else if \(typeof bodyUnknown === "undefined" \|\| bodyUnknown === null\) input = \{\};/,
    "expected planSession to preserve {} normalization for empty accepted bodies"
  );

  assert.match(
    source,
    /return res\.status\(200\)\.json\(\{\s*ok: out\?\.ok === true,\s*session: out\?\.result\?\.session \?\? null,\s*trace: out\?\.trace \?\? null\s*\}\);/s,
    "expected planSession to preserve the shared flattened success response contract across direct and empty accepted bodies"
  );
});
