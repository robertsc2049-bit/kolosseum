/* test/api.return_skip.regression.test.mjs */
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
    ...opts,
  });

  let stdout = "";
  let stderr = "";

  child.stdout.on("data", (d) => (stdout += d.toString("utf8")));
  child.stderr.on("data", (d) => (stderr += d.toString("utf8")));

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

async function waitForHealth(baseUrl, { timeoutMs = 8000, onTick } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastErr = null;

  while (Date.now() < deadline) {
    if (onTick) onTick();

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
  const serverEntrypoint = path.join(root, "dist", "src", "main.js");
  if (await fileExists(serverEntrypoint)) return serverEntrypoint;

  const build = spawnNpm(["run", "build:fast"], { cwd: root, env });
  const code = await new Promise((resolve) => build.child.on("close", resolve));

  if (code !== 0) {
    throw new Error(
      `build:fast failed (code=${code}).\n` +
        `stdout:\n${build.stdout}\n` +
        `stderr:\n${build.stderr}`
    );
  }

  if (!(await fileExists(serverEntrypoint))) {
    throw new Error(
      `build:fast completed but server entrypoint is still missing:\n${serverEntrypoint}`
    );
  }

  return serverEntrypoint;
}

test("API regression: RETURN_SKIP drops remaining-at-split deterministically and leaves state ungated", async (t) => {
  const root = repoRoot();

  const env = {
    ...process.env,
    DATABASE_URL:
      process.env.DATABASE_URL ??
      "postgres://postgres:postgres@127.0.0.1:5432/kolosseum_test",
    PORT: "0",
  };
  delete env.SMOKE_NO_DB;

  const serverEntrypoint = await ensureBuiltDist(root, env);

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

  const port = await getFreePort();
  env.PORT = String(port);

  const server = spawnNode([serverEntrypoint], { cwd: root, env });

  t.after(async () => {
    if (!server.child.killed) {
      try {
        server.child.kill();
      } catch {}
    }
    await delay(80);
  });

  const baseUrl = `http://127.0.0.1:${port}`;

  let exited = false;
  server.child.on("close", () => {
    exited = true;
  });

  try {
    await waitForHealth(baseUrl, {
      timeoutMs: 8000,
      onTick: () => {
        if (exited) {
          throw new Error(
            `server exited before becoming healthy.\nstdout:\n${server.stdout}\nstderr:\n${server.stderr}`
          );
        }
      },
    });
  } catch (e) {
    throw new Error(
      `${e.message}\nstdout:\n${server.stdout}\nstderr:\n${server.stderr}`
    );
  }

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
  assert.ok(initialState.json && typeof initialState.json === "object", `initial state expected JSON. raw=${initialState.text}`);
  assert.ok(initialState.json.current_step && typeof initialState.json.current_step === "object", `expected current_step. raw=${initialState.text}`);
  assert.equal(initialState.json.current_step.type, "EXERCISE", `expected EXERCISE current_step. raw=${initialState.text}`);
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
  assert.ok(Array.isArray(traceAtSplit.completed_ids), "expected completed_ids array at split");
  assert.ok(Array.isArray(traceAtSplit.remaining_ids), "expected remaining_ids array at split");
  assert.deepEqual(
    traceAtSplit.completed_ids,
    [firstExerciseId],
    `expected completed_ids to preserve first completed exercise. got ${JSON.stringify(traceAtSplit.completed_ids)}`
  );
  assert.ok(
    traceAtSplit.remaining_ids.length >= 1,
    `expected at least one remaining exercise at split. got ${JSON.stringify(traceAtSplit.remaining_ids)}`
  );

  const expectedCompletedIds = [...traceAtSplit.completed_ids];
  const expectedDroppedIds = [...traceAtSplit.remaining_ids];

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
  assert.deepEqual(
    traceFinal.completed_ids,
    expectedCompletedIds,
    `expected completed_ids preserved after RETURN_SKIP, got ${JSON.stringify(traceFinal.completed_ids)}`
  );
  assert.deepEqual(
    traceFinal.dropped_ids,
    expectedDroppedIds,
    `expected dropped_ids to equal remaining_ids captured at split, got ${JSON.stringify(traceFinal.dropped_ids)}`
  );

  assert.equal(
    Object.prototype.hasOwnProperty.call(traceFinal, "return_gate_required"),
    false,
    "trace must not expose return_gate_required"
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(traceFinal, "split_active"),
    false,
    "trace must not expose split_active"
  );

  if ("current_step" in finalState.json && finalState.json.current_step !== null && typeof finalState.json.current_step === "object") {
    assert.notEqual(
      finalState.json.current_step.type,
      "RETURN_DECISION",
      `RETURN_SKIP must not leave current_step at RETURN_DECISION. got ${JSON.stringify(finalState.json.current_step)}`
    );
  }

  const finalStateAgain = await httpJson("GET", `${baseUrl}/sessions/${sessionId}/state`);
  assert.equal(finalStateAgain.res.status, 200, `repeat final state expected 200, got ${finalStateAgain.res.status}. raw=${finalStateAgain.text}`);
  assert.equal(
    finalStateAgain.json.trace.return_decision_required,
    false,
    `gate must stay cleared on replay/read, got ${finalStateAgain.json.trace.return_decision_required}`
  );
  assert.deepEqual(
    finalStateAgain.json.trace.return_decision_options,
    [],
    `return options must stay empty on replay/read, got ${JSON.stringify(finalStateAgain.json.trace.return_decision_options)}`
  );
});