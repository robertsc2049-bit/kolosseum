import test, { mock } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = process.cwd();

function toFileHref(relativePath) {
  return pathToFileURL(path.join(repoRoot, relativePath)).href;
}

function sha256Json(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeResponseRecorder() {
  const record = {
    statusCode: 200,
    body: undefined
  };

  return {
    record,
    status(code) {
      record.statusCode = code;
      return this;
    },
    json(body) {
      record.body = body;
      return this;
    },
    sendStatus(code) {
      record.statusCode = code;
      return this;
    }
  };
}

async function cachedImport(relativePath) {
  return import(toFileHref(relativePath));
}

async function freshImport(relativePath) {
  const href = toFileHref(relativePath);
  const nonce = `?restart_nonce=${Date.now()}_${Math.random().toString(16).slice(2)}`;
  return import(`${href}${nonce}`);
}

function normalizeSnapshot(value) {
  return clone(value);
}

test("v0: create-session-from-persisted-block preserves state/events contract across cached, uncached, and restarted read paths", async (t) => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = "postgres://local:test@127.0.0.1:5432/kolosseum_test";
  }

  t.after(() => {
    if (previousDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl;
    }
    mock.reset();
  });

  const persistedBlockId = "block_v0_cached_uncached_restarted_001";
  const createdSessionId = "session_v0_cached_uncached_restarted_001";

  const plannedSessionInput = {
    ordinal: 1,
    activity_id: "powerlifting",
    planned_items: [
      {
        work_item_id: "work_item_001",
        exercise_id: "competition_squat",
        sets: 3,
        reps: 5
      }
    ]
  };

  const canonicalCreatePayload = {
    session_id: createdSessionId,
    block_id: persistedBlockId,
    ordinal: 1,
    planned_session: plannedSessionInput
  };

  const canonicalStatePayload = {
    session_id: createdSessionId,
    block_id: persistedBlockId,
    status: "not_started",
    current_step_id: "work_item_001",
    runtime_trace: {
      explicit_return_decision: null
    }
  };

  const canonicalEventsPayload = {
    session_id: createdSessionId,
    events: [
      {
        seq: 0,
        event_type: "SESSION_CREATED_FROM_BLOCK",
        session_id: createdSessionId,
        block_id: persistedBlockId
      }
    ]
  };

  const createCalls = [];
  const stateCalls = [];
  const eventsCalls = [];

  mock.module(toFileHref("dist/src/api/block_session_write_service.js"), {
    namedExports: {
      createSessionFromBlockMutation: async ({ block_id, planned_session }) => {
        createCalls.push(clone({ block_id, planned_session }));
        return clone({
          ...canonicalCreatePayload,
          block_id,
          planned_session
        });
      }
    }
  });

  mock.module(toFileHref("dist/src/api/session_state_query_service.js"), {
    namedExports: {
      getSessionStateQuery: async ({ session_id }) => {
        stateCalls.push(clone({ session_id }));
        return clone({
          ...canonicalStatePayload,
          session_id
        });
      }
    }
  });

  mock.module(toFileHref("dist/src/api/session_events_query_service.js"), {
    namedExports: {
      listRuntimeEventsQuery: async ({ session_id }) => {
        eventsCalls.push(clone({ session_id }));
        return clone({
          ...canonicalEventsPayload,
          session_id,
          events: canonicalEventsPayload.events.map((event) => ({
            ...event,
            session_id
          }))
        });
      }
    }
  });

  async function captureChain(blocksHandlers, sessionsHandlers) {
    assert.equal(typeof blocksHandlers.createSessionFromBlock, "function");
    assert.equal(typeof sessionsHandlers.getSessionState, "function");
    assert.equal(typeof sessionsHandlers.listRuntimeEvents, "function");

    const createResponse = makeResponseRecorder();
    await blocksHandlers.createSessionFromBlock(
      {
        params: { block_id: persistedBlockId },
        body: { planned_session: plannedSessionInput }
      },
      createResponse
    );

    const resolvedSessionId = createResponse.record.body?.session_id;
    assert.equal(resolvedSessionId, createdSessionId);

    const stateResponse = makeResponseRecorder();
    await sessionsHandlers.getSessionState(
      {
        params: { session_id: resolvedSessionId }
      },
      stateResponse
    );

    const eventsResponse = makeResponseRecorder();
    await sessionsHandlers.listRuntimeEvents(
      {
        params: { session_id: resolvedSessionId }
      },
      eventsResponse
    );

    return normalizeSnapshot({
      create: createResponse.record,
      state: stateResponse.record,
      events: eventsResponse.record
    });
  }

  const cachedBlocksHandlers = await cachedImport("dist/src/api/blocks.handlers.js");
  const cachedSessionsHandlers = await cachedImport("dist/src/api/sessions.handlers.js");

  const cachedPassA = await captureChain(cachedBlocksHandlers, cachedSessionsHandlers);
  const cachedPassB = await captureChain(cachedBlocksHandlers, cachedSessionsHandlers);

  const uncachedBlocksHandlers = await freshImport("dist/src/api/blocks.handlers.js");
  const uncachedSessionsHandlers = await freshImport("dist/src/api/sessions.handlers.js");
  const uncachedPass = await captureChain(uncachedBlocksHandlers, uncachedSessionsHandlers);

  const restartedBlocksHandlers = await freshImport("dist/src/api/blocks.handlers.js");
  const restartedSessionsHandlers = await freshImport("dist/src/api/sessions.handlers.js");
  const restartedPass = await captureChain(restartedBlocksHandlers, restartedSessionsHandlers);

  assert.equal(cachedPassA.create.statusCode, 201);
  assert.equal(cachedPassA.state.statusCode, 200);
  assert.equal(cachedPassA.events.statusCode, 200);

  assert.deepEqual(cachedPassB, cachedPassA);
  assert.deepEqual(uncachedPass, cachedPassA);
  assert.deepEqual(restartedPass, cachedPassA);

  assert.equal(sha256Json(cachedPassB), sha256Json(cachedPassA));
  assert.equal(sha256Json(uncachedPass), sha256Json(cachedPassA));
  assert.equal(sha256Json(restartedPass), sha256Json(cachedPassA));

  assert.deepEqual(createCalls, [
    {
      block_id: persistedBlockId,
      planned_session: plannedSessionInput
    },
    {
      block_id: persistedBlockId,
      planned_session: plannedSessionInput
    },
    {
      block_id: persistedBlockId,
      planned_session: plannedSessionInput
    },
    {
      block_id: persistedBlockId,
      planned_session: plannedSessionInput
    }
  ]);

  assert.deepEqual(stateCalls, [
    { session_id: createdSessionId },
    { session_id: createdSessionId },
    { session_id: createdSessionId },
    { session_id: createdSessionId }
  ]);

  assert.deepEqual(eventsCalls, [
    { session_id: createdSessionId },
    { session_id: createdSessionId },
    { session_id: createdSessionId },
    { session_id: createdSessionId }
  ]);
});