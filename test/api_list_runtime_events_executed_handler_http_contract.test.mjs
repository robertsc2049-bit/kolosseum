import test, { mock } from "node:test";
import assert from "node:assert/strict";

const distHttpErrorsUrl = new URL("../dist/src/api/http_errors.js", import.meta.url).href;
const distSessionStateQueryUrl = new URL("../dist/src/api/session_state_query_service.js", import.meta.url).href;
const distSessionStateWriteUrl = new URL("../dist/src/api/session_state_write_service.js", import.meta.url).href;
const distPlanSessionServiceUrl = new URL("../dist/src/api/plan_session_service.js", import.meta.url).href;
const distSessionEventsQueryUrl = new URL("../dist/src/api/session_events_query_service.js", import.meta.url).href;
const distPoolUrl = new URL("../dist/src/db/pool.js", import.meta.url).href;
const distHandlerUrl = new URL("../dist/src/api/sessions.handlers.js", import.meta.url).href;

let listRuntimeEventsQueryImpl = async (sessionId) => ({
  session_id: sessionId,
  events: []
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
      return {
        session_id: sessionId,
        trace: {}
      };
    },
    async getDecisionSummaryByRunIdQuery(runId) {
      return {
        identity: { run_id: runId },
        audit: { source: "engine_run", resolved_from: "run_id" }
      };
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
      return await listRuntimeEventsQueryImpl(sessionId);
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

test("listRuntimeEvents executed path: returns 200 with delegated JSON payload when query succeeds", async () => {
  listRuntimeEventsQueryImpl = async (sessionId) => ({
    session_id: sessionId,
    events: [
      { seq: 1, type: "SESSION_STARTED" },
      { seq: 2, type: "EXERCISE_COMPLETED" }
    ]
  });

  const { listRuntimeEvents } = await import(`${distHandlerUrl}?case=ok`);
  const req = makeReq({ session_id: "s_events_ok" });
  const res = makeRes();

  await listRuntimeEvents(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.jsonBody, {
    session_id: "s_events_ok",
    events: [
      { seq: 1, type: "SESSION_STARTED" },
      { seq: 2, type: "EXERCISE_COMPLETED" }
    ]
  });
});

test("listRuntimeEvents executed path: missing session_id throws 400 badRequest", async () => {
  const { listRuntimeEvents } = await import(`${distHandlerUrl}?case=missing_session_id`);
  const req = makeReq({});
  const res = makeRes();

  await assert.rejects(
    () => listRuntimeEvents(req, res),
    (error) => {
      assert.equal(error.status, 400);
      assert.equal(error.message, "Missing session_id");
      return true;
    }
  );
});

test("listRuntimeEvents executed path: delegated not-found error preserves explicit error contract", async () => {
  listRuntimeEventsQueryImpl = async () => {
    throw Object.assign(new Error("Session not found"), {
      status: 404,
      extras: { failure_token: "session_not_found" }
    });
  };

  const { listRuntimeEvents } = await import(`${distHandlerUrl}?case=not_found`);
  const req = makeReq({ session_id: "missing_session" });
  const res = makeRes();

  await assert.rejects(
    () => listRuntimeEvents(req, res),
    (error) => {
      assert.equal(error.status, 404);
      assert.equal(error.message, "Session not found");
      return true;
    }
  );
});
