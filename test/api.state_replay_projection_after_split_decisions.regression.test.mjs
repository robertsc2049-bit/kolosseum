/* test/api.state_replay_projection_after_split_decisions.regression.test.mjs */
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
    ...opts,
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
    },
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

function cloneJson(v) {
  return JSON.parse(JSON.stringify(v));
}

function projectExpectedFromEvents(events) {
  const types = events.map((x) => x?.event?.type);
  const completeExerciseIds = events
    .filter((x) => x?.event?.type === "COMPLETE_EXERCISE")
    .map((x) => x.event.exercise_id);

  const lastSplitIndex = types.lastIndexOf("SPLIT_SESSION");
  const lastContinueIndex = types.lastIndexOf("RETURN_CONTINUE");
  const lastSkipIndex = types.lastIndexOf("RETURN_SKIP");

  const isGated =
    lastSplitIndex !== -1 &&
    lastContinueIndex < lastSplitIndex &&
    lastSkipIndex < lastSplitIndex;

  const lastDecisionIndex = Math.max(lastContinueIndex, lastSkipIndex);
  const lastDecisionType = lastDecisionIndex === -1 ? null : types[lastDecisionIndex];

  return {
    types,
    completeExerciseIds,
    isGated,
    lastDecisionType,
  };
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
  assert.ok(state.json && typeof state.json === "object", `${label}: state expected JSON. raw=${state.text}`);
  assert.ok(state.json.trace && typeof state.json.trace === "object", `${label}: trace missing. raw=${state.text}`);
  return state;
}

async function getEvents(baseUrl, sessionId, label) {
  const events = await httpJson("GET", `${baseUrl}/sessions/${sessionId}/events`);
  assert.equal(
    events.res.status,
    200,
    `${label}: events expected 200, got ${events.res.status}. raw=${events.text}`
  );
  assert.ok(events.json && typeof events.json === "object", `${label}: events expected JSON object. raw=${events.text}`);
  assert.ok(Array.isArray(events.json.events), `${label}: events array missing. raw=${events.text}`);
  return events;
}

function assertNoLegacyGateLeak(trace, label) {
  assert.equal(
    Object.prototype.hasOwnProperty.call(trace, "split_active"),
    false,
    `${label}: trace must not expose split_active`
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(trace, "return_gate_required"),
    false,
    `${label}: trace must not expose return_gate_required`
  );
}

function assertReplayParity({
  stateJson,
  eventsJson,
  label,
  expectedCurrentStepExerciseId = null,
  expectedRemainingIds = null,
}) {
  const events = eventsJson.events;
  const trace = stateJson.trace;
  const projection = projectExpectedFromEvents(events);

  assert.deepEqual(
    events.map((x) => x.seq),
    Array.from({ length: events.length }, (_, i) => i + 1),
    `${label}: event seq must stay dense + ordered`
  );

  assertNoLegacyGateLeak(trace, label);

  assert.deepEqual(
    trace.completed_ids,
    projection.completeExerciseIds,
    `${label}: completed_ids must equal persisted COMPLETE_EXERCISE history.\ntrace=${JSON.stringify(trace)}\nevents=${JSON.stringify(events)}`
  );

  assert.equal(
    trace.return_decision_required,
    projection.isGated,
    `${label}: return_decision_required must be derivable from persisted split decision history.\ntrace=${JSON.stringify(trace)}\nevents=${JSON.stringify(events)}`
  );

  const expectedOptions = projection.isGated
    ? ["RETURN_CONTINUE", "RETURN_SKIP"]
    : [];
  const actualOptions = Array.isArray(trace.return_decision_options)
    ? [...trace.return_decision_options].slice().sort()
    : [];

  assert.deepEqual(
    actualOptions,
    expectedOptions.slice().sort(),
    `${label}: return_decision_options mismatch.\ntrace=${JSON.stringify(trace)}\nevents=${JSON.stringify(events)}`
  );

  if (expectedRemainingIds !== null) {
    assert.deepEqual(
      trace.remaining_ids,
      expectedRemainingIds,
      `${label}: remaining_ids mismatch.\ntrace=${JSON.stringify(trace)}`
    );
  }

  if (expectedCurrentStepExerciseId !== null) {
    assert.ok(
      stateJson.current_step && typeof stateJson.current_step === "object",
      `${label}: expected current_step`
    );
    assert.equal(
      stateJson.current_step.type,
      "EXERCISE",
      `${label}: expected EXERCISE current_step`
    );
    assert.equal(
      stateJson.current_step.exercise?.exercise_id,
      expectedCurrentStepExerciseId,
      `${label}: current_step.exercise.exercise_id mismatch.\ncurrent_step=${JSON.stringify(stateJson.current_step)}`
    );
  }
}

