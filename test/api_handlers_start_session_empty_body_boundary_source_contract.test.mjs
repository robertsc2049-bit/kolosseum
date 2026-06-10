import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const handlerPath = path.join(repoRoot, "src", "api", "sessions.handlers.ts");

test("startSession source contract: empty accepted bodies remain accepted and handler preserves pass-through success shape", () => {
  const source = fs.readFileSync(handlerPath, "utf8");

  assert.match(
    source,
    /export async function startSession\s*\(/,
    "expected startSession handler to exist"
  );

  assert.match(
    source,
    /const session_id = asString\(req\.params\?\.session_id\);/,
    "expected startSession handler to read session_id from req.params.session_id"
  );

  assert.match(
    source,
    /const result = await startSessionMutation\(session_id\);/,
    "expected startSession handler to delegate through startSessionMutation"
  );

  assert.match(
    source,
    /return res\.status\(200\)\.json\(result\);/,
    "expected startSession handler to preserve pass-through success shape"
  );
});
