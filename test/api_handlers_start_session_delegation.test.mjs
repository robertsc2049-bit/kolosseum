import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("sessions.handlers source contract: startSession delegates params.session_id to startSessionMutation and returns 200", () => {
  const repo = process.cwd();
  const file = path.join(repo, "src", "api", "sessions.handlers.ts");
  const src = fs.readFileSync(file, "utf8");

  assert.match(
    src,
    /import\s*\{[\s\S]*\bstartSessionMutation\b[\s\S]*\}\s*from\s*"\.\/session_state_write_service\.js"/,
    "expected handler to import startSessionMutation from extracted write service"
  );

  assert.match(
    src,
    /const\s+session_id\s*=\s*asString\(req\.params\?\.session_id\);/,
    "expected startSession to read params.session_id"
  );

  assert.match(
    src,
    /if\s*\(!session_id\)\s*throw\s+badRequest\("Missing session_id"\);/,
    "expected startSession to preserve missing session_id guard"
  );

  assert.match(
    src,
    /const\s+result\s*=\s*await\s+startSessionMutation\(session_id\);/,
    "expected startSession to delegate to startSessionMutation(session_id)"
  );

  assert.match(
    src,
    /return\s+res\.status\(200\)\.json\(result\);/,
    "expected startSession to preserve 200 JSON response contract"
  );
});