import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

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
  // Used by server defaults and by this HTTP e2e as the deterministic minimal input for /blocks/compile.
  const fixturePath = path.resolve(process.cwd(), "test", "fixtures", "golden", "inputs", "vanilla_minimal.json");
  if (!fs.existsSync(fixturePath)) {
    throw new Error(`Missing fixture: ${fixturePath}`);
  }
  return JSON.parse(fs.readFileSync(fixturePath, "utf8"));
}

test("Vertical slice (HTTP): compile->create session->start->return gate events->state contract", async (t) => {
  const gateEnabled = process.env.KOLOSSEUM_HTTP_E2E_RETURN_GATE === "1";

  // Current boot truth: server imports DB pool at module load, so DATABASE_URL is required.
  // Local default: skip if missing (unless the gate is explicitly enabled).
  if (!process.env.DATABASE_URL) {
    if (gateEnabled) {
      throw new Error("KOLOSSEUM_HTTP_E2E_RETURN_GATE=1 requires DATABASE_URL (CI contract).");
    }
    t.skip("DATABASE_URL missing; server boot hard-requires DB right now. Skipping HTTP vertical-slice.");
    return;
  }

  // Hard requirement: dist build must exist for server spawn.
  // Local default: skip if missing (unless the gate is explicitly enabled).
  if (!fs.existsSync(path.resolve(process.cwd(), "dist", "src", "main.js"))) {
    if (gateEnabled) {
      throw new Error("KOLOSSEUM_HTTP_E2E_RETURN_GATE=1 requires dist build (run build:fast).");
    }
    t.skip("dist/src/main.js missing; run build:fast before executing HTTP e2e.");
    return;
  }

  // Ensure DB schema exists (sessions/blocks/runtime_events tables).
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

    // Tier-0 probe
    {
      const r = await fetch(`${baseUrl}/health`);
      assert.equal(r.status, 200);
      const j = await r.json();
      assert.equal(j?.status, "ok");
      assert.ok(typeof j?.version === "string" && j.version.length > 0);
    }

    // Gate flow is explicitly opt-in.
    if (!gateEnabled) return;

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

    // 3) Apply SPLIT_SESSION (canonical engine event; SPLIT_START is a no-op)
    const evSplit = await fetch(`${baseUrl}/sessions/${encodeURIComponent(sessionId)}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event: { type: "SPLIT_SESSION" } }),
    });
    assert.equal(evSplit.status, 201, await evSplit.text());

    // 4) State must expose explicit gate semantics via trace.return_decision_*
    const state1 = await fetch(`${baseUrl}/sessions/${encodeURIComponent(sessionId)}/state`);
    const state1Body = await readJsonOnce(state1);
    assert.equal(state1.status, 200, state1Body.text);
    const s1 = state1Body.json;

    assert.ok(s1?.trace && typeof s1.trace === "object", "expected trace object");
    assert.equal(typeof s1.trace.return_decision_required, "boolean");
    assert.equal(
      s1.trace.return_decision_required,
      true,
      `expected return_decision_required=true; trace=` + JSON.stringify(s1.trace)
    );
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
    const state2Body = await readJsonOnce(state2);
    assert.equal(state2.status, 200, state2Body.text);
    const s2 = state2Body.json;

    assert.ok(s2?.trace && typeof s2.trace === "object", "expected trace object");
    assert.equal(typeof s2.trace.return_decision_required, "boolean");
    assert.equal(
      s2.trace.return_decision_required,
      false,
      `expected return_decision_required=false; trace=` + JSON.stringify(s2.trace)
    );
  } catch (e) {
    throw new Error(`${e?.message ?? e}\n\n--- server logs ---\n${getLogs()}`);
  }
});