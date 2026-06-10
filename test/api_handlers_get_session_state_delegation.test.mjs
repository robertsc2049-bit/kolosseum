import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repo = process.cwd();

test("sessions.handlers source contract: getSessionState delegates params.session_id to getSessionStateQuery and preserves JSON payload", () => {
  const file = path.join(repo, "src", "api", "sessions.handlers.ts");
  const src = fs.readFileSync(file, "utf8");

  assert.match(
    src,
    /import\s*\{[\s\S]*getSessionStateQuery[\s\S]*\}\s*from\s*"\.\/session_state_query_service\.js";/,
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

test("sessions.handlers source contract: getDecisionSummaryByRunId delegates params.run_id to getDecisionSummaryByRunIdQuery and preserves JSON payload", () => {
  const file = path.join(repo, "src", "api", "sessions.handlers.ts");
  const src = fs.readFileSync(file, "utf8");

  assert.match(
    src,
    /import\s*\{[\s\S]*getDecisionSummaryByRunIdQuery[\s\S]*\}\s*from\s*"\.\/session_state_query_service\.js";/,
    "expected handler to import getDecisionSummaryByRunIdQuery from query service"
  );

  assert.match(
    src,
    /export\s+async\s+function\s+getDecisionSummaryByRunId\s*\(req:\s*Request,\s*res:\s*Response\)\s*\{/,
    "expected getDecisionSummaryByRunId handler to be exported"
  );

  assert.match(
    src,
    /const\s+run_id\s*=\s*asString\(req\.params\?\.run_id\);/,
    "expected getDecisionSummaryByRunId to read params.run_id"
  );

  assert.match(
    src,
    /if\s*\(!run_id\)\s*throw\s+badRequest\("Missing run_id"\);/,
    "expected getDecisionSummaryByRunId to preserve missing run_id guard"
  );

  assert.match(
    src,
    /const\s+payload\s*=\s*await\s+getDecisionSummaryByRunIdQuery\(run_id\);/,
    "expected getDecisionSummaryByRunId to delegate to getDecisionSummaryByRunIdQuery(run_id)"
  );

  assert.match(
    src,
    /return\s+res\.json\(payload\);/,
    "expected getDecisionSummaryByRunId to preserve direct JSON response contract"
  );
});
