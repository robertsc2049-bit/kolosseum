import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  STOP_SKIP_PARTIAL_COPY_IDS,
  buildStopSkipPartialCompletionFlow,
  handleV1StopSkipPartialCompletionRequest,
  stopSkipPartialCompletionContract,
  tryBuildStopSkipPartialCompletionFlow
} from "../src/v1StopSkipPartialCompletionFlow.mjs";

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function setPath(target, dottedPath, value) {
  const parts = dottedPath.split(".");
  let current = target;

  for (const part of parts.slice(0, -1)) {
    if (/^\d+$/u.test(part)) {
      current = current[Number(part)];
      continue;
    }

    if (!current[part] || typeof current[part] !== "object") {
      current[part] = {};
    }

    current = current[part];
  }

  const finalPart = parts[parts.length - 1];
  if (/^\d+$/u.test(finalPart)) {
    current[Number(finalPart)] = value;
  } else {
    current[finalPart] = value;
  }
}

const fixture = readJson("ci/fixtures/v1_stop_skip_partial_completion/s_v1_38_stop_skip_partial_completion_cases.json");

function requestWithEvents(requestName, eventSource) {
  const request = clone(fixture[requestName]);
  request.session = clone(fixture.session);
  request.current_event_log = clone(fixture[eventSource]);
  return request;
}

test("S-V1-38 exposes a closed stop skip partial completion contract", () => {
  assert.equal(stopSkipPartialCompletionContract.surface_id, "v1_stop_skip_partial_completion_flow");
  assert.equal(stopSkipPartialCompletionContract.slice_id, "S-V1-38");
  assert.equal(stopSkipPartialCompletionContract.reducer_contract, "v1_runtime_event_reducer");
  assert.deepEqual(stopSkipPartialCompletionContract.factual_event_types, [
    "STOP_SESSION",
    "SKIP_WORK_ITEM",
    "PARTIAL_COMPLETE_WORK_ITEM"
  ]);
  assert.equal(stopSkipPartialCompletionContract.history_policy, "recorded_event_log_only");
});

test("S-V1-38 records stop as a factual session event", () => {
  const request = requestWithEvents("stop_request", "started_events");
  const before = clone(request);

  const flow = buildStopSkipPartialCompletionFlow(request);

  assert.equal(flow.action_status, "stop_recorded");
  assert.equal(flow.factual_event.event_type, "STOP_SESSION");
  assert.equal(flow.factual_event.seq, 3);
  assert.equal(flow.factual_event.work_item_id, null);
  assert.equal(flow.factual_event.factual_payload.reason_code, "athlete_stopped");
  assert.equal(flow.state.status, "stopped");
  assert.equal(flow.history.includes_only_recorded_events, true);
  assert.equal(flow.history.recorded_event_count, 3);
  assert.deepEqual(flow.history.recorded_events.map((event) => event.event_type), [
    "SESSION_START",
    "COMPLETE_WORK_ITEM",
    "STOP_SESSION"
  ]);
  assert.equal(flow.event_log.prior_truth_mutated, false);
  assert.deepEqual(request, before);
});

test("S-V1-38 records skip as a factual work-item event", () => {
  const request = requestWithEvents("skip_request", "started_events");

  const flow = buildStopSkipPartialCompletionFlow(request);

  assert.equal(flow.action_status, "skip_recorded");
  assert.equal(flow.factual_event.event_type, "SKIP_WORK_ITEM");
  assert.equal(flow.factual_event.work_item_id, "work_002");
  assert.equal(flow.factual_event.factual_payload.reason_code, "not_available");
  assert.equal(flow.state.work_items.work_002.status, "skipped");
  assert.deepEqual(flow.state.counts, {
    total: 3,
    completed: 1,
    skipped: 1,
    partial: 0,
    pending: 1
  });
});

test("S-V1-38 records partial completion as factual quantity payload", () => {
  const request = requestWithEvents("partial_request", "started_events");

  const first = buildStopSkipPartialCompletionFlow(request);
  const second = buildStopSkipPartialCompletionFlow(clone(request));

  assert.equal(first.action_status, "partial_completion_recorded");
  assert.equal(first.factual_event.event_type, "PARTIAL_COMPLETE_WORK_ITEM");
  assert.equal(first.factual_event.work_item_id, "work_002");
  assert.deepEqual(first.factual_event.factual_payload, {
    declared_completed_quantity: 2,
    declared_planned_quantity: 5,
    unit: "sets",
    reason_code: "time_unavailable"
  });
  assert.equal(first.state.work_items.work_002.status, "partial");
  assert.equal(first.replay.next_state_sha256, second.replay.next_state_sha256);
  assert.deepEqual(first.state, second.state);
});

