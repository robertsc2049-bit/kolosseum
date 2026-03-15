import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import net from "node:net";

async function readJsonOnce(res) {
  const text = await res.text().catch(() => "");
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }
  return { text, json };
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForHealth(baseUrl, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(`${baseUrl}/health`);
      if (r.ok) return;
    } catch {}
    await wait(200);
  }
  throw new Error(`server not healthy within ${timeoutMs}ms: ${baseUrl}/health`);
}

function spawnServer(port) {
  const env = { ...process.env, PORT: String(port), NODE_ENV: "test" };

  const child = spawn(process.execPath, ["dist/src/main.js"], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  let out = "";
  child.stdout.on("data", (d) => (out += d.toString("utf8")));
  child.stderr.on("data", (d) => (out += d.toString("utf8")));

  return { child, getLogs: () => out };
}

async function reserveEphemeralPort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();

    server.unref();
    server.on("error", reject);

    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("failed to reserve ephemeral port")));
        return;
      }

      const port = address.port;
      server.close((closeErr) => {
        if (closeErr) {
          reject(closeErr);
          return;
        }
        resolve(port);
      });
    });
  });
}

async function runNpm(scriptOrArgs, opts = {}) {
  const env = { ...process.env, ...(opts.env || {}) };

  const tokens = Array.isArray(scriptOrArgs)
    ? scriptOrArgs.map((x) => String(x))
    : ["run", String(scriptOrArgs)];

  if (tokens.length < 2 || tokens[0] !== "run") {
    throw new Error(`runNpm: expected "run <script>" shape. Got: ${tokens.join(" ")}`);
  }

  const isWin = process.platform === "win32";
  const cmd = isWin ? "cmd.exe" : "npm";
  const cmdArgs = isWin ? ["/d", "/s", "/c", "npm", ...tokens] : tokens;

  const p = spawn(cmd, cmdArgs, {
    cwd: opts.cwd || process.cwd(),
    env,
    stdio: "inherit",
    windowsHide: true,
    shell: false,
  });

  const code = await new Promise((res, rej) => {
    p.on("error", rej);
    p.on("exit", res);
  });

  if (code !== 0) throw new Error(`npm ${tokens.join(" ")} failed (exit=${code})`);
}

function loadPhase1FixtureOrThrow() {
  const fixturePath = path.resolve(process.cwd(), "test", "fixtures", "golden", "inputs", "vanilla_minimal.json");
  if (!fs.existsSync(fixturePath)) throw new Error(`Missing fixture: ${fixturePath}`);
  return JSON.parse(fs.readFileSync(fixturePath, "utf8"));
}

async function fetchState(baseUrl, sessionId) {
  const res = await fetch(`${baseUrl}/sessions/${encodeURIComponent(sessionId)}/state`);
  const body = await readJsonOnce(res);
  assert.equal(res.status, 200, body.text);
  assert.ok(body.json && typeof body.json === "object", "expected state object");
  assert.ok("current_step" in body.json, "expected current_step field (top-level)");
  assert.ok(body.json.trace && typeof body.json.trace === "object", "expected trace object");
  assert.ok("return_decision_required" in body.json.trace, "expected trace.return_decision_required");
  assert.equal(typeof body.json.trace.return_decision_required, "boolean", "expected trace.return_decision_required boolean");
  return body.json;
}

async function postEvent(baseUrl, sessionId, event) {
  const res = await fetch(`${baseUrl}/sessions/${encodeURIComponent(sessionId)}/events`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ event }),
  });
  const body = await readJsonOnce(res);
  return { res, body };
}

