// DEV NOTE: S-V0-16 closes the HTTP API contract without creating new endpoint law.
// These tests bind route registration, handler delegation, stable status-code seams,
// and stable failure-token mappings. HTTP may shape transport responses, but it must
// not create separate runtime truth or mutate engine/session state outside delegated services.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repo = process.cwd();

function read(relPath) {
  return fs.readFileSync(path.join(repo, relPath), "utf8");
}

function requireMatch(src, regex, label) {
  assert.match(src, regex, label);
}

function requireAbsent(src, regex, label) {
  assert.doesNotMatch(src, regex, label);
}

test("S-V0-16 route contract: active v0 endpoint registrations remain explicit and bounded", () => {
  const blocksRoutes = read("src/api/blocks.routes.ts");
  const sessionsRoutes = read("src/api/sessions.routes.ts");
  const server = read("src/server.ts");

  requireMatch(
    blocksRoutes,
    /blocksRouter\.post\("\/compile",\s*compileBlock\);/,
    "POST /blocks/compile must remain registered through compileBlock"
  );

  requireMatch(
    sessionsRoutes,
    /sessionsRouter\.post\("\/plan",\s*asyncHandler\(planSession\)\);/,
    "POST /sessions/plan must remain registered through planSession"
  );

  requireMatch(
    sessionsRoutes,
    /sessionsRouter\.post\("\/:session_id\/start",\s*asyncHandler\(startSession\)\);/,
    "POST /sessions/:session_id/start must remain registered through startSession"
  );

  requireMatch(
    sessionsRoutes,
    /sessionsRouter\.post\("\/:session_id\/events",\s*asyncHandler\(appendRuntimeEvent\)\);/,
    "POST /sessions/:session_id/events must remain registered through appendRuntimeEvent"
  );

  requireMatch(
    sessionsRoutes,
    /sessionsRouter\.get\("\/:session_id\/events",\s*asyncHandler\(listRuntimeEvents\)\);/,
    "GET /sessions/:session_id/events must remain registered through listRuntimeEvents"
  );

  requireMatch(
    sessionsRoutes,
    /sessionsRouter\.get\("\/:session_id\/state",\s*asyncHandler\(getSessionState\)\);/,
    "GET /sessions/:session_id/state must remain registered through getSessionState"
  );

  requireMatch(
    server,
    /app\.get\("\/health",\s*\(_req,\s*res\)\s*=>\s*\{/,
    "GET /health must remain a server-level health endpoint"
  );

  requireMatch(server, /app\.use\("\/blocks",\s*blocksRouter\);/, "server must mount /blocks router");
  requireMatch(server, /app\.use\("\/sessions",\s*sessionsRouter\);/, "server must mount /sessions router");
});

test("S-V0-16 route contract: no new v1 HTTP endpoint is required for v0 closure", () => {
  const blocksRoutes = read("src/api/blocks.routes.ts");
  const sessionsRoutes = read("src/api/sessions.routes.ts");
  const server = read("src/server.ts");

  requireAbsent(blocksRoutes, /\/v1\//, "v0 blocks routes must not introduce a v1 route");
  requireAbsent(sessionsRoutes, /\/v1\//, "v0 sessions routes must not introduce a v1 route");
  requireAbsent(server, /app\.(get|post|put|patch|delete)\("\/v1\/(?!health)/, "server must not add new v1 product endpoints for S-V0-16");
});

test("S-V0-16 handler contract: session handlers delegate to services and preserve transport-only response status", () => {
  const src = read("src/api/sessions.handlers.ts");

  requireMatch(src, /import\s+\{\s*planSessionService\s*\}\s+from\s+"\.\/plan_session_service\.js";/, "planSession must use planSessionService");
  requireMatch(src, /\bappendRuntimeEventMutation\b/, "runtime write handlers must import appendRuntimeEventMutation");
  requireMatch(src, /\bextractRawEventFromBody\b/, "runtime write handlers must import extractRawEventFromBody");
  requireMatch(src, /\bstartSessionMutation\b/, "runtime write handlers must import startSessionMutation");
  requireMatch(src, /from\s+"\.\/session_state_write_service\.js";/, "runtime write handlers must delegate to write service");
  requireMatch(src, /\bgetSessionStateQuery\b/, "state handlers must import getSessionStateQuery");
  requireMatch(src, /\bgetDecisionSummaryByRunIdQuery\b/, "decision summary handler must import getDecisionSummaryByRunIdQuery");
  requireMatch(src, /from\s+"\.\/session_state_query_service\.js";/, "state handlers must delegate to query service");
  requireMatch(src, /import\s+\{\s*listRuntimeEventsQuery\s*\}\s+from\s+"\.\/session_events_query_service\.js";/, "event history handler must delegate to events query service");

  requireMatch(src, /const\s+out\s*=\s*await\s+planSessionService\(input\);/, "planSession must delegate normalized input once");
  requireMatch(src, /const\s+result\s*=\s*await\s+startSessionMutation\(session_id\);/, "startSession must delegate session_id to mutation service");
  requireMatch(src, /const\s+raw\s*=\s*extractRawEventFromBody\(req\.body\);[\s\S]*const\s+result\s*=\s*await\s+appendRuntimeEventMutation\(session_id,\s*raw\);/, "appendRuntimeEvent must extract raw event then delegate mutation");
  requireMatch(src, /const\s+statePayload\s*=\s*await\s+getSessionStateQuery\(session_id\);/, "appendRuntimeEvent must read delegated state after mutation");
  requireMatch(src, /const\s+payload\s*=\s*await\s+listRuntimeEventsQuery\(session_id\);/, "listRuntimeEvents must delegate event history");
  requireMatch(src, /const\s+payload\s*=\s*await\s+getSessionStateQuery\(session_id\);/, "getSessionState must delegate state read");

  requireMatch(src, /return\s+res\.status\(200\)\.json\(\{[\s\S]*ok:\s*out\?\.ok === true,[\s\S]*session:\s*out\?\.result\?\.session \?\? null,[\s\S]*trace:\s*out\?\.trace \?\? null[\s\S]*\}\);/, "planSession success status must remain 200 with flattened response");
  requireMatch(src, /return\s+res\.status\(200\)\.json\(result\);/, "startSession success status must remain 200");
  requireMatch(src, /return\s+res\.status\(201\)\.json\(\{[\s\S]*\.\.\.statePayload,[\s\S]*ok:\s*result\?\.ok === true,[\s\S]*session_id:\s*result\?\.session_id \?\? session_id,[\s\S]*seq:\s*result\?\.seq \?\? null[\s\S]*\}\);/, "appendRuntimeEvent success status must remain 201 with flattened delegated state plus mutation ack fields");
  requireMatch(src, /return\s+res\.json\(payload\);/, "read handlers must preserve direct delegated JSON response");
});

test("S-V0-16 handler contract: compile handler delegates engine phases, persistence, and runtime replay without response widening", () => {
  const src = read("src/api/blocks.handlers.ts");

  requireMatch(src, /phase1Validate\(/, "compileBlock must delegate Phase 1 validation");
  requireMatch(src, /phase2CanonicaliseAndHash\(/, "compileBlock must delegate Phase 2 canonicalisation/hash");
  requireMatch(src, /phase3ResolveConstraintsAndLoadRegistries\(/, "compileBlock must delegate Phase 3 registry/constraint resolution");
  requireMatch(src, /phase4AssembleProgram\(/, "compileBlock must delegate Phase 4 programme assembly");
  requireMatch(src, /phase6ProduceSessionOutput\(/, "compileBlock must delegate Phase 6 session output");
  requireMatch(src, /applyRuntimeEvents\(/, "compileBlock replay path must delegate runtime event application");
  requireMatch(src, /persistCompiledBlockAndMaybeCreateSession\(\s*\{[\s\S]*planned_session_from_engine,[\s\S]*create_session[\s\S]*\}\s*\)/, "compileBlock must delegate persistence and optional session creation");
  requireMatch(src, /const\s+status\s*=\s*create_session\s*\?\s*201\s*:\s*\(persisted\.created_block\s*\?\s*201\s*:\s*200\);/, "compileBlock status mapping must remain stable");
    requireMatch(src, /return\s+res\.status\(status\)\.json\(/, "compileBlock must emit one status-bound JSON response");

  requireAbsent(src, /response\.phase1_input\b/, "compileBlock response must not expose raw phase1_input");
  requireAbsent(src, /response\.phase2_canonical_payload\b/, "compileBlock response must not expose phase2_canonical_payload");
  requireAbsent(src, /response\.phase3_output\b/, "compileBlock response must not expose phase3_output");
  requireAbsent(src, /response\.phase4_program\b/, "compileBlock response must not expose phase4_program");
  requireAbsent(src, /response\.phase5_adjustments\b/, "compileBlock response must not expose phase5_adjustments");
});

test("S-V0-16 error contract: HTTP helpers preserve stable status-code transport mapping", () => {
  const src = read("src/api/http_errors.ts");

  requireMatch(src, /export\s+function\s+badRequest\([\s\S]*status:\s*400/, "badRequest must preserve HTTP 400");
  requireMatch(src, /export\s+function\s+notFound\([\s\S]*status:\s*404/, "notFound must preserve HTTP 404");
  requireMatch(src, /export\s+function\s+conflict\([\s\S]*status:\s*409/, "conflict must preserve HTTP 409");
  requireMatch(src, /export\s+function\s+internalError\([\s\S]*status:\s*500/, "internalError must preserve HTTP 500");
});

test("S-V0-16 error contract: runtime failure tokens remain stable across compile and event append paths", () => {
  const blocks = read("src/api/blocks.handlers.ts");
  const write = read("src/api/session_state_write_service.ts");

  for (const src of [blocks, write]) {
    requireMatch(src, /phase6_runtime_await_return_decision/, "await-return-decision token must remain stable");
    requireMatch(src, /phase6_runtime_unknown_event/, "unknown runtime event token must remain stable");
    requireMatch(src, /phase6_runtime_invalid_event/, "invalid runtime event token must remain stable");
  }

  requireMatch(
    write,
    /phase6_runtime_resolved_return_decision_replay/,
    "resolved return-decision replay token must remain stable"
  );

  requireMatch(
    write,
    /phase6_runtime_resolved_exercise_replay/,
    "resolved exercise replay token must remain stable"
  );
});

test("S-V0-16 read contract: state and event-history query services are read-only surfaces", () => {
  const stateQuery = read("src/api/session_state_query_service.ts");
  const eventsQuery = read("src/api/session_events_query_service.ts");

  requireMatch(stateQuery, /export\s+async\s+function\s+getSessionStateQuery\(session_id:\s*string\)/, "state query export must remain explicit");
  requireMatch(eventsQuery, /export\s+async\s+function\s+listRuntimeEventsQuery\(session_id:\s*string\)/, "event history query export must remain explicit");

  requireAbsent(stateQuery, /\bINSERT\s+INTO\s+runtime_events\b/i, "state query must not insert runtime events");
  requireAbsent(stateQuery, /\bUPDATE\s+runtime_events\b/i, "state query must not update runtime events");
  requireAbsent(eventsQuery, /\bINSERT\s+INTO\s+runtime_events\b/i, "event history query must not insert runtime events");
  requireAbsent(eventsQuery, /\bUPDATE\s+runtime_events\b/i, "event history query must not update runtime events");
});