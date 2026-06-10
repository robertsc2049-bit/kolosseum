/* test/v0_compile_created_session_fresh_restart_progress_replay_safe.test.mjs */
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

async function startFreshServer(root, databaseUrl) {
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

  await waitForHealth(baseUrl);

  return {
    baseUrl,
    sessionStateCache,
    async close() {
      await new Promise((resolve) => {
        try {
          srv.close(() => resolve());
        } catch {
          resolve();
        }
      });
      await delay(50);
    }
  };
}

async function captureLivePair(baseUrl, sessionId, sessionStateCache, label) {
  sessionStateCache.clear();
  const uncachedState = await getState(baseUrl, sessionId, `${label} uncached state`);
  const uncachedEvents = await getEvents(baseUrl, sessionId, `${label} uncached events`);
  const cachedState = await getState(baseUrl, sessionId, `${label} cached state`);
  const cachedEvents = await getEvents(baseUrl, sessionId, `${label} cached events`);
  return { uncachedState, uncachedEvents, cachedState, cachedEvents };
}

function assertLivePairStable(pair, { label }) {
  assertLifecycleStateContract(pair.uncachedState, {
    label: `${label} uncached state`,
    expectDecisionRequired: false,
    expectCurrentStep: "EXERCISE"
  });
  assertLifecycleStateContract(pair.cachedState, {
    label: `${label} cached state`,
    expectDecisionRequired: false,
    expectCurrentStep: "EXERCISE"
  });
  assertByteStableState(pair.cachedState, pair.uncachedState, `${label}: state cache parity`);
  assertByteStableEvents(pair.cachedEvents, pair.uncachedEvents, `${label}: events cache parity`);
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
  const gatedState = await getState(baseUrl, sessionId, `${label} gated state`);
  assertLifecycleStateContract(gatedState, {
    label: `${label} gated state`,
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

  const baseline = await captureLivePair(baseUrl, sessionId, sessionStateCache, `${label} baseline live`);
  assertLivePairStable(baseline, { label: `${label} baseline live` });

  const baselineExerciseId = baseline.uncachedState.json.current_step?.exercise?.exercise_id ?? null;
  assert.ok(
    typeof baselineExerciseId === "string" && baselineExerciseId.length > 0,
    `${label}: baseline live exercise_id missing`
  );

  const baselineSnapshot = snapshotEvents(baseline.uncachedEvents);

  const freshServer = await startFreshServer(root, databaseUrl);
  try {
    const freshBefore = await captureLivePair(
      freshServer.baseUrl,
      sessionId,
      freshServer.sessionStateCache,
      `${label} fresh before progress`
    );
    assertLivePairStable(freshBefore, { label: `${label} fresh before progress` });

    assertByteStableState(
      freshBefore.uncachedState,
      baseline.uncachedState,
      `${label}: fresh-before state parity`
    );
    assertByteStableEvents(
      freshBefore.uncachedEvents,
      baseline.uncachedEvents,
      `${label}: fresh-before events parity`
    );
    assertEventIdentityStable(
      freshBefore.uncachedEvents,
      baselineSnapshot,
      `${label}: fresh-before event identity parity`
    );

    const replayExerciseId = freshBefore.uncachedState.json.current_step?.exercise?.exercise_id ?? null;
    assert.equal(
      replayExerciseId,
      baselineExerciseId,
      `${label}: fresh-before live exercise_id drifted before replay-safe progress probe`
    );

    const acceptedProgress = await httpJson(
      "POST",
      `${freshServer.baseUrl}/sessions/${sessionId}/events`,
      { event: { type: "COMPLETE_EXERCISE", exercise_id: replayExerciseId } }
    );
    assert.equal(
      acceptedProgress.res.status,
      201,
      `${label}: first live progress write after fresh restart expected 201, got ${acceptedProgress.res.status}. raw=${acceptedProgress.text}`
    );

    const afterAccepted = await captureLivePair(
      freshServer.baseUrl,
      sessionId,
      freshServer.sessionStateCache,
      `${label} after accepted progress`
    );
    assertLivePairStable(afterAccepted, { label: `${label} after accepted progress` });

    const afterAcceptedExerciseId =
      afterAccepted.uncachedState.json.current_step?.exercise?.exercise_id ?? null;

    assert.ok(
      typeof afterAcceptedExerciseId === "string" && afterAcceptedExerciseId.length > 0,
      `${label}: after-accepted live exercise_id missing`
    );
    assert.notEqual(
      afterAcceptedExerciseId,
      replayExerciseId,
      `${label}: live current_step resurrected stale pre-progress exercise after accepted write`
    );

    assert.equal(
      afterAccepted.uncachedEvents.json.events.length,
      freshBefore.uncachedEvents.json.events.length + 1,
      `${label}: expected exactly one appended runtime event after accepted live progress`
    );

    const afterAcceptedSnapshot = snapshotEvents(afterAccepted.uncachedEvents);
    for (let i = 0; i < baselineSnapshot.length; i += 1) {
      assert.deepEqual(
        afterAcceptedSnapshot[i],
        baselineSnapshot[i],
        `${label}: append-only event prefix drifted at index ${i} after accepted progress`
      );
    }

    const replayRejected = await httpJson(
      "POST",
      `${freshServer.baseUrl}/sessions/${sessionId}/events`,
      { event: { type: "COMPLETE_EXERCISE", exercise_id: replayExerciseId } }
    );
    assertRejectedMutation(replayRejected, `${label} rejected replay of accepted progress`);

    const afterRejected = await captureLivePair(
      freshServer.baseUrl,
      sessionId,
      freshServer.sessionStateCache,
      `${label} after rejected replay`
    );
    assertLivePairStable(afterRejected, { label: `${label} after rejected replay` });

    assertByteStableState(
      afterRejected.uncachedState,
      afterAccepted.uncachedState,
      `${label}: rejected replay must not drift uncached state`
    );
    assertByteStableEvents(
      afterRejected.uncachedEvents,
      afterAccepted.uncachedEvents,
      `${label}: rejected replay must not drift uncached events`
    );
    assertByteStableState(
      afterRejected.cachedState,
      afterAccepted.cachedState,
      `${label}: rejected replay must not drift cached state`
    );
    assertByteStableEvents(
      afterRejected.cachedEvents,
      afterAccepted.cachedEvents,
      `${label}: rejected replay must not drift cached events`
    );
    assertEventIdentityStable(
      afterRejected.uncachedEvents,
      afterAcceptedSnapshot,
      `${label}: rejected replay must preserve event identity/order`
    );

    const reloadAfterRejected = await captureLivePair(
      freshServer.baseUrl,
      sessionId,
      freshServer.sessionStateCache,
      `${label} reload after rejected replay`
    );
    assertLivePairStable(reloadAfterRejected, { label: `${label} reload after rejected replay` });

    assertByteStableState(
      reloadAfterRejected.uncachedState,
      afterAccepted.uncachedState,
      `${label}: reload-after-rejected uncached state parity`
    );
    assertByteStableEvents(
      reloadAfterRejected.uncachedEvents,
      afterAccepted.uncachedEvents,
      `${label}: reload-after-rejected uncached events parity`
    );
    assertEventIdentityStable(
      reloadAfterRejected.uncachedEvents,
      afterAcceptedSnapshot,
      `${label}: reload-after-rejected event identity parity`
    );
  } finally {
    await freshServer.close();
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

test("v0 fresh restart replay safety: compile-created live session rejects duplicate progress replay after accepted restart write (RETURN_CONTINUE)", async (t) => {
  await withServer(t, async ({ baseUrl, root, databaseUrl, sessionStateCache }) => {
    await runScenario({
      baseUrl,
      root,
      databaseUrl,
      sessionStateCache,
      decisionType: "RETURN_CONTINUE",
      label: "return-continue fresh restart progress replay safe scenario"
    });
  });
});

test("v0 fresh restart replay safety: compile-created live session rejects duplicate progress replay after accepted restart write (RETURN_SKIP)", async (t) => {
  await withServer(t, async ({ baseUrl, root, databaseUrl, sessionStateCache }) => {
    await runScenario({
      baseUrl,
      root,
      databaseUrl,
      sessionStateCache,
      decisionType: "RETURN_SKIP",
      label: "return-skip fresh restart progress replay safe scenario"
    });
  });
});