/* test/v1_compile_created_session_accepted_runtime_state_events_parity.test.mjs */
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
  const init = {
    method,
    headers: { "content-type": "application/json" }
  };

  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }

  const res = await fetch(url, init);
  const text = await res.text();

  let json = null;
  try {
    json = text.length ? JSON.parse(text) : null;
  } catch {
    // keep raw text for assertions
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

function snapshotEvents(eventsPayload) {
  const events = eventsPayload?.json?.events;
  assert.ok(Array.isArray(events), "snapshotEvents expected events array");

  return events.map((entry) => ({
    seq: entry?.seq ?? null,
    type: entry?.event?.type ?? null,
    created_at: entry?.created_at ?? null
  }));
}

function assertEventSeqMonotonic(eventsPayload, label) {
  const events = eventsPayload?.json?.events;
  assert.ok(Array.isArray(events), `${label}: expected events array`);

  let previous = 0;
  for (let i = 0; i < events.length; i += 1) {
    const seq = events[i]?.seq;
    assert.equal(
      Number.isInteger(seq),
      true,
      `${label}: seq must be integer at index ${i}. raw=${JSON.stringify(events[i])}`
    );
    assert.equal(
      seq > previous,
      true,
      `${label}: seq must be strictly increasing at index ${i}. previous=${previous} current=${seq}`
    );
    previous = seq;
  }
}

function assertCacheParity(cachedState, uncachedState, cachedEvents, uncachedEvents, label) {
  assert.equal(
    cachedState.text,
    uncachedState.text,
    `${label}: cached and uncached /state payloads drifted.\nuncached=${uncachedState.text}\ncached=${cachedState.text}`
  );
  assert.deepEqual(
    cachedState.json,
    uncachedState.json,
    `${label}: cached and uncached /state JSON drifted.`
  );

  assert.equal(
    cachedEvents.text,
    uncachedEvents.text,
    `${label}: cached and uncached /events payloads drifted.\nuncached=${uncachedEvents.text}\ncached=${cachedEvents.text}`
  );
  assert.deepEqual(
    cachedEvents.json,
    uncachedEvents.json,
    `${label}: cached and uncached /events JSON drifted.`
  );
}

async function readCachedUncachedPair(baseUrl, sessionId, sessionStateCache, label) {
  sessionStateCache.clear();
  const uncachedState = await getState(baseUrl, sessionId, `${label} uncached state`);
  const uncachedEvents = await getEvents(baseUrl, sessionId, `${label} uncached events`);

  const cachedState = await getState(baseUrl, sessionId, `${label} cached state`);
  const cachedEvents = await getEvents(baseUrl, sessionId, `${label} cached events`);

  return { uncachedState, uncachedEvents, cachedState, cachedEvents };
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
  await fn({ baseUrl, root, sessionStateCache });
}

test("v1 accepted runtime path: compile-created session preserves append-only events and cached-vs-uncached state/events parity after downstream progress", async (t) => {
  await withServer(t, async ({ baseUrl, root, sessionStateCache }) => {
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
      `compile create_session expected 201, got ${compile.res.status}. raw=${compile.text}`
    );
    assert.ok(
      compile.json && typeof compile.json === "object",
      `compile create_session expected JSON object. raw=${compile.text}`
    );
    assert.ok(
      typeof compile.json.session_id === "string" && compile.json.session_id.length > 0,
      `compile create_session missing session_id. raw=${compile.text}`
    );

    const sessionId = compile.json.session_id;

    const start = await httpJson("POST", `${baseUrl}/sessions/${sessionId}/start`, {});
    assert.ok(
      start.res.status === 200 || start.res.status === 201,
      `start expected 200/201, got ${start.res.status}. raw=${start.text}`
    );
    assert.ok(
      start.json && typeof start.json === "object",
      `start expected JSON object. raw=${start.text}`
    );

    const initialPair = await readCachedUncachedPair(
      baseUrl,
      sessionId,
      sessionStateCache,
      "after start"
    );
    assertCacheParity(
      initialPair.cachedState,
      initialPair.uncachedState,
      initialPair.cachedEvents,
      initialPair.uncachedEvents,
      "after start"
    );
    assertEventSeqMonotonic(initialPair.uncachedEvents, "after start events");

    const initialState = initialPair.uncachedState.json;
    assert.equal(
      initialState.trace.return_decision_required,
      false,
      `after start: expected ungated state. raw=${JSON.stringify(initialState)}`
    );
    assert.equal(
      initialState.current_step?.type ?? null,
      "EXERCISE",
      `after start: expected EXERCISE current_step. raw=${JSON.stringify(initialState)}`
    );

    const initialExerciseId = initialState.current_step?.exercise?.exercise_id ?? null;
    assert.ok(
      typeof initialExerciseId === "string" && initialExerciseId.length > 0,
      `after start: expected current_step.exercise.exercise_id. raw=${JSON.stringify(initialState)}`
    );

    const beforeEventsSnapshot = snapshotEvents(initialPair.uncachedEvents);

    const append = await httpJson(
      "POST",
      `${baseUrl}/sessions/${sessionId}/events`,
      { event: { type: "COMPLETE_EXERCISE", exercise_id: initialExerciseId } }
    );
    assert.equal(
      append.res.status,
      201,
      `COMPLETE_EXERCISE expected 201, got ${append.res.status}. raw=${append.text}`
    );
    assert.ok(
      append.json && typeof append.json === "object",
      `COMPLETE_EXERCISE expected JSON object. raw=${append.text}`
    );

    const postProgressPair = await readCachedUncachedPair(
      baseUrl,
      sessionId,
      sessionStateCache,
      "after accepted progress"
    );
    assertCacheParity(
      postProgressPair.cachedState,
      postProgressPair.uncachedState,
      postProgressPair.cachedEvents,
      postProgressPair.uncachedEvents,
      "after accepted progress"
    );
    assertEventSeqMonotonic(postProgressPair.uncachedEvents, "after accepted progress events");

    const afterEventsSnapshot = snapshotEvents(postProgressPair.uncachedEvents);
    assert.ok(
      afterEventsSnapshot.length > beforeEventsSnapshot.length,
      `expected /events to grow after accepted runtime progress. before=${beforeEventsSnapshot.length} after=${afterEventsSnapshot.length}`
    );
    assert.deepEqual(
      afterEventsSnapshot.slice(0, beforeEventsSnapshot.length),
      beforeEventsSnapshot,
      "expected /events to remain append-only after accepted runtime progress"
    );
    assert.equal(
      afterEventsSnapshot.at(-1)?.type ?? null,
      "COMPLETE_EXERCISE",
      `expected latest event type to be COMPLETE_EXERCISE. got=${JSON.stringify(afterEventsSnapshot.at(-1) ?? null)}`
    );

    const postProgressState = postProgressPair.uncachedState.json;
    assert.equal(
      postProgressState.trace.return_decision_required,
      false,
      `after accepted progress: expected ungated state. raw=${JSON.stringify(postProgressState)}`
    );

    const completedIds = Array.isArray(postProgressState.trace?.completed_ids)
      ? postProgressState.trace.completed_ids
      : [];
    assert.ok(
      completedIds.includes(initialExerciseId),
      `after accepted progress: completed_ids does not include completed exercise ${initialExerciseId}. raw=${JSON.stringify(postProgressState)}`
    );

    const postType = postProgressState.current_step?.type ?? null;
    assert.ok(
      postType === "EXERCISE" || postType === null,
      `after accepted progress: expected current_step.type to be EXERCISE or terminal null. raw=${JSON.stringify(postProgressState)}`
    );

    if (postType === "EXERCISE") {
      const nextExerciseId = postProgressState.current_step?.exercise?.exercise_id ?? null;
      assert.ok(
        typeof nextExerciseId === "string" && nextExerciseId.length > 0,
        `after accepted progress: expected next exercise id. raw=${JSON.stringify(postProgressState)}`
      );
      assert.notEqual(
        nextExerciseId,
        initialExerciseId,
        `after accepted progress: state did not advance beyond completed exercise ${initialExerciseId}`
      );
    }

    if (postType === null) {
      assert.equal(
        postProgressState.current_step,
        null,
        `after accepted progress: expected terminal null current_step when no further exercises remain. raw=${JSON.stringify(postProgressState)}`
      );
      const remainingIds = Array.isArray(postProgressState.trace?.remaining_ids)
        ? postProgressState.trace.remaining_ids
        : [];
      assert.deepEqual(
        remainingIds,
        [],
        `after accepted progress terminal path: expected no remaining_ids. raw=${JSON.stringify(postProgressState)}`
      );
    }
  });
});
