import test, { mock } from "node:test";
import assert from "node:assert/strict";

const distHttpErrorsUrl = new URL("../dist/src/api/http_errors.js", import.meta.url).href;
const distSessionStateQueryUrl = new URL("../dist/src/api/session_state_query_service.js", import.meta.url).href;
const distSessionStateWriteUrl = new URL("../dist/src/api/session_state_write_service.js", import.meta.url).href;
const distPlanSessionServiceUrl = new URL("../dist/src/api/plan_session_service.js", import.meta.url).href;
const distSessionEventsQueryUrl = new URL("../dist/src/api/session_events_query_service.js", import.meta.url).href;
const distPoolUrl = new URL("../dist/src/db/pool.js", import.meta.url).href;
const distHandlerUrl = new URL("../dist/src/api/sessions.handlers.js", import.meta.url).href;

let getSessionStateQueryImpl = async (sessionId) => ({
  session_id: sessionId,
  trace: {}
});

let getDecisionSummaryByRunIdQueryImpl = async (runId) => ({
  identity: { run_id: runId },
  audit: { source: "engine_run", resolved_from: "run_id" }
});

mock.module(distHttpErrorsUrl, {
  namedExports: {
    badRequest(message, extras = undefined) {
      return Object.assign(new Error(message), { status: 400, extras });
    },
    notFound(message, extras = undefined) {
      return Object.assign(new Error(message), { status: 404, extras });
    },
    internalError(message, extras = undefined) {
      return Object.assign(new Error(message), { status: 500, extras });
    },
    conflict(message, extras = undefined) {
      return Object.assign(new Error(message), { status: 409, extras });
    },
    upstreamBadGateway(message, extras = undefined) {
      return Object.assign(new Error(message), { status: 502, extras });
    }
  }
});

mock.module(distPoolUrl, {
  namedExports: {
    pool: {
      connect: async () => ({
        query: async () => ({ rowCount: 0, rows: [] }),
        release() {}
      })
    }
  }
});

mock.module(distSessionStateQueryUrl, {
  namedExports: {
    async getSessionStateQuery(sessionId) {
      return await getSessionStateQueryImpl(sessionId);
    },
    async getDecisionSummaryByRunIdQuery(runId) {
      return await getDecisionSummaryByRunIdQueryImpl(runId);
    }
  }
});

mock.module(distSessionStateWriteUrl, {
  namedExports: {
    async startSessionMutation(sessionId) {
      return { session_id: sessionId, started: true };
    },
    extractRawEventFromBody(body) {
      return body;
    },
    async appendRuntimeEventMutation(sessionId, raw) {
      return { session_id: sessionId, accepted: true, event: raw };
    }
  }
});

mock.module(distPlanSessionServiceUrl, {
  namedExports: {
    async planSessionService(input) {
      return { ok: true, input };
    }
  }
});

mock.module(distSessionEventsQueryUrl, {
  namedExports: {
    async listRuntimeEventsQuery(sessionId) {
      return { session_id: sessionId, events: [] };
    }
  }
});

function makeReq(params = {}, body = undefined) {
  return { params, body };
}

function makeRes() {
  return {
    statusCode: 200,
    jsonBody: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.jsonBody = payload;
      return this;
    }
  };
}

test("getSessionState executed path: returns 200 with delegated JSON payload when query succeeds", async () => {
  getSessionStateQueryImpl = async (sessionId) => ({
    session_id: sessionId,
    current_step: null,
    trace: { started: true }
  });

  const { getSessionState } = await import(`${distHandlerUrl}?case=get_session_state_ok`);
  const req = makeReq({ session_id: "s_exec_ok" });
  const res = makeRes();

  await getSessionState(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.jsonBody, {
    session_id: "s_exec_ok",
    current_step: null,
    trace: { started: true }
  });
});

test("getSessionState executed path: missing session_id throws 400 badRequest", async () => {
  const { getSessionState } = await import(`${distHandlerUrl}?case=get_session_state_missing_session_id`);
  const req = makeReq({});
  const res = makeRes();

  await assert.rejects(
    () => getSessionState(req, res),
    (error) => {
      assert.equal(error.status, 400);
      assert.equal(error.message, "Missing session_id");
      return true;
    }
  );
});