test("API regression: /state is a pure replay projection of /events after split decisions", async (t) => {
  const root = repoRoot();

  const databaseUrl =
    process.env.DATABASE_URL ??
    "postgres://postgres:postgres@127.0.0.1:5432/kolosseum_test";

  const buildEnv = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    PORT: "0",
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
    import(cacheModuleUrl),
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

  // Scenario A: split -> RETURN_CONTINUE
  const continueSessionId = await createSession(baseUrl, root);

  const continueInitialState = await getState(baseUrl, continueSessionId, "continue initial");
  assert.ok(
    continueInitialState.json.current_step &&
      continueInitialState.json.current_step.type === "EXERCISE" &&
      typeof continueInitialState.json.current_step.exercise?.exercise_id === "string" &&
      continueInitialState.json.current_step.exercise.exercise_id.length > 0,
    `continue initial: expected exercise current_step. raw=${JSON.stringify(continueInitialState.json)}`
  );
  const continueFirstExerciseId = continueInitialState.json.current_step.exercise.exercise_id;

  {
    const r = await httpJson(
      "POST",
      `${baseUrl}/sessions/${continueSessionId}/events`,
      { event: { type: "COMPLETE_EXERCISE", exercise_id: continueFirstExerciseId } }
    );
    assert.equal(
      r.res.status,
      201,
      `continue scenario initial COMPLETE_EXERCISE expected 201, got ${r.res.status}. raw=${r.text}`
    );
  }

  {
    const r = await httpJson(
      "POST",
      `${baseUrl}/sessions/${continueSessionId}/events`,
      { event: { type: "SPLIT_SESSION" } }
    );
    assert.equal(
      r.res.status,
      201,
      `continue scenario SPLIT_SESSION expected 201, got ${r.res.status}. raw=${r.text}`
    );
  }

  const continueSplitState = await getState(baseUrl, continueSessionId, "continue split");
  const continueSplitEvents = await getEvents(baseUrl, continueSessionId, "continue split");
  const continueExpectedRemainingIds = [...continueSplitState.json.trace.remaining_ids];
  const continueExpectedCurrentStepExerciseId = continueExpectedRemainingIds[0];

  assertReplayParity({
    stateJson: continueSplitState.json,
    eventsJson: continueSplitEvents.json,
    label: "continue split parity",
  });

  {
    const r = await httpJson(
      "POST",
      `${baseUrl}/sessions/${continueSessionId}/events`,
      { event: { type: "RETURN_CONTINUE" } }
    );
    assert.equal(
      r.res.status,
      201,
      `continue scenario RETURN_CONTINUE expected 201, got ${r.res.status}. raw=${r.text}`
    );
  }

  const continueAfterDecisionState = await getState(baseUrl, continueSessionId, "continue final");
  const continueAfterDecisionEvents = await getEvents(baseUrl, continueSessionId, "continue final");

  assertReplayParity({
    stateJson: continueAfterDecisionState.json,
    eventsJson: continueAfterDecisionEvents.json,
    label: "continue final parity",
    expectedCurrentStepExerciseId: continueExpectedCurrentStepExerciseId,
    expectedRemainingIds: continueExpectedRemainingIds,
  });

  const continueBeforeClearState = cloneJson(continueAfterDecisionState.json);
  const continueBeforeClearEvents = cloneJson(continueAfterDecisionEvents.json);

  // Scenario B: split -> RETURN_SKIP
  const skipSessionId = await createSession(baseUrl, root);

  const skipInitialState = await getState(baseUrl, skipSessionId, "skip initial");
  assert.ok(
    skipInitialState.json.current_step &&
      skipInitialState.json.current_step.type === "EXERCISE" &&
      typeof skipInitialState.json.current_step.exercise?.exercise_id === "string" &&
      skipInitialState.json.current_step.exercise.exercise_id.length > 0,
    `skip initial: expected exercise current_step. raw=${JSON.stringify(skipInitialState.json)}`
  );
  const skipFirstExerciseId = skipInitialState.json.current_step.exercise.exercise_id;

  {
    const r = await httpJson(
      "POST",
      `${baseUrl}/sessions/${skipSessionId}/events`,
      { event: { type: "COMPLETE_EXERCISE", exercise_id: skipFirstExerciseId } }
    );
    assert.equal(
      r.res.status,
      201,
      `skip scenario initial COMPLETE_EXERCISE expected 201, got ${r.res.status}. raw=${r.text}`
    );
  }

  {
    const r = await httpJson(
      "POST",
      `${baseUrl}/sessions/${skipSessionId}/events`,
      { event: { type: "SPLIT_SESSION" } }
    );
    assert.equal(
      r.res.status,
      201,
      `skip scenario SPLIT_SESSION expected 201, got ${r.res.status}. raw=${r.text}`
    );
  }

  const skipSplitState = await getState(baseUrl, skipSessionId, "skip split");
  const skipSplitEvents = await getEvents(baseUrl, skipSessionId, "skip split");
  const skipRemainingAtSplit = [...skipSplitState.json.trace.remaining_ids];

  assertReplayParity({
    stateJson: skipSplitState.json,
    eventsJson: skipSplitEvents.json,
    label: "skip split parity",
  });

  {
    const r = await httpJson(
      "POST",
      `${baseUrl}/sessions/${skipSessionId}/events`,
      { event: { type: "RETURN_SKIP" } }
    );
    assert.equal(
      r.res.status,
      201,
      `skip scenario RETURN_SKIP expected 201, got ${r.res.status}. raw=${r.text}`
    );
  }

  const skipAfterDecisionState = await getState(baseUrl, skipSessionId, "skip final");
  const skipAfterDecisionEvents = await getEvents(baseUrl, skipSessionId, "skip final");

  assertReplayParity({
    stateJson: skipAfterDecisionState.json,
    eventsJson: skipAfterDecisionEvents.json,
    label: "skip final parity",
    expectedRemainingIds: [],
  });

  assert.ok(
    Array.isArray(skipRemainingAtSplit) && skipRemainingAtSplit.length >= 1,
    `skip final parity: expected split to have at least one remaining id before skip. split trace=${JSON.stringify(skipSplitState.json.trace)}`
  );
  assert.deepEqual(
    skipAfterDecisionState.json.trace.remaining_ids,
    [],
    `skip final parity: expected RETURN_SKIP to consume remaining path. trace=${JSON.stringify(skipAfterDecisionState.json.trace)}`
  );

  const skipBeforeClearState = cloneJson(skipAfterDecisionState.json);
  const skipBeforeClearEvents = cloneJson(skipAfterDecisionEvents.json);

  sessionStateCache.clear();

  const continueAfterClearState = await getState(baseUrl, continueSessionId, "continue after clear");
  const continueAfterClearEvents = await getEvents(baseUrl, continueSessionId, "continue after clear");
  const skipAfterClearState = await getState(baseUrl, skipSessionId, "skip after clear");
  const skipAfterClearEvents = await getEvents(baseUrl, skipSessionId, "skip after clear");

  assert.deepEqual(
    continueAfterClearEvents.json,
    continueBeforeClearEvents,
    `continue after clear: /events drifted.\nbefore=${JSON.stringify(continueBeforeClearEvents)}\nafter=${JSON.stringify(continueAfterClearEvents.json)}`
  );
  assert.deepEqual(
    continueAfterClearState.json,
    continueBeforeClearState,
    `continue after clear: /state drifted.\nbefore=${JSON.stringify(continueBeforeClearState)}\nafter=${JSON.stringify(continueAfterClearState.json)}`
  );
  assertReplayParity({
    stateJson: continueAfterClearState.json,
    eventsJson: continueAfterClearEvents.json,
    label: "continue after clear parity",
    expectedCurrentStepExerciseId: continueExpectedCurrentStepExerciseId,
    expectedRemainingIds: continueExpectedRemainingIds,
  });

  assert.deepEqual(
    skipAfterClearEvents.json,
    skipBeforeClearEvents,
    `skip after clear: /events drifted.\nbefore=${JSON.stringify(skipBeforeClearEvents)}\nafter=${JSON.stringify(skipAfterClearEvents.json)}`
  );
  assert.deepEqual(
    skipAfterClearState.json,
    skipBeforeClearState,
    `skip after clear: /state drifted.\nbefore=${JSON.stringify(skipBeforeClearState)}\nafter=${JSON.stringify(skipAfterClearState.json)}`
  );
  assertReplayParity({
    stateJson: skipAfterClearState.json,
    eventsJson: skipAfterClearEvents.json,
    label: "skip after clear parity",
    expectedRemainingIds: [],
  });
});