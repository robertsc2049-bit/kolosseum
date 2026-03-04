import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

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

async function runNpm(script) {
  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  const p = spawn(npmCmd, ["run", script], { stdio: "inherit", windowsHide: true });
  const code = await new Promise((res) => p.on("exit", res));
  if (code !== 0) throw new Error(`npm run ${script} failed (exit=${code})`);
}

function loadPhase1FixtureOrThrow() {
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

  const port = 59200 + Math.floor(Math.random() * 2000);
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

    // Gate is opt-in (like return-gate test).
    if (!enabled) return;

    const phase1_input = loadPhase1FixtureOrThrow();

    // 1) Compile + create session
    const compile = await fetch(`${baseUrl}/blocks/compile?create_session=true`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phase1_input }),
    });
    assert.ok(compile.status === 200 || compile.status === 201, await compile.text());
    const compiled = await compile.json();

    assert.ok(typeof compiled?.session_id === "string" && compiled.session_id.length > 0, "expected session_id");
    const sessionId = compiled.session_id;

    // 2) Start
    const start = await fetch(`${baseUrl}/sessions/${encodeURIComponent(sessionId)}/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(start.status, 200, await start.text());

    // 3) State should expose current_step (exercise) initially (unless return gate is active)
    const st1r = await fetch(`${baseUrl}/sessions/${encodeURIComponent(sessionId)}/state`);
    assert.equal(st1r.status, 200, await st1r.text());
    const st1 = await st1r.json();

    assert.ok(st1 && typeof st1 === "object", "expected state object");
    assert.ok(st1.trace && typeof st1.trace === "object", "expected trace object");
    assert.ok("return_decision_required" in st1.trace, "expected trace.return_decision_required");
    assert.ok("current_step" in st1, "expected current_step field");

    if (st1.trace.return_decision_required === true) {
      assert.equal(st1.current_step?.type, "RETURN_DECISION");
      assert.ok(Array.isArray(st1.current_step?.options), "expected current_step.options");
      // If gate required, COMPLETE_STEP must be rejected (engine guard).
      const evBlocked = await fetch(`${baseUrl}/sessions/${encodeURIComponent(sessionId)}/events`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ event: { type: "COMPLETE_STEP" } }),
      });
      assert.equal(evBlocked.status, 400, await evBlocked.text());
      return;
    }

    assert.equal(st1.current_step?.type, "EXERCISE");
    assert.ok(st1.current_step?.exercise?.exercise_id, "expected current_step.exercise.exercise_id");

    const beforeCompleted = Array.isArray(st1.completed_exercises) ? st1.completed_exercises.length : 0;

    // 4) COMPLETE_STEP (server expands to COMPLETE_EXERCISE)
    const ev = await fetch(`${baseUrl}/sessions/${encodeURIComponent(sessionId)}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event: { type: "COMPLETE_STEP" } }),
    });
    assert.equal(ev.status, 201, await ev.text());

    // 5) State must show completed count increased (or at least changed deterministically)
    const st2r = await fetch(`${baseUrl}/sessions/${encodeURIComponent(sessionId)}/state`);
    assert.equal(st2r.status, 200, await st2r.text());
    const st2 = await st2r.json();

    const afterCompleted = Array.isArray(st2.completed_exercises) ? st2.completed_exercises.length : 0;
    assert.ok(afterCompleted === beforeCompleted + 1, `expected completed_exercises +1 (before=${beforeCompleted}, after=${afterCompleted})`);

    // Also keep current_step contract present
    assert.ok("current_step" in st2, "expected current_step field");
  } catch (e) {
    throw new Error(`${e?.message ?? e}\n\n--- server logs ---\n${getLogs()}`);
  }
});