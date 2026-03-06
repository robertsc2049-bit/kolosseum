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

  const port = 60123 + Math.floor(Math.random() * 2000);
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

    if (!enabled) return;

    const phase1_input = loadPhase1FixtureOrThrow();

    // Create a session
    const compile = await fetch(`${baseUrl}/blocks/compile?create_session=true`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phase1_input }),
    });
    const compileBody = await readJsonOnce(compile);
    assert.ok(compile.status === 200 || compile.status === 201, compileBody.text);

    const sessionId = compileBody.json?.session_id;
    assert.ok(typeof sessionId === "string" && sessionId.length > 0, "expected session_id");

    // Start session
    const start = await fetch(`${baseUrl}/sessions/${encodeURIComponent(sessionId)}/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const startBody = await readJsonOnce(start);
    assert.equal(start.status, 200, startBody.text);

    // Trigger the unknown-engine-500 pathway.
    // Contract: when KOLOSSEUM_HTTP_E2E_UNKNOWN_ENGINE_500=1, the server must expose a deterministic
    // request that forces an UNKNOWN (non-whitelisted) engine exception and maps it to 500.
    //
    // This test assumes that request is implemented via a special event type.
    const ev = await fetch(`${baseUrl}/sessions/${encodeURIComponent(sessionId)}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event: { type: "E2E_FORCE_UNKNOWN_ENGINE_ERROR" } }),
    });

    const evBody = await readJsonOnce(ev);

    // The entire point: never classify unknown engine exceptions as 4xx.
    assert.equal(ev.status, 500, evBody.text);
  } catch (e) {
    throw new Error(`${e?.message ?? e}\n\n--- server logs ---\n${getLogs()}`);
  }
});