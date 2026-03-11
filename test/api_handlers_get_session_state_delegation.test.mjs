import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("sessions.handlers source contract: getSessionState delegates params.session_id to getSessionStateQuery and preserves JSON payload", () => {
  const repo = process.cwd();
  const file = path.join(repo, "src", "api", "sessions.handlers.ts");
  const src = fs.readFileSync(file, "utf8");

  assert.match(
    src,
    /import\s*\{\s*getSessionStateQuery\s*\}\s*from\s*"\.\/session_state_query_service\.js"/,
    "expected handler to import getSessionStateQuery from extracted query service"
  );

  assert.match(
    src,
    /const\s+session_id\s*=\s*asString\(req\.params\?\.session_id\);/,
    "expected getSessionState to read params.session_id"
  );

  assert.match(
    src,
    /if\s*\(!session_id\)\s*throw\s+badRequest\("Missing session_id"\);/,
    "expected getSessionState to preserve missing session_id guard"
  );

  assert.match(
    src,
    /const\s+payload\s*=\s*await\s+getSessionStateQuery\(session_id\);/,
    "expected getSessionState to delegate to getSessionStateQuery(session_id)"
  );

  assert.match(
    src,
    /return\s+res\.json\(payload\);/,
    "expected getSessionState to preserve direct JSON response contract"
  );
});