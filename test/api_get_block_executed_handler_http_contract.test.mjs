import test, { mock } from "node:test";
import assert from "node:assert/strict";

const distHttpErrorsUrl = new URL("../dist/src/api/http_errors.js", import.meta.url).href;
const distBlockQueryUrl = new URL("../dist/src/api/block_query_service.js", import.meta.url).href;
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

  mock.module(distBlockQueryUrl, {
    namedExports: {
      async getBlockByIdQuery(blockId) {
        if (queryError) {
          throw queryError;
        }

        if (typeof queryResult === "undefined") {
          return {
            block_id: blockId,
            created_at: "2026-03-17T22:00:00.000Z",
            engine_version: "EB2-1.0.0",
            canonical_hash: "phase2_hash_123",
            phase1_input: { activity: "powerlifting" },
            phase2_canonical: {
              phase2_canonical_json: "{\"activity\":\"powerlifting\"}",
              phase2_hash: "phase2_hash_123"
            },
            phase3_output: { constraints: [] },
            phase4_program: { activity: "powerlifting" },
            phase5_adjustments: [],
            phase2_canonical_json: "{\"activity\":\"powerlifting\"}",
            phase2_hash: "phase2_hash_123"
          };
        }

        return queryResult;
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

test("getBlock executed path: returns delegated persisted block payload", async () => {
  mock.reset();
  installCommonMocks({
    queryResult: {
      block_id: "b_123",
      created_at: "2026-03-17T22:00:00.000Z",
      engine_version: "EB2-1.0.0",
      canonical_hash: "phase2_hash_123",
      phase1_input: { activity: "powerlifting" },
      phase2_canonical: {
        phase2_canonical_json: "{\"activity\":\"powerlifting\"}",
        phase2_hash: "phase2_hash_123"
      },
      phase3_output: { constraints: [] },
      phase4_program: { activity: "powerlifting" },
      phase5_adjustments: [],
      phase2_canonical_json: "{\"activity\":\"powerlifting\"}",
      phase2_hash: "phase2_hash_123"
    }
  });

  const { getBlock } = await import(`${distHandlerUrl}?case=get_block_ok`);
  const req = makeReq({
    params: {
      block_id: "b_123"
    }
  });
  const res = makeRes();

  await getBlock(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.jsonBody, {
    block_id: "b_123",
    created_at: "2026-03-17T22:00:00.000Z",
    engine_version: "EB2-1.0.0",
    canonical_hash: "phase2_hash_123",
    phase1_input: { activity: "powerlifting" },
    phase2_canonical: {
      phase2_canonical_json: "{\"activity\":\"powerlifting\"}",
      phase2_hash: "phase2_hash_123"
    },
    phase3_output: { constraints: [] },
    phase4_program: { activity: "powerlifting" },
    phase5_adjustments: [],
    phase2_canonical_json: "{\"activity\":\"powerlifting\"}",
    phase2_hash: "phase2_hash_123"
  });
});

test("getBlock executed path: missing block_id throws 400 badRequest", async () => {
  mock.reset();
  installCommonMocks();

  const { getBlock } = await import(`${distHandlerUrl}?case=get_block_missing_block_id`);
  const req = makeReq();
  const res = makeRes();

  await assert.rejects(
    () => getBlock(req, res),
    (err) => err?.status === 400 && err?.message === "Missing block_id"
  );
});

test("getBlock executed path: missing persisted block throws 404 notFound", async () => {
  mock.reset();
  installCommonMocks({
    queryResult: null
  });

  const { getBlock } = await import(`${distHandlerUrl}?case=get_block_not_found`);
  const req = makeReq({
    params: {
      block_id: "b_missing"
    }
  });
  const res = makeRes();

  await assert.rejects(
    () => getBlock(req, res),
    (err) => err?.status === 404 && err?.message === "Block not found"
  );
});

test("getBlock executed path: delegated query error preserves explicit error contract", async () => {
  mock.reset();
  installCommonMocks({
    queryError: Object.assign(new Error("Storage unavailable"), {
      status: 500,
      extras: {
        failure_token: "storage_unavailable"
      }
    })
  });

  const { getBlock } = await import(`${distHandlerUrl}?case=get_block_query_failure`);
  const req = makeReq({
    params: {
      block_id: "b_123"
    }
  });
  const res = makeRes();

  await assert.rejects(
    () => getBlock(req, res),
    (err) =>
      err?.status === 500 &&
      err?.message === "Storage unavailable" &&
      err?.extras?.failure_token === "storage_unavailable"
  );
});