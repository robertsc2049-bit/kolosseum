import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

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
  child.stdout.on("data", (d) => {
    out += d.toString("utf8");
  });
  child.stderr.on("data", (d) => {
    out += d.toString("utf8");
  });

  return { child, getLogs: () => out };
}

async function runDbSchemaOrThrow() {
  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

  const p = spawn(npmCmd, ["run", "db:schema"], {
    stdio: "inherit",
    windowsHide: true,
  });

  const code = await new Promise((res) => p.on("exit", res));
  if (code !== 0) throw new Error(`db:schema failed (exit=${code})`);
}

test("Vertical slice (HTTP): boots server and responds to /health", async (t) => {
  // Hard fact: server boot currently requires DATABASE_URL at import-time (dist/src/db/pool.js throws).
  // So this e2e can only run in environments that provide DATABASE_URL (CI / dev with .env).
  if (!process.env.DATABASE_URL) {
    t.skip("DATABASE_URL missing; server boot hard-requires DB right now. Skipping HTTP vertical-slice.");
    return;
  }

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

    const r = await fetch(`${baseUrl}/health`);
    assert.equal(r.status, 200);
    const body = await r.text();
    assert.ok(body.length > 0, "health body must be non-empty");

    // Full return-gate flow is OPTIONAL and must be explicitly enabled.
    // Enable:
    //   $env:KOLOSSEUM_HTTP_E2E_RETURN_GATE="1"
    //   (DATABASE_URL already required for this test)
    //   npm run test:ci:integration
    if (process.env.KOLOSSEUM_HTTP_E2E_RETURN_GATE !== "1") return;

    await runDbSchemaOrThrow();

    // NOTE: The below endpoints/payloads are still guesses until we lock the HTTP contract.
    // Keep this behind the flag until the API routes are confirmed.

    const create = await fetch(`${baseUrl}/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(create.status, 200, await create.text());
    const created = await create.json();
    assert.ok(created?.session_id, "expected session_id");
    const sessionId = created.session_id;

    const compile = await fetch(`${baseUrl}/blocks/compile`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ session_id: sessionId }),
    });
    assert.equal(compile.status, 200, await compile.text());

    const apply = await fetch(`${baseUrl}/blocks/apply`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        runtime_events: [{ kind: "SPLIT_START" }],
      }),
    });
    assert.equal(apply.status, 200, await apply.text());

    const state1 = await fetch(`${baseUrl}/sessions/${sessionId}/state`);
    assert.equal(state1.status, 200, await state1.text());
    const s1 = await state1.json();

    assert.equal(typeof s1?.return_decision_required, "boolean");
    assert.equal(s1.return_decision_required, true);
    assert.ok(Array.isArray(s1?.return_decision_options));

    const cont = await fetch(`${baseUrl}/blocks/apply`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        runtime_events: [{ kind: "RETURN_CONTINUE" }],
      }),
    });
    assert.equal(cont.status, 200, await cont.text());

    const state2 = await fetch(`${baseUrl}/sessions/${sessionId}/state`);
    assert.equal(state2.status, 200, await state2.text());
    const s2 = await state2.json();

    assert.equal(s2?.return_decision_required, false);
  } catch (e) {
    throw new Error(`${e?.message ?? e}\n\n--- server logs ---\n${getLogs()}`);
  }
});