import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import { resolve } from "node:path";
import net from "node:net";

function loadDefaultFixtureOrDie() {
  const p = resolve(process.cwd(), "test", "fixtures", "golden", "inputs", "vanilla_minimal.json");
  if (!fs.existsSync(p)) throw new Error("Missing fixture: " + p);
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

async function readJsonOrText(res) {
  const ct = String(res.headers.get("content-type") || "").toLowerCase();
  if (ct.includes("application/json") || ct.includes("+json")) return await res.json();
  const txt = await res.text();
  try {
    return JSON.parse(txt);
  } catch {
    return txt;
  }
}

function defaultDbUrl() {
  // Match repo convention seen in scripts/smoke-blocks-run.ps1
  return "postgres://postgres:postgres@127.0.0.1:5432/kolosseum_test";
}

function getDbUrl() {
  const env = (process.env.DATABASE_URL || "").trim();
  return env.length > 0 ? env : defaultDbUrl();
}

function parseHostPort(dbUrl) {
  try {
    const u = new URL(dbUrl);
    const host = u.hostname || "127.0.0.1";
    const port = Number(u.port || "5432");
    return { host, port };
  } catch {
    return { host: "127.0.0.1", port: 5432 };
  }
}

async function canConnectTcp(host, port, timeoutMs = 250) {
  return await new Promise((resolve) => {
    const sock = new net.Socket();
    let done = false;

    function finish(ok) {
      if (done) return;
      done = true;
      try {
        sock.destroy();
      } catch {}
      resolve(ok);
    }

    sock.setTimeout(timeoutMs);
    sock.once("error", () => finish(false));
    sock.once("timeout", () => finish(false));
    sock.connect(port, host, () => finish(true));
  });
}

async function loadExpressAppOrDie() {
  // dist/src/server.js imports db/pool at module top-level.
  // Ensure DATABASE_URL is set *before* import.
  const dbUrl = getDbUrl();
  process.env.DATABASE_URL = dbUrl;

  const mod = await import("../dist/src/server.js");
  if (mod && mod.app) return mod.app;

  const keys = Object.keys(mod || {}).sort();
  throw new Error("Server entrypoint did not export `app`. Exports: " + keys.join(", "));
}

function isCi() {
  // GitHub Actions sets CI=true; keep this generic.
  return String(process.env.CI || "").toLowerCase() === "true";
}

test("SMOKE (Tier-1): /blocks/compile?create_session=true -> /sessions/:id/start -> /sessions/:id/state", async (t) => {
  const dbUrl = getDbUrl();
  const { host, port } = parseHostPort(dbUrl);

  // If nothing is listening, skip locally (and in CI if CI does not provision DB for this lane).
  const tcpOk = await canConnectTcp(host, port, 250);
  if (!tcpOk) {
    t.skip("Tier-1 smoke skipped: no Postgres listening at " + host + ":" + port + " (DATABASE_URL=" + dbUrl + ")");
    return;
  }

  const app = await loadExpressAppOrDie();
  const srv = http.createServer(app);

  try {
    await new Promise((resolve) => srv.listen(0, "127.0.0.1", resolve));

    const addr = srv.address();
    assert.ok(addr && typeof addr === "object" && typeof addr.port === "number", "server address/port not available");
    const baseUrl = "http://127.0.0.1:" + addr.port;

    // blocks/compile expects { phase1_input: ... }
    const phase1 = loadDefaultFixtureOrDie();
    const compileBody = { phase1_input: phase1 };

    const compileRes = await fetch(baseUrl + "/blocks/compile?create_session=true", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(compileBody)
    });

    if (!compileRes.ok) {
      const body = await readJsonOrText(compileRes);
      const msg = String(body?.error || body?.message || "");
      const isAuthFail = msg.toLowerCase().includes("password authentication failed");

      // Local convenience: if a Postgres is up but creds are wrong, skip (dev machines vary).
      // CI correctness: if a Postgres is reachable but creds are wrong, FAIL (do not hide broken infra).
      if (compileRes.status === 500 && isAuthFail && !isCi()) {
        t.skip("Tier-1 smoke skipped: Postgres auth failed (DATABASE_URL=" + dbUrl + "). Bring up docker testdb or fix creds.");
        return;
      }

      throw new Error("blocks/compile failed: " + compileRes.status + " body=" + JSON.stringify(body).slice(0, 2000));
    }

    const compiled = await readJsonOrText(compileRes);
    assert.ok(compiled && typeof compiled === "object", "compile response not object");
    assert.ok(compiled.block_id, "expected block_id");
    assert.ok(compiled.session_id, "expected session_id (create_session=true)");

    const sessionId = String(compiled.session_id);

    const startRes = await fetch(baseUrl + "/sessions/" + sessionId + "/start", { method: "POST" });
    if (!startRes.ok) {
      const body = await readJsonOrText(startRes);
      throw new Error("sessions/start failed: " + startRes.status + " body=" + JSON.stringify(body).slice(0, 2000));
    }

    const stateRes = await fetch(baseUrl + "/sessions/" + sessionId + "/state");
    if (!stateRes.ok) {
      const body = await readJsonOrText(stateRes);
      throw new Error("sessions/state failed: " + stateRes.status + " body=" + JSON.stringify(body).slice(0, 2000));
    }

    const state = await readJsonOrText(stateRes);
    assert.equal(String(state.session_id), sessionId);
    assert.ok(state.trace && typeof state.trace === "object", "expected trace object");
    assert.ok(Array.isArray(state.remaining_exercises), "expected remaining_exercises[]");
    assert.ok(Array.isArray(state.completed_exercises), "expected completed_exercises[]");
    assert.ok(Array.isArray(state.dropped_exercises), "expected dropped_exercises[]");
  } finally {
    await new Promise((resolve) => srv.close(resolve));
  }
});