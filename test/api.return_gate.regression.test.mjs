/* test/api.return_gate.regression.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import net from "node:net";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

function repoRoot() {
  // Robust on Windows: convert file URL -> real path
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

test("API regression: split return decision gate blocks events until RETURN_CONTINUE", async (t) => {
  const root = repoRoot();

  // ---- Environment ----
  const env = {
    ...process.env,
    DATABASE_URL: process.env.DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5432/kolosseum",
    PORT: "0"
  };
  delete env.SMOKE_NO_DB;

  // ---- Apply schema (idempotent) ----
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

  // ---- Start server on free port ----
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

  // ---- Create session ----
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

  // ---- Start session ----
  const start = await httpJson("POST", `${baseUrl}/sessions/${sessionId}/start`, {});
  assert.ok(start.res.status === 200 || start.res.status === 201, `start expected 200/201, got ${start.res.status}. raw=${start.text}`);

  // ---- 1) SPLIT_SESSION arms gate ----
  const evSplit = await httpJson("POST", `${baseUrl}/sessions/${sessionId}/events`, { event: { type: "SPLIT_SESSION" } });
  assert.equal(evSplit.res.status, 201, `SPLIT_SESSION expected 201, got ${evSplit.res.status}. raw=${evSplit.text}`);

  const st1 = await httpJson("GET", `${baseUrl}/sessions/${sessionId}/state`);
  assert.equal(st1.res.status, 200, `GET state expected 200, got ${st1.res.status}. raw=${st1.text}`);
  assert.ok(st1.json && typeof st1.json === "object", `state expected JSON object. raw=${st1.text}`);

  const trace1 = st1.json.trace;
  assert.ok(trace1 && typeof trace1 === "object", `state.trace missing. raw=${st1.text}`);

  assert.equal(trace1.return_decision_required, true, `expected trace.return_decision_required=true, got ${trace1.return_decision_required}`);
  assert.ok(Array.isArray(trace1.return_decision_options), `expected trace.return_decision_options array`);
  const opts1 = [...trace1.return_decision_options].slice().sort().join(",");
  assert.equal(opts1, "RETURN_CONTINUE,RETURN_SKIP", `expected both return options, got ${opts1}`);

  // "billionaire-proof": no semantics leak fields
  assert.equal(Object.prototype.hasOwnProperty.call(trace1, "return_gate_required"), false, "trace must not expose return_gate_required");
  assert.equal(Object.prototype.hasOwnProperty.call(trace1, "split_active"), false, "trace must not expose split_active (no inference/legacy semantics leak)");

  // ---- 2) COMPLETE_EXERCISE while gated -> 400 await-return-decision ----
  const evCompleteWhileGated = await httpJson(
    "POST",
    `${baseUrl}/sessions/${sessionId}/events`,
    { event: { type: "COMPLETE_EXERCISE", exercise_id: "bench_press" } }
  );

  assert.equal(evCompleteWhileGated.res.status, 400, `COMPLETE_EXERCISE while gated expected 400, got ${evCompleteWhileGated.res.status}. raw=${evCompleteWhileGated.text}`);
  assert.ok(evCompleteWhileGated.json && typeof evCompleteWhileGated.json === "object", `expected JSON error object. raw=${evCompleteWhileGated.text}`);

  const details = evCompleteWhileGated.json.details;
  assert.ok(details && typeof details === "object", `expected error.details. raw=${evCompleteWhileGated.text}`);
  assert.equal(details.failure_token, "phase6_runtime_await_return_decision", `expected failure_token=phase6_runtime_await_return_decision, got ${details.failure_token}`);
  assert.ok(typeof details.cause === "string" && details.cause.startsWith("PHASE6_RUNTIME_AWAIT_RETURN_DECISION:"), `expected details.cause prefix, got ${details.cause}`);

  // ---- 3) RETURN_CONTINUE clears gate ----
  const evReturn = await httpJson("POST", `${baseUrl}/sessions/${sessionId}/events`, { event: { type: "RETURN_CONTINUE" } });
  assert.equal(evReturn.res.status, 201, `RETURN_CONTINUE expected 201, got ${evReturn.res.status}. raw=${evReturn.text}`);

  // ---- 4) COMPLETE_EXERCISE now succeeds ----
  const evComplete = await httpJson(
    "POST",
    `${baseUrl}/sessions/${sessionId}/events`,
    { event: { type: "COMPLETE_EXERCISE", exercise_id: "bench_press" } }
  );
  assert.equal(evComplete.res.status, 201, `COMPLETE_EXERCISE expected 201, got ${evComplete.res.status}. raw=${evComplete.text}`);

  // ---- Final state ----
  const st2 = await httpJson("GET", `${baseUrl}/sessions/${sessionId}/state`);
  assert.equal(st2.res.status, 200, `GET state expected 200, got ${st2.res.status}. raw=${st2.text}`);

  const trace2 = st2.json.trace;
  assert.ok(trace2 && typeof trace2 === "object", `state.trace missing. raw=${st2.text}`);

  assert.ok(Array.isArray(trace2.completed_ids), "expected trace.completed_ids array");
  assert.equal(trace2.completed_ids.length, 1, `expected exactly 1 completed_id, got ${trace2.completed_ids.length}: ${JSON.stringify(trace2.completed_ids)}`);
  assert.equal(trace2.completed_ids[0], "bench_press", `expected completed_ids=["bench_press"], got ${JSON.stringify(trace2.completed_ids)}`);

  assert.equal(trace2.return_decision_required, false, `expected return_decision_required=false, got ${trace2.return_decision_required}`);
  assert.ok(Array.isArray(trace2.return_decision_options) && trace2.return_decision_options.length === 0, `expected return_decision_options empty, got ${JSON.stringify(trace2.return_decision_options)}`);
});