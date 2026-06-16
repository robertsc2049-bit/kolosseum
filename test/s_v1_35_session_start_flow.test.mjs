import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  SESSION_START_FLOW_COPY_IDS,
  buildSessionStartFlow,
  handleV1SessionStartRequest,
  sessionStartFlowContract,
  tryBuildSessionStartFlow
} from "../src/v1SessionStartFlow.mjs";

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
    if (!current[part] || typeof current[part] !== "object") {
      current[part] = {};
    }

    current = current[part];
  }

  current[parts[parts.length - 1]] = value;
}

const fixture = readJson("ci/fixtures/v1_session_start_flow/s_v1_35_session_start_flow_cases.json");

test("S-V1-35 exposes a closed session start flow contract", () => {
  assert.equal(sessionStartFlowContract.surface_id, "v1_session_start_flow");
  assert.equal(sessionStartFlowContract.slice_id, "S-V1-35");
  assert.equal(sessionStartFlowContract.compile_output_version, "S-V1-31");
  assert.equal(sessionStartFlowContract.start_event_type, "SESSION_START");
  assert.equal(sessionStartFlowContract.restart_policy, "return_existing_start_event_only");
});

test("S-V1-35 starts from lawful assigned compiled state only", () => {
  const request = clone(fixture.valid_request);
  const before = clone(request);

  const result = buildSessionStartFlow(request);

  assert.equal(result.surface_id, "v1_session_start_flow");
  assert.equal(result.version, "1.0.0");
  assert.equal(result.start_status, "started");
  assert.equal(result.session_id, "session_s_v1_35_001");
  assert.equal(result.assignment_id, "programme_assignment_001");
  assert.equal(result.start_event.event_type, "SESSION_START");
  assert.equal(result.start_event.factual_event, true);
  assert.equal(result.start_event.session_id, request.compiled_session.session_id);
  assert.equal(result.start_event.assignment_id, request.assignment.assignment_id);
  assert.equal(result.start_event.compile_output_hash, request.compiled_session.compile_output_hash);
  assert.match(result.start_event.event_id, /^session_start_event_[a-f0-9]{24}$/u);
  assert.equal(result.idempotency.created_start_event, true);
  assert.equal(result.idempotency.returned_existing_start_event, false);
  assert.equal(result.boundary.lawful_compiled_state_required, true);
  assert.equal(result.boundary.start_event_is_factual, true);
  assert.equal(result.boundary.ad_hoc_extra_session, false);
  assert.equal(result.boundary.coach_live_change, false);
  assert.equal(result.boundary.advisory_decision, false);

  assert.deepEqual(request, before);
});

test("S-V1-35 returns existing start event for idempotent restart path", () => {
  const request = clone(fixture.valid_request);
  request.prior_start_event = clone(fixture.prior_start_event);

  const result = buildSessionStartFlow(request);

  assert.equal(result.start_status, "already_started");
  assert.equal(result.start_event.event_id, fixture.prior_start_event.event_id);
  assert.equal(result.idempotency.created_start_event, false);
  assert.equal(result.idempotency.returned_existing_start_event, true);
  assert.equal(result.idempotency.restart_policy, "return_existing_start_event_only");
  assert.equal(result.ui_model.primary_action_state, "recorded");
});

test("S-V1-35 rejects invalid or missing compiled state", () => {
  for (const testCase of fixture.negative_cases) {
    const request = clone(fixture.valid_request);
    setPath(request, testCase.mutation_path, testCase.mutation_value);

    const result = tryBuildSessionStartFlow(request);

    assert.equal(result.ok, false, testCase.case_id);
    assert.equal(result.error.reason, testCase.expected_reason, testCase.case_id);
  }
});

test("S-V1-35 API adapter maps valid start and missing compile rejection", () => {
  const started = handleV1SessionStartRequest({
    method: "POST",
    path: "/v1/session-start",
    body: clone(fixture.valid_request)
  });

  assert.equal(started.status, 201);
  assert.equal(started.body.ok, true);
  assert.equal(started.body.start_flow.start_status, "started");

  const alreadyStartedRequest = clone(fixture.valid_request);
  alreadyStartedRequest.prior_start_event = clone(fixture.prior_start_event);

  const alreadyStarted = handleV1SessionStartRequest({
    method: "POST",
    path: "/v1/session-start",
    body: alreadyStartedRequest
  });

  assert.equal(alreadyStarted.status, 200);
  assert.equal(alreadyStarted.body.ok, true);
  assert.equal(alreadyStarted.body.start_flow.start_status, "already_started");

  const missingCompile = clone(fixture.valid_request);
  missingCompile.compiled_session = null;

  const rejected = handleV1SessionStartRequest({
    method: "POST",
    path: "/v1/session-start",
    body: missingCompile
  });

  assert.equal(rejected.status, 400);
  assert.equal(rejected.body.ok, false);
  assert.equal(rejected.body.reason, "compiled_session_missing");
});

test("S-V1-35 UI handoff is presentation-only and copy-backed", () => {
  const copyEntries = readJson("copy/session_start_flow_copy.json");
  const registered = new Set(copyEntries.map((entry) => entry.copy_id));
  const result = buildSessionStartFlow(clone(fixture.valid_request));

  for (const copyId of Object.values(SESSION_START_FLOW_COPY_IDS)) {
    assert.equal(registered.has(copyId), true, `${copyId} missing from session start copy surface`);
  }

  assert.equal(result.ui_model.surface_id, "v1_session_start_flow_ui");
  assert.equal(result.ui_model.mobile_shell_input.engineOutput.session_id, "session_s_v1_35_001");
  assert.equal(result.ui_model.mobile_shell_input.engineOutput.status, "in_progress");
  assert.equal(result.ui_model.mobile_shell_input.engineOutput.work_items.length, 2);
  assert.equal(result.ui_model.mutation_contract.creates_engine_output, false);
  assert.equal(result.ui_model.mutation_contract.changes_compile_output, false);
  assert.equal(result.ui_model.mutation_contract.coach_live_change, false);
  assert.equal(result.ui_model.mutation_contract.ad_hoc_extra_session, false);
  assert.equal(result.ui_model.mutation_contract.advisory_decision, false);
});
