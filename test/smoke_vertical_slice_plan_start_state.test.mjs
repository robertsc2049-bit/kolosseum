import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import { resolve } from "node:path";

function requireDatabaseUrlOrDie() {
  if (!process.env.DATABASE_URL) {
    throw new Error("Tier-1 smoke requires DATABASE_URL to be set (real Postgres). Refusing to invent creds.");
  }
}

async function loadExpressAppOrDie() {
  requireDatabaseUrlOrDie();

  const mod = await import("../dist/src/server.js");
  if (mod && mod.app) return mod.app;

  const keys = Object.keys(mod || {}).sort();
  throw new Error("Server entrypoint did not export `app`. Exports: " + keys.join(", "));
}

function loadDefaultFixtureOrDie() {
  const p = resolve(process.cwd(), "test", "fixtures", "golden", "inputs", "vanilla_minimal.json");
  if (!fs.existsSync(p)) throw new Error("Missing fixture: " + p);
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

async function readJsonOrText(res) {
  const ct = String(res.headers.get("content-type") || "").toLowerCase();
  if (ct.includes("application/json") || ct.includes("+json")) return await res.json();
  const txt = await res.text();
  try { return JSON.parse(txt); } catch { return txt; }
}

test("SMOKE (Tier-1): /blocks/compile?create_session=true -> /sessions/:id/start -> /sessions/:id/state", async () => {
  const app = await loadExpressAppOrDie();
  const srv = http.createServer(app);

  try {
    await new Promise((resolve) => srv.listen(0, "127.0.0.1", resolve));

    const addr = srv.address();
    assert.ok(addr && typeof addr === "object" && typeof addr.port === "number", "server address/port not available");
    const baseUrl = "http://127.0.0.1:" + addr.port;

    const phase1 = loadDefaultFixtureOrDie();
    const compileBody = { phase1_input: phase1 };

    const compileRes = await fetch(baseUrl + "/blocks/compile?create_session=true", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(compileBody)
    });

    if (!compileRes.ok) {
      const body = await readJsonOrText(compileRes);
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