test("Vertical slice (HTTP): COMPLETE_STEP is rejected during RETURN_DECISION and accepted immediately after RETURN_CONTINUE", async (t) => {
  const enabled = process.env.KOLOSSEUM_HTTP_E2E_COMPLETE_STEP === "1";

  if (!process.env.DATABASE_URL) {
    if (enabled) throw new Error("KOLOSSEUM_HTTP_E2E_COMPLETE_STEP=1 requires DATABASE_URL (CI contract).");
    t.skip("DATABASE_URL missing; server boot hard-requires DB right now. Skipping HTTP vertical-slice.");
    return;
  }

  if (!fs.existsSync(path.resolve(process.cwd(), "dist", "src", "main.js"))) {
    if (enabled) throw new Error("KOLOSSEUM_HTTP_E2E_COMPLETE_STEP=1 requires dist build (run build:fast).");
    t.skip("dist/src/main.js missing; run build:fast before executing HTTP e2e.");
    return;
  }

  await runNpm("db:schema");

  const port = await reserveEphemeralPort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const { child, getLogs } = spawnServer(port);

  t.after(async () => {
    if (!child.killed) {
      child.kill();
      await wait(200);
    }
  });

  try {
    await waitForHealth(baseUrl);

    {
      const r = await fetch(`${baseUrl}/health`);
      const body = await readJsonOnce(r);
      assert.equal(r.status, 200, body.text);
      assert.equal(body.json?.status, "ok");
      assert.ok(typeof body.json?.version === "string" && body.json.version.length > 0);
    }

    if (!enabled) return;

    const phase1_input = loadPhase1FixtureOrThrow();

    const compile = await fetch(`${baseUrl}/blocks/compile?create_session=true`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phase1_input }),
    });
    const compileBody = await readJsonOnce(compile);
    assert.ok(compile.status === 200 || compile.status === 201, compileBody.text);

    const sessionId = compileBody.json?.session_id;
    assert.ok(typeof sessionId === "string" && sessionId.length > 0, "expected session_id");

    const start = await fetch(`${baseUrl}/sessions/${encodeURIComponent(sessionId)}/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const startBody = await readJsonOnce(start);
    assert.equal(start.status, 200, startBody.text);

    const st1 = await fetchState(baseUrl, sessionId);

    const beforeCompleted = Array.isArray(st1.completed_exercises) ? st1.completed_exercises.length : 0;

    if (st1.trace.return_decision_required === true) {
      assert.equal(st1.current_step?.type, "RETURN_DECISION");
      assert.ok(Array.isArray(st1.current_step?.options), "expected current_step.options");

      const blocked = await postEvent(baseUrl, sessionId, { type: "COMPLETE_STEP" });
      assert.equal(blocked.res.status, 400, blocked.body.text);
      assert.match(blocked.body.text, /phase6_runtime_await_return_decision/, "expected failure token in body");

      const continueEvent = await postEvent(baseUrl, sessionId, { type: "RETURN_CONTINUE" });
      assert.equal(continueEvent.res.status, 201, continueEvent.body.text);

      const st2 = await fetchState(baseUrl, sessionId);
      assert.equal(st2.trace.return_decision_required, false, "RETURN_CONTINUE should immediately ungate the state");
      assert.equal(st2.current_step?.type, "EXERCISE", "expected EXERCISE step immediately after RETURN_CONTINUE");
      assert.ok(st2.current_step?.exercise?.exercise_id, "expected exercise after RETURN_CONTINUE");

      const accepted = await postEvent(baseUrl, sessionId, { type: "COMPLETE_STEP" });
      assert.equal(accepted.res.status, 201, accepted.body.text);

      const st3 = await fetchState(baseUrl, sessionId);
      const afterCompleted = Array.isArray(st3.completed_exercises) ? st3.completed_exercises.length : 0;
      assert.ok(
        afterCompleted === beforeCompleted + 1,
        `expected completed_exercises +1 after RETURN_CONTINUE then COMPLETE_STEP (before=${beforeCompleted}, after=${afterCompleted})`
      );
      return;
    }

    assert.equal(st1.current_step?.type, "EXERCISE");
    assert.ok(st1.current_step?.exercise?.exercise_id, "expected current_step.exercise.exercise_id");

    const accepted = await postEvent(baseUrl, sessionId, { type: "COMPLETE_STEP" });
    assert.equal(accepted.res.status, 201, accepted.body.text);

    const st2 = await fetchState(baseUrl, sessionId);
    const afterCompleted = Array.isArray(st2.completed_exercises) ? st2.completed_exercises.length : 0;
    assert.ok(
      afterCompleted === beforeCompleted + 1,
      `expected completed_exercises +1 (before=${beforeCompleted}, after=${afterCompleted})`
    );
  } catch (e) {
    throw new Error(`${e?.message ?? e}\n\n--- server logs ---\n${getLogs()}`);
  }
});