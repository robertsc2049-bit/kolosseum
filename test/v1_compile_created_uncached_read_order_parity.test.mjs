/* test/v1_compile_created_uncached_read_order_parity.test.mjs */
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

async function ensureBuiltArtifacts(root, env) {
  const mainModulePath = path.join(root, "dist", "src", "main.js");
  const serverModulePath = path.join(root, "dist", "src", "server.js");
  const cacheModulePath = path.join(root, "dist", "src", "api", "session_state_cache.js");

  if (
    !(await fileExists(mainModulePath)) ||
    !(await fileExists(serverModulePath)) ||
    !(await fileExists(cacheModulePath))
  ) {
    const build = spawnNpm(["run", "build:fast"], { cwd: root, env });
    const code = await new Promise((resolve) => build.child.on("close", resolve));

    if (code !== 0) {
      throw new Error(
        `build:fast failed (code=${code}).\nstdout:\n${build.stdout}\nstderr:\n${build.stderr}`
      );
    }
  }

  assert.equal(await fileExists(mainModulePath), true, `missing built main entrypoint: ${mainModulePath}`);
  assert.equal(await fileExists(serverModulePath), true, `missing built server module: ${serverModulePath}`);
  assert.equal(await fileExists(cacheModulePath), true, `missing built cache module: ${cacheModulePath}`);

  return { mainModulePath, serverModulePath, cacheModulePath };
}

async function applySchema(root, env) {
  const schemaScript = path.join(root, "scripts", "apply-schema.mjs");
  const schema = spawnNode([schemaScript], { cwd: root, env });
  const code = await new Promise((resolve) => schema.child.on("close", resolve));

  if (code !== 0) {
    throw new Error(
      `apply-schema failed (code=${code}).\nstdout:\n${schema.stdout}\nstderr:\n${schema.stderr}`
    );
  }
}

async function importBuiltServerArtifacts(root, env) {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousSmokeNoDb = process.env.SMOKE_NO_DB;

  process.env.DATABASE_URL = env.DATABASE_URL;
  delete process.env.SMOKE_NO_DB;

  try {
    const { serverModulePath, cacheModulePath } = await ensureBuiltArtifacts(root, env);

    const serverModule = await import(pathToFileURL(serverModulePath).href);
    const cacheModule = await import(pathToFileURL(cacheModulePath).href);

    assert.ok(serverModule?.app, "expected built server module to export app");
    assert.equal(
      typeof serverModule.app.listen,
      "function",
      "expected built server module app to be express-like"
    );
    assert.ok(cacheModule?.sessionStateCache, "expected built cache module to export sessionStateCache");
    assert.equal(
      typeof cacheModule.sessionStateCache.clear,
      "function",
      "expected sessionStateCache.clear to exist"
    );

    return {
      app: serverModule.app,
      sessionStateCache: cacheModule.sessionStateCache
    };
  } finally {
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
  }
}

async function startInProcessServer(app) {
  const port = await getFreePort();
  const host = "127.0.0.1";
  const baseUrl = `http://${host}:${port}`;

  const server = await new Promise((resolve, reject) => {
    const s = app.listen(port, host, () => resolve(s));
    s.once("error", reject);
  });

  return { server, baseUrl, port };
}

