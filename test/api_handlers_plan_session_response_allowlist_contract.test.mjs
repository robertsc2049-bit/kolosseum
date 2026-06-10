import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const handlerPath = path.join(repoRoot, "src", "api", "sessions.handlers.ts");

test("planSession handler source contract: success response is pinned to explicit flattened top-level allowlist", () => {
  const source = fs.readFileSync(handlerPath, "utf8");

  assert.match(
    source,
    /const out = await planSessionService\(input\);/,
    "expected planSession to preserve service delegation seam"
  );

  assert.match(
    source,
    /return res\.status\(200\)\.json\(\{\s*ok: out\?\.ok === true,\s*session: out\?\.result\?\.session \?\? null,\s*trace: out\?\.trace \?\? null\s*\}\);/s,
    "expected planSession success response to remain pinned to the explicit flattened allowlist"
  );

  assert.doesNotMatch(
    source,
    /return res\.status\(200\)\.json\(out\);/,
    "planSession must not leak the raw service payload directly"
  );

  assert.doesNotMatch(
    source,
    /session_id:\s*out\?\./,
    "planSession handler must not widen the flattened response with session_id"
  );

  assert.doesNotMatch(
    source,
    /status:\s*out\?\./,
    "planSession handler must not widen the flattened response with status"
  );

  assert.doesNotMatch(
    source,
    /block_id:\s*out\?\./,
    "planSession handler must not widen the flattened response with block_id"
  );

  assert.doesNotMatch(
    source,
    /athlete_id:\s*out\?\./,
    "planSession handler must not widen the flattened response with athlete_id"
  );

  assert.doesNotMatch(
    source,
    /created_at:\s*out\?\./,
    "planSession handler must not widen the flattened response with created_at"
  );

  assert.doesNotMatch(
    source,
    /updated_at:\s*out\?\./,
    "planSession handler must not widen the flattened response with updated_at"
  );
});
