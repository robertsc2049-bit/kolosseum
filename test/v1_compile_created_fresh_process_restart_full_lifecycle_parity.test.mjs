/* test/v1_compile_created_fresh_process_restart_full_lifecycle_parity.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import net from "node:net";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

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

async function waitForHealth(baseUrl, { timeoutMs = 12000 } = {}) {
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

function waitForChildExit(child) {
  return new Promise((resolve) => {
    if (child.exitCode !== null) {
      resolve({ code: child.exitCode, signalCode: child.signalCode ?? null });
      return;
    }

    child.once("exit", (code, signal) => {
      resolve({ code, signalCode: signal ?? null });
    });
  });
}

function formatBootFailure({
  reason,
  modulePath,
  port,
  baseUrl,
  timeoutMs = null,
  lastError = null,
  exit = null,
  stdout = "",
  stderr = ""
}) {
  const lines = [
    reason,
    `module: ${modulePath}`,
    `port: ${port}`,
    `base_url: ${baseUrl}`
  ];

  if (timeoutMs !== null) {
    lines.push(`timeout_ms: ${timeoutMs}`);
  }

  if (lastError) {
    lines.push(`last_error: ${lastError?.message ?? String(lastError)}`);
  }

  if (exit) {
    lines.push(`exit_code: ${String(exit.code)}`);
    lines.push(`signal: ${String(exit.signalCode)}`);
  }

  lines.push("stdout:");
  lines.push(stdout || "<empty>");
  lines.push("stderr:");
  lines.push(stderr || "<empty>");

  return lines.join("\n");
}

async function waitForHealthOrExit(proc, modulePath, port, baseUrl, { timeoutMs = 12000 } = {}) {
  const healthPromise = (async () => {
    try {
      await waitForHealth(baseUrl, { timeoutMs });
      return { kind: "healthy" };
    } catch (error) {
      return { kind: "health-timeout", error };
    }
  })();

  const exitPromise = waitForChildExit(proc.child).then((exit) => ({
    kind: "exited",
    exit
  }));

  const first = await Promise.race([healthPromise, exitPromise]);

  if (first.kind === "healthy") {
    return;
  }

  if (first.kind === "exited") {
    throw new Error(
      formatBootFailure({
        reason: "server exited before health became ready",
        modulePath,
        port,
        baseUrl,
        exit: first.exit,
        stdout: proc.stdout,
        stderr: proc.stderr
      })
    );
  }

  if (proc.child.exitCode !== null) {
    const exit = await waitForChildExit(proc.child);
    throw new Error(
      formatBootFailure({
        reason: "server exited before health became ready",
        modulePath,
        port,
        baseUrl,
        timeoutMs,
        lastError: first.error,
        exit,
        stdout: proc.stdout,
        stderr: proc.stderr
      })
    );
  }

  throw new Error(
    formatBootFailure({
      reason: "server did not become healthy in time",
      modulePath,
      port,
      baseUrl,
      timeoutMs,
      lastError: first.error,
      stdout: proc.stdout,
      stderr: proc.stderr
    })
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

async function ensureBuiltEntrypoints(root, env) {
  const mainModulePath = path.join(root, "dist", "src", "main.js");
  const serverModulePath = path.join(root, "dist", "src", "server.js");

  if (!(await fileExists(mainModulePath)) || !(await fileExists(serverModulePath))) {
    const build = spawnNpm(["run", "build:fast"], { cwd: root, env });
    const code = await new Promise((resolve) => build.child.on("close", resolve));

    if (code !== 0) {
      throw new Error(
        `build:fast failed (code=${code}).\nstdout:\n${build.stdout}\nstderr:\n${build.stderr}`
      );
    }
  }

  assert.equal(
    await fileExists(mainModulePath),
    true,
    `expected built standalone entrypoint to exist: ${mainModulePath}`
  );
  assert.equal(
    await fileExists(serverModulePath),
    true,
    `expected built server module to exist: ${serverModulePath}`
  );

  return { mainModulePath, serverModulePath };
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

function assertRestartParity(beforeRead, afterRead, label) {
  assert.equal(
    afterRead.state.text,
    beforeRead.state.text,
    `${label}: /state raw drifted across restart.\nbefore=${beforeRead.state.text}\nafter=${afterRead.state.text}`
  );
  assert.deepEqual(
    afterRead.state.json,
    beforeRead.state.json,
    `${label}: /state json drifted across restart.`
  );
  assert.equal(
    afterRead.events.text,
    beforeRead.events.text,
    `${label}: /events raw drifted across restart.\nbefore=${beforeRead.events.text}\nafter=${afterRead.events.text}`
  );
  assert.deepEqual(
    afterRead.events.json,
    beforeRead.events.json,
    `${label}: /events json drifted across restart.`
  );

  assertEventSeqMonotonic(beforeRead.events, `${label} before restart events`);
  assertEventSeqMonotonic(afterRead.events, `${label} after restart events`);

  const beforeFacts = deriveFacts(beforeRead.state, beforeRead.events, `${label} before restart`);
  const afterFacts = deriveFacts(afterRead.state, afterRead.events, `${label} after restart`);
  assertFactsEqual(beforeFacts, afterFacts, `${label} restart facts`);

  return beforeFacts;
}

async function readPair(baseUrl, sessionId, label) {
  const state = await getState(baseUrl, sessionId, `${label} state`);
  const events = await getEvents(baseUrl, sessionId, `${label} events`);
  return { state, events };
}

async function startServer(root, env) {
  const { mainModulePath } = await ensureBuiltEntrypoints(root, env);
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;

  const proc = spawnNode([mainModulePath], {
    cwd: root,
    env: {
      ...env,
      PORT: String(port)
    }
  });

  await waitForHealthOrExit(proc, mainModulePath, port, baseUrl, { timeoutMs: 12000 });

  return { child: proc.child, baseUrl, port };
}

async function stopServer(server) {
  if (!server?.child) return;

  const child = server.child;

  if (child.exitCode !== null) {
    return;
  }

  if (process.platform === "win32") {
    child.kill();
  } else {
    child.kill("SIGTERM");
  }

  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    delay(3000)
  ]);

  if (child.exitCode === null) {
    child.kill("SIGKILL");
    await Promise.race([
      new Promise((resolve) => child.once("exit", resolve)),
      delay(2000)
    ]);
  }
}

async function restartServer(server, root, env) {
  await stopServer(server);
  return await startServer(root, env);
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

test("v1 fresh-process boot harness surfaces early child exit diagnostics", async () => {
  const modulePath = path.resolve(repoRoot(), "test", "__boot_harness_fake_server_exit__.mjs");
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;

  const fakeModule = [
    'console.log("BOOT_STDOUT_MARKER");',
    'console.error("BOOT_STDERR_MARKER");',
    "process.exit(17);"
  ].join("\n");

  await fs.writeFile(modulePath, fakeModule, "utf8");

  try {
    const proc = spawnNode([modulePath], {
      cwd: repoRoot(),
      env: {
        ...process.env,
        PORT: String(port)
      }
    });

    await assert.rejects(
      async () => {
        await waitForHealthOrExit(proc, modulePath, port, baseUrl, { timeoutMs: 1500 });
      },
      (error) => {
        assert.match(error.message, /server exited before health became ready/);
        assert.match(error.message, /BOOT_STDOUT_MARKER/);
        assert.match(error.message, /BOOT_STDERR_MARKER/);
        assert.match(error.message, /exit_code: 17/);
        assert.match(error.message, /signal: null/);
        assert.match(error.message, new RegExp(modulePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
        assert.match(error.message, new RegExp(`port: ${port}`));
        return true;
      }
    );
  } finally {
    await fs.rm(modulePath, { force: true });
  }
});

test("v1 built entrypoint contract: dist main boots health and source contract keeps listen in src/main.ts", async (t) => {
  const root = repoRoot();
  const databaseUrl =
    process.env.DATABASE_URL ??
    "postgres://postgres:postgres@127.0.0.1:5432/kolosseum_test";

  const env = {
    ...process.env,
    DATABASE_URL: databaseUrl
  };
  delete env.SMOKE_NO_DB;

  const { mainModulePath, serverModulePath } = await ensureBuiltEntrypoints(root, env);

  assert.equal(
    await fileExists(mainModulePath),
    true,
    `expected built standalone entrypoint to exist: ${mainModulePath}`
  );
  assert.equal(
    await fileExists(serverModulePath),
    true,
    `expected built server module to exist: ${serverModulePath}`
  );

  let server = await startServer(root, env);
  t.after(async () => {
    await stopServer(server);
  });

  const health = await httpJson("GET", `${server.baseUrl}/health`);
  assert.equal(
    health.res.status,
    200,
    `standalone main: /health expected 200, got ${health.res.status}. raw=${health.text}`
  );
  assert.ok(
    health.json && typeof health.json === "object",
    `standalone main: /health expected json object. raw=${health.text}`
  );
  assert.equal(
    health.json.status,
    "ok",
    `standalone main: expected health status ok. raw=${health.text}`
  );

  assert.equal(
    server.child.exitCode,
    null,
    "standalone main: process must remain alive after /health"
  );

  const mainSource = await fs.readFile(path.join(root, "src", "main.ts"), "utf8");
  const serverSource = await fs.readFile(path.join(root, "src", "server.ts"), "utf8");

  assert.match(
    mainSource,
    /app\.listen\(/,
    "expected src/main.ts to own standalone listen contract"
  );
  assert.doesNotMatch(
    serverSource,
    /app\.listen\(/,
    "expected src/server.ts to remain non-listening"
  );
});

test("v1 fresh-process restart full-lifecycle parity: compile-created split lifecycle survives restarts unchanged", async (t) => {
  const root = repoRoot();
  const databaseUrl =
    process.env.DATABASE_URL ??
    "postgres://postgres:postgres@127.0.0.1:5432/kolosseum_test";

  const env = {
    ...process.env,
    DATABASE_URL: databaseUrl
  };
  delete env.SMOKE_NO_DB;

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

  await ensureBuiltEntrypoints(root, env);

  {
    const schemaScript = path.join(root, "scripts", "apply-schema.mjs");
    const schema = spawnNode([schemaScript], { cwd: root, env });
    const code = await new Promise((resolve) => schema.child.on("close", resolve));
    if (code !== 0) {
      throw new Error(
        `apply-schema failed (code=${code}).\nstdout:\n${schema.stdout}\nstderr:\n${schema.stderr}`
      );
    }
  }

  let server = await startServer(root, env);
  t.after(async () => {
    await stopServer(server);
  });

  const sessionId = await createCompileCreatedSession(server.baseUrl, root, "lifecycle");

  {
    const start = await httpJson("POST", `${server.baseUrl}/sessions/${sessionId}/start`, {});
    assert.ok(
      start.res.status === 200 || start.res.status === 201,
      `lifecycle: start expected 200/201, got ${start.res.status}. raw=${start.text}`
    );
  }

  const afterStartBeforeRestart = await readPair(server.baseUrl, sessionId, "after start before restart");
  server = await restartServer(server, root, env);
  const afterStartAfterRestart = await readPair(server.baseUrl, sessionId, "after start after restart");
  const afterStartFacts = assertRestartParity(
    afterStartBeforeRestart,
    afterStartAfterRestart,
    "after start"
  );

  assert.equal(
    afterStartFacts.returnDecisionRequired,
    false,
    `after start: expected ungated state. facts=${JSON.stringify(afterStartFacts)}`
  );
  assert.equal(
    afterStartFacts.currentStepType,
    "EXERCISE",
    `after start: expected EXERCISE current_step. facts=${JSON.stringify(afterStartFacts)}`
  );
  assert.ok(
    typeof afterStartFacts.currentExerciseId === "string" && afterStartFacts.currentExerciseId.length > 0,
    `after start: expected current exercise id. facts=${JSON.stringify(afterStartFacts)}`
  );

  {
    const accepted = await httpJson(
      "POST",
      `${server.baseUrl}/sessions/${sessionId}/events`,
      { event: { type: "COMPLETE_EXERCISE", exercise_id: afterStartFacts.currentExerciseId } }
    );
    assert.equal(
      accepted.res.status,
      201,
      `after start: COMPLETE_EXERCISE expected 201, got ${accepted.res.status}. raw=${accepted.text}`
    );
  }

  {
    const split = await httpJson(
      "POST",
      `${server.baseUrl}/sessions/${sessionId}/events`,
      { event: { type: "SPLIT_SESSION" } }
    );
    assert.equal(
      split.res.status,
      201,
      `before gated restart: SPLIT_SESSION expected 201, got ${split.res.status}. raw=${split.text}`
    );
  }

  const gatedBeforeRestart = await readPair(server.baseUrl, sessionId, "gated before restart");
  const gatedBeforeSnapshot = snapshotEvents(gatedBeforeRestart.events);
  server = await restartServer(server, root, env);
  const gatedAfterRestart = await readPair(server.baseUrl, sessionId, "gated after restart");
  const gatedFacts = assertRestartParity(gatedBeforeRestart, gatedAfterRestart, "gated");

  assert.equal(
    gatedFacts.returnDecisionRequired,
    true,
    `gated: expected return decision required. facts=${JSON.stringify(gatedFacts)}`
  );
  assert.deepEqual(
    gatedFacts.returnDecisionOptions,
    ["RETURN_CONTINUE", "RETURN_SKIP"],
    `gated: expected exact return decision options. facts=${JSON.stringify(gatedFacts)}`
  );
  assert.equal(
    gatedFacts.currentStepType,
    "RETURN_DECISION",
    `gated: expected RETURN_DECISION current_step. facts=${JSON.stringify(gatedFacts)}`
  );
  assert.equal(
    gatedFacts.lastEventType,
    "SPLIT_SESSION",
    `gated: expected SPLIT_SESSION as latest event. facts=${JSON.stringify(gatedFacts)}`
  );

  {
    const resolve = await httpJson(
      "POST",
      `${server.baseUrl}/sessions/${sessionId}/events`,
      { event: { type: "RETURN_CONTINUE" } }
    );
    assert.equal(
      resolve.res.status,
      201,
      `gated: RETURN_CONTINUE expected 201, got ${resolve.res.status}. raw=${resolve.text}`
    );
  }

  const resolvedBeforeRestart = await readPair(server.baseUrl, sessionId, "resolved before restart");
  const resolvedBeforeSnapshot = snapshotEvents(resolvedBeforeRestart.events);
  assert.equal(
    resolvedBeforeSnapshot.length,
    gatedBeforeSnapshot.length + 1,
    "resolved before restart: expected exactly one appended event after resolution"
  );
  assert.deepEqual(
    resolvedBeforeSnapshot.slice(0, gatedBeforeSnapshot.length),
    gatedBeforeSnapshot,
    "resolved before restart: expected append-only /events after resolution"
  );

  server = await restartServer(server, root, env);
  const resolvedAfterRestart = await readPair(server.baseUrl, sessionId, "resolved after restart");
  const resolvedFacts = assertRestartParity(
    resolvedBeforeRestart,
    resolvedAfterRestart,
    "resolved"
  );

  assert.equal(
    resolvedFacts.returnDecisionRequired,
    false,
    `resolved: expected gate cleared. facts=${JSON.stringify(resolvedFacts)}`
  );
  assert.deepEqual(
    resolvedFacts.returnDecisionOptions,
    [],
    `resolved: expected no decision options. facts=${JSON.stringify(resolvedFacts)}`
  );
  assert.equal(
    resolvedFacts.lastEventType,
    "RETURN_CONTINUE",
    `resolved: expected RETURN_CONTINUE as latest event. facts=${JSON.stringify(resolvedFacts)}`
  );
  assert.ok(
    resolvedFacts.currentStepType === "EXERCISE" || resolvedFacts.currentStepType === null,
    `resolved: expected EXERCISE or terminal null current step. facts=${JSON.stringify(resolvedFacts)}`
  );

  if (resolvedFacts.currentStepType === "EXERCISE") {
    const accepted = await httpJson(
      "POST",
      `${server.baseUrl}/sessions/${sessionId}/events`,
      { event: { type: "COMPLETE_EXERCISE", exercise_id: resolvedFacts.currentExerciseId } }
    );
    assert.equal(
      accepted.res.status,
      201,
      `post-resolution: COMPLETE_EXERCISE expected 201, got ${accepted.res.status}. raw=${accepted.text}`
    );

    const postProgressBeforeRestart = await readPair(
      server.baseUrl,
      sessionId,
      "post-progress before restart"
    );
    const postProgressBeforeSnapshot = snapshotEvents(postProgressBeforeRestart.events);
    assert.equal(
      postProgressBeforeSnapshot.length,
      resolvedBeforeSnapshot.length + 1,
      "post-progress before restart: expected exactly one appended event after downstream progress"
    );
    assert.deepEqual(
      postProgressBeforeSnapshot.slice(0, resolvedBeforeSnapshot.length),
      resolvedBeforeSnapshot,
      "post-progress before restart: expected append-only /events after downstream progress"
    );

    server = await restartServer(server, root, env);
    const postProgressAfterRestart = await readPair(
      server.baseUrl,
      sessionId,
      "post-progress after restart"
    );
    const postProgressFacts = assertRestartParity(
      postProgressBeforeRestart,
      postProgressAfterRestart,
      "post-progress"
    );

    assert.equal(
      postProgressFacts.returnDecisionRequired,
      false,
      `post-progress: gate must not reappear. facts=${JSON.stringify(postProgressFacts)}`
    );
    assert.deepEqual(
      postProgressFacts.returnDecisionOptions,
      [],
      `post-progress: decision options must remain empty. facts=${JSON.stringify(postProgressFacts)}`
    );
    assert.equal(
      postProgressFacts.lastEventType,
      "COMPLETE_EXERCISE",
      `post-progress: expected COMPLETE_EXERCISE as latest event. facts=${JSON.stringify(postProgressFacts)}`
    );
    assert.ok(
      postProgressFacts.currentStepType === "EXERCISE" || postProgressFacts.currentStepType === null,
      `post-progress: expected EXERCISE or terminal null current step. facts=${JSON.stringify(postProgressFacts)}`
    );

    if (postProgressFacts.currentStepType === "EXERCISE") {
      assert.notEqual(
        postProgressFacts.currentExerciseId,
        resolvedFacts.currentExerciseId,
        `post-progress: expected current exercise to advance. facts=${JSON.stringify(postProgressFacts)}`
      );
    }
  }
});
