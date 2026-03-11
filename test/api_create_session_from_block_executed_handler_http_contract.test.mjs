import test, { mock } from "node:test";
import assert from "node:assert/strict";

const distHttpErrorsUrl = new URL("../dist/src/api/http_errors.js", import.meta.url).href;
const distBlockSessionWriteUrl = new URL("../dist/src/api/block_session_write_service.js", import.meta.url).href;
const distCompileWriteUrl = new URL("../dist/src/api/block_compile_write_service.js", import.meta.url).href;
const distBlockSessionQueryUrl = new URL("../dist/src/api/block_session_query_service.js", import.meta.url).href;
const distDbPoolUrl = new URL("../dist/src/db/pool.js", import.meta.url).href;
const distHandlerUrl = new URL("../dist/src/api/blocks.handlers.js", import.meta.url).href;

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

  mock.module(distBlockSessionWriteUrl, {
    namedExports: {
      async createSessionFromBlockMutation(blockId, plannedSession) {
        if (mutationError) {
          throw mutationError;
        }

        return mutationResult ?? {
          session_id: "s_123",
          block_id: blockId,
          planned_session: plannedSession
        };
      }
    }
  });

  mock.module(distCompileWriteUrl, {
    namedExports: {
      async persistCompiledBlockAndMaybeCreateSession() {
        throw new Error("not used in this test");
      }
    }
  });

  mock.module(distBlockSessionQueryUrl, {
    namedExports: {
      async listBlockSessionsQuery() {
        throw new Error("not used in this test");
      }
    }
  });

  mock.module(distDbPoolUrl, {
    namedExports: {
      pool: {}
    }
  });
}

test("createSessionFromBlock executed path: returns 201 with delegated JSON payload when mutation succeeds", async () => {
  mock.reset();
  installCommonMocks({
    mutationResult: {
      session_id: "s_123",
      block_id: "b_123",
      planned_session: {
        exercises: [
          { exercise_id: "ex_a", sets: 3, status: "pending" }
        ]
      }
    }
  });

  const { createSessionFromBlock } = await import(`${distHandlerUrl}?case=created`);
  const req = makeReq({
    params: {
      block_id: "b_123"
    },
    body: {
      planned_session: {
        exercises: [
          { exercise_id: "ex_a", sets: 3, status: "pending" }
        ]
      }
    }
  });
  const res = makeRes();

  await createSessionFromBlock(req, res);

  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.jsonBody, {
    session_id: "s_123",
    block_id: "b_123",
    planned_session: {
      exercises: [
        { exercise_id: "ex_a", sets: 3, status: "pending" }
      ]
    }
  });
});

test("createSessionFromBlock executed path: missing block_id throws 400 badRequest", async () => {
  mock.reset();
  installCommonMocks();

  const { createSessionFromBlock } = await import(`${distHandlerUrl}?case=missing_block_id`);
  const req = makeReq({
    body: {
      planned_session: {
        exercises: [
          { exercise_id: "ex_a", sets: 3, status: "pending" }
        ]
      }
    }
  });
  const res = makeRes();

  await assert.rejects(
    () => createSessionFromBlock(req, res),
    (err) => err?.status === 400 && err?.message === "Missing block_id"
  );
});

test("createSessionFromBlock executed path: missing planned_session throws 400 badRequest", async () => {
  mock.reset();
  installCommonMocks();

  const { createSessionFromBlock } = await import(`${distHandlerUrl}?case=missing_planned_session`);
  const req = makeReq({
    params: {
      block_id: "b_123"
    },
    body: {}
  });
  const res = makeRes();

  await assert.rejects(
    () => createSessionFromBlock(req, res),
    (err) => err?.status === 400 && err?.message === "Missing planned_session"
  );
});

test("createSessionFromBlock executed path: delegated mutation error preserves explicit error contract", async () => {
  mock.reset();
  installCommonMocks({
    mutationError: Object.assign(new Error("Block not found"), {
      status: 404,
      extras: {
        failure_token: "block_not_found"
      }
    })
  });

  const { createSessionFromBlock } = await import(`${distHandlerUrl}?case=delegated_not_found`);
  const req = makeReq({
    params: {
      block_id: "b_missing"
    },
    body: {
      planned_session: {
        exercises: [
          { exercise_id: "ex_a", sets: 3, status: "pending" }
        ]
      }
    }
  });
  const res = makeRes();

  await assert.rejects(
    () => createSessionFromBlock(req, res),
    (err) =>
      err?.status === 404 &&
      err?.message === "Block not found" &&
      err?.extras?.failure_token === "block_not_found"
  );
});