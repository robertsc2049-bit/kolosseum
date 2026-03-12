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

async function runResolvedReplayScenario({ baseUrl, root, sessionStateCache, label, decisionType }) {
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

  const acceptedEvents = await getEvents(baseUrl, sessionId, `${label} accepted events`);
  const acceptedState = await getState(baseUrl, sessionId, `${label} accepted state`);

  assert.equal(
    acceptedState.json.trace.return_decision_required,
    false,
    `${label}: expected gate cleared after first ${decisionType}. trace=${JSON.stringify(acceptedState.json.trace)}`
  );
  assert.deepEqual(
    acceptedState.json.trace.return_decision_options,
    [],
    `${label}: expected no return options after first ${decisionType}. trace=${JSON.stringify(acceptedState.json.trace)}`
  );

  const replay = await httpJson(
    "POST",
    `${baseUrl}/sessions/${sessionId}/events`,
    { event: { type: decisionType } }
  );

  assert.equal(
    replay.res.status,
    409,
    `${label}: replayed ${decisionType} expected 409, got ${replay.res.status}. raw=${replay.text}`
  );
  assert.ok(
    replay.json && typeof replay.json === "object",
    `${label}: expected replay error JSON. raw=${replay.text}`
  );
  assert.equal(
    replay.json.details?.failure_token,
    "phase6_runtime_resolved_return_decision_replay",
    `${label}: expected failure_token phase6_runtime_resolved_return_decision_replay. raw=${replay.text}`
  );
  assert.equal(
    replay.json.details?.cause,
    `PHASE6_RUNTIME_RESOLVED_RETURN_DECISION_REPLAY: ${decisionType}`,
    `${label}: expected explicit cause for resolved replay. raw=${replay.text}`
  );

  sessionStateCache.clear();

  const afterReplayEvents = await getEvents(baseUrl, sessionId, `${label} after replay events`);
  const afterReplayState = await getState(baseUrl, sessionId, `${label} after replay state`);

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

test("API regression: split decision commands are idempotent-rejected after gate resolution", async (t) => {
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