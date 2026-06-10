/* test/v0_compile_created_session_rejected_mutation_cache_parity.test.mjs */
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

function assertRejectedMutation(payload, label) {
  assert.ok(
    payload.res.status >= 400 && payload.res.status < 500,
    `${label}: expected 4xx rejected mutation, got ${payload.res.status}. raw=${payload.text}`
  );
  assert.ok(
    payload.json && typeof payload.json === "object",
    `${label}: expected JSON error payload. raw=${payload.text}`
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
        `${label}: expected exercise_id on EXERCISE current_step. raw=${JSON.stringify(statePayload.json)}`
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
}

function snapshotEvents(eventsPayload) {
  const events = eventsPayload?.json?.events;
  assert.ok(Array.isArray(events), "snapshotEvents expected events array");

  return events.map((event, index) => ({
    index,
    session_event_seq: event?.session_event_seq ?? null,
    event_id: event?.event_id ?? null,
    type: event?.type ?? null
  }));
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

function assertEventIdentityStable(actualEventsPayload, acceptedSnapshot, label) {
  const actualSnapshot = snapshotEvents(actualEventsPayload);

  assert.equal(
    actualSnapshot.length,
    acceptedSnapshot.length,
    `${label}: event cardinality changed.\nbefore=${acceptedSnapshot.length}\nafter=${actualSnapshot.length}`
  );

  assert.deepEqual(
    actualSnapshot,
    acceptedSnapshot,
    `${label}: event identity/order drifted.\nbefore=${JSON.stringify(acceptedSnapshot)}\nafter=${JSON.stringify(actualSnapshot)}`
  );
}

function assertCacheParity(cachedState, uncachedState, cachedEvents, uncachedEvents, label) {
  assertByteStableState(cachedState, uncachedState, `${label}: state cache parity`);
  assertByteStableEvents(cachedEvents, uncachedEvents, `${label}: events cache parity`);
}

async function readCachedUncachedPair(baseUrl, sessionId, sessionStateCache, label) {
  sessionStateCache.clear();
  const uncachedState = await getState(baseUrl, sessionId, `${label} uncached state`);
  const uncachedEvents = await getEvents(baseUrl, sessionId, `${label} uncached events`);

  const cachedState = await getState(baseUrl, sessionId, `${label} cached state`);
  const cachedEvents = await getEvents(baseUrl, sessionId, `${label} cached events`);

  return { uncachedState, uncachedEvents, cachedState, cachedEvents };
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

async function assertRejectedMutationPreservesCacheParity({
  baseUrl,
  sessionId,
  sessionStateCache,
  acceptedLabel,
  mutationLabel,
  mutationBody,
  expectDecisionRequired,
  expectCurrentStep
}) {
  const acceptedPair = await readCachedUncachedPair(
    baseUrl,
    sessionId,
    sessionStateCache,
    `${acceptedLabel} accepted`
  );

  assertLifecycleStateContract(acceptedPair.uncachedState, {
    label: `${acceptedLabel} accepted uncached state`,
    expectDecisionRequired,
    expectCurrentStep
  });
  assertCacheParity(
    acceptedPair.cachedState,
    acceptedPair.uncachedState,
    acceptedPair.cachedEvents,
    acceptedPair.uncachedEvents,
    `${acceptedLabel} accepted`
  );

  const acceptedUncachedSnapshot = snapshotEvents(acceptedPair.uncachedEvents);
  const acceptedCachedSnapshot = snapshotEvents(acceptedPair.cachedEvents);

  const rejected = await httpJson(
    "POST",
    `${baseUrl}/sessions/${sessionId}/events`,
    mutationBody
  );
  assertRejectedMutation(rejected, mutationLabel);

  const afterPair = await readCachedUncachedPair(
    baseUrl,
    sessionId,
    sessionStateCache,
    `${mutationLabel} after`
  );

  assertLifecycleStateContract(afterPair.uncachedState, {
    label: `${mutationLabel} after uncached state`,
    expectDecisionRequired,
    expectCurrentStep
  });
  assertCacheParity(
    afterPair.cachedState,
    afterPair.uncachedState,
    afterPair.cachedEvents,
    afterPair.uncachedEvents,
    `${mutationLabel} after`
  );

  assertByteStableState(afterPair.uncachedState, acceptedPair.uncachedState, `${mutationLabel}: uncached state parity`);
  assertByteStableEvents(afterPair.uncachedEvents, acceptedPair.uncachedEvents, `${mutationLabel}: uncached events parity`);
  assertEventIdentityStable(afterPair.uncachedEvents, acceptedUncachedSnapshot, `${mutationLabel}: uncached event identity parity`);

  assertByteStableState(afterPair.cachedState, acceptedPair.cachedState, `${mutationLabel}: cached state parity`);
  assertByteStableEvents(afterPair.cachedEvents, acceptedPair.cachedEvents, `${mutationLabel}: cached events parity`);
  assertEventIdentityStable(afterPair.cachedEvents, acceptedCachedSnapshot, `${mutationLabel}: cached event identity parity`);
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

    const pair = await readCachedUncachedPair(
      baseUrl,
      sessionId,
      sessionStateCache,
      `${label} fresh`
    );

    return pair;
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

async function runScenario({
  baseUrl,
  root,
  databaseUrl,
  sessionStateCache,
  decisionType,
  label
}) {
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
    `${label}: compile create_session expected 201, got ${compile.res.status}. raw=${compile.text}`
  );
  assert.ok(
    compile.json && typeof compile.json === "object",
    `${label}: compile create_session expected JSON object. raw=${compile.text}`
  );
  assert.ok(
    typeof compile.json.session_id === "string" && compile.json.session_id.length > 0,
    `${label}: compile create_session missing session_id. raw=${compile.text}`
  );

  const sessionId = compile.json.session_id;

  const start = await httpJson("POST", `${baseUrl}/sessions/${sessionId}/start`, {});
  assert.ok(
    start.res.status === 200 || start.res.status === 201,
    `${label}: start expected 200/201, got ${start.res.status}. raw=${start.text}`
  );

  await assertRejectedMutationPreservesCacheParity({
    baseUrl,
    sessionId,
    sessionStateCache,
    acceptedLabel: `${label} after start`,
    mutationLabel: `${label} reject bogus complete before progress`,
    mutationBody: {
      event: {
        type: "COMPLETE_EXERCISE",
        exercise_id: "bogus-exercise-id"
      }
    },
    expectDecisionRequired: false,
    expectCurrentStep: "EXERCISE"
  });

  const postStartPair = await readCachedUncachedPair(
    baseUrl,
    sessionId,
    sessionStateCache,
    `${label} post-start valid progress`
  );

  await completeCurrentExercise(
    baseUrl,
    sessionId,
    postStartPair.uncachedState,
    `${label} first valid complete`
  );

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

  await assertRejectedMutationPreservesCacheParity({
    baseUrl,
    sessionId,
    sessionStateCache,
    acceptedLabel: `${label} gated`,
    mutationLabel: `${label} reject duplicate split while gated`,
    mutationBody: { event: { type: "SPLIT_SESSION" } },
    expectDecisionRequired: true,
    expectCurrentStep: "RETURN_DECISION"
  });

  await assertRejectedMutationPreservesCacheParity({
    baseUrl,
    sessionId,
    sessionStateCache,
    acceptedLabel: `${label} gated`,
    mutationLabel: `${label} reject complete while return decision gate is active`,
    mutationBody: {
      event: {
        type: "COMPLETE_EXERCISE",
        exercise_id: "bogus-gated-exercise-id"
      }
    },
    expectDecisionRequired: true,
    expectCurrentStep: "RETURN_DECISION"
  });

  const resolve = await httpJson(
    "POST",
    `${baseUrl}/sessions/${sessionId}/events`,
    { event: { type: decisionType } }
  );
  assert.equal(
    resolve.res.status,
    201,
    `${label}: ${decisionType} expected 201, got ${resolve.res.status}. raw=${resolve.text}`
  );

  await assertRejectedMutationPreservesCacheParity({
    baseUrl,
    sessionId,
    sessionStateCache,
    acceptedLabel: `${label} post decision`,
    mutationLabel: `${label} reject resolved return decision replay`,
    mutationBody: { event: { type: decisionType } },
    expectDecisionRequired: false,
    expectCurrentStep: "EXERCISE"
  });

  const terminalState = await advanceToTerminal(baseUrl, sessionId, sessionStateCache, `${label} terminal`);
  assertLifecycleStateContract(terminalState, {
    label: `${label} terminal state`,
    expectDecisionRequired: false,
    expectCurrentStep: "TERMINAL"
  });

  await assertRejectedMutationPreservesCacheParity({
    baseUrl,
    sessionId,
    sessionStateCache,
    acceptedLabel: `${label} terminal`,
    mutationLabel: `${label} reject post-terminal bogus complete`,
    mutationBody: {
      event: {
        type: "COMPLETE_EXERCISE",
        exercise_id: "bogus-terminal-exercise-id"
      }
    },
    expectDecisionRequired: false,
    expectCurrentStep: "TERMINAL"
  });

  const terminalPair = await readCachedUncachedPair(
    baseUrl,
    sessionId,
    sessionStateCache,
    `${label} terminal snapshot`
  );

  assertLifecycleStateContract(terminalPair.uncachedState, {
    label: `${label} terminal snapshot uncached state`,
    expectDecisionRequired: false,
    expectCurrentStep: "TERMINAL"
  });
  assertCacheParity(
    terminalPair.cachedState,
    terminalPair.uncachedState,
    terminalPair.cachedEvents,
    terminalPair.uncachedEvents,
    `${label} terminal snapshot`
  );

  const terminalSnapshotState = terminalPair.uncachedState;
  const terminalSnapshotEvents = terminalPair.uncachedEvents;

  const reloadPair = await readCachedUncachedPair(
    baseUrl,
    sessionId,
    sessionStateCache,
    `${label} reload`
  );

  assertLifecycleStateContract(reloadPair.uncachedState, {
    label: `${label} reload uncached state`,
    expectDecisionRequired: false,
    expectCurrentStep: "TERMINAL"
  });
  assertCacheParity(
    reloadPair.cachedState,
    reloadPair.uncachedState,
    reloadPair.cachedEvents,
    reloadPair.uncachedEvents,
    `${label} reload`
  );
  assertByteStableState(reloadPair.uncachedState, terminalSnapshotState, `${label}: reload uncached state parity`);
  assertByteStableEvents(reloadPair.uncachedEvents, terminalSnapshotEvents, `${label}: reload uncached events parity`);

  const freshPair = await readViaFreshServer({
    root,
    databaseUrl,
    sessionId,
    label: `${label} fresh parity`
  });

  assertLifecycleStateContract(freshPair.uncachedState, {
    label: `${label} fresh uncached state`,
    expectDecisionRequired: false,
    expectCurrentStep: "TERMINAL"
  });
  assertCacheParity(
    freshPair.cachedState,
    freshPair.uncachedState,
    freshPair.cachedEvents,
    freshPair.uncachedEvents,
    `${label} fresh`
  );
  assertByteStableState(freshPair.uncachedState, terminalSnapshotState, `${label}: fresh uncached state parity`);
  assertByteStableEvents(freshPair.uncachedEvents, terminalSnapshotEvents, `${label}: fresh uncached events parity`);
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

test("v0 cache parity: rejected runtime mutations preserve cached and uncached lifecycle parity (RETURN_CONTINUE)", async (t) => {
  await withServer(t, async ({ baseUrl, root, databaseUrl, sessionStateCache }) => {
    await runScenario({
      baseUrl,
      root,
      databaseUrl,
      sessionStateCache,
      decisionType: "RETURN_CONTINUE",
      label: "return-continue rejected mutation cache parity scenario"
    });
  });
});

test("v0 cache parity: rejected runtime mutations preserve cached and uncached lifecycle parity (RETURN_SKIP)", async (t) => {
  await withServer(t, async ({ baseUrl, root, databaseUrl, sessionStateCache }) => {
    await runScenario({
      baseUrl,
      root,
      databaseUrl,
      sessionStateCache,
      decisionType: "RETURN_SKIP",
      label: "return-skip rejected mutation cache parity scenario"
    });
  });
});