import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("sessions.handlers source contract: planSession delegates body.input ?? body to planSessionService and preserves flattened 200 http response contract", () => {
  const repo = process.cwd();
  const file = path.join(repo, "src", "api", "sessions.handlers.ts");
  const src = fs.readFileSync(file, "utf8");

  assert.match(
    src,
    /import\s*\{\s*planSessionService\s*\}\s*from\s*"\.\/plan_session_service\.js"/,
    "expected handler to import planSessionService from extracted service module"
  );

  assert.match(
    src,
    /if\s*\(isRecord\(bodyUnknown\)\)\s*input\s*=\s*\(bodyUnknown as any\)\.input\s*\?\?\s*bodyUnknown;/s,
    "expected planSession to unwrap body.input ?? body"
  );

  assert.match(
    src,
    /const\s+out\s*=\s*await\s+planSessionService\(input\);/s,
    "expected planSession to delegate to planSessionService(input)"
  );

  assert.match(
    src,
    /return\s+res\.status\(200\)\.json\(\{\s*ok:\s*out\?\.\s*ok\s*===\s*true,\s*session:\s*out\?\.\s*result\?\.\s*session\s*\?\?\s*null,\s*trace:\s*out\?\.\s*trace\s*\?\?\s*null\s*\}\);/s,
    "expected planSession to preserve flattened 200 http response contract"
  );
});
