import test, { mock } from "node:test";
import assert from "node:assert/strict";

const distHttpErrorsUrl = new URL("../dist/src/api/http_errors.js", import.meta.url).href;
const distSessionStateWriteUrl = new URL("../dist/src/api/session_state_write_service.js", import.meta.url).href;
const distPlanSessionServiceUrl = new URL("../dist/src/api/plan_session_service.js", import.meta.url).href;
const distSessionEventsQueryUrl = new URL("../dist/src/api/session_events_query_service.js", import.meta.url).href;
const distSessionStateQueryUrl = new URL("../dist/src/api/session_state_query_service.js", import.meta.url).href;
const distHandlerUrl = new URL("../dist/src/api/sessions.handlers.js", import.meta.url).href;

function makeReq({ body = undefined, params = {}, query = {}, headers = {} } = {}) {
  return {
    body,
    params,
    query,
    get(name) {
      const key = String(name).toLowerCase();
      return headers[key];
    }
  };
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

function installCommonMocks({ normalizedRaw, mutationResult, extractError, mutationError } = {}) {
  mock.module(distHttpErrorsUrl, {
    namedExports: {
      badRequest(message, extras = undefined) {
        const err = new Error(message);
        err.status = 400;
        err.extras = extras;
        return err;
      },
      notFound(message, extras = undefined) {
        const err = new Error(message);
        err.status = 404;
        err.extras = extras;
        return err;
      },
      internalError(message, extras = undefined) {
        const err = new Error(message);
        err.status = 500;
        err.extras = extras;
        return err;
      }
    }
  });

  mock.module(distSessionStateWriteUrl, {
    namedExports: {
      extractRawEventFromBody(body) {
        if (extractError) {
          throw extractError;
        }

        return normalizedRaw ?? body;
      },
      async appendRuntimeEventMutation(sessionId, raw) {
        if (mutationError) {
          throw mutationError;
        }

        return mutationResult ?? {
          session_id: sessionId,
          accepted: true,
          event: raw
        };
      },
      async startSessionMutation() {
        throw new Error("not used in this test");
      }
    }
  });

  mock.module(distPlanSessionServiceUrl, {
    namedExports: {
      async planSessionService() {
        throw new Error("not used in this test");
      }
    }
  });

  mock.module(distSessionEventsQueryUrl, {
    namedExports: {
      async listRuntimeEventsQuery() {
        throw new Error("not used in this test");
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
}

test("appendRuntimeEvent executed path: returns 201 with delegated JSON payload when mutation succeeds", async () => {
  mock.reset();
  installCommonMocks({
    normalizedRaw: {
      type: "COMPLETE_EXERCISE",
      exercise_id: "ex_a"
    },
    mutationResult: {
      session_id: "sess_123",
      ok: true,
      seq: 7
    }
  });

  const { appendRuntimeEvent } = await import(`${distHandlerUrl}?case=ok`);
  const req = makeReq({
    params: {
      session_id: "sess_123"
    },
    body: {
      event: {
        type: "COMPLETE_EXERCISE",
        exercise_id: "ex_a"
      }
    }
  });
  const res = makeRes();

  await appendRuntimeEvent(req, res);

  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.jsonBody, {
    session_id: "sess_123",
    trace: {},
    ok: true,
    seq: 7
  });
});

test("appendRuntimeEvent executed path: missing session_id throws 400 badRequest", async () => {
  mock.reset();
  installCommonMocks();

  const { appendRuntimeEvent } = await import(`${distHandlerUrl}?case=missing_session_id`);
  const req = makeReq({
    body: {
      event: {
        type: "COMPLETE_EXERCISE",
        exercise_id: "ex_a"
      }
    }
  });
  const res = makeRes();

  await assert.rejects(
    () => appendRuntimeEvent(req, res),
    (err) => err?.status === 400 && err?.message === "Missing session_id"
  );
});

test("appendRuntimeEvent executed path: extractRawEventFromBody validation failure preserves explicit error contract", async () => {
  mock.reset();
  installCommonMocks({
    extractError: Object.assign(new Error("Invalid runtime event body"), {
      status: 400,
      extras: {
        failure_token: "invalid_runtime_event_body"
      }
    })
  });

  const { appendRuntimeEvent } = await import(`${distHandlerUrl}?case=invalid_body`);
  const req = makeReq({
    params: {
      session_id: "sess_123"
    },
    body: {
      nope: true
    }
  });
  const res = makeRes();

  await assert.rejects(
    () => appendRuntimeEvent(req, res),
    (err) =>
      err?.status === 400 &&
      err?.message === "Invalid runtime event body" &&
      err?.extras?.failure_token === "invalid_runtime_event_body"
  );
});

test("appendRuntimeEvent executed path: delegated mutation error preserves explicit error contract", async () => {
  mock.reset();
  installCommonMocks({
    normalizedRaw: {
      type: "COMPLETE_EXERCISE",
      exercise_id: "ex_missing"
    },
    mutationError: Object.assign(new Error("Session not found"), {
      status: 404,
      extras: {
        failure_token: "session_not_found"
      }
    })
  });

  const { appendRuntimeEvent } = await import(`${distHandlerUrl}?case=mutation_not_found`);
  const req = makeReq({
    params: {
      session_id: "sess_missing"
    },
    body: {
      event: {
        type: "COMPLETE_EXERCISE",
        exercise_id: "ex_missing"
      }
    }
  });
  const res = makeRes();

  await assert.rejects(
    () => appendRuntimeEvent(req, res),
    (err) =>
      err?.status === 404 &&
      err?.message === "Session not found" &&
      err?.extras?.failure_token === "session_not_found"
  );
});
