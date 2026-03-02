/* test/api.apply_unknown_maps_500.regression.test.mjs */
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

function spawnNode(args, opts = {}) {
  const child = spawn(process.execPath, args, {
    stdio: ["ignore", "pipe", "pipe"],
    ...opts
  });

  let stdout = "";
  let stderr = "";

  child.stdout.on("data", (d) => (stdout += d.toString("utf8")));
  child.stderr.on("data", (d) => (stderr += d.toString("utf8")));

  return {
    child,
    get stdout() { return stdout; },
    get stderr() { return stderr; }
  };
}

async function waitForHealth(baseUrl, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  let lastErr = null;

  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${baseUrl}/health`);
      if (r.ok) return;
      lastErr = new Error(`health not ok: ${r.status}`);
    } catch (e) {
      lastErr = e;
    }
    await new Promise((r) => setTimeout(r, 120));
  }

  throw new Error(
    `server did not become healthy in time (${timeoutMs}ms). last error: ${lastErr?.message ?? lastErr}`
  );
}

async function httpJson(method, url, body) {
  const init = { method, headers: { "content-type": "application/json" } };
  if (body !== undefined) init.body = JSON.stringify(body);
  const res = await fetch(url, init);
  const text = await res.text();
  let json = null;
  try { json = text.length ? JSON.parse(text) : null; } catch { /* keep raw */ }
  return { res, text, json };
}

test("API regression: unknown applyRuntimeEvents failure must map to 500 (not 400)", async (t) => {
  const root = repoRoot();

  const env = {
    ...process.env,
    DATABASE_URL: process.env.DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5432/kolosseum",
    PORT: "0",

    // This must trigger the sentinel throw you add right before applyRuntimeEvents(...)
    KOLOSSEUM_TEST_FORCE_WIRE_APPLY_THROW: "1"
  };
  delete env.SMOKE_NO_DB;

  // Apply schema (idempotent)
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

  // Start server
  const port = await getFreePort();
  env.PORT = String(port);

  const serverEntrypoint = path.join(root, "dist", "src", "main.js");
  const server = spawnNode([serverEntrypoint], { cwd: root, env });

  t.after(() => {
    if (!server.child.killed) {
      try { server.child.kill(); } catch {}
    }
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  await waitForHealth(baseUrl);

  // Create session
  const helloPath = path.join(root, "examples", "hello_world.json");
  const phase1 = JSON.parse(await fs.readFile(helloPath, "utf8"));

  const compile = await httpJson(
    "POST",
    `${baseUrl}/blocks/compile?create_session=true`,
    { phase1_input: phase1 }
  );

  assert.equal(compile.res.status, 201, `compile expected 201, got ${compile.res.status}. raw=${compile.text}`);
  assert.ok(compile.json && typeof compile.json === "object", `compile expected JSON object. raw=${compile.text}`);
  assert.ok(typeof compile.json.session_id === "string" && compile.json.session_id.length > 0, `missing session_id. raw=${compile.text}`);

  const sessionId = compile.json.session_id;

  // Start session
  const start = await httpJson("POST", `${baseUrl}/sessions/${sessionId}/start`, {});
  assert.ok(start.res.status === 200 || start.res.status === 201, `start expected 200/201, got ${start.res.status}. raw=${start.text}`);

  // Post a normal event that would normally hit applyRuntimeEvents(...)
  const ev = await httpJson("POST", `${baseUrl}/sessions/${sessionId}/events`, { event: { type: "SPLIT_SESSION" } });

  // This is the core regression assertion:
  assert.equal(ev.res.status, 500, `expected 500 for unknown apply failure, got ${ev.res.status}. raw=${ev.text}`);

  // Optional: sanity that we got structured JSON (keep permissive until we lock exact token)
  assert.ok(ev.json && typeof ev.json === "object", `expected JSON error object. raw=${ev.text}`);
  assert.ok(ev.json.details && typeof ev.json.details === "object", `expected json.details object. raw=${ev.text}`);

  // The point: it MUST NOT masquerade as a caller fault token
  assert.notEqual(ev.json.details.failure_token, "phase6_runtime_await_return_decision", "must not map unknown apply error to a known caller-fault token");

  // If your API has a canonical internal token, lock it here once you confirm it:
  // assert.equal(ev.json.details.failure_token, "internal_server_error", `expected internal_server_error token, got ${ev.json.details.failure_token}`);
});