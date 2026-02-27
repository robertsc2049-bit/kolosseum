import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const expected = require("../package.json").version;

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

function ensureDatabaseUrlForImport() {
  // dist/src/server.js imports db/pool at module top-level; pool hard-fails if DATABASE_URL missing.
  if (!process.env.DATABASE_URL) {
    // Does not need to be reachable for this test; we just need import-time to not crash.
    process.env.DATABASE_URL = "postgres://user:pass@127.0.0.1:5432/kolosseum_test";
  }
}

async function loadExpressAppOrDie() {
  ensureDatabaseUrlForImport();

  const mod = await import("../dist/src/server.js");

  if (mod && mod.app) return mod.app;

  const keys = Object.keys(mod || {}).sort();
  throw new Error("Server entrypoint did not export `app`. Exports: " + keys.join(", "));
}

async function probeHealth(baseUrl, timeoutMs = 2500, pollMs = 75) {
  const paths = [
    "/health",
    "/healthz",
    "/_health",
    "/api/health",
    "/api/healthz",
    "/v1/health",
    "/status",
    "/version"
  ];

  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    for (const p of paths) {
      const url = baseUrl + p;
      try {
        const res = await fetch(url);
        if (res.status !== 200) continue;

        // We found a 200 endpoint. Return it.
        return { url, res };
      } catch {
        // ignore until deadline
      }
    }

    await sleep(pollMs);
  }

  throw new Error("No health endpoint returned 200 within " + timeoutMs + "ms at base " + baseUrl);
}

async function readBody(res) {
  const ct = String(res.headers.get("content-type") || "").toLowerCase();

  // try JSON first if content-type hints
  if (ct.includes("application/json") || ct.includes("+json")) {
    try {
      return { kind: "json", value: await res.json() };
    } catch {
      // fall through to text
    }
  }

  // otherwise read as text and try parse JSON opportunistically
  const txt = await res.text();
  try {
    const j = JSON.parse(txt);
    return { kind: "json", value: j };
  } catch {
    return { kind: "text", value: txt };
  }
}

test("health exposes package.json build version", async () => {
  const app = await loadExpressAppOrDie();
  const srv = http.createServer(app);

  try {
    await new Promise((resolve) => srv.listen(0, "127.0.0.1", resolve));

    const addr = srv.address();
    assert.ok(addr && typeof addr === "object" && typeof addr.port === "number", "server address/port not available");

    const baseUrl = "http://127.0.0.1:" + addr.port;

    const { url, res } = await probeHealth(baseUrl, 2500, 75);
    const body = await readBody(res);

    // Diagnostics (only prints on failure in most runners, but useful locally too)
    // eslint-disable-next-line no-console
    console.log("[health.test] ok endpoint:", url);

    if (body.kind === "json") {
      const j = body.value || {};
      // tolerate varying shapes, but must prove the build version is exposed
      const status = String(j.status || j.ok || j.state || "").toLowerCase();
      const version = String(j.version || j.build_version || j.buildVersion || j.app_version || j.appVersion || "");

      // If a status exists, require it to indicate OK; otherwise only require version match.
      if (status) assert.ok(status === "ok" || status === "true" || status === "healthy", "health status not ok: " + status);

      assert.equal(version, expected);
      return;
    }

    // text mode: prove the version is exposed somewhere in the payload
    const t = String(body.value || "");
    assert.ok(t.includes(expected), "health text payload did not include version " + expected + " :: " + t.slice(0, 200));
  } finally {
    await new Promise((resolve) => srv.close(resolve));
  }
});
