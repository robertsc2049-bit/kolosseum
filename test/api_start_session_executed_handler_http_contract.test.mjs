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

function installCommonMocks({ mutationResult, mutationError } = {}) {
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
      extractRawEventFromBody() {
        throw new Error("not used in this test");
      },
      async appendRuntimeEventMutation() {
        throw new Error("not used in this test");
      },
      async startSessionMutation(sessionId) {
        if (mutationError) {
          throw mutationError;
        }

        return mutationResult ?? {
          session_id: sessionId,
          started: true
        };
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
      async getSessionStateQuery() {
        throw new Error("not used in this test");
      }
    }
  });
}

test("startSession executed path: returns 200 with delegated JSON payload when mutation succeeds", async () => {
  mock.reset();
  installCommonMocks({
    mutationResult: {
      session_id: "sess_123",
      started: true
    }
  });

  const { startSession } = await import(`${distHandlerUrl}?case=ok`);
  const req = makeReq({
    params: {
      session_id: "sess_123"
    }
  });
  const res = makeRes();

  await startSession(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.jsonBody, {
    session_id: "sess_123",
    started: true
  });
});

test("startSession executed path: missing session_id throws 400 badRequest", async () => {
  mock.reset();
  installCommonMocks();

  const { startSession } = await import(`${distHandlerUrl}?case=missing_session_id`);
  const req = makeReq();
  const res = makeRes();

  await assert.rejects(
    () => startSession(req, res),
    (err) => err?.status === 400 && err?.message === "Missing session_id"
  );
});

test("startSession executed path: delegated not-found error preserves explicit error contract", async () => {
  mock.reset();
  installCommonMocks({
    mutationError: Object.assign(new Error("Session not found"), {
      status: 404,
      extras: {
        failure_token: "session_not_found"
      }
    })
  });

  const { startSession } = await import(`${distHandlerUrl}?case=not_found`);
  const req = makeReq({
    params: {
      session_id: "sess_missing"
    }
  });
  const res = makeRes();

  await assert.rejects(
    () => startSession(req, res),
    (err) =>
      err?.status === 404 &&
      err?.message === "Session not found" &&
      err?.extras?.failure_token === "session_not_found"
  );
});