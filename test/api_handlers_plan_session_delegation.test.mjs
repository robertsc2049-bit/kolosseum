import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const filePath = path.join(repoRoot, "src", "api", "sessions.handlers.ts");

test("sessions.handlers source contract: planSession preserves body.input ?? body delegation semantics and flattened 200 http response contract", () => {
  const source = fs.readFileSync(filePath, "utf8");

  assert.match(
    source,
    /if\s*\(isRecord\(bodyUnknown\)\)\s*\{[\s\S]*?input = \(body as any\)\.input \?\? body;[\s\S]*?\}/,
    "expected planSession to preserve wrapped-body delegation semantics"
  );

  assert.match(
    source,
    /return res\.status\(200\)\.json\(\{\s*ok: out\?\.ok === true,\s*session: out\?\.result\?\.session \?\? null,\s*trace: out\?\.trace \?\? null\s*\}\);/s,
    "expected planSession to preserve flattened 200 response contract"
  );
});