async function stopInProcessServer(serverHandle) {
  if (!serverHandle?.server) return;

  await new Promise((resolve, reject) => {
    serverHandle.server.close((err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
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

function deriveFacts(statePayload, eventsPayload, label) {
  const state = statePayload?.json;
  const events = eventsPayload?.json?.events;

  assert.ok(state && typeof state === "object", `${label}: missing state json`);
  assert.ok(Array.isArray(events), `${label}: missing events array`);

  const trace = state.trace ?? {};
  const currentStep = state.current_step ?? null;
  const eventTypes = events.map((entry) => entry?.event?.type ?? null);
  const lastEventType = eventTypes.length ? eventTypes.at(-1) : null;
  const remainingIds = Array.isArray(trace.remaining_ids)
    ? trace.remaining_ids.filter((entry) => typeof entry === "string")
    : [];

  return {
    returnDecisionRequired: trace.return_decision_required ?? null,
    returnDecisionOptions: [...(trace.return_decision_options ?? [])].sort(),
    currentStepType: currentStep?.type ?? null,
    currentExerciseId: currentStep?.exercise?.exercise_id ?? null,
    remainingIds,
    lastEventType,
    eventCount: events.length,
    eventTypes
  };
}

function assertFactsEqual(leftFacts, rightFacts, label) {
  assert.deepEqual(
    rightFacts,
    leftFacts,
    `${label}: facts drifted.\nleft=${JSON.stringify(leftFacts)}\nright=${JSON.stringify(rightFacts)}`
  );
}

function assertReadParity(leftRead, rightRead, label) {
  assert.equal(
    rightRead.state.text,
    leftRead.state.text,
    `${label}: /state raw drifted across read-order permutation.\nleft=${leftRead.state.text}\nright=${rightRead.state.text}`
  );
  assert.deepEqual(
    rightRead.state.json,
    leftRead.state.json,
    `${label}: /state json drifted across read-order permutation.`
  );
  assert.equal(
    rightRead.events.text,
    leftRead.events.text,
    `${label}: /events raw drifted across read-order permutation.\nleft=${leftRead.events.text}\nright=${rightRead.events.text}`
  );
  assert.deepEqual(
    rightRead.events.json,
    leftRead.events.json,
    `${label}: /events json drifted across read-order permutation.`
  );

  assertEventSeqMonotonic(leftRead.events, `${label} left events`);
  assertEventSeqMonotonic(rightRead.events, `${label} right events`);

  const leftFacts = deriveFacts(leftRead.state, leftRead.events, `${label} left`);
  const rightFacts = deriveFacts(rightRead.state, rightRead.events, `${label} right`);
  assertFactsEqual(leftFacts, rightFacts, `${label} facts`);

  return leftFacts;
}

function clearSessionStateCache(sessionStateCache, label) {
  sessionStateCache.clear();

  const stats = sessionStateCache.stats();
  assert.deepEqual(
    stats,
    { size: 0, hits: 0, misses: 0 },
    `${label}: expected cache clear to reset stats; got ${JSON.stringify(stats)}`
  );
}

async function readFreshOrder(baseUrl, sessionId, sessionStateCache, order, label) {
  clearSessionStateCache(sessionStateCache, `${label} cache clear`);

  const read = {
    state: null,
    events: null
  };

  for (const endpoint of order) {
    if (endpoint === "state") {
      read.state = await getState(baseUrl, sessionId, `${label} state`);
      continue;
    }

    if (endpoint === "events") {
      read.events = await getEvents(baseUrl, sessionId, `${label} events`);
      continue;
    }

    throw new Error(`${label}: unknown endpoint order token ${String(endpoint)}`);
  }

  assert.ok(read.state, `${label}: state payload missing`);
  assert.ok(read.events, `${label}: events payload missing`);

  return {
    state: read.state,
    events: read.events
  };
}

async function createCompileCreatedSession(baseUrl, root, label) {
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

  return compile.json.session_id;
}

test("v1 compile-created accepted runtime parity across fresh uncached state-events read order", async (t) => {
  const root = repoRoot();
  const databaseUrl =
    process.env.DATABASE_URL ??
    "postgres://postgres:postgres@127.0.0.1:5432/kolosseum_test";

  const env = {
    ...process.env,
    DATABASE_URL: databaseUrl
  };
  delete env.SMOKE_NO_DB;

  await applySchema(root, env);
  const { app, sessionStateCache } = await importBuiltServerArtifacts(root, env);

  const serverHandle = await startInProcessServer(app);
  t.after(async () => {
    await stopInProcessServer(serverHandle);
  });

  const sessionId = await createCompileCreatedSession(serverHandle.baseUrl, root, "compile-created read-order");

  {
    const start = await httpJson(
      "POST",
      `${serverHandle.baseUrl}/sessions/${sessionId}/start`,
      {}
    );
    assert.ok(
      start.res.status === 200 || start.res.status === 201,
      `compile-created read-order: start expected 200/201, got ${start.res.status}. raw=${start.text}`
    );
  }

  const afterStartStateFirst = await readFreshOrder(
    serverHandle.baseUrl,
    sessionId,
    sessionStateCache,
    ["state", "events"],
    "after start state-first"
  );
  const afterStartEventsFirst = await readFreshOrder(
    serverHandle.baseUrl,
    sessionId,
    sessionStateCache,
    ["events", "state"],
    "after start events-first"
  );

  const afterStartFacts = assertReadParity(
    afterStartStateFirst,
    afterStartEventsFirst,
    "after start fresh uncached order parity"
  );

  assert.equal(
    afterStartFacts.returnDecisionRequired,
    false,
    `after start: expected ungated accepted runtime. facts=${JSON.stringify(afterStartFacts)}`
  );
  assert.equal(
    afterStartFacts.currentStepType,
    "EXERCISE",
    `after start: expected EXERCISE current step. facts=${JSON.stringify(afterStartFacts)}`
  );
  assert.ok(
    typeof afterStartFacts.currentExerciseId === "string" && afterStartFacts.currentExerciseId.length > 0,
    `after start: expected current exercise id. facts=${JSON.stringify(afterStartFacts)}`
  );

  const beforeProgressSnapshot = snapshotEvents(afterStartStateFirst.events);

  {
    const accepted = await httpJson(
      "POST",
      `${serverHandle.baseUrl}/sessions/${sessionId}/events`,
      { event: { type: "COMPLETE_EXERCISE", exercise_id: afterStartFacts.currentExerciseId } }
    );
    assert.equal(
      accepted.res.status,
      201,
      `after start: COMPLETE_EXERCISE expected 201, got ${accepted.res.status}. raw=${accepted.text}`
    );
  }

  const afterProgressStateFirst = await readFreshOrder(
    serverHandle.baseUrl,
    sessionId,
    sessionStateCache,
    ["state", "events"],
    "after progress state-first"
  );
  const afterProgressEventsFirst = await readFreshOrder(
    serverHandle.baseUrl,
    sessionId,
    sessionStateCache,
    ["events", "state"],
    "after progress events-first"
  );
  const afterProgressRepeatStateFirst = await readFreshOrder(
    serverHandle.baseUrl,
    sessionId,
    sessionStateCache,
    ["state", "events"],
    "after progress repeat state-first"
  );

  const afterProgressFacts = assertReadParity(
    afterProgressStateFirst,
    afterProgressEventsFirst,
    "after progress fresh uncached order parity"
  );
  assertReadParity(
    afterProgressStateFirst,
    afterProgressRepeatStateFirst,
    "after progress repeated fresh uncached parity"
  );

  const afterProgressSnapshot = snapshotEvents(afterProgressStateFirst.events);
  assert.equal(
    afterProgressSnapshot.length,
    beforeProgressSnapshot.length + 1,
    "after progress: expected exactly one appended runtime event"
  );
  assert.deepEqual(
    afterProgressSnapshot.slice(0, beforeProgressSnapshot.length),
    beforeProgressSnapshot,
    "after progress: expected append-only /events across accepted downstream progress"
  );

  assert.equal(
    afterProgressFacts.returnDecisionRequired,
    false,
    `after progress: expected ungated accepted runtime. facts=${JSON.stringify(afterProgressFacts)}`
  );
  assert.equal(
    afterProgressFacts.lastEventType,
    "COMPLETE_EXERCISE",
    `after progress: expected COMPLETE_EXERCISE as latest event. facts=${JSON.stringify(afterProgressFacts)}`
  );
  assert.ok(
    afterProgressFacts.currentStepType === "EXERCISE" || afterProgressFacts.currentStepType === null,
    `after progress: expected EXERCISE or terminal null current step. facts=${JSON.stringify(afterProgressFacts)}`
  );

  if (afterProgressFacts.currentStepType === "EXERCISE") {
    assert.notEqual(
      afterProgressFacts.currentExerciseId,
      afterStartFacts.currentExerciseId,
      `after progress: expected accepted downstream progress to advance current exercise. facts=${JSON.stringify(afterProgressFacts)}`
    );
  }
});
