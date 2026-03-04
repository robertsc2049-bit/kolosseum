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
  // This file already exists in your repo and is used by server planSession as a default.
  // Here we use it as a deterministic "minimal viable" phase1_input for /blocks/compile.
  // If this ever stops being Phase1-shaped, that is a real contract break and should fail loudly.
  const fixturePath = path.resolve(process.cwd(), "test", "fixtures", "golden", "inputs", "vanilla_minimal.json");
  if (!fs.existsSync(fixturePath)) {
    throw new Error(`Missing fixture: ${fixturePath}`);
  }
  return JSON.parse(fs.readFileSync(fixturePath, "utf8"));
}

test("Vertical slice (HTTP): compile->create session->start->return gate events->state contract", async (t) => {  // Current boot truth: server imports DB pool at module load, so DATABASE_URL is required.
  // Local default: skip if missing (unless the gate is explicitly enabled).
  if (!process.env.DATABASE_URL) {
    if (process.env.KOLOSSEUM_HTTP_E2E_RETURN_GATE === "1") {
      throw new Error("KOLOSSEUM_HTTP_E2E_RETURN_GATE=1 requires DATABASE_URL (CI contract).");
    }
    t.skip("DATABASE_URL missing; server boot hard-requires DB right now. Skipping HTTP vertical-slice.");
    return;
  }  // Hard requirement: dist build must exist for server spawn.
  // Local default: skip if missing (unless the gate is explicitly enabled).
  if (!fs.existsSync(path.resolve(process.cwd(), "dist", "src", "main.js"))) {
    if (process.env.KOLOSSEUM_HTTP_E2E_RETURN_GATE === "1") {
      throw new Error("KOLOSSEUM_HTTP_E2E_RETURN_GATE=1 requires dist build (run build:fast).");
    }
    t.skip("dist/src/main.js missing; run build:fast before executing HTTP e2e.");
    return;
  }// Ensure DB schema exists (sessions/blocks/runtime_events tables).
  await runNpm("db:schema");

  const port = 58123 + Math.floor(Math.random() * 2000);
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

    // Always assert /health (Tier-0 probe)
    {
      const r = await fetch(`${baseUrl}/health`);
      assert.equal(r.status, 200);
      const j = await r.json();
      assert.equal(j?.status, "ok");
      assert.ok(typeof j?.version === "string" && j.version.length > 0);
    }

    // Full return-gate flow must be explicitly enabled (CI sets this to "1").
        // Full return-gate flow must be explicitly enabled (CI sets this to "1").
    const gateEnabled = process.env.KOLOSSEUM_HTTP_E2E_RETURN_GATE === "1";
    if (!gateEnabled) return;

    // If the gate is enabled, these become hard requirements (CI contract).
    if (!process.env.DATABASE_URL) {
      throw new Error("KOLOSSEUM_HTTP_E2E_RETURN_GATE=1 requires DATABASE_URL (CI contract).");
    }
    if (!fs.existsSync(path.resolve(process.cwd(), "dist", "src", "main.js"))) {
      throw new Error("KOLOSSEUM_HTTP_E2E_RETURN_GATE=1 requires dist build (run build:fast).");
    }

    const phase1_input = loadPhase1FixtureOrThrow();

    // 1) Compile + create session
    const compile = await fetch(`${baseUrl}/blocks/compile?create_session=true`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phase1_input }),
    });
    assert.ok(compile.status === 200 || compile.status === 201, await compile.text());
    const compiled = await compile.json();

    assert.ok(typeof compiled?.block_id === "string" && compiled.block_id.length > 0, "expected block_id");
    assert.ok(typeof compiled?.session_id === "string" && compiled.session_id.length > 0, "expected session_id");

    const sessionId = compiled.session_id;

    // 2) Start session (idempotent)
    const start = await fetch(`${baseUrl}/sessions/${encodeURIComponent(sessionId)}/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(start.status, 200, await start.text());

    // 3) Apply SPLIT_START
    const evSplit = await fetch(`${baseUrl}/sessions/${encodeURIComponent(sessionId)}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event: { type: "SPLIT_START" } }),
    });
    assert.equal(evSplit.status, 201, await evSplit.text());

    // 4) State must expose explicit gate semantics via trace.return_decision_*
    const state1 = await fetch(`${baseUrl}/sessions/${encodeURIComponent(sessionId)}/state`);
    assert.equal(state1.status, 200, await state1.text());
    const s1 = await state1.json();

    assert.ok(s1?.trace && typeof s1.trace === "object", "expected trace object");
    assert.equal(typeof s1.trace.return_decision_required, "boolean");
    assert.equal(s1.trace.return_decision_required, true);
    assert.ok(Array.isArray(s1.trace.return_decision_options), "expected return_decision_options array");
    assert.ok(
      s1.trace.return_decision_options.includes("RETURN_CONTINUE") &&
        s1.trace.return_decision_options.includes("RETURN_SKIP"),
      "expected RETURN_CONTINUE and RETURN_SKIP options"
    );

    // 5) Continue
    const evContinue = await fetch(`${baseUrl}/sessions/${encodeURIComponent(sessionId)}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event: { type: "RETURN_CONTINUE" } }),
    });
    assert.equal(evContinue.status, 201, await evContinue.text());

    const state2 = await fetch(`${baseUrl}/sessions/${encodeURIComponent(sessionId)}/state`);
    assert.equal(state2.status, 200, await state2.text());
    const s2 = await state2.json();

    assert.ok(s2?.trace && typeof s2.trace === "object", "expected trace object");
    assert.equal(typeof s2.trace.return_decision_required, "boolean");
    assert.equal(s2.trace.return_decision_required, false);
  } catch (e) {
    throw new Error(`${e?.message ?? e}\n\n--- server logs ---\n${getLogs()}`);
  }
});