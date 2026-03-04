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

function spawnServer(port, extraEnv = {}) {
  const env = { ...process.env, PORT: String(port), NODE_ENV: "test", ...extraEnv };

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

test("Vertical slice (HTTP): unknown engine exception maps to 500 (never 4xx)", async (t) => {
  const enabled = process.env.KOLOSSEUM_HTTP_E2E_UNKNOWN_ENGINE_500 === "1";

  if (!process.env.DATABASE_URL) {
    if (enabled) throw new Error("KOLOSSEUM_HTTP_E2E_UNKNOWN_ENGINE_500=1 requires DATABASE_URL (CI contract).");
    t.skip("DATABASE_URL missing; server boot hard-requires DB right now. Skipping HTTP vertical-slice.");
    return;
  }

  if (!fs.existsSync(path.resolve(process.cwd(), "dist", "src", "main.js"))) {
    if (enabled) throw new Error("KOLOSSEUM_HTTP_E2E_UNKNOWN_ENGINE_500=1 requires dist build (run build:fast).");
    t.skip("dist/src/main.js missing; run build:fast before executing HTTP e2e.");
    return;
  }

  await runNpm("db:schema");

  const port = 61200 + Math.floor(Math.random() * 2000);
  const baseUrl = `http://127.0.0.1:${port}`;

  // Enable the server-side sentinel so applyWireEvent throws an unknown error for any non-START event.
  const { child, getLogs } = spawnServer(port, { KOLOSSEUM_TEST_FORCE_WIRE_APPLY_THROW: "1" });

  t.after(async () => {
    if (!child.killed) {
      child.kill();
      await wait(200);
    }
  });

  try {
    await waitForHealth(baseUrl);

    // Gate is opt-in.
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

    // 3) Send a valid non-START runtime event.
    // Use COMPLETE_STEP so the API expands it to a canonical engine event.
    const ev = await fetch(`${baseUrl}/sessions/${encodeURIComponent(sessionId)}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event: { type: "COMPLETE_STEP" } }),
    });

    const txt = await ev.text();

    // Unknown exception must be a server fault.
    assert.equal(ev.status, 500, txt);

    // Lock the “unknown engine error” path: body should include sentinel marker or the generic message.
    assert.match(txt, /(KOLOSSEUM_TEST_FORCE_WIRE_APPLY_THROW|unexpected engine error)/i, "expected unknown-engine marker in body");
  } catch (e) {
    throw new Error(`${e?.message ?? e}\n\n--- server logs ---\n${getLogs()}`);
  }
});