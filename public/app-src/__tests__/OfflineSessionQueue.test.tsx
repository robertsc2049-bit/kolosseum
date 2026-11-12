import assert from "node:assert/strict";
import test from "node:test";

import {
  __resetOfflineQueueForTests,
  enqueueSessionEvent,
  flushSessionEvents,
  isNetworkError,
  isRetryableSendError,
  pendingSessionEvents,
  withPendingSetLogs
} from "../api/offlineSessionQueue";
import { ApiRequestError } from "../api/transport";

const setLog = (setIndex: number, reps: number, id: string) => ({
  session_id: "s1", client_request_id: id, queued_at: "2026-09-27T10:00:00.000Z",
  event: { type: "SET_LOG_REPORT", exercise_id: "back_squat", set_index: setIndex, reps, load_value: 140, load_unit: "kg" }
});

test.afterEach(() => __resetOfflineQueueForTests());

test("queued sets are sent in order; still offline, it stops and keeps the rest", async () => {
  enqueueSessionEvent(setLog(1, 5, "a"));
  enqueueSessionEvent(setLog(2, 5, "b"));
  enqueueSessionEvent(setLog(3, 4, "c"));
  const sent: string[] = [];
  const result = await flushSessionEvents(async (item) => {
    if (item.client_request_id === "b") throw new TypeError("Failed to fetch");
    sent.push(item.client_request_id);
  });
  assert.deepEqual(sent, ["a"]);
  assert.deepEqual(result, { sent: 1, dropped: 0, waiting: 2 });
  assert.deepEqual(pendingSessionEvents("s1").map((i) => i.client_request_id), ["b", "c"]);
});

test("an event the server refuses (e.g. the session has ended) is dropped, not retried forever", async () => {
  enqueueSessionEvent(setLog(1, 5, "a"));
  enqueueSessionEvent(setLog(2, 5, "b"));
  const result = await flushSessionEvents(async (item) => {
    if (item.client_request_id === "a") throw new ApiRequestError("phase6_runtime_set_log_report_unknown_exercise", 400, null);
  });
  assert.deepEqual(result, { sent: 1, dropped: 1, waiting: 0 });
  assert.deepEqual(pendingSessionEvents(), []);
});

test("back online mid-deploy: a 502 from the proxy keeps every queued set for the next try - never drops a logged set (walkthrough 15)", async () => {
  enqueueSessionEvent(setLog(1, 5, "a"));
  enqueueSessionEvent(setLog(2, 5, "b"));
  const result = await flushSessionEvents(async (item) => {
    if (item.client_request_id === "a") throw new ApiRequestError("bad_gateway", 502, null);
  });
  assert.deepEqual(result, { sent: 0, dropped: 0, waiting: 2 });
  assert.deepEqual(pendingSessionEvents("s1").map((i) => i.client_request_id), ["a", "b"], "both still on the phone, in order");
});

test("a server error, rate limit, or a sign-in that went stale while offline is retried later; only a definite refusal drops", () => {
  for (const status of [0, 401, 403, 408, 429, 500, 502, 503, 504]) {
    assert.equal(isRetryableSendError(new ApiRequestError("x", status, null)), true, `HTTP ${status} is retried`);
  }
  for (const status of [400, 404, 409, 410, 422]) {
    assert.equal(isRetryableSendError(new ApiRequestError("x", status, null)), false, `HTTP ${status} is dropped`);
  }
  assert.equal(isRetryableSendError(new TypeError("Failed to fetch")), true);
});

test("only a request that got no response counts as offline", () => {
  assert.equal(isNetworkError(new TypeError("Failed to fetch")), true);
  assert.equal(isNetworkError({ name: "TypeError", message: "Load failed" }), true, "another realm's TypeError");
  assert.equal(isNetworkError(new ApiRequestError("x", 0, null)), true);
  assert.equal(isNetworkError(new ApiRequestError("x", 400, null)), false);
  assert.equal(isNetworkError(new Error("boom")), false);
});

test("queued set logs show over the server's, marked as saved on the phone", () => {
  enqueueSessionEvent(setLog(2, 3, "b"));
  const merged = withPendingSetLogs("s1", "back_squat", [
    { set_index: 1, reps: 5, load_value: 140, load_unit: "kg" },
    { set_index: 2, reps: 5, load_value: 140, load_unit: "kg" }
  ]);
  assert.deepEqual(merged.map((l) => [l.set_index, l.reps, l.pending === true]), [[1, 5, false], [2, 3, true]]);
  assert.deepEqual(withPendingSetLogs("s1", "deadlift", []), []);
});
