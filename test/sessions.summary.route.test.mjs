import test from "node:test";
import assert from "node:assert/strict";

const mod = await import("../src/api/sessions.summary.handlers.ts");
const { createGetNeutralSessionSummaryHandler } = mod;

function createResCapture() {
  const state = {
    statusCode: 200,
    payload: undefined,
  };

  return {
    state,
    res: {
      status(code) {
        state.statusCode = code;
        return this;
      },
      json(payload) {
        state.payload = payload;
      },
    },
  };
}

test("GET neutral session summary returns the exact pinned factual DTO", async () => {
  const handler = createGetNeutralSessionSummaryHandler({
    sessionStateStore: {
      async getSessionStateBySessionId(sessionId) {
        assert.equal(sessionId, "session_100");
        return {
          session_id: "session_100",
          run_id: "run_100",
          execution_status: "in_progress",
          trace: {
            completed_ids: ["x1"],
            dropped_ids: [],
            remaining_ids: ["x2"],
            event_count: 3,
          },
          planned_work_item_ids: ["x1", "x2"],
        };
      },
    },
    sessionEventsStore: {
      async listRuntimeEventsBySessionId(sessionId) {
        assert.equal(sessionId, "session_100");
        return [
          { event_type: "START_SESSION", timestamp_utc: "2026-04-04T12:00:00Z" },
          { event_type: "EXTRA_WORK", timestamp_utc: "2026-04-04T12:05:00Z" },
          { event_type: "RETURN_CONTINUE", timestamp_utc: "2026-04-04T12:10:00Z" },
        ];
      },
    },
  });

  const { state, res } = createResCapture();

  await handler({ params: { sessionId: "session_100" } }, res);

  assert.equal(state.statusCode, 200);
  assert.deepEqual(state.payload, {
    session_id: "session_100",
    run_id: "run_100",
    status: "in_progress",
    prescribed_items_total: 2,
    prescribed_items_completed: 1,
    prescribed_items_skipped: 0,
    prescribed_items_remaining: 1,
    extra_work_event_count: 1,
    split_event_count: 0,
    return_continue_count: 1,
    return_skip_count: 0,
    runtime_event_count: 3,
    started_at_utc: "2026-04-04T12:00:00Z",
    completed_at_utc: null,
  });
});

test("GET neutral session summary returns 404 when session does not exist", async () => {
  const handler = createGetNeutralSessionSummaryHandler({
    sessionStateStore: {
      async getSessionStateBySessionId() {
        return null;
      },
    },
    sessionEventsStore: {
      async listRuntimeEventsBySessionId() {
        return [];
      },
    },
  });

  const { state, res } = createResCapture();

  await handler({ params: { sessionId: "missing_session" } }, res);

  assert.equal(state.statusCode, 404);
  assert.deepEqual(state.payload, { error: "session_not_found" });
});

test("GET neutral session summary returns 400 when sessionId is missing", async () => {
  const handler = createGetNeutralSessionSummaryHandler({
    sessionStateStore: {
      async getSessionStateBySessionId() {
        return null;
      },
    },
    sessionEventsStore: {
      async listRuntimeEventsBySessionId() {
        return [];
      },
    },
  });

  const { state, res } = createResCapture();

  await handler({ params: {} }, res);

  assert.equal(state.statusCode, 400);
  assert.deepEqual(state.payload, { error: "missing_session_id" });
});