test("getSessionState executed path: delegated not-found error preserves explicit error contract", async () => {
  getSessionStateQueryImpl = async () => {
    throw Object.assign(new Error("Session not found"), {
      status: 404,
      extras: { failure_token: "session_not_found" }
    });
  };

  const { getSessionState } = await import(`${distHandlerUrl}?case=get_session_state_not_found`);
  const req = makeReq({ session_id: "missing_session" });
  const res = makeRes();

  await assert.rejects(
    () => getSessionState(req, res),
    (error) => {
      assert.equal(error.status, 404);
      assert.equal(error.message, "Session not found");
      return true;
    }
  );
});

test("getDecisionSummaryByRunId executed path: returns 200 with delegated JSON payload when query succeeds", async () => {
  getDecisionSummaryByRunIdQueryImpl = async (runId) => ({
    schema: { version: "v1" },
    identity: { run_id: runId },
    currentness: { state: "current" },
    outcome: { decision: { selected: "keep_plan" } },
    drivers: [{ code: "timebox_ok" }],
    timeline: {
      created_at: "2026-03-21T12:00:00.000Z",
      completed_at: "2026-03-21T12:05:00.000Z"
    },
    audit: {
      source: "engine_run",
      resolved_from: "run_id"
    },
    issues: []
  });

  const { getDecisionSummaryByRunId } = await import(`${distHandlerUrl}?case=get_decision_summary_ok`);
  const req = makeReq({ run_id: "er_http_001" });
  const res = makeRes();

  await getDecisionSummaryByRunId(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.jsonBody, {
    schema: { version: "v1" },
    identity: { run_id: "er_http_001" },
    currentness: { state: "current" },
    outcome: { decision: { selected: "keep_plan" } },
    drivers: [{ code: "timebox_ok" }],
    timeline: {
      created_at: "2026-03-21T12:00:00.000Z",
      completed_at: "2026-03-21T12:05:00.000Z"
    },
    audit: {
      source: "engine_run",
      resolved_from: "run_id"
    },
    issues: []
  });
});

test("getDecisionSummaryByRunId executed path: missing run_id throws 400 badRequest", async () => {
  let called = false;
  getDecisionSummaryByRunIdQueryImpl = async () => {
    called = true;
    return {};
  };

  const { getDecisionSummaryByRunId } = await import(`${distHandlerUrl}?case=get_decision_summary_missing_run_id`);
  const req = makeReq({});
  const res = makeRes();

  await assert.rejects(
    () => getDecisionSummaryByRunId(req, res),
    (error) => {
      assert.equal(error.status, 400);
      assert.equal(error.message, "Missing run_id");
      return true;
    }
  );

  assert.equal(called, false, "expected missing run_id to fail before query delegation");
});

test("getDecisionSummaryByRunId executed path: delegated not-found error preserves explicit error contract", async () => {
  getDecisionSummaryByRunIdQueryImpl = async () => {
    throw Object.assign(new Error("Engine run not found"), {
      status: 404,
      extras: { failure_token: "decision_summary_run_id_not_found" }
    });
  };

  const { getDecisionSummaryByRunId } = await import(`${distHandlerUrl}?case=get_decision_summary_not_found`);
  const req = makeReq({ run_id: "er_missing_001" });
  const res = makeRes();

  await assert.rejects(
    () => getDecisionSummaryByRunId(req, res),
    (error) => {
      assert.equal(error.status, 404);
      assert.equal(error.message, "Engine run not found");
      return true;
    }
  );
});

test("getDecisionSummaryByRunId executed path: delegated invalid-source error preserves explicit error contract", async () => {
  getDecisionSummaryByRunIdQueryImpl = async () => {
    throw Object.assign(new Error("Invalid decision summary source"), {
      status: 500,
      extras: { failure_token: "decision_summary_invalid_source" }
    });
  };

  const { getDecisionSummaryByRunId } = await import(`${distHandlerUrl}?case=get_decision_summary_invalid_source`);
  const req = makeReq({ run_id: "er_invalid_source_001" });
  const res = makeRes();

  await assert.rejects(
    () => getDecisionSummaryByRunId(req, res),
    (error) => {
      assert.equal(error.status, 500);
      assert.equal(error.message, "Invalid decision summary source");
      return true;
    }
  );
});
