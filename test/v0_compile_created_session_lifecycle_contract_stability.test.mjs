/* test/v0_compile_created_session_lifecycle_contract_stability.test.mjs */
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
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHealth(baseUrl, { timeoutMs = 8000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastErr = null;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/health`);
      if (res.ok) return;
      lastErr = new Error(`health not ok: ${res.status}`);
    } catch (err) {
      lastErr = err;
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
      `build:fast failed (code=${code}).\nstdout:\n${build.stdout}\nstderr:\n${build.stderr}`
    );
  }

  if (!(await fileExists(serverModulePath))) {
    throw new Error(`build:fast completed but dist server is still missing: ${serverModulePath}`);
  }

  return serverModulePath;
}

async function getState(baseUrl, sessionId, label) {
  const payload = await httpJson("GET", `${baseUrl}/sessions/${sessionId}/state`);
  assert.equal(
    payload.res.status,
    200,
    `${label}: state expected 200, got ${payload.res.status}. raw=${payload.text}`
  );
  assert.ok(
    payload.json && typeof payload.json === "object",
    `${label}: state expected JSON object. raw=${payload.text}`
  );
  assert.ok(
    payload.json.trace && typeof payload.json.trace === "object",
    `${label}: state trace missing. raw=${payload.text}`
  );
  return payload;
}

async function getEvents(baseUrl, sessionId, label) {
  const payload = await httpJson("GET", `${baseUrl}/sessions/${sessionId}/events`);
  assert.equal(
    payload.res.status,
    200,
    `${label}: events expected 200, got ${payload.res.status}. raw=${payload.text}`
  );
  assert.ok(
    payload.json && typeof payload.json === "object",
    `${label}: events expected JSON object. raw=${payload.text}`
  );
  assert.ok(
    Array.isArray(payload.json.events),
    `${label}: expected events array. raw=${payload.text}`
  );
  return payload;
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

function assertAppendOnlyEventOrderingStable(actualEventsPayload, acceptedEventsPayload, acceptedOrdering, label) {
  const actualEvents = actualEventsPayload?.json?.events;
  const acceptedEvents = acceptedEventsPayload?.json?.events;

  assert.ok(Array.isArray(actualEvents), `${label}: actual events array missing`);
  assert.ok(Array.isArray(acceptedEvents), `${label}: accepted events array missing`);
  assert.equal(
    actualEvents.length,
    acceptedEvents.length,
    `${label}: event cardinality changed.\nbefore=${acceptedEvents.length}\nafter=${actualEvents.length}`
  );

  const actualOrdering = snapshotEventOrdering(actualEventsPayload);
  assert.deepEqual(
    actualOrdering,
    acceptedOrdering,
    `${label}: event ordering drifted.\nbefore=${JSON.stringify(acceptedOrdering)}\nafter=${JSON.stringify(actualOrdering)}`
  );
}

function assertByteStableState(actualState, acceptedState, label) {
  assert.equal(
    actualState.text,
    acceptedState.text,
    `${label}: /state raw payload drifted.\nbefore=${acceptedState.text}\nafter=${actualState.text}`
  );
  assert.deepEqual(
    actualState.json,
    acceptedState.json,
    `${label}: /state JSON drifted.\nbefore=${JSON.stringify(acceptedState.json)}\nafter=${JSON.stringify(actualState.json)}`
  );
}

function assertByteStableEvents(actualEvents, acceptedEvents, label) {
  assert.equal(
    actualEvents.text,
    acceptedEvents.text,
    `${label}: /events raw payload drifted.\nbefore=${acceptedEvents.text}\nafter=${actualEvents.text}`
  );
  assert.deepEqual(
    actualEvents.json,
    acceptedEvents.json,
    `${label}: /events JSON drifted.\nbefore=${JSON.stringify(acceptedEvents.json)}\nafter=${JSON.stringify(actualEvents.json)}`
  );
}

function assertLifecycleStateContract(statePayload, { label, expectDecisionRequired, expectCurrentStep }) {
  const trace = statePayload.json.trace;
  assert.equal(
    trace.return_decision_required,
    expectDecisionRequired,
    `${label}: trace.return_decision_required mismatch. trace=${JSON.stringify(trace)}`
  );

  const options = Array.isArray(trace.return_decision_options) ? trace.return_decision_options : [];
  if (expectDecisionRequired) {
    assert.deepEqual(
      [...options].slice().sort(),
      ["RETURN_CONTINUE", "RETURN_SKIP"],
      `${label}: expected both return options at decision gate. trace=${JSON.stringify(trace)}`
    );
    assert.equal(
      statePayload.json.current_step?.type ?? null,
      "RETURN_DECISION",
      `${label}: expected RETURN_DECISION current_step while gated. raw=${JSON.stringify(statePayload.json)}`
    );
  } else {
    assert.deepEqual(
      options,
      [],
      `${label}: expected no return options when ungated. trace=${JSON.stringify(trace)}`
    );

    if (expectCurrentStep === "EXERCISE") {
      assert.equal(
        statePayload.json.current_step?.type ?? null,
        "EXERCISE",
        `${label}: expected EXERCISE current_step. raw=${JSON.stringify(statePayload.json)}`
      );
      assert.ok(
        typeof statePayload.json.current_step?.exercise?.exercise_id === "string" &&
          statePayload.json.current_step.exercise.exercise_id.length > 0,
        `${label}: expected exercise_id on EXERCISE step. raw=${JSON.stringify(statePayload.json)}`
      );
    }

    if (expectCurrentStep === "TERMINAL") {
      assert.equal(
        statePayload.json.current_step ?? null,
        null,
        `${label}: expected terminal null current_step. raw=${JSON.stringify(statePayload.json)}`
      );
    }
  }

  assert.equal(
    Object.prototype.hasOwnProperty.call(trace, "split_active"),
    false,
    `${label}: trace must not expose split_active`
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(trace, "remaining_at_split_ids"),
    false,
    `${label}: trace must not expose remaining_at_split_ids`
  );
}

async function completeCurrentExercise(baseUrl, sessionId, statePayload, label) {
  const exerciseId = statePayload.json.current_step?.exercise?.exercise_id ?? null;
  assert.ok(
    typeof exerciseId === "string" && exerciseId.length > 0,
    `${label}: expected exercise_id on current step. raw=${JSON.stringify(statePayload.json)}`
  );

  const res = await httpJson(
    "POST",
    `${baseUrl}/sessions/${sessionId}/events`,
    { event: { type: "COMPLETE_EXERCISE", exercise_id: exerciseId } }
  );

  assert.equal(
    res.res.status,
    201,
    `${label}: COMPLETE_EXERCISE expected 201, got ${res.res.status}. raw=${res.text}`
  );
  return exerciseId;
}

async function advanceToTerminal(baseUrl, sessionId, sessionStateCache, label) {
  for (let i = 1; i <= 20; i += 1) {
    sessionStateCache.clear();
    const state = await getState(baseUrl, sessionId, `${label} terminal probe ${i}`);

    if ((state.json.current_step ?? null) === null) {
      assertLifecycleStateContract(state, {
        label: `${label} terminal probe ${i}`,
        expectDecisionRequired: false,
        expectCurrentStep: "TERMINAL"
      });
      return state;
    }

    assertLifecycleStateContract(state, {
      label: `${label} terminal probe ${i}`,
      expectDecisionRequired: false,
      expectCurrentStep: "EXERCISE"
    });

    await completeCurrentExercise(baseUrl, sessionId, state, `${label} terminal complete ${i}`);
  }

  throw new Error(`${label}: failed to reach terminal state within 20 exercise completions`);
}

async function readViaFreshServer({ root, databaseUrl, sessionId, label }) {
  const buildEnv = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    PORT: "0"
  };
  delete buildEnv.SMOKE_NO_DB;

  const serverModulePath = await ensureBuiltDist(root, buildEnv);
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const freshSuffix = `?fresh=${Date.now()}-${Math.random()}`;

  const [{ app }, { sessionStateCache }] = await Promise.all([
    import(pathToFileURL(serverModulePath).href + freshSuffix),
    import(pathToFileURL(path.join(root, "dist", "src", "api", "session_state_cache.js")).href + freshSuffix)
  ]);

  const srv = await new Promise((resolve, reject) => {
    const instance = app.listen(port, "127.0.0.1", () => resolve(instance));
    instance.on("error", reject);
  });

  try {
    await waitForHealth(baseUrl);
    sessionStateCache.clear();

    const state = await getState(baseUrl, sessionId, `${label} fresh state`);
    const events = await getEvents(baseUrl, sessionId, `${label} fresh events`);
    return { state, events };
  } finally {
    await new Promise((resolve) => {
      try {
        srv.close(() => resolve());
      } catch {
        resolve();
      }
    });
    await delay(50);
  }
}

async function runLifecycleScenario({
  baseUrl,
  root,
  sessionStateCache,
  databaseUrl,
  decisionType,
  label
}) {
  const helloPath = path.join(root, "examples", "hello_world.json");
  const phase1 = JSON.parse(await fs.readFile(helloPath, "utf8"));

  const compile = await httpJson("POST", `${baseUrl}/blocks/compile`, { phase1_input: phase1 });
  assert.ok(
    compile.res.status === 200 || compile.res.status === 201,
    `${label}: compile expected 200/201, got ${compile.res.status}. raw=${compile.text}`
  );
  assert.ok(
    compile.json && typeof compile.json === "object",
    `${label}: compile expected JSON object. raw=${compile.text}`
  );
  assert.ok(
    typeof compile.json.block_id === "string" && compile.json.block_id.length > 0,
    `${label}: compile missing block_id. raw=${compile.text}`
  );
  assert.ok(
    compile.json.planned_session && typeof compile.json.planned_session === "object",
    `${label}: compile missing planned_session. raw=${compile.text}`
  );

  const blockId = compile.json.block_id;
  const plannedSession = compile.json.planned_session;

  const blockRead = await httpJson("GET", `${baseUrl}/blocks/${blockId}`);
  assert.equal(
    blockRead.res.status,
    200,
    `${label}: block readback expected 200, got ${blockRead.res.status}. raw=${blockRead.text}`
  );
  assert.ok(
    blockRead.json && typeof blockRead.json === "object",
    `${label}: block readback expected JSON object. raw=${blockRead.text}`
  );
  assert.equal(
    blockRead.json.block_id,
    blockId,
    `${label}: block readback block_id mismatch. raw=${blockRead.text}`
  );

  const createSession = await httpJson(
    "POST",
    `${baseUrl}/blocks/${blockId}/sessions`,
    { planned_session: plannedSession }
  );
  assert.equal(
    createSession.res.status,
    201,
    `${label}: createSessionFromBlock expected 201, got ${createSession.res.status}. raw=${createSession.text}`
  );
  assert.ok(
    createSession.json && typeof createSession.json === "object",
    `${label}: createSessionFromBlock expected JSON object. raw=${createSession.text}`
  );
  assert.ok(
    typeof createSession.json.session_id === "string" && createSession.json.session_id.length > 0,
    `${label}: createSessionFromBlock missing session_id. raw=${createSession.text}`
  );

  const sessionId = createSession.json.session_id;

  const blockSessions = await httpJson("GET", `${baseUrl}/blocks/${blockId}/sessions`);
  assert.equal(
    blockSessions.res.status,
    200,
    `${label}: block sessions readback expected 200, got ${blockSessions.res.status}. raw=${blockSessions.text}`
  );
  assert.ok(
    blockSessions.json && typeof blockSessions.json === "object",
    `${label}: block sessions readback expected JSON object. raw=${blockSessions.text}`
  );
  assert.ok(
    Array.isArray(blockSessions.json.sessions),
    `${label}: block sessions readback expected sessions array. raw=${blockSessions.text}`
  );
  assert.ok(
    blockSessions.json.sessions.some((s) => s?.session_id === sessionId),
    `${label}: block sessions readback missing created session ${sessionId}. raw=${blockSessions.text}`
  );

  const stateBeforeStart = await getState(baseUrl, sessionId, `${label} state before start`);
  assertLifecycleStateContract(stateBeforeStart, {
    label: `${label} state before start`,
    expectDecisionRequired: false,
    expectCurrentStep: "EXERCISE"
  });

  const eventsBeforeStart = await getEvents(baseUrl, sessionId, `${label} events before start`);
  assert.ok(
    Array.isArray(eventsBeforeStart.json.events),
    `${label}: events before start should expose events array`
  );

  const start = await httpJson("POST", `${baseUrl}/sessions/${sessionId}/start`, {});
  assert.ok(
    start.res.status === 200 || start.res.status === 201,
    `${label}: start expected 200/201, got ${start.res.status}. raw=${start.text}`
  );

  sessionStateCache.clear();
  const stateAfterStart = await getState(baseUrl, sessionId, `${label} state after start`);
  assertLifecycleStateContract(stateAfterStart, {
    label: `${label} state after start`,
    expectDecisionRequired: false,
    expectCurrentStep: "EXERCISE"
  });

  await completeCurrentExercise(baseUrl, sessionId, stateAfterStart, `${label} first complete`);

  const split = await httpJson(
    "POST",
    `${baseUrl}/sessions/${sessionId}/events`,
    { event: { type: "SPLIT_SESSION" } }
  );
  assert.equal(
    split.res.status,
    201,
    `${label}: SPLIT_SESSION expected 201, got ${split.res.status}. raw=${split.text}`
  );

  sessionStateCache.clear();
  const splitState = await getState(baseUrl, sessionId, `${label} split state`);
  assertLifecycleStateContract(splitState, {
    label: `${label} split state`,
    expectDecisionRequired: true,
    expectCurrentStep: "RETURN_DECISION"
  });

  const splitRemainingIds = Array.isArray(splitState.json.trace.remaining_ids)
    ? [...splitState.json.trace.remaining_ids]
    : [];
  const splitCompletedIds = Array.isArray(splitState.json.trace.completed_ids)
    ? [...splitState.json.trace.completed_ids]
    : [];

  assert.ok(
    splitCompletedIds.length >= 1,
    `${label}: expected completed_ids at split. trace=${JSON.stringify(splitState.json.trace)}`
  );
  assert.ok(
    splitRemainingIds.length >= 1,
    `${label}: expected remaining_ids at split. trace=${JSON.stringify(splitState.json.trace)}`
  );

  const decision = await httpJson(
    "POST",
    `${baseUrl}/sessions/${sessionId}/events`,
    { event: { type: decisionType } }
  );
  assert.equal(
    decision.res.status,
    201,
    `${label}: ${decisionType} expected 201, got ${decision.res.status}. raw=${decision.text}`
  );

  sessionStateCache.clear();
  const stateAfterDecision = await getState(baseUrl, sessionId, `${label} state after decision`);
  assertLifecycleStateContract(stateAfterDecision, {
    label: `${label} state after decision`,
    expectDecisionRequired: false,
    expectCurrentStep: decisionType === "RETURN_CONTINUE" ? "EXERCISE" : "EXERCISE"
  });

  assert.deepEqual(
    stateAfterDecision.json.trace.completed_ids,
    splitCompletedIds,
    `${label}: completed_ids drifted after decision. trace=${JSON.stringify(stateAfterDecision.json.trace)}`
  );

  if (decisionType === "RETURN_CONTINUE") {
    assert.deepEqual(
      stateAfterDecision.json.trace.remaining_ids,
      splitRemainingIds,
      `${label}: RETURN_CONTINUE should preserve remaining_ids from split. trace=${JSON.stringify(stateAfterDecision.json.trace)}`
    );
    assert.deepEqual(
      Array.isArray(stateAfterDecision.json.trace.dropped_ids) ? stateAfterDecision.json.trace.dropped_ids : [],
      [],
      `${label}: RETURN_CONTINUE should not create dropped_ids. trace=${JSON.stringify(stateAfterDecision.json.trace)}`
    );
    assert.equal(
      stateAfterDecision.json.current_step?.exercise?.exercise_id ?? null,
      splitRemainingIds[0] ?? null,
      `${label}: RETURN_CONTINUE should realign current step with split remaining_ids[0]. raw=${JSON.stringify(stateAfterDecision.json)}`
    );
  } else {
    assert.deepEqual(
      Array.isArray(stateAfterDecision.json.trace.dropped_ids) ? stateAfterDecision.json.trace.dropped_ids : [],
      splitRemainingIds,
      `${label}: RETURN_SKIP should move split remaining_ids into dropped_ids. trace=${JSON.stringify(stateAfterDecision.json.trace)}`
    );
  }

  const eventsAfterDecision = await getEvents(baseUrl, sessionId, `${label} events after decision`);
  const acceptedOrderingAfterDecision = snapshotEventOrdering(eventsAfterDecision);
  assert.ok(
    acceptedOrderingAfterDecision.length >= 4,
    `${label}: expected at least 4 runtime events after decision. raw=${JSON.stringify(eventsAfterDecision.json)}`
  );

  const terminalState = await advanceToTerminal(baseUrl, sessionId, sessionStateCache, `${label} terminal`);
  const terminalEvents = await getEvents(baseUrl, sessionId, `${label} terminal events`);
  const terminalOrdering = snapshotEventOrdering(terminalEvents);

  assertLifecycleStateContract(terminalState, {
    label: `${label} terminal state`,
    expectDecisionRequired: false,
    expectCurrentStep: "TERMINAL"
  });

  assertAppendOnlyEventOrderingStable(
    terminalEvents,
    terminalEvents,
    terminalOrdering,
    `${label} terminal self-ordering baseline`
  );

  sessionStateCache.clear();
  const terminalReloadState = await getState(baseUrl, sessionId, `${label} terminal reload state`);
  const terminalReloadEvents = await getEvents(baseUrl, sessionId, `${label} terminal reload events`);

  assertByteStableState(
    terminalReloadState,
    terminalState,
    `${label}: terminal reload /state`
  );
  assertByteStableEvents(
    terminalReloadEvents,
    terminalEvents,
    `${label}: terminal reload /events`
  );
  assertAppendOnlyEventOrderingStable(
    terminalReloadEvents,
    terminalEvents,
    terminalOrdering,
    `${label}: terminal reload ordering`
  );

  const fresh = await readViaFreshServer({
    root,
    databaseUrl,
    sessionId,
    label: `${label} fresh parity`
  });

  assertLifecycleStateContract(fresh.state, {
    label: `${label} fresh parity state`,
    expectDecisionRequired: false,
    expectCurrentStep: "TERMINAL"
  });
  assertByteStableState(fresh.state, terminalState, `${label}: fresh restart /state`);
  assertByteStableEvents(fresh.events, terminalEvents, `${label}: fresh restart /events`);
  assertAppendOnlyEventOrderingStable(
    fresh.events,
    terminalEvents,
    terminalOrdering,
    `${label}: fresh restart ordering`
  );
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

  const freshSuffix = `?t=${Date.now()}-${Math.random()}`;
  const serverModuleUrl = pathToFileURL(serverModulePath).href + freshSuffix;
  const cacheModuleUrl =
    pathToFileURL(path.join(root, "dist", "src", "api", "session_state_cache.js")).href +
    freshSuffix;

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
  await fn({ baseUrl, root, databaseUrl, sessionStateCache });
}

test("v0 lifecycle: compile-created session stays contract-stable across block readback, session creation/readback, runtime progression, split decision resolution, and terminal reload parity (RETURN_CONTINUE)", async (t) => {
  await withServer(t, async ({ baseUrl, root, databaseUrl, sessionStateCache }) => {
    await runLifecycleScenario({
      baseUrl,
      root,
      databaseUrl,
      sessionStateCache,
      decisionType: "RETURN_CONTINUE",
      label: "return-continue lifecycle scenario"
    });
  });
});

test("v0 lifecycle: compile-created session stays contract-stable across block readback, session creation/readback, runtime progression, split decision resolution, and terminal reload parity (RETURN_SKIP)", async (t) => {
  await withServer(t, async ({ baseUrl, root, databaseUrl, sessionStateCache }) => {
    await runLifecycleScenario({
      baseUrl,
      root,
      databaseUrl,
      sessionStateCache,
      decisionType: "RETURN_SKIP",
      label: "return-skip lifecycle scenario"
    });
  });
});