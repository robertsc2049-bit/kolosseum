import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  SPLIT_RETURN_FLOW_COPY_IDS,
  buildSplitReturnFlow,
  handleV1SplitReturnFlowRequest,
  splitReturnFlowContract,
  tryBuildSplitReturnFlow
} from "../src/v1SplitReturnFlow.mjs";

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

const fixture = readJson("ci/fixtures/v1_split_return_flow/s_v1_37_split_return_flow_cases.json");

function requestWithEvents(requestName, eventSource) {
  const request = clone(fixture[requestName]);
  request.session = clone(fixture.session);
  request.current_event_log = clone(fixture[eventSource]);
  return request;
}

test("S-V1-37 exposes a closed split and return flow contract", () => {
  assert.equal(splitReturnFlowContract.surface_id, "v1_split_return_flow");
  assert.equal(splitReturnFlowContract.slice_id, "S-V1-37");
  assert.equal(splitReturnFlowContract.reducer_contract, "v1_runtime_event_reducer");
  assert.deepEqual(splitReturnFlowContract.factual_event_types, ["SPLIT_SESSION", "RETURN_CONTINUE", "RETURN_SKIP"]);
  assert.equal(splitReturnFlowContract.return_policy, "single_open_split_decision");
  assert.equal(splitReturnFlowContract.replay_policy, "resolved_return_decision_rejected");
});

test("S-V1-37 records split as factual event and exposes return action handoff", () => {
  const request = requestWithEvents("split_request", "started_events");
  const before = clone(request);

  const flow = buildSplitReturnFlow(request);

  assert.equal(flow.surface_id, "v1_split_return_flow");
  assert.equal(flow.action_status, "split_recorded");
  assert.equal(flow.factual_event.event_type, "SPLIT_SESSION");
  assert.equal(flow.factual_event.seq, 3);
  assert.equal(flow.factual_event.session_id, request.session.session_id);
  assert.equal(flow.factual_event.factual_payload.reason_code, "time_unavailable");
  assert.equal(flow.event_log.previous_event_count, 2);
  assert.equal(flow.event_log.next_event_count, 3);
  assert.equal(flow.event_log.append_only, true);
  assert.equal(flow.event_log.prior_truth_mutated, false);
  assert.equal(flow.return_decision.required_before, false);
  assert.equal(flow.return_decision.required_after, true);
  assert.deepEqual(flow.return_decision.options_after, ["RETURN_CONTINUE", "RETURN_SKIP"]);
  assert.deepEqual(
    flow.ui_model.mobile_shell.action_intents.map((action) => action.runtime_event_type),
    ["RETURN_CONTINUE", "RETURN_SKIP"]
  );

  assert.deepEqual(request, before);
});

test("S-V1-37 return continue clears the open split without changing prior event truth", () => {
  const request = requestWithEvents("return_continue_request", "split_events");
  const beforeEvents = clone(request.current_event_log);

  const flow = buildSplitReturnFlow(request);

  assert.equal(flow.action_status, "return_continue_recorded");
  assert.equal(flow.factual_event.event_type, "RETURN_CONTINUE");
  assert.equal(flow.factual_event.seq, 4);
  assert.equal(flow.return_decision.required_before, true);
  assert.equal(flow.return_decision.required_after, false);
  assert.equal(flow.return_decision.resolved_event_type, "RETURN_CONTINUE");
  assert.equal(flow.state.split.active, false);
  assert.equal(flow.state.work_items.work_001.status, "completed");
  assert.equal(flow.state.work_items.work_002.status, "pending");
  assert.equal(flow.event_log.prior_truth_mutated, false);
  assert.deepEqual(request.current_event_log, beforeEvents);
});

test("S-V1-37 return skip deterministically skips remaining-at-split work", () => {
  const request = requestWithEvents("return_skip_request", "split_events");

  const first = buildSplitReturnFlow(request);
  const second = buildSplitReturnFlow(clone(request));

  assert.equal(first.action_status, "return_skip_recorded");
  assert.equal(first.factual_event.event_type, "RETURN_SKIP");
  assert.equal(first.return_decision.required_before, true);
  assert.equal(first.return_decision.required_after, false);
  assert.equal(first.return_decision.resolved_event_type, "RETURN_SKIP");
  assert.deepEqual(first.state.counts, {
    total: 3,
    completed: 1,
    skipped: 2,
    partial: 0,
    pending: 0
  });
  assert.equal(first.state.work_items.work_002.status, "skipped");
  assert.equal(first.state.work_items.work_003.status, "skipped");
  assert.deepEqual(first.state, second.state);
  assert.equal(first.replay.next_state_sha256, second.replay.next_state_sha256);
});

test("S-V1-37 rejects replay of a resolved return decision", () => {
  const request = requestWithEvents("return_skip_request", "resolved_return_continue_events");
  const result = tryBuildSplitReturnFlow(request);

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, "return_decision_already_resolved");

  const http = handleV1SplitReturnFlowRequest({
    method: "POST",
    path: "/v1/split-return-flow",
    body: request
  });

  assert.equal(http.status, 409);
  assert.equal(http.body.ok, false);
  assert.equal(http.body.reason, "return_decision_already_resolved");
});

test("S-V1-37 invalid split and return inputs fail closed", () => {
  for (const testCase of fixture.negative_cases) {
    const request = requestWithEvents(
      testCase.base_request,
      testCase.event_log_source ?? "started_events"
    );

    if (testCase.mutation_path) {
      setPath(request, testCase.mutation_path, testCase.mutation_value);
    }

    const result = tryBuildSplitReturnFlow(request);

    assert.equal(result.ok, false, testCase.case_id);
    assert.equal(result.error.reason, testCase.expected_reason, testCase.case_id);
  }
});

test("S-V1-37 API adapter maps split and return outcomes", () => {
  const split = handleV1SplitReturnFlowRequest({
    method: "POST",
    path: "/v1/split-return-flow",
    body: requestWithEvents("split_request", "started_events")
  });

  assert.equal(split.status, 201);
  assert.equal(split.body.ok, true);
  assert.equal(split.body.split_return_flow.factual_event.event_type, "SPLIT_SESSION");

  const returned = handleV1SplitReturnFlowRequest({
    method: "POST",
    path: "/v1/split-return-flow",
    body: requestWithEvents("return_continue_request", "split_events")
  });

  assert.equal(returned.status, 201);
  assert.equal(returned.body.ok, true);
  assert.equal(returned.body.split_return_flow.factual_event.event_type, "RETURN_CONTINUE");

  const methodRejected = handleV1SplitReturnFlowRequest({
    method: "GET",
    path: "/v1/split-return-flow",
    body: {}
  });

  assert.equal(methodRejected.status, 405);
});

test("S-V1-37 copy ids are backed by split return copy surface", () => {
  const copyEntries = readJson("copy/split_return_flow_copy.json");
  const registered = new Set(copyEntries.map((entry) => entry.copy_id));

  for (const copyId of Object.values(SPLIT_RETURN_FLOW_COPY_IDS)) {
    assert.equal(registered.has(copyId), true, `${copyId} missing from split return copy surface`);
  }

  for (const entry of copyEntries) {
    assert.equal(entry.surface_id, "v1_split_return_flow");
    assert.equal(typeof entry.text, "string");
    assert.equal(entry.text.length > 0, true);
  }
});
