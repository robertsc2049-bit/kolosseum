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

async function freshImport(relativePath) {
  const href = toFileHref(relativePath);
  const nonce = `?mixed_read_nonce=${Date.now()}_${Math.random().toString(16).slice(2)}`;
  return import(`${href}${nonce}`);
}

test("v0: create-session-from-persisted-block state/events parity survives repeated mixed read order", async (t) => {
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

  const persistedBlockId = "block_v0_mixed_read_order_001";
  const createdSessionId = "session_v0_mixed_read_order_001";

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

  const createPayload = {
    session_id: createdSessionId,
    block_id: persistedBlockId,
    ordinal: 1,
    planned_session: plannedSessionInput
  };

  const statePayload = {
    block_id: persistedBlockId,
    status: "not_started",
    current_step_id: "work_item_001",
    runtime_trace: {
      explicit_return_decision: null
    }
  };

  const eventsPayload = {
    events: [
      {
        seq: 0,
        event_type: "SESSION_CREATED_FROM_BLOCK",
        session_id: createdSessionId,
        block_id: persistedBlockId
      }
    ]
  };

  let createCallCount = 0;
  const stateCalls = [];
  const eventsCalls = [];

  mock.module(toFileHref("dist/src/api/block_session_write_service.js"), {
    namedExports: {
      createSessionFromBlockMutation: async () => {
        createCallCount += 1;
        return clone(createPayload);
      }
    }
  });

  mock.module(toFileHref("dist/src/api/session_state_query_service.js"), {
    namedExports: {
      getSessionStateQuery: async ({ session_id }) => {
        stateCalls.push(session_id);
        return clone(statePayload);
      }
    }
  });

  mock.module(toFileHref("dist/src/api/session_events_query_service.js"), {
    namedExports: {
      listRuntimeEventsQuery: async ({ session_id }) => {
        eventsCalls.push(session_id);
        return clone(eventsPayload);
      }
    }
  });

  const blocksHandlers = await freshImport("dist/src/api/blocks.handlers.js");
  const sessionsHandlers = await freshImport("dist/src/api/sessions.handlers.js");

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

  assert.equal(createResponse.record.statusCode, 201);
  assert.equal(createResponse.record.body?.session_id, createdSessionId);

  const readOrder = [
    "state",
    "events",
    "state",
    "events",
    "events",
    "state",
    "state",
    "events"
  ];

  const observedStates = [];
  const observedEvents = [];

  for (const step of readOrder) {
    if (step === "state") {
      const response = makeResponseRecorder();
      await sessionsHandlers.getSessionState(
        {
          params: { session_id: createdSessionId }
        },
        response
      );

      assert.equal(response.record.statusCode, 200);
      observedStates.push(clone(response.record.body));
      continue;
    }

    const response = makeResponseRecorder();
    await sessionsHandlers.listRuntimeEvents(
      {
        params: { session_id: createdSessionId }
      },
      response
    );

    assert.equal(response.record.statusCode, 200);
    observedEvents.push(clone(response.record.body));
  }

  assert.equal(createCallCount, 1);
  assert.equal(observedStates.length, 4);
  assert.equal(observedEvents.length, 4);

  for (const snapshot of observedStates) {
    assert.deepEqual(snapshot, observedStates[0]);
    assert.deepEqual(snapshot, statePayload);
    assert.equal(sha256Json(snapshot), sha256Json(observedStates[0]));
  }

  for (const snapshot of observedEvents) {
    assert.deepEqual(snapshot, observedEvents[0]);
    assert.deepEqual(snapshot, eventsPayload);
    assert.equal(sha256Json(snapshot), sha256Json(observedEvents[0]));
  }

  assert.deepEqual(stateCalls, [
    createdSessionId,
    createdSessionId,
    createdSessionId,
    createdSessionId
  ]);

  assert.deepEqual(eventsCalls, [
    createdSessionId,
    createdSessionId,
    createdSessionId,
    createdSessionId
  ]);
});