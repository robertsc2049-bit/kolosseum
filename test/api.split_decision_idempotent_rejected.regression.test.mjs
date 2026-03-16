/* test/api.split_decision_idempotent_rejected.regression.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import net from "node:net";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

function repoRoot() {
  const here = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(here), "..");
}

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function getFreePort() {
  return await new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      srv.close(() => resolve(addr.port));
    });
  });
}

function spawnProc(cmd, args, opts = {}) {
  const child = spawn(cmd, args, {
    stdio: ["ignore", "pipe", "pipe"],
    ...opts
  });

  let stdout = "";
  let stderr = "";

  child.stdout.on("data", (d) => {
    stdout += d.toString("utf8");
  });
  child.stderr.on("data", (d) => {
    stderr += d.toString("utf8");
  });

  return {
    child,
    get stdout() {
      return stdout;
    },
    get stderr() {
      return stderr;
    }
  };
}

function spawnNode(args, opts = {}) {
  return spawnProc(process.execPath, args, opts);
}

function spawnNpm(args, opts = {}) {
  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  return spawnProc(npmCmd, args, opts);
}

async function delay(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function waitForHealth(baseUrl, { timeoutMs = 8000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastErr = null;

  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${baseUrl}/health`);
      if (r.ok) return;
      lastErr = new Error(`health not ok: ${r.status}`);
    } catch (e) {
      lastErr = e;
    }

    await delay(120);
  }

  throw new Error(
    `server did not become healthy in time (${timeoutMs}ms). last error: ${lastErr?.message ?? String(lastErr)}`
  );
}

async function httpJson(method, url, body) {
  const init = { method, headers: { "content-type": "application/json" } };
  if (body !== undefined) init.body = JSON.stringify(body);

  const res = await fetch(url, init);
  const text = await res.text();

  let json = null;
  try {
    json = text.length ? JSON.parse(text) : null;
  } catch {
    // keep raw
  }

  return { res, text, json };
}

async function ensureBuiltDist(root, env) {
  const serverModulePath = path.join(root, "dist", "src", "server.js");
  if (await fileExists(serverModulePath)) return serverModulePath;

  const build = spawnNpm(["run", "build:fast"], { cwd: root, env });
  const code = await new Promise((resolve) => build.child.on("close", resolve));

  if (code !== 0) {
    throw new Error(
      `build:fast failed (code=${code}).\n` +
        `stdout:\n${build.stdout}\n` +
        `stderr:\n${build.stderr}`
    );
  }

  if (!(await fileExists(serverModulePath))) {
    throw new Error(
      `build:fast completed but server module is still missing:\n${serverModulePath}`
    );
  }

  return serverModulePath;
}

async function createSession(baseUrl, root) {
  const helloPath = path.join(root, "examples", "hello_world.json");
  const phase1 = JSON.parse(await fs.readFile(helloPath, "utf8"));

  const compile = await httpJson(
    "POST",
    `${baseUrl}/blocks/compile?create_session=true`,
    { phase1_input: phase1 }
  );

  assert.equal(
    compile.res.status,
    201,
    `compile expected 201, got ${compile.res.status}. raw=${compile.text}`
  );
  assert.ok(
    compile.json && typeof compile.json === "object",
    `compile expected JSON object. raw=${compile.text}`
  );
  assert.ok(
    typeof compile.json.session_id === "string" && compile.json.session_id.length > 0,
    `missing session_id. raw=${compile.text}`
  );

  const sessionId = compile.json.session_id;

  const start = await httpJson("POST", `${baseUrl}/sessions/${sessionId}/start`, {});
  assert.ok(
    start.res.status === 200 || start.res.status === 201,
    `start expected 200/201, got ${start.res.status}. raw=${start.text}`
  );

  return sessionId;
}

async function getState(baseUrl, sessionId, label) {
  const state = await httpJson("GET", `${baseUrl}/sessions/${sessionId}/state`);
  assert.equal(
    state.res.status,
    200,
    `${label}: state expected 200, got ${state.res.status}. raw=${state.text}`
  );
  assert.ok(
    state.json && typeof state.json === "object",
    `${label}: state expected JSON. raw=${state.text}`
  );
  assert.ok(
    state.json.trace && typeof state.json.trace === "object",
    `${label}: state trace missing. raw=${state.text}`
  );
  return state;
}

async function getEvents(baseUrl, sessionId, label) {
  const events = await httpJson("GET", `${baseUrl}/sessions/${sessionId}/events`);
  assert.equal(
    events.res.status,
    200,
    `${label}: events expected 200, got ${events.res.status}. raw=${events.text}`
  );
  assert.ok(
    events.json && typeof events.json === "object",
    `${label}: events expected JSON. raw=${events.text}`
  );
  assert.ok(
    Array.isArray(events.json.events),
    `${label}: expected events array. raw=${events.text}`
  );
  return events;
}

function assertRejectedResolvedReplay(replay, { label, decisionType, ordinal }) {
  const replayLabel = ordinal
    ? `${label}: rejected replay #${ordinal}`
    : `${label}: replayed ${decisionType}`;

  assert.equal(
    replay.res.status,
    409,
    `${replayLabel} expected 409, got ${replay.res.status}. raw=${replay.text}`
  );
  assert.ok(
    replay.json && typeof replay.json === "object",
    `${replayLabel}: expected replay error JSON. raw=${replay.text}`
  );
  assert.equal(
    replay.json.details?.failure_token,
    "phase6_runtime_resolved_return_decision_replay",
    `${replayLabel}: expected failure_token phase6_runtime_resolved_return_decision_replay. raw=${replay.text}`
  );
  assert.equal(
    replay.json.details?.cause,
    `PHASE6_RUNTIME_RESOLVED_RETURN_DECISION_REPLAY: ${decisionType}`,
    `${replayLabel}: expected explicit cause for resolved replay. raw=${replay.text}`
  );
}

function assertByteStableState(statePayload, acceptedState, acceptedStateText, label) {
  assert.equal(
    statePayload.text,
    acceptedStateText,
    `${label}: /state raw payload changed.\nbefore=${acceptedStateText}\nafter=${statePayload.text}`
  );
  assert.deepEqual(
    statePayload.json,
    acceptedState.json,
    `${label}: /state JSON changed.\nbefore=${JSON.stringify(acceptedState.json)}\nafter=${JSON.stringify(statePayload.json)}`
  );
}

function assertByteStableEvents(eventsPayload, acceptedEvents, acceptedEventsText, label) {
  assert.equal(
    eventsPayload.text,
    acceptedEventsText,
    `${label}: /events raw payload changed.\nbefore=${acceptedEventsText}\nafter=${eventsPayload.text}`
  );
  assert.deepEqual(
    eventsPayload.json,
    acceptedEvents.json,
    `${label}: /events JSON changed.\nbefore=${JSON.stringify(acceptedEvents.json)}\nafter=${JSON.stringify(eventsPayload.json)}`
  );
}

function snapshotEventOrdering(eventsPayload) {
  const events = eventsPayload?.json?.events;
  assert.ok(Array.isArray(events), "snapshotEventOrdering expected events array");

  return events.map((event, index) => ({
    index,
    session_event_seq: event?.session_event_seq ?? null,
    event_id: event?.event_id ?? null,
    type: event?.type ?? null
  }));
}

function assertAppendOnlyEventCardinalityAndOrderingStable(
  eventsPayload,
  acceptedEvents,
  acceptedOrdering,
  label
) {
  const actualEvents = eventsPayload?.json?.events;
  const expectedEvents = acceptedEvents?.json?.events;

  assert.ok(Array.isArray(actualEvents), `${label}: actual events array missing`);
  assert.ok(Array.isArray(expectedEvents), `${label}: expected events array missing`);

  assert.equal(
    actualEvents.length,
    expectedEvents.length,
    `${label}: event cardinality changed.\nbefore=${expectedEvents.length}\nafter=${actualEvents.length}`
  );

  const actualOrdering = snapshotEventOrdering(eventsPayload);
  assert.deepEqual(
    actualOrdering,
    acceptedOrdering,
    `${label}: append-only event ordering changed.\nbefore=${JSON.stringify(acceptedOrdering)}\nafter=${JSON.stringify(actualOrdering)}`
  );

  const actualSeqs = actualOrdering.map((x) => x.session_event_seq);
  const expectedSeqs = acceptedOrdering.map((x) => x.session_event_seq);
  assert.deepEqual(
    actualSeqs,
    expectedSeqs,
    `${label}: session_event_seq order drifted.\nbefore=${JSON.stringify(expectedSeqs)}\nafter=${JSON.stringify(actualSeqs)}`
  );

  const actualIds = actualOrdering.map((x) => x.event_id);
  const expectedIds = acceptedOrdering.map((x) => x.event_id);
  assert.deepEqual(
    actualIds,
    expectedIds,
    `${label}: event_id order drifted.\nbefore=${JSON.stringify(expectedIds)}\nafter=${JSON.stringify(actualIds)}`
  );

  const actualTypes = actualOrdering.map((x) => x.type);
  const expectedTypes = acceptedOrdering.map((x) => x.type);
  assert.deepEqual(
    actualTypes,
    expectedTypes,
    `${label}: event type order drifted.\nbefore=${JSON.stringify(expectedTypes)}\nafter=${JSON.stringify(actualTypes)}`
  );
}

function snapshotNormalizedCurrentStepIdentity(statePayload) {
  const currentStep = statePayload?.json?.current_step ?? null;
  const trace = statePayload?.json?.trace;

  assert.ok(trace && typeof trace === "object", "snapshotNormalizedCurrentStepIdentity expected trace object");

  return {
    current_step_present: currentStep !== null,
    current_step_type: currentStep?.type ?? null,
    current_step_exercise_id: currentStep?.exercise?.exercise_id ?? null,
    current_step_block_id: currentStep?.block_id ?? null,
    trace_return_decision_required: trace?.return_decision_required ?? null,
    trace_return_decision_options: Array.isArray(trace?.return_decision_options)
      ? [...trace.return_decision_options]
      : [],
    trace_split_session_active: trace?.split_session_active ?? null
  };
}

function assertNormalizedCurrentStepIdentityAndTraceStable(
  statePayload,
  acceptedState,
  acceptedIdentity,
  label
) {
  const actualIdentity = snapshotNormalizedCurrentStepIdentity(statePayload);

  assert.deepEqual(
    actualIdentity,
    acceptedIdentity,
    `${label}: normalized current-step identity or trace contract changed.\nbefore=${JSON.stringify(acceptedIdentity)}\nafter=${JSON.stringify(actualIdentity)}`
  );

  assert.equal(
    statePayload?.json?.current_step?.type ?? null,
    acceptedState?.json?.current_step?.type ?? null,
    `${label}: current_step.type drifted`
  );

  assert.equal(
    statePayload?.json?.current_step?.exercise?.exercise_id ?? null,
    acceptedState?.json?.current_step?.exercise?.exercise_id ?? null,
    `${label}: current_step.exercise.exercise_id drifted`
  );

  assert.equal(
    (statePayload?.json?.current_step ?? null) !== null,
    (acceptedState?.json?.current_step ?? null) !== null,
    `${label}: current_step presence drifted`
  );

  assert.equal(
    statePayload?.json?.trace?.return_decision_required ?? null,
    acceptedState?.json?.trace?.return_decision_required ?? null,
    `${label}: trace.return_decision_required drifted`
  );

  assert.deepEqual(
    Array.isArray(statePayload?.json?.trace?.return_decision_options)
      ? statePayload.json.trace.return_decision_options
      : [],
    Array.isArray(acceptedState?.json?.trace?.return_decision_options)
      ? acceptedState.json.trace.return_decision_options
      : [],
    `${label}: trace.return_decision_options drifted`
  );
}

function snapshotTerminalStateShape(statePayload) {
  const currentStep = statePayload?.json?.current_step ?? null;
  const trace = statePayload?.json?.trace;

  assert.ok(trace && typeof trace === "object", "snapshotTerminalStateShape expected trace object");

  return {
    terminal_current_step_present: currentStep !== null,
    terminal_current_step_type: currentStep?.type ?? null,
    terminal_current_step_exercise_id: currentStep?.exercise?.exercise_id ?? null,
    terminal_current_step_block_id: currentStep?.block_id ?? null,
    terminal_trace_return_decision_required: trace?.return_decision_required ?? null,
    terminal_trace_return_decision_options: Array.isArray(trace?.return_decision_options)
      ? [...trace.return_decision_options]
      : [],
    terminal_trace_split_session_active: trace?.split_session_active ?? null
  };
}

function assertTerminalStateShapeAndNoResurrectionStable(
  statePayload,
  acceptedTerminalState,
  acceptedTerminalShape,
  label
) {
  const actualShape = snapshotTerminalStateShape(statePayload);

  assert.deepEqual(
    actualShape,
    acceptedTerminalShape,
    `${label}: terminal-state shape changed.\nbefore=${JSON.stringify(acceptedTerminalShape)}\nafter=${JSON.stringify(actualShape)}`
  );

  assert.equal(
    statePayload?.json?.current_step ?? null,
    null,
    `${label}: current_step resurrected in terminal state`
  );

  assert.equal(
    statePayload?.json?.trace?.return_decision_required ?? null,
    false,
    `${label}: terminal return gate resurrected`
  );

  assert.deepEqual(
    Array.isArray(statePayload?.json?.trace?.return_decision_options)
      ? statePayload.json.trace.return_decision_options
      : [],
    [],
    `${label}: terminal return decision options resurrected`
  );

  assert.equal(
    acceptedTerminalState?.json?.current_step ?? null,
    null,
    `${label}: accepted terminal baseline was not terminal`
  );
}

async function advanceSessionToTerminalState({
  baseUrl,
  sessionId,
  sessionStateCache,
  label,
  maxSteps = 20
}) {
  let attempts = 0;

  while (attempts < maxSteps) {
    attempts += 1;

    sessionStateCache.clear();
    const state = await getState(
      baseUrl,
      sessionId,
      `${label} terminal advance state ${attempts}`
    );

    const currentStep = state.json.current_step ?? null;
    if (currentStep === null) {
      assert.equal(
        state.json.trace.return_decision_required,
        false,
        `${label}: terminal state must remain ungated. trace=${JSON.stringify(state.json.trace)}`
      );
      assert.deepEqual(
        Array.isArray(state.json.trace.return_decision_options)
          ? state.json.trace.return_decision_options
          : [],
        [],
        `${label}: terminal state must not expose return options. trace=${JSON.stringify(state.json.trace)}`
      );
      return state;
    }

    assert.equal(
      currentStep.type,
      "EXERCISE",
      `${label}: expected EXERCISE while advancing to terminal state. raw=${JSON.stringify(state.json)}`
    );
    assert.ok(
      typeof currentStep.exercise?.exercise_id === "string" &&
        currentStep.exercise.exercise_id.length > 0,
      `${label}: expected exercise_id while advancing to terminal state. raw=${JSON.stringify(state.json)}`
    );

    const complete = await httpJson(
      "POST",
      `${baseUrl}/sessions/${sessionId}/events`,
      {
        event: {
          type: "COMPLETE_EXERCISE",
          exercise_id: currentStep.exercise.exercise_id
        }
      }
    );

    assert.equal(
      complete.res.status,
      201,
      `${label}: COMPLETE_EXERCISE while advancing to terminal expected 201, got ${complete.res.status}. raw=${complete.text}`
    );
  }

  throw new Error(`${label}: failed to reach terminal state within ${maxSteps} exercise completions`);
}

async function runResolvedReplayScenario({
  baseUrl,
  root,
  sessionStateCache,
  label,
  decisionType,
  requireByteStableImmediateReplay = false,
  requireByteStableAcrossRepeatedReloads = false,
  requireByteStableAfterDownstreamProgress = false,
  requireByteStableAcrossMixedReadPaths = false,
  requireByteStableAcrossAlternatingReadCyclesAfterMultipleRejectedReposts = false,
  requireAppendOnlyEventCardinalityAndOrderingAcrossRepeatedInterleavedReads = false,
  requireNormalizedCurrentStepIdentityAndTraceContractAcrossRepeatedInterleavedReads = false,
  requireTerminalStateShapeAndNoResurrectionAcrossRepeatedInterleavedReads = false
}) {
  const sessionId = await createSession(baseUrl, root);

  const initialState = await getState(baseUrl, sessionId, `${label} initial`);
  assert.ok(
    initialState.json.current_step &&
      initialState.json.current_step.type === "EXERCISE" &&
      typeof initialState.json.current_step.exercise?.exercise_id === "string" &&
      initialState.json.current_step.exercise.exercise_id.length > 0,
    `${label}: expected EXERCISE current_step. raw=${JSON.stringify(initialState.json)}`
  );

  const firstExerciseId = initialState.json.current_step.exercise.exercise_id;

  {
    const r = await httpJson(
      "POST",
      `${baseUrl}/sessions/${sessionId}/events`,
      { event: { type: "COMPLETE_EXERCISE", exercise_id: firstExerciseId } }
    );
    assert.equal(
      r.res.status,
      201,
      `${label}: initial COMPLETE_EXERCISE expected 201, got ${r.res.status}. raw=${r.text}`
    );
  }

  {
    const r = await httpJson(
      "POST",
      `${baseUrl}/sessions/${sessionId}/events`,
      { event: { type: "SPLIT_SESSION" } }
    );
    assert.equal(
      r.res.status,
      201,
      `${label}: SPLIT_SESSION expected 201, got ${r.res.status}. raw=${r.text}`
    );
  }

  const splitState = await getState(baseUrl, sessionId, `${label} split`);
  assert.equal(
    splitState.json.trace.return_decision_required,
    true,
    `${label}: expected gated split trace. trace=${JSON.stringify(splitState.json.trace)}`
  );
  assert.deepEqual(
    [...splitState.json.trace.return_decision_options].slice().sort(),
    ["RETURN_CONTINUE", "RETURN_SKIP"],
    `${label}: expected both return options at split. trace=${JSON.stringify(splitState.json.trace)}`
  );

  {
    const r = await httpJson(
      "POST",
      `${baseUrl}/sessions/${sessionId}/events`,
      { event: { type: decisionType } }
    );
    assert.equal(
      r.res.status,
      201,
      `${label}: first ${decisionType} expected 201, got ${r.res.status}. raw=${r.text}`
    );
  }

  const acceptedEventsAfterDecision = await getEvents(
    baseUrl,
    sessionId,
    `${label} accepted events after decision`
  );
  const acceptedStateAfterDecision = await getState(
    baseUrl,
    sessionId,
    `${label} accepted state after decision`
  );

  assert.equal(
    acceptedStateAfterDecision.json.trace.return_decision_required,
    false,
    `${label}: expected gate cleared after first ${decisionType}. trace=${JSON.stringify(acceptedStateAfterDecision.json.trace)}`
  );
  assert.deepEqual(
    acceptedStateAfterDecision.json.trace.return_decision_options,
    [],
    `${label}: expected no return options after first ${decisionType}. trace=${JSON.stringify(acceptedStateAfterDecision.json.trace)}`
  );

  let acceptedEvents = acceptedEventsAfterDecision;
  let acceptedState = acceptedStateAfterDecision;

  if (requireByteStableAfterDownstreamProgress) {
    const acceptedCurrentStep = acceptedStateAfterDecision.json.current_step ?? null;

    if (
      acceptedCurrentStep?.type === "EXERCISE" &&
      typeof acceptedCurrentStep?.exercise?.exercise_id === "string" &&
      acceptedCurrentStep.exercise.exercise_id.length > 0
    ) {
      const downstreamExerciseId = acceptedCurrentStep.exercise.exercise_id;

      const downstream = await httpJson(
        "POST",
        `${baseUrl}/sessions/${sessionId}/events`,
        {
          event: {
            type: "COMPLETE_EXERCISE",
            exercise_id: downstreamExerciseId
          }
        }
      );

      assert.equal(
        downstream.res.status,
        201,
        `${label}: downstream COMPLETE_EXERCISE expected 201, got ${downstream.res.status}. raw=${downstream.text}`
      );

      sessionStateCache.clear();

      acceptedEvents = await getEvents(
        baseUrl,
        sessionId,
        `${label} accepted events after downstream progress`
      );
      acceptedState = await getState(
        baseUrl,
        sessionId,
        `${label} accepted state after downstream progress`
      );

      assert.equal(
        acceptedState.json.trace.return_decision_required,
        false,
        `${label}: downstream progress must remain ungated. trace=${JSON.stringify(acceptedState.json.trace)}`
      );
      assert.deepEqual(
        acceptedState.json.trace.return_decision_options,
        [],
        `${label}: downstream progress must not restore return options. trace=${JSON.stringify(acceptedState.json.trace)}`
      );
    }
  }

  let acceptedEventsText = acceptedEvents.text;
  let acceptedStateText = acceptedState.text;
  let acceptedEventOrdering = snapshotEventOrdering(acceptedEvents);
  let acceptedNormalizedCurrentStepIdentity =
    snapshotNormalizedCurrentStepIdentity(acceptedState);

  const replay = await httpJson(
    "POST",
    `${baseUrl}/sessions/${sessionId}/events`,
    { event: { type: decisionType } }
  );
  assertRejectedResolvedReplay(replay, { label, decisionType });

  if (requireByteStableAcrossMixedReadPaths) {
    sessionStateCache.clear();

    const mixedHydratedState = await getState(
      baseUrl,
      sessionId,
      `${label} mixed hydrated state`
    );

    sessionStateCache.clear();

    const mixedHydratedEvents = await getEvents(
      baseUrl,
      sessionId,
      `${label} mixed hydrated events`
    );

    assertByteStableState(
      mixedHydratedState,
      acceptedState,
      acceptedStateText,
      `${label}: /state across mixed cache/hydrated reads after rejected replay`
    );
    assertByteStableEvents(
      mixedHydratedEvents,
      acceptedEvents,
      acceptedEventsText,
      `${label}: /events across mixed cache/hydrated reads after rejected replay`
    );
  }

  if (requireByteStableAcrossAlternatingReadCyclesAfterMultipleRejectedReposts) {
    for (let i = 2; i <= 3; i += 1) {
      const replayAgain = await httpJson(
        "POST",
        `${baseUrl}/sessions/${sessionId}/events`,
        { event: { type: decisionType } }
      );
      assertRejectedResolvedReplay(replayAgain, { label, decisionType, ordinal: i });
    }

    for (let cycle = 1; cycle <= 2; cycle += 1) {
      sessionStateCache.clear();
      const stateA = await getState(
        baseUrl,
        sessionId,
        `${label} alternating cycle ${cycle} state A`
      );
      const eventsMid = await getEvents(
        baseUrl,
        sessionId,
        `${label} alternating cycle ${cycle} events`
      );
      const stateB = await getState(
        baseUrl,
        sessionId,
        `${label} alternating cycle ${cycle} state B`
      );

      assertByteStableState(
        stateA,
        acceptedState,
        acceptedStateText,
        `${label}: alternating cycle ${cycle} first /state after multiple rejected re-posts`
      );
      assertByteStableEvents(
        eventsMid,
        acceptedEvents,
        acceptedEventsText,
        `${label}: alternating cycle ${cycle} /events after multiple rejected re-posts`
      );
      assertByteStableState(
        stateB,
        acceptedState,
        acceptedStateText,
        `${label}: alternating cycle ${cycle} second /state after multiple rejected re-posts`
      );
    }
  }

  if (requireAppendOnlyEventCardinalityAndOrderingAcrossRepeatedInterleavedReads) {
    for (let i = 2; i <= 4; i += 1) {
      const replayAgain = await httpJson(
        "POST",
        `${baseUrl}/sessions/${sessionId}/events`,
        { event: { type: decisionType } }
      );
      assertRejectedResolvedReplay(replayAgain, { label, decisionType, ordinal: i });
    }

    for (let cycle = 1; cycle <= 3; cycle += 1) {
      sessionStateCache.clear();

      const interleavedEventsA = await getEvents(
        baseUrl,
        sessionId,
        `${label} interleaved cycle ${cycle} events A`
      );
      const interleavedState = await getState(
        baseUrl,
        sessionId,
        `${label} interleaved cycle ${cycle} state`
      );
      const interleavedEventsB = await getEvents(
        baseUrl,
        sessionId,
        `${label} interleaved cycle ${cycle} events B`
      );

      assertAppendOnlyEventCardinalityAndOrderingStable(
        interleavedEventsA,
        acceptedEvents,
        acceptedEventOrdering,
        `${label}: interleaved cycle ${cycle} first /events`
      );
      assertByteStableState(
        interleavedState,
        acceptedState,
        acceptedStateText,
        `${label}: interleaved cycle ${cycle} /state`
      );
      assertAppendOnlyEventCardinalityAndOrderingStable(
        interleavedEventsB,
        acceptedEvents,
        acceptedEventOrdering,
        `${label}: interleaved cycle ${cycle} second /events`
      );
    }
  }

  if (requireNormalizedCurrentStepIdentityAndTraceContractAcrossRepeatedInterleavedReads) {
    for (let i = 2; i <= 4; i += 1) {
      const replayAgain = await httpJson(
        "POST",
        `${baseUrl}/sessions/${sessionId}/events`,
        { event: { type: decisionType } }
      );
      assertRejectedResolvedReplay(replayAgain, { label, decisionType, ordinal: i });
    }

    for (let cycle = 1; cycle <= 3; cycle += 1) {
      sessionStateCache.clear();

      const interleavedStateA = await getState(
        baseUrl,
        sessionId,
        `${label} normalized current-step cycle ${cycle} state A`
      );
      const interleavedEvents = await getEvents(
        baseUrl,
        sessionId,
        `${label} normalized current-step cycle ${cycle} events`
      );
      const interleavedStateB = await getState(
        baseUrl,
        sessionId,
        `${label} normalized current-step cycle ${cycle} state B`
      );

      assertNormalizedCurrentStepIdentityAndTraceStable(
        interleavedStateA,
        acceptedState,
        acceptedNormalizedCurrentStepIdentity,
        `${label}: normalized current-step cycle ${cycle} first /state`
      );
      assertAppendOnlyEventCardinalityAndOrderingStable(
        interleavedEvents,
        acceptedEvents,
        acceptedEventOrdering,
        `${label}: normalized current-step cycle ${cycle} /events`
      );
      assertNormalizedCurrentStepIdentityAndTraceStable(
        interleavedStateB,
        acceptedState,
        acceptedNormalizedCurrentStepIdentity,
        `${label}: normalized current-step cycle ${cycle} second /state`
      );
    }
  }

  if (requireTerminalStateShapeAndNoResurrectionAcrossRepeatedInterleavedReads) {
    const acceptedTerminalState = await advanceSessionToTerminalState({
      baseUrl,
      sessionId,
      sessionStateCache,
      label: `${label} terminal advance`
    });

    sessionStateCache.clear();
    acceptedEvents = await getEvents(
      baseUrl,
      sessionId,
      `${label} accepted terminal events`
    );
    acceptedState = acceptedTerminalState;

    acceptedStateText = acceptedState.text;
    acceptedEventsText = acceptedEvents.text;
    acceptedEventOrdering = snapshotEventOrdering(acceptedEvents);
    acceptedNormalizedCurrentStepIdentity =
      snapshotNormalizedCurrentStepIdentity(acceptedState);

    const acceptedTerminalShape = snapshotTerminalStateShape(acceptedState);
    const acceptedTerminalOrdering = acceptedEventOrdering;

    for (let i = 2; i <= 4; i += 1) {
      const replayAgain = await httpJson(
        "POST",
        `${baseUrl}/sessions/${sessionId}/events`,
        { event: { type: decisionType } }
      );
      assertRejectedResolvedReplay(replayAgain, { label, decisionType, ordinal: i });
    }

    for (let cycle = 1; cycle <= 3; cycle += 1) {
      sessionStateCache.clear();

      const interleavedEventsA = await getEvents(
        baseUrl,
        sessionId,
        `${label} terminal cycle ${cycle} events A`
      );
      const interleavedState = await getState(
        baseUrl,
        sessionId,
        `${label} terminal cycle ${cycle} state`
      );
      const interleavedEventsB = await getEvents(
        baseUrl,
        sessionId,
        `${label} terminal cycle ${cycle} events B`
      );

      assertAppendOnlyEventCardinalityAndOrderingStable(
        interleavedEventsA,
        acceptedEvents,
        acceptedTerminalOrdering,
        `${label}: terminal cycle ${cycle} first /events`
      );
      assertTerminalStateShapeAndNoResurrectionStable(
        interleavedState,
        acceptedState,
        acceptedTerminalShape,
        `${label}: terminal cycle ${cycle} /state`
      );
      assertAppendOnlyEventCardinalityAndOrderingStable(
        interleavedEventsB,
        acceptedEvents,
        acceptedTerminalOrdering,
        `${label}: terminal cycle ${cycle} second /events`
      );
    }

    sessionStateCache.clear();

    const afterTerminalReplayEvents = await getEvents(
      baseUrl,
      sessionId,
      `${label} after terminal replay events`
    );
    const afterTerminalReplayState = await getState(
      baseUrl,
      sessionId,
      `${label} after terminal replay state`
    );

    assertByteStableEvents(
      afterTerminalReplayEvents,
      acceptedEvents,
      acceptedEventsText,
      `${label}: terminal /events after rejected replay`
    );
    assertByteStableState(
      afterTerminalReplayState,
      acceptedState,
      acceptedStateText,
      `${label}: terminal /state after rejected replay`
    );
    assertTerminalStateShapeAndNoResurrectionStable(
      afterTerminalReplayState,
      acceptedState,
      acceptedTerminalShape,
      `${label}: final terminal /state after repeated interleaved reads`
    );
  }

  sessionStateCache.clear();

  const afterReplayEvents = await getEvents(baseUrl, sessionId, `${label} after replay events`);
  const afterReplayState = await getState(baseUrl, sessionId, `${label} after replay state`);

  if (requireByteStableImmediateReplay) {
    assertByteStableEvents(
      afterReplayEvents,
      acceptedEvents,
      acceptedEventsText,
      `${label}: /events after rejected replay`
    );
    assertByteStableState(
      afterReplayState,
      acceptedState,
      acceptedStateText,
      `${label}: /state after rejected replay`
    );
  } else {
    assert.deepEqual(
      afterReplayEvents.json,
      acceptedEvents.json,
      `${label}: /events changed after rejected replay.\nbefore=${JSON.stringify(acceptedEvents.json)}\nafter=${JSON.stringify(afterReplayEvents.json)}`
    );
    assert.deepEqual(
      afterReplayState.json,
      acceptedState.json,
      `${label}: /state changed after rejected replay.\nbefore=${JSON.stringify(acceptedState.json)}\nafter=${JSON.stringify(afterReplayState.json)}`
    );
  }

  if (requireAppendOnlyEventCardinalityAndOrderingAcrossRepeatedInterleavedReads) {
    assertAppendOnlyEventCardinalityAndOrderingStable(
      afterReplayEvents,
      acceptedEvents,
      acceptedEventOrdering,
      `${label}: final /events after repeated interleaved reads`
    );
  }

  if (requireNormalizedCurrentStepIdentityAndTraceContractAcrossRepeatedInterleavedReads) {
    assertNormalizedCurrentStepIdentityAndTraceStable(
      afterReplayState,
      acceptedState,
      acceptedNormalizedCurrentStepIdentity,
      `${label}: final /state after repeated interleaved reads`
    );
  }

  if (requireByteStableAcrossRepeatedReloads) {
    sessionStateCache.clear();

    const secondReloadEvents = await getEvents(
      baseUrl,
      sessionId,
      `${label} second reload events`
    );
    const secondReloadState = await getState(
      baseUrl,
      sessionId,
      `${label} second reload state`
    );

    assertByteStableEvents(
      secondReloadEvents,
      acceptedEvents,
      acceptedEventsText,
      `${label}: /events across repeated reloads after rejected replay`
    );
    assertByteStableState(
      secondReloadState,
      acceptedState,
      acceptedStateText,
      `${label}: /state across repeated reloads after rejected replay`
    );

    if (requireAppendOnlyEventCardinalityAndOrderingAcrossRepeatedInterleavedReads) {
      assertAppendOnlyEventCardinalityAndOrderingStable(
        secondReloadEvents,
        acceptedEvents,
        acceptedEventOrdering,
        `${label}: second reload /events after repeated interleaved reads`
      );
    }

    if (requireNormalizedCurrentStepIdentityAndTraceContractAcrossRepeatedInterleavedReads) {
      assertNormalizedCurrentStepIdentityAndTraceStable(
        secondReloadState,
        acceptedState,
        acceptedNormalizedCurrentStepIdentity,
        `${label}: second reload /state after repeated interleaved reads`
      );
    }
  }
}

async function withServer(t, fn) {
  const root = repoRoot();

  const databaseUrl =
    process.env.DATABASE_URL ??
    "postgres://postgres:postgres@127.0.0.1:5432/kolosseum_test";

  const buildEnv = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    PORT: "0"
  };
  delete buildEnv.SMOKE_NO_DB;

  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousSmokeNoDb = process.env.SMOKE_NO_DB;

  process.env.DATABASE_URL = databaseUrl;
  delete process.env.SMOKE_NO_DB;

  t.after(() => {
    if (typeof previousDatabaseUrl === "undefined") {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl;
    }

    if (typeof previousSmokeNoDb === "undefined") {
      delete process.env.SMOKE_NO_DB;
    } else {
      process.env.SMOKE_NO_DB = previousSmokeNoDb;
    }
  });

  const serverModulePath = await ensureBuiltDist(root, buildEnv);

  {
    const schemaScript = path.join(root, "scripts", "apply-schema.mjs");
    const schema = spawnNode([schemaScript], { cwd: root, env: buildEnv });
    const code = await new Promise((resolve) => schema.child.on("close", resolve));
    if (code !== 0) {
      throw new Error(
        `apply-schema failed (code=${code}).\nstdout:\n${schema.stdout}\nstderr:\n${schema.stderr}`
      );
    }
  }

  const port = await getFreePort();
  process.env.PORT = String(port);

  const serverModuleUrl = pathToFileURL(serverModulePath).href + `?t=${Date.now()}`;
  const cacheModuleUrl =
    pathToFileURL(path.join(root, "dist", "src", "api", "session_state_cache.js")).href +
    `?t=${Date.now()}`;

  const [{ app }, { sessionStateCache }] = await Promise.all([
    import(serverModuleUrl),
    import(cacheModuleUrl)
  ]);

  assert.ok(app && typeof app.listen === "function", "expected dist server app.listen()");
  assert.ok(
    sessionStateCache && typeof sessionStateCache.clear === "function",
    "expected dist sessionStateCache.clear()"
  );

  const baseUrl = `http://127.0.0.1:${port}`;

  const srv = await new Promise((resolve, reject) => {
    const instance = app.listen(port, "127.0.0.1", () => resolve(instance));
    instance.on("error", reject);
  });

  t.after(async () => {
    await new Promise((resolve) => {
      try {
        srv.close(() => resolve());
      } catch {
        resolve();
      }
    });
    await delay(50);
  });

  await waitForHealth(baseUrl);

  await fn({ baseUrl, root, sessionStateCache });
}

test("API regression: split decision commands are idempotent-rejected after gate resolution", async (t) => {
  await withServer(t, async ({ baseUrl, root, sessionStateCache }) => {
    await runResolvedReplayScenario({
      baseUrl,
      root,
      sessionStateCache,
      label: "continue scenario",
      decisionType: "RETURN_CONTINUE"
    });

    await runResolvedReplayScenario({
      baseUrl,
      root,
      sessionStateCache,
      label: "skip scenario",
      decisionType: "RETURN_SKIP"
    });
  });
});

test("API regression: RETURN_CONTINUE replay rejection leaves /events and /state byte-stable across immediate re-post", async (t) => {
  await withServer(t, async ({ baseUrl, root, sessionStateCache }) => {
    await runResolvedReplayScenario({
      baseUrl,
      root,
      sessionStateCache,
      label: "continue byte-stable immediate replay scenario",
      decisionType: "RETURN_CONTINUE",
      requireByteStableImmediateReplay: true
    });
  });
});

test("API regression: RETURN_SKIP replay rejection leaves /events and /state byte-stable across immediate re-post", async (t) => {
  await withServer(t, async ({ baseUrl, root, sessionStateCache }) => {
    await runResolvedReplayScenario({
      baseUrl,
      root,
      sessionStateCache,
      label: "skip byte-stable immediate replay scenario",
      decisionType: "RETURN_SKIP",
      requireByteStableImmediateReplay: true
    });
  });
});

test("API regression: rejected split-decision replay remains byte-stable across repeated reloads", async (t) => {
  await withServer(t, async ({ baseUrl, root, sessionStateCache }) => {
    await runResolvedReplayScenario({
      baseUrl,
      root,
      sessionStateCache,
      label: "continue repeated-reload byte-stable replay scenario",
      decisionType: "RETURN_CONTINUE",
      requireByteStableImmediateReplay: true,
      requireByteStableAcrossRepeatedReloads: true
    });

    await runResolvedReplayScenario({
      baseUrl,
      root,
      sessionStateCache,
      label: "skip repeated-reload byte-stable replay scenario",
      decisionType: "RETURN_SKIP",
      requireByteStableImmediateReplay: true,
      requireByteStableAcrossRepeatedReloads: true
    });
  });
});

test("API regression: rejected RETURN_CONTINUE replay remains byte-stable after accepted downstream progress", async (t) => {
  await withServer(t, async ({ baseUrl, root, sessionStateCache }) => {
    await runResolvedReplayScenario({
      baseUrl,
      root,
      sessionStateCache,
      label: "continue downstream-progress byte-stable replay scenario",
      decisionType: "RETURN_CONTINUE",
      requireByteStableImmediateReplay: true,
      requireByteStableAfterDownstreamProgress: true
    });
  });
});

test("API regression: rejected split-decision replay remains byte-stable across mixed cache/hydrated reads", async (t) => {
  await withServer(t, async ({ baseUrl, root, sessionStateCache }) => {
    await runResolvedReplayScenario({
      baseUrl,
      root,
      sessionStateCache,
      label: "continue mixed-read byte-stable replay scenario",
      decisionType: "RETURN_CONTINUE",
      requireByteStableImmediateReplay: true,
      requireByteStableAcrossMixedReadPaths: true
    });

    await runResolvedReplayScenario({
      baseUrl,
      root,
      sessionStateCache,
      label: "skip mixed-read byte-stable replay scenario",
      decisionType: "RETURN_SKIP",
      requireByteStableImmediateReplay: true,
      requireByteStableAcrossMixedReadPaths: true
    });
  });
});

test("API regression: rejected split-decision replay remains byte-stable across alternating /state -> /events -> /state read cycles after multiple rejected re-posts", async (t) => {
  await withServer(t, async ({ baseUrl, root, sessionStateCache }) => {
    await runResolvedReplayScenario({
      baseUrl,
      root,
      sessionStateCache,
      label: "continue alternating state-events-state byte-stable replay scenario",
      decisionType: "RETURN_CONTINUE",
      requireByteStableImmediateReplay: true,
      requireByteStableAcrossAlternatingReadCyclesAfterMultipleRejectedReposts: true
    });

    await runResolvedReplayScenario({
      baseUrl,
      root,
      sessionStateCache,
      label: "skip alternating state-events-state byte-stable replay scenario",
      decisionType: "RETURN_SKIP",
      requireByteStableImmediateReplay: true,
      requireByteStableAcrossAlternatingReadCyclesAfterMultipleRejectedReposts: true
    });
  });
});

test("API regression: rejected split-decision replay preserves append-only event cardinality and ordering across repeated interleaved reads", async (t) => {
  await withServer(t, async ({ baseUrl, root, sessionStateCache }) => {
    await runResolvedReplayScenario({
      baseUrl,
      root,
      sessionStateCache,
      label: "continue append-only event cardinality and ordering scenario",
      decisionType: "RETURN_CONTINUE",
      requireByteStableImmediateReplay: true,
      requireByteStableAcrossRepeatedReloads: true,
      requireAppendOnlyEventCardinalityAndOrderingAcrossRepeatedInterleavedReads: true
    });

    await runResolvedReplayScenario({
      baseUrl,
      root,
      sessionStateCache,
      label: "skip append-only event cardinality and ordering scenario",
      decisionType: "RETURN_SKIP",
      requireByteStableImmediateReplay: true,
      requireByteStableAcrossRepeatedReloads: true,
      requireAppendOnlyEventCardinalityAndOrderingAcrossRepeatedInterleavedReads: true
    });
  });
});

test("API regression: rejected split-decision replay preserves normalized current-step identity and trace contract across repeated interleaved reads", async (t) => {
  await withServer(t, async ({ baseUrl, root, sessionStateCache }) => {
    await runResolvedReplayScenario({
      baseUrl,
      root,
      sessionStateCache,
      label: "continue normalized current-step identity and trace contract scenario",
      decisionType: "RETURN_CONTINUE",
      requireByteStableImmediateReplay: true,
      requireByteStableAcrossRepeatedReloads: true,
      requireAppendOnlyEventCardinalityAndOrderingAcrossRepeatedInterleavedReads: true,
      requireNormalizedCurrentStepIdentityAndTraceContractAcrossRepeatedInterleavedReads: true
    });

    await runResolvedReplayScenario({
      baseUrl,
      root,
      sessionStateCache,
      label: "skip normalized current-step identity and trace contract scenario",
      decisionType: "RETURN_SKIP",
      requireByteStableImmediateReplay: true,
      requireByteStableAcrossRepeatedReloads: true,
      requireAppendOnlyEventCardinalityAndOrderingAcrossRepeatedInterleavedReads: true,
      requireNormalizedCurrentStepIdentityAndTraceContractAcrossRepeatedInterleavedReads: true
    });
  });
});

test("API regression: rejected split-decision replay preserves terminal-state shape and no-resurrection invariants across repeated interleaved reads", async (t) => {
  await withServer(t, async ({ baseUrl, root, sessionStateCache }) => {
    await runResolvedReplayScenario({
      baseUrl,
      root,
      sessionStateCache,
      label: "continue terminal-state shape and no-resurrection scenario",
      decisionType: "RETURN_CONTINUE",
      requireByteStableImmediateReplay: true,
      requireByteStableAcrossRepeatedReloads: true,
      requireAppendOnlyEventCardinalityAndOrderingAcrossRepeatedInterleavedReads: true,
      requireNormalizedCurrentStepIdentityAndTraceContractAcrossRepeatedInterleavedReads: true,
      requireTerminalStateShapeAndNoResurrectionAcrossRepeatedInterleavedReads: true
    });

    await runResolvedReplayScenario({
      baseUrl,
      root,
      sessionStateCache,
      label: "skip terminal-state shape and no-resurrection scenario",
      decisionType: "RETURN_SKIP",
      requireByteStableImmediateReplay: true,
      requireByteStableAcrossRepeatedReloads: true,
      requireAppendOnlyEventCardinalityAndOrderingAcrossRepeatedInterleavedReads: true,
      requireNormalizedCurrentStepIdentityAndTraceContractAcrossRepeatedInterleavedReads: true,
      requireTerminalStateShapeAndNoResurrectionAcrossRepeatedInterleavedReads: true
    });
  });
});