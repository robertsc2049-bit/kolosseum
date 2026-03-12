/* test/api.events_append_only_history.regression.test.mjs */
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

test("API regression: /events is append-only and never rewrites historical payloads", async (t) => {
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

  const eventsAfterStart = await httpJson("GET", `${baseUrl}/sessions/${sessionId}/events`);
  assert.equal(
    eventsAfterStart.res.status,
    200,
    `events after start expected 200, got ${eventsAfterStart.res.status}. raw=${eventsAfterStart.text}`
  );
  assert.ok(
    eventsAfterStart.json && typeof eventsAfterStart.json === "object",
    `events after start expected JSON object. raw=${eventsAfterStart.text}`
  );
  assert.ok(Array.isArray(eventsAfterStart.json.events), `expected events array. raw=${eventsAfterStart.text}`);
  assert.equal(eventsAfterStart.json.events.length, 1, `expected exactly 1 event after start, got ${eventsAfterStart.json.events.length}`);
  assert.equal(eventsAfterStart.json.events[0].seq, 1, `expected first seq=1, got ${JSON.stringify(eventsAfterStart.json.events[0])}`);
  assert.equal(
    eventsAfterStart.json.events[0].event?.type,
    "START_SESSION",
    `expected first event type START_SESSION, got ${JSON.stringify(eventsAfterStart.json.events[0])}`
  );

  const startSnapshot = cloneJson(eventsAfterStart.json);

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

  const eventsAfterComplete = await httpJson("GET", `${baseUrl}/sessions/${sessionId}/events`);
  assert.equal(
    eventsAfterComplete.res.status,
    200,
    `events after complete expected 200, got ${eventsAfterComplete.res.status}. raw=${eventsAfterComplete.text}`
  );
  assert.ok(Array.isArray(eventsAfterComplete.json?.events), `expected events array. raw=${eventsAfterComplete.text}`);
  assert.equal(eventsAfterComplete.json.events.length, 2, `expected 2 events after complete, got ${eventsAfterComplete.json.events.length}`);
  assert.deepEqual(
    cloneJson(eventsAfterComplete.json.events.slice(0, 1)),
    startSnapshot.events,
    "historical START_SESSION row must remain byte-for-byte stable after append"
  );
  assert.deepEqual(
    eventsAfterComplete.json.events.map((x) => x.seq),
    [1, 2],
    `expected seq ordering [1,2], got ${JSON.stringify(eventsAfterComplete.json.events.map((x) => x.seq))}`
  );
  assert.equal(
    eventsAfterComplete.json.events[1].event?.type,
    "COMPLETE_EXERCISE",
    `expected second event type COMPLETE_EXERCISE, got ${JSON.stringify(eventsAfterComplete.json.events[1])}`
  );
  assert.equal(
    eventsAfterComplete.json.events[1].event?.exercise_id,
    firstExerciseId,
    `expected COMPLETE_EXERCISE to target first exercise. got ${JSON.stringify(eventsAfterComplete.json.events[1])}`
  );

  const completeSnapshot = cloneJson(eventsAfterComplete.json);

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
  assert.ok(splitState.json && typeof splitState.json === "object", `split state expected JSON. raw=${splitState.text}`);

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

  const evSkip = await httpJson(
    "POST",
    `${baseUrl}/sessions/${sessionId}/events`,
    { event: { type: "RETURN_SKIP" } }
  );
  assert.equal(
    evSkip.res.status,
    201,
    `RETURN_SKIP expected 201, got ${evSkip.res.status}. raw=${evSkip.text}`
  );

  const eventsAfterSkip = await httpJson("GET", `${baseUrl}/sessions/${sessionId}/events`);
  assert.equal(
    eventsAfterSkip.res.status,
    200,
    `events after RETURN_SKIP expected 200, got ${eventsAfterSkip.res.status}. raw=${eventsAfterSkip.text}`
  );
  assert.ok(Array.isArray(eventsAfterSkip.json?.events), `expected events array. raw=${eventsAfterSkip.text}`);
  assert.equal(eventsAfterSkip.json.events.length, 4, `expected 4 events after RETURN_SKIP, got ${eventsAfterSkip.json.events.length}`);
  assert.deepEqual(
    cloneJson(eventsAfterSkip.json.events.slice(0, 2)),
    completeSnapshot.events,
    "historical rows must remain unchanged after later appends"
  );
  assert.deepEqual(
    eventsAfterSkip.json.events.map((x) => x.seq),
    [1, 2, 3, 4],
    `expected seq ordering [1,2,3,4], got ${JSON.stringify(eventsAfterSkip.json.events.map((x) => x.seq))}`
  );
  assert.deepEqual(
    eventsAfterSkip.json.events.map((x) => x.event?.type),
    ["START_SESSION", "COMPLETE_EXERCISE", "SPLIT_SESSION", "RETURN_SKIP"],
    `expected ordered runtime event types, got ${JSON.stringify(eventsAfterSkip.json.events.map((x) => x.event?.type))}`
  );

  const finalState = await httpJson("GET", `${baseUrl}/sessions/${sessionId}/state`);
  assert.equal(
    finalState.res.status,
    200,
    `final state expected 200, got ${finalState.res.status}. raw=${finalState.text}`
  );
  assert.ok(finalState.json && typeof finalState.json === "object", `final state expected JSON. raw=${finalState.text}`);

  const traceFinal = finalState.json.trace;
  assert.ok(traceFinal && typeof traceFinal === "object", `final trace missing. raw=${finalState.text}`);
  assert.equal(
    traceFinal.return_decision_required,
    false,
    `expected gate cleared after RETURN_SKIP, got ${traceFinal.return_decision_required}`
  );
  assert.deepEqual(
    traceFinal.return_decision_options,
    [],
    `expected no return options after RETURN_SKIP, got ${JSON.stringify(traceFinal.return_decision_options)}`
  );

  const beforeClearEvents = cloneJson(eventsAfterSkip.json);
  const beforeClearState = cloneJson(finalState.json);

  sessionStateCache.clear();

  const afterClearEvents = await httpJson("GET", `${baseUrl}/sessions/${sessionId}/events`);
  assert.equal(
    afterClearEvents.res.status,
    200,
    `events after cache clear expected 200, got ${afterClearEvents.res.status}. raw=${afterClearEvents.text}`
  );
  assert.deepEqual(
    afterClearEvents.json,
    beforeClearEvents,
    `expected /events payload to be identical after cache clear.\nbefore=${JSON.stringify(beforeClearEvents)}\nafter=${JSON.stringify(afterClearEvents.json)}`
  );

  const afterClearState = await httpJson("GET", `${baseUrl}/sessions/${sessionId}/state`);
  assert.equal(
    afterClearState.res.status,
    200,
    `state after cache clear expected 200, got ${afterClearState.res.status}. raw=${afterClearState.text}`
  );
  assert.deepEqual(
    afterClearState.json,
    beforeClearState,
    `expected /state payload to be identical after cache clear.\nbefore=${JSON.stringify(beforeClearState)}\nafter=${JSON.stringify(afterClearState.json)}`
  );

  assert.deepEqual(
    afterClearEvents.json.events.slice(0, 2),
    completeSnapshot.events,
    "historical events must remain unchanged after uncached reload"
  );
  assert.equal(
    afterClearEvents.json.events[0].event?.type,
    "START_SESSION",
    `expected START_SESSION to remain first after uncached reload. got ${JSON.stringify(afterClearEvents.json.events[0])}`
  );
  assert.equal(
    afterClearEvents.json.events.filter((x) => x.event?.type === "START_SESSION").length,
    1,
    `expected exactly one START_SESSION row in append-only history. got ${JSON.stringify(afterClearEvents.json.events)}`
  );
});