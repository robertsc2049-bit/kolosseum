import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("sessions.handlers source contract: listRuntimeEvents delegates params.session_id to listRuntimeEventsQuery and preserves JSON payload", () => {
  const repo = process.cwd();
  const file = path.join(repo, "src", "api", "sessions.handlers.ts");
  const src = fs.readFileSync(file, "utf8");

  assert.match(
    src,
    /import\s*\{\s*listRuntimeEventsQuery\s*\}\s*from\s*"\.\/session_events_query_service\.js"/,
    "expected handler to import listRuntimeEventsQuery from extracted events query service"
  );

  assert.match(
    src,
    /const\s+session_id\s*=\s*asString\(req\.params\?\.session_id\);/,
    "expected listRuntimeEvents to read params.session_id"
  );

  assert.match(
    src,
    /if\s*\(!session_id\)\s*throw\s+badRequest\("Missing session_id"\);/,
    "expected listRuntimeEvents to preserve missing session_id guard"
  );

  assert.match(
    src,
    /const\s+payload\s*=\s*await\s+listRuntimeEventsQuery\(session_id\);/,
    "expected listRuntimeEvents to delegate to listRuntimeEventsQuery(session_id)"
  );

  assert.match(
    src,
    /return\s+res\.json\(payload\);/,
    "expected listRuntimeEvents to preserve direct JSON response contract"
  );
});