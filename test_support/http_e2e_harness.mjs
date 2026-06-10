import assert from "node:assert/strict";
import http from "node:http";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export async function readJsonOnce(res) {
  const text = await res.text().catch(() => "");
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { text, json };
}

export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runNpm(scriptOrArgs, opts = {}) {
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

  const child = spawn(cmd, cmdArgs, {
    cwd: opts.cwd || process.cwd(),
    env,
    stdio: "inherit",
    windowsHide: true,
    shell: false
  });

  const code = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", resolve);
  });

  if (code !== 0) {
    throw new Error(`npm ${tokens.join(" ")} failed (exit=${code})`);
  }
}

export function loadPhase1FixtureOrThrow() {
  const fixturePath = path.resolve(
    process.cwd(),
    "test",
    "fixtures",
    "golden",
    "inputs",
    "vanilla_minimal.json"
  );

  if (!fs.existsSync(fixturePath)) {
    throw new Error(`Missing fixture: ${fixturePath}`);
  }

  return JSON.parse(fs.readFileSync(fixturePath, "utf8"));
}

async function importServerApp() {
  const serverPath = path.resolve(process.cwd(), "dist", "src", "server.js");
  const serverUrl = pathToFileURL(serverPath).href;
  const mod = await import(serverUrl);
  const app = mod?.app ?? null;
  const exportsList = Object.keys(mod || {}).sort().join(", ");

  assert.ok(
    app && typeof app.listen === "function",
    `expected dist server to export app.listen(); exports=[${exportsList || "(none)"}]`
  );

  return app;
}

export async function bootHttpVerticalSlice(t, { requiredFlagEnvVar }) {
  const enabled = process.env[requiredFlagEnvVar] === "1";

  if (!process.env.DATABASE_URL) {
    if (enabled) {
      throw new Error(`${requiredFlagEnvVar}=1 requires DATABASE_URL (CI contract).`);
    }
    t.skip("DATABASE_URL missing; server boot hard-requires DB right now. Skipping HTTP vertical-slice.");
    return null;
  }

  const distServerPath = path.resolve(process.cwd(), "dist", "src", "server.js");
  if (!fs.existsSync(distServerPath)) {
    if (enabled) {
      throw new Error(`${requiredFlagEnvVar}=1 requires dist build (run build:fast).`);
    }
    t.skip("dist/src/server.js missing; run build:fast before executing HTTP e2e.");
    return null;
  }

  await runNpm("db:schema");

  process.env.NODE_ENV = "test";

  const app = await importServerApp();
  const server = http.createServer(app);
  const sockets = new Set();

  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });

  await new Promise((resolve, reject) => {
    const onError = (err) => {
      server.off("error", onError);
      reject(err);
    };

    server.on("error", onError);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", onError);
      resolve();
    });
  });

  const address = server.address();
  assert.ok(address && typeof address === "object" && typeof address.port === "number", "server address/port not available");

  const baseUrl = `http://127.0.0.1:${address.port}`;

  t.after(async () => {
    try {
      if (typeof server.closeIdleConnections === "function") {
        server.closeIdleConnections();
      }
    } catch {}

    try {
      if (typeof server.closeAllConnections === "function") {
        server.closeAllConnections();
      }
    } catch {}

    for (const socket of sockets) {
      try {
        socket.destroy();
      } catch {}
    }

    if (server.listening) {
      await new Promise((resolve) => server.close(() => resolve()));
    }
  });

  const health = await fetch(`${baseUrl}/health`);
  const healthBody = await readJsonOnce(health);

  assert.equal(health.status, 200, healthBody.text);
  assert.equal(healthBody.json?.status, "ok");
  assert.ok(typeof healthBody.json?.version === "string" && healthBody.json.version.length > 0);

  return {
    enabled,
    baseUrl,
    getLogs: () => "in-process http e2e harness (no child process logs)"
  };
}

export async function createStartedSession(baseUrl) {
  const phase1_input = loadPhase1FixtureOrThrow();

  const compile = await fetch(`${baseUrl}/blocks/compile?create_session=true`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ phase1_input })
  });

  const compileBody = await readJsonOnce(compile);
  assert.ok(compile.status === 200 || compile.status === 201, compileBody.text);

  const sessionId = compileBody.json?.session_id;
  assert.ok(typeof sessionId === "string" && sessionId.length > 0, "expected session_id");

  const start = await fetch(`${baseUrl}/sessions/${encodeURIComponent(sessionId)}/start`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({})
  });

  const startBody = await readJsonOnce(start);
  assert.equal(start.status, 200, startBody.text);

  return sessionId;
}

export async function fetchState(baseUrl, sessionId) {
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

export async function postEvent(baseUrl, sessionId, event) {
  const res = await fetch(`${baseUrl}/sessions/${encodeURIComponent(sessionId)}/events`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ event })
  });

  const body = await readJsonOnce(res);
  return { res, body };
}