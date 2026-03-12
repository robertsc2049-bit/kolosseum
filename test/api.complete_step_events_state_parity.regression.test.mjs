/* test/api.complete_step_events_state_parity.regression.test.mjs */
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

test("API regression: COMPLETE_STEP expands server-side and /events stays consistent with /state across reloads", async (t) => {
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

  const initialState = await httpJson("GET", `${baseUrl}/sessions/${sessionId}/state`);
  assert.equal(
    initialState.res.status,
    200,
    `initial state expected 200, got ${initialState.res.status}. raw=${initialState.text}`
  );
  assert.ok(
    initialState.json && typeof initialState.json === "object",
    `initial state expected JSON. raw=${initialState.text}`
  );
  assert.ok(
    initialState.json.current_step && typeof initialState.json.current_step === "object",
    `expected current_step. raw=${initialState.text}`
  );
  assert.equal(
    initialState.json.current_step.type,
    "EXERCISE",
    `expected EXERCISE current_step. raw=${initialState.text}`
  );
  assert.ok(
    typeof initialState.json.current_step.exercise?.exercise_id === "string" &&
      initialState.json.current_step.exercise.exercise_id.length > 0,
    `expected current_step.exercise.exercise_id. raw=${initialState.text}`
  );

  const firstExerciseId = initialState.json.current_step.exercise.exercise_id;
  const initialRemainingIds = Array.isArray(initialState.json.trace?.remaining_ids)
    ? [...initialState.json.trace.remaining_ids]
    : [];

  assert.ok(
    initialRemainingIds.length >= 1,
    `expected at least one remaining_id before COMPLETE_STEP. got ${JSON.stringify(initialState.json.trace)}`
  );
  assert.equal(
    initialRemainingIds[0],
    firstExerciseId,
    `expected current_step exercise to match first remaining id. trace=${JSON.stringify(initialState.json.trace)}`
  );

  const eventsBeforeComplete = await httpJson("GET", `${baseUrl}/sessions/${sessionId}/events`);
  assert.equal(
    eventsBeforeComplete.res.status,
    200,
    `events before COMPLETE_STEP expected 200, got ${eventsBeforeComplete.res.status}. raw=${eventsBeforeComplete.text}`
  );
  assert.ok(
    eventsBeforeComplete.json && typeof eventsBeforeComplete.json === "object",
    `events before COMPLETE_STEP expected JSON object. raw=${eventsBeforeComplete.text}`
  );
  assert.ok(
    Array.isArray(eventsBeforeComplete.json.events),
    `expected events array before COMPLETE_STEP. raw=${eventsBeforeComplete.text}`
  );
  assert.deepEqual(
    eventsBeforeComplete.json.events.map((x) => x.seq),
    [1],
    `expected exactly one START_SESSION row before COMPLETE_STEP. got ${JSON.stringify(eventsBeforeComplete.json.events)}`
  );
  assert.deepEqual(
    eventsBeforeComplete.json.events.map((x) => x.event?.type),
    ["START_SESSION"],
    `expected only START_SESSION before COMPLETE_STEP. got ${JSON.stringify(eventsBeforeComplete.json.events)}`
  );

  const beforeCompleteSnapshot = cloneJson(eventsBeforeComplete.json);

  const completeStep = await httpJson(
    "POST",
    `${baseUrl}/sessions/${sessionId}/events`,
    { event: { type: "COMPLETE_STEP" } }
  );
  assert.equal(
    completeStep.res.status,
    201,
    `COMPLETE_STEP expected 201, got ${completeStep.res.status}. raw=${completeStep.text}`
  );

  const eventsAfterComplete = await httpJson("GET", `${baseUrl}/sessions/${sessionId}/events`);
  assert.equal(
    eventsAfterComplete.res.status,
    200,
    `events after COMPLETE_STEP expected 200, got ${eventsAfterComplete.res.status}. raw=${eventsAfterComplete.text}`
  );
  assert.ok(
    eventsAfterComplete.json && typeof eventsAfterComplete.json === "object",
    `events after COMPLETE_STEP expected JSON object. raw=${eventsAfterComplete.text}`
  );
  assert.ok(
    Array.isArray(eventsAfterComplete.json.events),
    `expected events array after COMPLETE_STEP. raw=${eventsAfterComplete.text}`
  );

  const eventsRows = eventsAfterComplete.json.events;
  assert.equal(eventsRows.length, 2, `expected 2 events after COMPLETE_STEP, got ${eventsRows.length}`);
  assert.deepEqual(
    cloneJson(eventsRows.slice(0, 1)),
    beforeCompleteSnapshot.events,
    "historical START_SESSION row must remain unchanged after COMPLETE_STEP append"
  );
  assert.deepEqual(
    eventsRows.map((x) => x.seq),
    [1, 2],
    `expected seq ordering [1,2], got ${JSON.stringify(eventsRows.map((x) => x.seq))}`
  );
  assert.deepEqual(
    eventsRows.map((x) => x.event?.type),
    ["START_SESSION", "COMPLETE_EXERCISE"],
    `expected COMPLETE_STEP to persist as COMPLETE_EXERCISE, got ${JSON.stringify(eventsRows.map((x) => x.event?.type))}`
  );
  assert.equal(
    eventsRows[1]?.event?.exercise_id,
    firstExerciseId,
    `expected server-side COMPLETE_STEP expansion to target first remaining exercise_id. got ${JSON.stringify(eventsRows[1])}`
  );

  const stateAfterComplete = await httpJson("GET", `${baseUrl}/sessions/${sessionId}/state`);
  assert.equal(
    stateAfterComplete.res.status,
    200,
    `state after COMPLETE_STEP expected 200, got ${stateAfterComplete.res.status}. raw=${stateAfterComplete.text}`
  );
  assert.ok(
    stateAfterComplete.json && typeof stateAfterComplete.json === "object",
    `state after COMPLETE_STEP expected JSON. raw=${stateAfterComplete.text}`
  );

  const completedIds = Array.isArray(stateAfterComplete.json.trace?.completed_ids)
    ? [...stateAfterComplete.json.trace.completed_ids]
    : [];
  const remainingIdsAfter = Array.isArray(stateAfterComplete.json.trace?.remaining_ids)
    ? [...stateAfterComplete.json.trace.remaining_ids]
    : [];

  assert.deepEqual(
    completedIds,
    [firstExerciseId],
    `expected state.completed_ids to reflect the persisted COMPLETE_EXERCISE, got ${JSON.stringify(stateAfterComplete.json.trace)}`
  );
  assert.equal(
    stateAfterComplete.json.trace?.return_decision_required,
    false,
    `COMPLETE_STEP should not gate state here. got ${JSON.stringify(stateAfterComplete.json.trace)}`
  );
  assert.deepEqual(
    stateAfterComplete.json.trace?.return_decision_options ?? [],
    [],
    `COMPLETE_STEP should not set return options here. got ${JSON.stringify(stateAfterComplete.json.trace)}`
  );
  assert.ok(
    remainingIdsAfter.every((x) => x !== firstExerciseId),
    `expected completed exercise to be removed from remaining_ids. got ${JSON.stringify(remainingIdsAfter)}`
  );

  if (remainingIdsAfter.length > 0) {
    assert.ok(
      stateAfterComplete.json.current_step && typeof stateAfterComplete.json.current_step === "object",
      `expected current_step after COMPLETE_STEP while exercises remain. raw=${stateAfterComplete.text}`
    );
    assert.equal(
      stateAfterComplete.json.current_step.type,
      "EXERCISE",
      `expected EXERCISE current_step after COMPLETE_STEP. raw=${stateAfterComplete.text}`
    );
    assert.equal(
      stateAfterComplete.json.current_step.exercise?.exercise_id,
      remainingIdsAfter[0],
      `expected current_step.exercise.exercise_id to match next remaining id. trace=${JSON.stringify(stateAfterComplete.json.trace)}`
    );
  }

  const beforeClearEvents = cloneJson(eventsAfterComplete.json);
  const beforeClearState = cloneJson(stateAfterComplete.json);

  sessionStateCache.clear();

  const eventsAfterClear = await httpJson("GET", `${baseUrl}/sessions/${sessionId}/events`);
  assert.equal(
    eventsAfterClear.res.status,
    200,
    `events after cache clear expected 200, got ${eventsAfterClear.res.status}. raw=${eventsAfterClear.text}`
  );
  assert.deepEqual(
    eventsAfterClear.json,
    beforeClearEvents,
    `expected /events payload to be identical after cache clear.\nbefore=${JSON.stringify(beforeClearEvents)}\nafter=${JSON.stringify(eventsAfterClear.json)}`
  );

  const stateAfterClear = await httpJson("GET", `${baseUrl}/sessions/${sessionId}/state`);
  assert.equal(
    stateAfterClear.res.status,
    200,
    `state after cache clear expected 200, got ${stateAfterClear.res.status}. raw=${stateAfterClear.text}`
  );
  assert.deepEqual(
    stateAfterClear.json,
    beforeClearState,
    `expected /state payload to be identical after cache clear.\nbefore=${JSON.stringify(beforeClearState)}\nafter=${JSON.stringify(stateAfterClear.json)}`
  );

  assert.deepEqual(
    eventsAfterClear.json.events.map((x) => x.event?.type),
    ["START_SESSION", "COMPLETE_EXERCISE"],
    `expected persisted event history to remain START_SESSION -> COMPLETE_EXERCISE after reload. got ${JSON.stringify(eventsAfterClear.json.events)}`
  );
  assert.deepEqual(
    stateAfterClear.json.trace.completed_ids,
    [firstExerciseId],
    `expected completed_ids to stay aligned with persisted COMPLETE_EXERCISE after reload. got ${JSON.stringify(stateAfterClear.json.trace)}`
  );
});