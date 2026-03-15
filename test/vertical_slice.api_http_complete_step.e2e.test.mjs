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
  // Contract:
  // - runNpm("db:schema")  => npm run db:schema
  // - runNpm(["run","db:schema"]) => npm run db:schema
  // Windows: wrap via cmd.exe to avoid npm(.cmd) spawn quirks.

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
  // Canonical minimal Phase-1 contract fixture.
  const fixturePath = path.resolve(process.cwd(), "test", "fixtures", "golden", "inputs", "vanilla_minimal.json");
  if (!fs.existsSync(fixturePath)) throw new Error(`Missing fixture: ${fixturePath}`);
  return JSON.parse(fs.readFileSync(fixturePath, "utf8"));
}

test("Vertical slice (HTTP): COMPLETE_STEP expands to COMPLETE_EXERCISE + state exposes current_step", async (t) => {
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

    // Tier-0 probe
    {
      const r = await fetch(`${baseUrl}/health`);
      const body = await readJsonOnce(r);
      assert.equal(r.status, 200, body.text);
      assert.equal(body.json?.status, "ok");
      assert.ok(typeof body.json?.version === "string" && body.json.version.length > 0);
    }

    // Gate is opt-in.
    if (!enabled) return;

    const phase1_input = loadPhase1FixtureOrThrow();

    // 1) Compile + create session
    const compile = await fetch(`${baseUrl}/blocks/compile?create_session=true`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phase1_input }),
    });
    const compileBody = await readJsonOnce(compile);
    assert.ok(compile.status === 200 || compile.status === 201, compileBody.text);

    const compiled = compileBody.json;
    assert.ok(typeof compiled?.session_id === "string" && compiled.session_id.length > 0, "expected session_id");
    const sessionId = compiled.session_id;

    // 2) Start session (idempotent)
    const start = await fetch(`${baseUrl}/sessions/${encodeURIComponent(sessionId)}/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const startBody = await readJsonOnce(start);
    assert.equal(start.status, 200, startBody.text);

    // 3) State must expose current_step at top-level (contract), plus trace.return_decision_required
    const st1r = await fetch(`${baseUrl}/sessions/${encodeURIComponent(sessionId)}/state`);
    const st1Body = await readJsonOnce(st1r);
    assert.equal(st1r.status, 200, st1Body.text);

    const st1 = st1Body.json;
    assert.ok(st1 && typeof st1 === "object", "expected state object");
    assert.ok(st1.trace && typeof st1.trace === "object", "expected trace object");
    assert.ok("return_decision_required" in st1.trace, "expected trace.return_decision_required");
    assert.equal(typeof st1.trace.return_decision_required, "boolean", "expected trace.return_decision_required boolean");

    assert.ok("current_step" in st1, "expected current_step field (top-level)");
    const beforeCompleted = Array.isArray(st1.completed_exercises) ? st1.completed_exercises.length : 0;

    // If return gate is active, COMPLETE_STEP must be rejected (engine guard).
    if (st1.trace.return_decision_required === true) {
      assert.equal(st1.current_step?.type, "RETURN_DECISION");
      assert.ok(Array.isArray(st1.current_step?.options), "expected current_step.options");

      const evBlocked = await fetch(`${baseUrl}/sessions/${encodeURIComponent(sessionId)}/events`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ event: { type: "COMPLETE_STEP" } }),
      });
      const blockedBody = await readJsonOnce(evBlocked);
      assert.equal(evBlocked.status, 400, blockedBody.text);
      assert.match(blockedBody.text, /phase6_runtime_await_return_decision/, "expected failure token in body");
      return;
    }

    // Otherwise we must be on an EXERCISE step and COMPLETE_STEP should advance completion.
    assert.equal(st1.current_step?.type, "EXERCISE");
    assert.ok(st1.current_step?.exercise?.exercise_id, "expected current_step.exercise.exercise_id");

    // 4) COMPLETE_STEP (server expands to COMPLETE_EXERCISE)
    const ev = await fetch(`${baseUrl}/sessions/${encodeURIComponent(sessionId)}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event: { type: "COMPLETE_STEP" } }),
    });
    const evBody = await readJsonOnce(ev);
    assert.equal(ev.status, 201, evBody.text);

    // 5) State must show completed count increased deterministically (+1)
    const st2r = await fetch(`${baseUrl}/sessions/${encodeURIComponent(sessionId)}/state`);
    const st2Body = await readJsonOnce(st2r);
    assert.equal(st2r.status, 200, st2Body.text);

    const st2 = st2Body.json;
    assert.ok(st2 && typeof st2 === "object", "expected state object");
    assert.ok("current_step" in st2, "expected current_step field (top-level)");

    const afterCompleted = Array.isArray(st2.completed_exercises) ? st2.completed_exercises.length : 0;
    assert.ok(
      afterCompleted === beforeCompleted + 1,
      `expected completed_exercises +1 (before=${beforeCompleted}, after=${afterCompleted})`
    );
  } catch (e) {
    throw new Error(`${e?.message ?? e}\n\n--- server logs ---\n${getLogs()}`);
  }
});