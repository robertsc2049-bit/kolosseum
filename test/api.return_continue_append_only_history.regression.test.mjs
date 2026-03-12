/* test/api.return_continue_append_only_history.regression.test.mjs */
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

test("API regression: RETURN_CONTINUE preserves append-only history and ungates state without rewriting prior events", async (t) => {
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

  const evCompleteFirst = await httpJson(
    "POST",
    `${baseUrl}/sessions/${sessionId}/events`,
    { event: { type: "COMPLETE_EXERCISE", exercise_id: firstExerciseId } }
  );
  assert.equal(
    evCompleteFirst.res.status,
    201,
    `initial COMPLETE_EXERCISE expected 201, got ${evCompleteFirst.res.status}. raw=${evCompleteFirst.text}`
  );

  const eventsAfterFirstComplete = await httpJson("GET", `${baseUrl}/sessions/${sessionId}/events`);
  assert.equal(
    eventsAfterFirstComplete.res.status,
    200,
    `events after first complete expected 200, got ${eventsAfterFirstComplete.res.status}. raw=${eventsAfterFirstComplete.text}`
  );
  assert.ok(
    eventsAfterFirstComplete.json && typeof eventsAfterFirstComplete.json === "object",
    `events after first complete expected JSON object. raw=${eventsAfterFirstComplete.text}`
  );
  assert.ok(
    Array.isArray(eventsAfterFirstComplete.json.events),
    `expected events array after first complete. raw=${eventsAfterFirstComplete.text}`
  );
  assert.deepEqual(
    eventsAfterFirstComplete.json.events.map((x) => x.seq),
    [1, 2],
    `expected [1,2] after first complete, got ${JSON.stringify(eventsAfterFirstComplete.json.events)}`
  );
  assert.deepEqual(
    eventsAfterFirstComplete.json.events.map((x) => x.event?.type),
    ["START_SESSION", "COMPLETE_EXERCISE"],
    `expected START_SESSION then COMPLETE_EXERCISE, got ${JSON.stringify(eventsAfterFirstComplete.json.events)}`
  );

  const snapshotBeforeSplit = cloneJson(eventsAfterFirstComplete.json);

  const evSplit = await httpJson(
    "POST",
    `${baseUrl}/sessions/${sessionId}/events`,
    { event: { type: "SPLIT_SESSION" } }
  );
  assert.equal(
    evSplit.res.status,
    201,
    `SPLIT_SESSION expected 201, got ${evSplit.res.status}. raw=${evSplit.text}`
  );

  const splitState = await httpJson("GET", `${baseUrl}/sessions/${sessionId}/state`);
  assert.equal(
    splitState.res.status,
    200,
    `split state expected 200, got ${splitState.res.status}. raw=${splitState.text}`
  );
  assert.ok(
    splitState.json && typeof splitState.json === "object",
    `split state expected JSON. raw=${splitState.text}`
  );

  const traceAtSplit = splitState.json.trace;
  assert.ok(traceAtSplit && typeof traceAtSplit === "object", `split trace missing. raw=${splitState.text}`);
  assert.equal(
    traceAtSplit.return_decision_required,
    true,
    `expected gated trace at split. got ${JSON.stringify(traceAtSplit)}`
  );
  assert.deepEqual(
    [...traceAtSplit.return_decision_options].slice().sort(),
    ["RETURN_CONTINUE", "RETURN_SKIP"],
    `expected both return options at split. got ${JSON.stringify(traceAtSplit.return_decision_options)}`
  );
  assert.deepEqual(
    traceAtSplit.completed_ids,
    [firstExerciseId],
    `expected completed_ids to preserve first completed exercise. got ${JSON.stringify(traceAtSplit.completed_ids)}`
  );
  assert.ok(
    Array.isArray(traceAtSplit.remaining_ids) && traceAtSplit.remaining_ids.length >= 1,
    `expected at least one remaining exercise at split. got ${JSON.stringify(traceAtSplit.remaining_ids)}`
  );

  const expectedCompletedIds = [...traceAtSplit.completed_ids];
  const expectedRemainingIdsAtSplit = [...traceAtSplit.remaining_ids];
  const expectedNextExerciseId = expectedRemainingIdsAtSplit[0];

  const evContinue = await httpJson(
    "POST",
    `${baseUrl}/sessions/${sessionId}/events`,
    { event: { type: "RETURN_CONTINUE" } }
  );
  assert.equal(
    evContinue.res.status,
    201,
    `RETURN_CONTINUE expected 201, got ${evContinue.res.status}. raw=${evContinue.text}`
  );

  const eventsAfterContinue = await httpJson("GET", `${baseUrl}/sessions/${sessionId}/events`);
  assert.equal(
    eventsAfterContinue.res.status,
    200,
    `events after RETURN_CONTINUE expected 200, got ${eventsAfterContinue.res.status}. raw=${eventsAfterContinue.text}`
  );
  assert.ok(
    eventsAfterContinue.json && typeof eventsAfterContinue.json === "object",
    `events after RETURN_CONTINUE expected JSON object. raw=${eventsAfterContinue.text}`
  );
  assert.ok(
    Array.isArray(eventsAfterContinue.json.events),
    `expected events array after RETURN_CONTINUE. raw=${eventsAfterContinue.text}`
  );

  const eventRows = eventsAfterContinue.json.events;
  assert.equal(eventRows.length, 4, `expected 4 events after RETURN_CONTINUE, got ${eventRows.length}`);
  assert.deepEqual(
    cloneJson(eventRows.slice(0, 2)),
    snapshotBeforeSplit.events,
    "historical rows must remain unchanged after split/continue appends"
  );
  assert.deepEqual(
    eventRows.map((x) => x.seq),
    [1, 2, 3, 4],
    `expected strict seq ordering [1,2,3,4], got ${JSON.stringify(eventRows.map((x) => x.seq))}`
  );
  assert.deepEqual(
    eventRows.map((x) => x.event?.type),
    ["START_SESSION", "COMPLETE_EXERCISE", "SPLIT_SESSION", "RETURN_CONTINUE"],
    `expected ordered runtime event types, got ${JSON.stringify(eventRows.map((x) => x.event?.type))}`
  );
  assert.equal(
    eventRows[1]?.event?.exercise_id,
    firstExerciseId,
    `expected persisted COMPLETE_EXERCISE to remain stable. got ${JSON.stringify(eventRows[1])}`
  );

  const stateAfterContinue = await httpJson("GET", `${baseUrl}/sessions/${sessionId}/state`);
  assert.equal(
    stateAfterContinue.res.status,
    200,
    `state after RETURN_CONTINUE expected 200, got ${stateAfterContinue.res.status}. raw=${stateAfterContinue.text}`
  );
  assert.ok(
    stateAfterContinue.json && typeof stateAfterContinue.json === "object",
    `state after RETURN_CONTINUE expected JSON. raw=${stateAfterContinue.text}`
  );

  const traceAfterContinue = stateAfterContinue.json.trace;
  assert.ok(traceAfterContinue && typeof traceAfterContinue === "object", `continue trace missing. raw=${stateAfterContinue.text}`);

  assert.equal(
    traceAfterContinue.return_decision_required,
    false,
    `expected gate cleared after RETURN_CONTINUE, got ${traceAfterContinue.return_decision_required}`
  );
  assert.deepEqual(
    traceAfterContinue.return_decision_options,
    [],
    `expected no return options after RETURN_CONTINUE, got ${JSON.stringify(traceAfterContinue.return_decision_options)}`
  );
  assert.deepEqual(
    traceAfterContinue.completed_ids,
    expectedCompletedIds,
    `expected completed_ids preserved after RETURN_CONTINUE, got ${JSON.stringify(traceAfterContinue.completed_ids)}`
  );
  assert.deepEqual(
    traceAfterContinue.remaining_ids,
    expectedRemainingIdsAtSplit,
    `expected remaining_ids restored after RETURN_CONTINUE, got ${JSON.stringify(traceAfterContinue.remaining_ids)}`
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(traceAfterContinue, "split_active"),
    false,
    "trace must not expose split_active"
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(traceAfterContinue, "return_gate_required"),
    false,
    "trace must not expose return_gate_required"
  );

  assert.ok(
    stateAfterContinue.json.current_step && typeof stateAfterContinue.json.current_step === "object",
    `expected current_step after RETURN_CONTINUE. raw=${stateAfterContinue.text}`
  );
  assert.equal(
    stateAfterContinue.json.current_step.type,
    "EXERCISE",
    `expected EXERCISE current_step after RETURN_CONTINUE. raw=${stateAfterContinue.text}`
  );
  assert.equal(
    stateAfterContinue.json.current_step.exercise?.exercise_id,
    expectedNextExerciseId,
    `expected current_step.exercise.exercise_id to match restored remaining_ids[0]. trace=${JSON.stringify(traceAfterContinue)}`
  );

  const beforeClearEvents = cloneJson(eventsAfterContinue.json);
  const beforeClearState = cloneJson(stateAfterContinue.json);

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
    eventsAfterClear.json.events.map((x) => x.seq),
    [1, 2, 3, 4],
    `event seq ordering changed after cache clear. got ${JSON.stringify(eventsAfterClear.json.events.map((x) => x.seq))}`
  );
  assert.deepEqual(
    eventsAfterClear.json.events.map((x) => x.event?.type),
    ["START_SESSION", "COMPLETE_EXERCISE", "SPLIT_SESSION", "RETURN_CONTINUE"],
    `persisted event history changed after cache clear. got ${JSON.stringify(eventsAfterClear.json.events)}`
  );
  assert.deepEqual(
    stateAfterClear.json.trace.completed_ids,
    expectedCompletedIds,
    `completed_ids changed after cache clear. got ${JSON.stringify(stateAfterClear.json.trace)}`
  );
  assert.deepEqual(
    stateAfterClear.json.trace.remaining_ids,
    expectedRemainingIdsAtSplit,
    `remaining_ids changed after cache clear. got ${JSON.stringify(stateAfterClear.json.trace)}`
  );
  assert.equal(
    stateAfterClear.json.current_step.exercise?.exercise_id,
    expectedNextExerciseId,
    `current_step drifted after cache clear. got ${JSON.stringify(stateAfterClear.json.current_step)}`
  );
});