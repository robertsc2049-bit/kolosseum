import test, { mock } from "node:test";
import assert from "node:assert/strict";

const distHttpErrorsUrl = new URL("../dist/src/api/http_errors.js", import.meta.url).href;
const distCanonicalHashUrl = new URL("../dist/src/api/canonical_hash.js", import.meta.url).href;
const distCompileWriteUrl = new URL("../dist/src/api/block_compile_write_service.js", import.meta.url).href;
const distBlockSessionWriteUrl = new URL("../dist/src/api/block_session_write_service.js", import.meta.url).href;
const distBlockSessionQueryUrl = new URL("../dist/src/api/block_session_query_service.js", import.meta.url).href;
const distDbPoolUrl = new URL("../dist/src/db/pool.js", import.meta.url).href;
const distHandlerUrl = new URL("../dist/src/api/blocks.handlers.js", import.meta.url).href;

const PHASE1_SPEC = "@kolosseum/engine/phases/phase1.js";
const PHASE2_SPEC = "@kolosseum/engine/phases/phase2.js";
const PHASE3_SPEC = "@kolosseum/engine/phases/phase3.js";
const PHASE4_SPEC = "@kolosseum/engine/phases/phase4.js";
const PHASE6_SPEC = "@kolosseum/engine/phases/phase6.js";
const SESSION_SUMMARY_SPEC = "@kolosseum/engine/runtime/session_summary.js";
const APPLY_RUNTIME_EVENT_SPEC = "@kolosseum/engine/runtime/apply_runtime_event.js";

function makeReq({ body = undefined, query = {}, headers = {} } = {}) {
  return {
    body,
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

function installCommonMocks({
  persistedResult,
  phase1Result,
  runtimeState,
  runtimeApplyErrorMessage
} = {}) {
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

  mock.module(distCanonicalHashUrl, {
    namedExports: {
      selectCanonicalHash() {
        return { canonical_hash: "canon_hash_selected" };
      }
    }
  });

  mock.module(PHASE1_SPEC, {
    namedExports: {
      phase1Validate() {
        return phase1Result ?? {
          ok: true,
          canonical_input: {
            activity: "powerlifting",
            constraints: { timebox_minutes: 60 }
          }
        };
      }
    }
  });

  mock.module(PHASE2_SPEC, {
    namedExports: {
      phase2CanonicaliseAndHash(canonical_input) {
        return {
          ok: true,
          phase2: {
            phase2_canonical_json: JSON.stringify(canonical_input),
            phase2_hash: "phase2_hash_123",
            canonical_input_hash: "canonical_input_hash_123"
          }
        };
      }
    }
  });

  mock.module(PHASE3_SPEC, {
    namedExports: {
      phase3ResolveConstraintsAndLoadRegistries() {
        return {
          ok: true,
          phase3: {
            constraints: { timebox_minutes: 60 }
          }
        };
      }
    }
  });

  mock.module(PHASE4_SPEC, {
    namedExports: {
      phase4AssembleProgram() {
        return {
          ok: true,
          program: { program_id: "program_powerlifting_v1" }
        };
      }
    }
  });

  mock.module(PHASE6_SPEC, {
    namedExports: {
      phase6ProduceSessionOutput() {
        return {
          ok: true,
          session: {
            exercises: [
              { exercise_id: "ex_a", sets: 3 },
              { exercise_id: "ex_b", sets: 2 }
            ]
          }
        };
      }
    }
  });

  mock.module(SESSION_SUMMARY_SPEC, {
    namedExports: {
      validateWireRuntimeEvent(event) {
        return event;
      }
    }
  });

  mock.module(APPLY_RUNTIME_EVENT_SPEC, {
    namedExports: {
      applyRuntimeEvents() {
        if (runtimeApplyErrorMessage) {
          throw new Error(runtimeApplyErrorMessage);
        }

        return runtimeState ?? {
          remaining_ids: ["ex_b"],
          completed_ids: new Set(["ex_a"]),
          dropped_ids: new Set(),
          return_decision_required: false,
          return_decision_options: [],
          runtime_trace: {
            remaining_ids: ["ex_b"],
            completed_ids: ["ex_a"],
            dropped_ids: [],
            return_decision_required: false,
            return_decision_options: []
          }
        };
      }
    }
  });

  mock.module(distCompileWriteUrl, {
    namedExports: {
      async persistCompiledBlockAndMaybeCreateSession() {
        return persistedResult ?? {
          persisted_block_id: "b_123",
          created_block: true
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

test("compileBlock executed path: returns 201 with block payload when persistence creates block", async () => {
  mock.reset();
  installCommonMocks();

  const { compileBlock } = await import(`${distHandlerUrl}?case=created`);
  const req = makeReq({
    body: {
      phase1_input: { activity: "powerlifting" }
    }
  });
  const res = makeRes();

  await compileBlock(req, res);

  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.jsonBody, {
    block_id: "b_123",
    engine_version: "EB2-1.0.0",
    canonical_hash: "canon_hash_selected",
    planned_session: {
      exercises: [
        { exercise_id: "ex_a", sets: 3, status: "completed" },
        { exercise_id: "ex_b", sets: 2, status: "pending" }
      ]
    },
    runtime_trace: {
      remaining_ids: ["ex_b"],
      completed_ids: ["ex_a"],
      dropped_ids: [],
      return_decision_required: false,
      return_decision_options: []
    }
  });
});

test("compileBlock executed path: returns 201 and session_id when create_session=true", async () => {
  mock.reset();
  installCommonMocks({
    persistedResult: {
      persisted_block_id: "b_existing",
      created_block: false,
      session_id: "s_123"
    }
  });

  const { compileBlock } = await import(`${distHandlerUrl}?case=create_session`);
  const req = makeReq({
    body: {
      phase1_input: { activity: "powerlifting" }
    },
    query: {
      create_session: "true"
    }
  });
  const res = makeRes();

  await compileBlock(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.jsonBody.block_id, "b_existing");
  assert.equal(res.jsonBody.session_id, "s_123");
});

test("compileBlock executed path: missing phase1_input throws 400 badRequest", async () => {
  mock.reset();
  installCommonMocks();

  const { compileBlock } = await import(`${distHandlerUrl}?case=missing_phase1`);
  const req = makeReq({
    body: {}
  });
  const res = makeRes();

  await assert.rejects(
    () => compileBlock(req, res),
    (err) => err?.status === 400 && err?.message === "Missing phase1_input"
  );
});

test("compileBlock executed path: runtime await-return-decision failure maps to explicit 400 token", async () => {
  mock.reset();
  installCommonMocks({
    runtimeApplyErrorMessage: "PHASE6_RUNTIME_AWAIT_RETURN_DECISION: blocked"
  });

  const { compileBlock } = await import(`${distHandlerUrl}?case=runtime_await_return`);
  const req = makeReq({
    body: {
      phase1_input: { activity: "powerlifting" },
      runtime_events: [{ type: "RETURN_CONTINUE" }]
    }
  });
  const res = makeRes();

  await assert.rejects(
    () => compileBlock(req, res),
    (err) =>
      err?.status === 400 &&
      err?.message === "Runtime event rejected (await return decision)" &&
      err?.extras?.failure_token === "phase6_runtime_await_return_decision"
  );
});