test("S-V1-38 history reflects recorded events only", () => {
  const request = requestWithEvents("partial_request", "started_events");
  const flow = buildStopSkipPartialCompletionFlow(request);

  assert.equal(flow.history.history_source, "recorded_event_log_only");
  assert.equal(flow.history.recorded_event_count, flow.event_log.next_event_count);
  assert.equal(flow.history.judgement_value, null);
  assert.deepEqual(
    flow.history.recorded_events.map((event) => ({
      seq: event.seq,
      event_id: event.event_id,
      event_type: event.event_type,
      work_item_id: event.work_item_id
    })),
    [
      {
        seq: 1,
        event_id: "event_001",
        event_type: "SESSION_START",
        work_item_id: null
      },
      {
        seq: 2,
        event_id: "event_002",
        event_type: "COMPLETE_WORK_ITEM",
        work_item_id: "work_001"
      },
      {
        seq: 3,
        event_id: flow.factual_event.event_id,
        event_type: "PARTIAL_COMPLETE_WORK_ITEM",
        work_item_id: "work_002"
      }
    ]
  );
});

test("S-V1-38 invalid stop skip partial inputs fail closed", () => {
  for (const testCase of fixture.negative_cases) {
    const request = requestWithEvents(
      testCase.base_request,
      testCase.event_log_source ?? "started_events"
    );

    if (testCase.mutation_path) {
      setPath(request, testCase.mutation_path, testCase.mutation_value);
    }

    const result = tryBuildStopSkipPartialCompletionFlow(request);

    assert.equal(result.ok, false, testCase.case_id);
    assert.equal(result.error.reason, testCase.expected_reason, testCase.case_id);
  }
});

test("S-V1-38 API adapter maps stop skip partial outcomes", () => {
  const stopped = handleV1StopSkipPartialCompletionRequest({
    method: "POST",
    path: "/v1/stop-skip-partial-completion",
    body: requestWithEvents("stop_request", "started_events")
  });

  assert.equal(stopped.status, 201);
  assert.equal(stopped.body.ok, true);
  assert.equal(stopped.body.stop_skip_partial_completion_flow.factual_event.event_type, "STOP_SESSION");

  const skipped = handleV1StopSkipPartialCompletionRequest({
    method: "POST",
    path: "/v1/stop-skip-partial-completion",
    body: requestWithEvents("skip_request", "started_events")
  });

  assert.equal(skipped.status, 201);
  assert.equal(skipped.body.ok, true);
  assert.equal(skipped.body.stop_skip_partial_completion_flow.factual_event.event_type, "SKIP_WORK_ITEM");

  const partial = handleV1StopSkipPartialCompletionRequest({
    method: "POST",
    path: "/v1/stop-skip-partial-completion",
    body: requestWithEvents("partial_request", "started_events")
  });

  assert.equal(partial.status, 201);
  assert.equal(partial.body.ok, true);
  assert.equal(partial.body.stop_skip_partial_completion_flow.factual_event.event_type, "PARTIAL_COMPLETE_WORK_ITEM");

  const methodRejected = handleV1StopSkipPartialCompletionRequest({
    method: "GET",
    path: "/v1/stop-skip-partial-completion",
    body: {}
  });

  assert.equal(methodRejected.status, 405);
});

test("S-V1-38 copy lint keeps stop skip partial copy factual", () => {
  const copyEntries = readJson("copy/stop_skip_partial_completion_copy.json");
  const registered = new Set(copyEntries.map((entry) => entry.copy_id));

  for (const copyId of Object.values(STOP_SKIP_PARTIAL_COPY_IDS)) {
    assert.equal(registered.has(copyId), true, `${copyId} missing from stop skip partial copy surface`);
  }

  const blocked = [
    "good adherence",
    "bad adherence",
    "poor adherence",
    "adherence score",
    "coaching advice",
    "recommended",
    "optimal",
    "readiness",
    "fatigue",
    "risk"
  ];

  for (const entry of copyEntries) {
    assert.equal(entry.surface_id, "v1_stop_skip_partial_completion_flow");
    assert.equal(typeof entry.text, "string");
    assert.equal(entry.text.length > 0, true);

    const text = entry.text.toLowerCase();
    for (const fragment of blocked) {
      assert.equal(text.includes(fragment), false, `${entry.copy_id} contains blocked copy fragment ${fragment}`);
    }
  }
});
