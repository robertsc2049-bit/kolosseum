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
    `${label}: trace missing. raw=${state.text}`
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
    `${label}: events expected JSON object. raw=${events.text}`
  );
  assert.ok(
    Array.isArray(events.json.events),
    `${label}: events array missing. raw=${events.text}`
  );
  return events;
}

function assertRejectedDecision(label, response) {
  assert.ok(
    response.res.status === 400 || response.res.status === 409,
    `${label}: expected 400 or 409 for a resolved-gate decision replay, got ${response.res.status}. raw=${response.text}`
  );
}

test("API regression: split decision commands are idempotent-rejected after gate resolution", async (t) => {
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

  // Scenario A: resolve gate with RETURN_CONTINUE, then prove later decision commands are rejected.
  const continueSessionId = await createSession(baseUrl, root);

  const continueInitialState = await getState(baseUrl, continueSessionId, "continue initial");
  assert.ok(
    continueInitialState.json.current_step &&
      continueInitialState.json.current_step.type === "EXERCISE" &&
      typeof continueInitialState.json.current_step.exercise?.exercise_id === "string" &&
      continueInitialState.json.current_step.exercise.exercise_id.length > 0,
    `continue initial: expected exercise current_step. raw=${JSON.stringify(continueInitialState.json)}`
  );

  const continueFirstExerciseId =
    continueInitialState.json.current_step.exercise.exercise_id;

  {
    const r = await httpJson(
      "POST",
      `${baseUrl}/sessions/${continueSessionId}/events`,
      { event: { type: "COMPLETE_EXERCISE", exercise_id: continueFirstExerciseId } }
    );
    assert.equal(
      r.res.status,
      201,
      `continue scenario COMPLETE_EXERCISE expected 201, got ${r.res.status}. raw=${r.text}`
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

  const continueStateAtSplit = await getState(baseUrl, continueSessionId, "continue split state");
  assert.equal(
    continueStateAtSplit.json.trace.return_decision_required,
    true,
    `continue split state: expected gate active. trace=${JSON.stringify(continueStateAtSplit.json.trace)}`
  );

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

  const continueEventsBeforeIllegal = await getEvents(
    baseUrl,
    continueSessionId,
    "continue before illegal"
  );
  const continueStateBeforeIllegal = await getState(
    baseUrl,
    continueSessionId,
    "continue before illegal"
  );

  assert.equal(
    continueStateBeforeIllegal.json.trace.return_decision_required,
    false,
    `continue before illegal: expected gate cleared. trace=${JSON.stringify(continueStateBeforeIllegal.json.trace)}`
  );
  assert.deepEqual(
    continueStateBeforeIllegal.json.trace.return_decision_options,
    [],
    `continue before illegal: expected no return options. trace=${JSON.stringify(continueStateBeforeIllegal.json.trace)}`
  );
  assert.deepEqual(
    continueEventsBeforeIllegal.json.events.map((x) => x.event?.type),
    ["START_SESSION", "COMPLETE_EXERCISE", "SPLIT_SESSION", "RETURN_CONTINUE"],
    `continue before illegal: unexpected event history ${JSON.stringify(continueEventsBeforeIllegal.json.events)}`
  );

  const continueEventsSnapshot = cloneJson(continueEventsBeforeIllegal.json);
  const continueStateSnapshot = cloneJson(continueStateBeforeIllegal.json);

  const continueIllegalContinue = await httpJson(
    "POST",
    `${baseUrl}/sessions/${continueSessionId}/events`,
    { event: { type: "RETURN_CONTINUE" } }
  );
  assertRejectedDecision("continue scenario illegal RETURN_CONTINUE", continueIllegalContinue);

  const continueIllegalSkip = await httpJson(
    "POST",
    `${baseUrl}/sessions/${continueSessionId}/events`,
    { event: { type: "RETURN_SKIP" } }
  );
  assertRejectedDecision("continue scenario illegal RETURN_SKIP", continueIllegalSkip);

  const continueEventsAfterIllegal = await getEvents(
    baseUrl,
    continueSessionId,
    "continue after illegal"
  );
  const continueStateAfterIllegal = await getState(
    baseUrl,
    continueSessionId,
    "continue after illegal"
  );

  assert.deepEqual(
    continueEventsAfterIllegal.json,
    continueEventsSnapshot,
    `continue scenario: /events changed after rejected decisions.\nbefore=${JSON.stringify(continueEventsSnapshot)}\nafter=${JSON.stringify(continueEventsAfterIllegal.json)}`
  );
  assert.deepEqual(
    continueStateAfterIllegal.json,
    continueStateSnapshot,
    `continue scenario: /state changed after rejected decisions.\nbefore=${JSON.stringify(continueStateSnapshot)}\nafter=${JSON.stringify(continueStateAfterIllegal.json)}`
  );

  // Scenario B: resolve gate with RETURN_SKIP, then prove later decision commands are rejected.
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
      `skip scenario COMPLETE_EXERCISE expected 201, got ${r.res.status}. raw=${r.text}`
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

  const skipStateAtSplit = await getState(baseUrl, skipSessionId, "skip split state");
  assert.equal(
    skipStateAtSplit.json.trace.return_decision_required,
    true,
    `skip split state: expected gate active. trace=${JSON.stringify(skipStateAtSplit.json.trace)}`
  );

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

  const skipEventsBeforeIllegal = await getEvents(baseUrl, skipSessionId, "skip before illegal");
  const skipStateBeforeIllegal = await getState(baseUrl, skipSessionId, "skip before illegal");

  assert.equal(
    skipStateBeforeIllegal.json.trace.return_decision_required,
    false,
    `skip before illegal: expected gate cleared. trace=${JSON.stringify(skipStateBeforeIllegal.json.trace)}`
  );
  assert.deepEqual(
    skipStateBeforeIllegal.json.trace.return_decision_options,
    [],
    `skip before illegal: expected no return options. trace=${JSON.stringify(skipStateBeforeIllegal.json.trace)}`
  );
  assert.deepEqual(
    skipEventsBeforeIllegal.json.events.map((x) => x.event?.type),
    ["START_SESSION", "COMPLETE_EXERCISE", "SPLIT_SESSION", "RETURN_SKIP"],
    `skip before illegal: unexpected event history ${JSON.stringify(skipEventsBeforeIllegal.json.events)}`
  );

  const skipEventsSnapshot = cloneJson(skipEventsBeforeIllegal.json);
  const skipStateSnapshot = cloneJson(skipStateBeforeIllegal.json);

  const skipIllegalSkip = await httpJson(
    "POST",
    `${baseUrl}/sessions/${skipSessionId}/events`,
    { event: { type: "RETURN_SKIP" } }
  );
  assertRejectedDecision("skip scenario illegal RETURN_SKIP", skipIllegalSkip);

  const skipIllegalContinue = await httpJson(
    "POST",
    `${baseUrl}/sessions/${skipSessionId}/events`,
    { event: { type: "RETURN_CONTINUE" } }
  );
  assertRejectedDecision("skip scenario illegal RETURN_CONTINUE", skipIllegalContinue);

  const skipEventsAfterIllegal = await getEvents(baseUrl, skipSessionId, "skip after illegal");
  const skipStateAfterIllegal = await getState(baseUrl, skipSessionId, "skip after illegal");

  assert.deepEqual(
    skipEventsAfterIllegal.json,
    skipEventsSnapshot,
    `skip scenario: /events changed after rejected decisions.\nbefore=${JSON.stringify(skipEventsSnapshot)}\nafter=${JSON.stringify(skipEventsAfterIllegal.json)}`
  );
  assert.deepEqual(
    skipStateAfterIllegal.json,
    skipStateSnapshot,
    `skip scenario: /state changed after rejected decisions.\nbefore=${JSON.stringify(skipStateSnapshot)}\nafter=${JSON.stringify(skipStateAfterIllegal.json)}`
  );

  sessionStateCache.clear();

  const continueEventsAfterClear = await getEvents(
    baseUrl,
    continueSessionId,
    "continue after clear"
  );
  const continueStateAfterClear = await getState(
    baseUrl,
    continueSessionId,
    "continue after clear"
  );
  const skipEventsAfterClear = await getEvents(baseUrl, skipSessionId, "skip after clear");
  const skipStateAfterClear = await getState(baseUrl, skipSessionId, "skip after clear");

  assert.deepEqual(
    continueEventsAfterClear.json,
    continueEventsSnapshot,
    `continue scenario after clear: /events drifted.\nbefore=${JSON.stringify(continueEventsSnapshot)}\nafter=${JSON.stringify(continueEventsAfterClear.json)}`
  );
  assert.deepEqual(
    continueStateAfterClear.json,
    continueStateSnapshot,
    `continue scenario after clear: /state drifted.\nbefore=${JSON.stringify(continueStateSnapshot)}\nafter=${JSON.stringify(continueStateAfterClear.json)}`
  );
  assert.deepEqual(
    skipEventsAfterClear.json,
    skipEventsSnapshot,
    `skip scenario after clear: /events drifted.\nbefore=${JSON.stringify(skipEventsSnapshot)}\nafter=${JSON.stringify(skipEventsAfterClear.json)}`
  );
  assert.deepEqual(
    skipStateAfterClear.json,
    skipStateSnapshot,
    `skip scenario after clear: /state drifted.\nbefore=${JSON.stringify(skipStateSnapshot)}\nafter=${JSON.stringify(skipStateAfterClear.json)}`
  );
});