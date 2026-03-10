import test, { mock } from "node:test";
import assert from "node:assert/strict";

const distPoolUrl = new URL("../dist/src/db/pool.js", import.meta.url).href;
const distQueryServiceUrl = new URL("../dist/src/api/session_events_query_service.js", import.meta.url).href;

let poolQueryCalls = [];

function resetState() {
  poolQueryCalls = [];
}

mock.module(distPoolUrl, {
  namedExports: {
    pool: {
      query: async (sql, params) => {
        poolQueryCalls.push({ sql: String(sql), params });

        const sessionId = params?.[0];

        if (sessionId === "s_events") {
          return {
            rowCount: 2,
            rows: [
              { seq: 1, event: { type: "START_SESSION" }, created_at: "2026-03-10T10:00:00.000Z" },
              { seq: 2, event: { type: "COMPLETE_EXERCISE", exercise_id: "ex1" }, created_at: "2026-03-10T10:01:00.000Z" }
            ]
          };
        }

        if (sessionId === "s_empty") {
          return {
            rowCount: 0,
            rows: []
          };
        }

        throw new Error("unexpected session id in test");
      }
    }
  }
});

const { listRuntimeEventsQuery } = await import(distQueryServiceUrl);

test("listRuntimeEventsQuery returns ordered runtime events payload unchanged", async () => {
  resetState();

  const out = await listRuntimeEventsQuery("s_events");

  assert.equal(poolQueryCalls.length, 1);
  assert.match(poolQueryCalls[0].sql, /SELECT seq, event, created_at/i);
  assert.match(poolQueryCalls[0].sql, /FROM runtime_events/i);
  assert.match(poolQueryCalls[0].sql, /WHERE session_id = \$1/i);
  assert.match(poolQueryCalls[0].sql, /ORDER BY seq ASC/i);
  assert.deepEqual(poolQueryCalls[0].params, ["s_events"]);

  assert.deepEqual(out, {
    session_id: "s_events",
    events: [
      { seq: 1, event: { type: "START_SESSION" }, created_at: "2026-03-10T10:00:00.000Z" },
      { seq: 2, event: { type: "COMPLETE_EXERCISE", exercise_id: "ex1" }, created_at: "2026-03-10T10:01:00.000Z" }
    ]
  });
});

test("listRuntimeEventsQuery returns empty events array when no runtime events exist", async () => {
  resetState();

  const out = await listRuntimeEventsQuery("s_empty");

  assert.equal(poolQueryCalls.length, 1);
  assert.deepEqual(poolQueryCalls[0].params, ["s_empty"]);
  assert.deepEqual(out, {
    session_id: "s_empty",
    events: []
  });
});