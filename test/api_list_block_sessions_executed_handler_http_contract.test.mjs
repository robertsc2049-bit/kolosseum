import test, { mock } from "node:test";
import assert from "node:assert/strict";

const distHttpErrorsUrl = new URL("../dist/src/api/http_errors.js", import.meta.url).href;
const distBlockSessionQueryUrl = new URL("../dist/src/api/block_session_query_service.js", import.meta.url).href;
const distBlockSessionWriteUrl = new URL("../dist/src/api/block_session_write_service.js", import.meta.url).href;
const distCompileWriteUrl = new URL("../dist/src/api/block_compile_write_service.js", import.meta.url).href;
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

function installCommonMocks({ queryResult, queryError } = {}) {
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

  mock.module(distBlockSessionQueryUrl, {
    namedExports: {
      async listBlockSessionsQuery(blockId) {
        if (queryError) {
          throw queryError;
        }

        return queryResult ?? {
          block_id: blockId,
          sessions: [
            { session_id: "s_001", status: "active" },
            { session_id: "s_002", status: "completed" }
          ]
        };
      }
    }
  });

  mock.module(distBlockSessionWriteUrl, {
    namedExports: {
      async createSessionFromBlockMutation() {
        throw new Error("not used in this test");
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

  mock.module(distDbPoolUrl, {
    namedExports: {
      pool: {}
    }
  });
}

test("listBlockSessions executed path: returns 200 with delegated JSON payload when query succeeds", async () => {
  mock.reset();
  installCommonMocks({
    queryResult: {
      block_id: "b_123",
      sessions: [
        { session_id: "s_001", status: "active" },
        { session_id: "s_002", status: "completed" }
      ]
    }
  });

  const { listBlockSessions } = await import(`${distHandlerUrl}?case=ok`);
  const req = makeReq({
    params: {
      block_id: "b_123"
    }
  });
  const res = makeRes();

  await listBlockSessions(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.jsonBody, {
    block_id: "b_123",
    sessions: [
      { session_id: "s_001", status: "active" },
      { session_id: "s_002", status: "completed" }
    ]
  });
});

test("listBlockSessions executed path: missing block_id throws 400 badRequest", async () => {
  mock.reset();
  installCommonMocks();

  const { listBlockSessions } = await import(`${distHandlerUrl}?case=missing_block_id`);
  const req = makeReq();
  const res = makeRes();

  await assert.rejects(
    () => listBlockSessions(req, res),
    (err) => err?.status === 400 && err?.message === "Missing block_id"
  );
});

test("listBlockSessions executed path: delegated not-found error preserves explicit error contract", async () => {
  mock.reset();
  installCommonMocks({
    queryError: Object.assign(new Error("Block not found"), {
      status: 404,
      extras: {
        failure_token: "block_not_found"
      }
    })
  });

  const { listBlockSessions } = await import(`${distHandlerUrl}?case=not_found`);
  const req = makeReq({
    params: {
      block_id: "b_missing"
    }
  });
  const res = makeRes();

  await assert.rejects(
    () => listBlockSessions(req, res),
    (err) =>
      err?.status === 404 &&
      err?.message === "Block not found" &&
      err?.extras?.failure_token === "block_not_found"
  );
});