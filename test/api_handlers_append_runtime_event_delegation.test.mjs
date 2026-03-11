import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("sessions.handlers source contract: appendRuntimeEvent extracts raw body event, delegates once, and returns 201", () => {
  const repo = process.cwd();
  const file = path.join(repo, "src", "api", "sessions.handlers.ts");
  const src = fs.readFileSync(file, "utf8");

  assert.match(
    src,
    /import\s*\{[\s\S]*\bappendRuntimeEventMutation\b[\s\S]*\bextractRawEventFromBody\b[\s\S]*\}\s*from\s*"\.\/session_state_write_service\.js"/,
    "expected handler to import appendRuntimeEventMutation and extractRawEventFromBody from extracted write service"
  );

  assert.match(
    src,
    /const\s+session_id\s*=\s*asString\(req\.params\?\.session_id\);/,
    "expected appendRuntimeEvent to read params.session_id"
  );

  assert.match(
    src,
    /if\s*\(!session_id\)\s*throw\s+badRequest\("Missing session_id"\);/,
    "expected appendRuntimeEvent to preserve missing session_id guard"
  );

  assert.match(
    src,
    /const\s+raw\s*=\s*extractRawEventFromBody\(req\.body\);/,
    "expected appendRuntimeEvent to normalize request body through extractRawEventFromBody"
  );

  assert.match(
    src,
    /const\s+result\s*=\s*await\s+appendRuntimeEventMutation\(session_id,\s*raw\);/,
    "expected appendRuntimeEvent to delegate to appendRuntimeEventMutation(session_id, raw)"
  );

  assert.match(
    src,
    /return\s+res\.status\(201\)\.json\(result\);/,
    "expected appendRuntimeEvent to preserve 201 JSON response contract"
  );
});