import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { startServer } from "../dist/src/server.js";

const require = createRequire(import.meta.url);
const expected = require("../package.json").version;

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function waitForHealth(url, timeoutMs = 2000, pollMs = 50) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.status === 200) return res;
    } catch {
      // ignore until deadline
    }
    await sleep(pollMs);
  }
  throw new Error("health did not return 200 within " + timeoutMs + "ms: " + url);
}

test("health exposes package.json build version", async () => {
  const srv = startServer(0);

  try {
    // Ensure the server is actually bound before using address()/fetch
    await new Promise((resolve) => srv.once("listening", resolve));

    const addr = srv.address();
    assert.ok(addr && typeof addr === "object" && typeof addr.port === "number", "server address/port not available");
    const url = "http://127.0.0.1:" + addr.port + "/health";

    const res = await waitForHealth(url, 2000, 50);
    const body = await res.json();

    assert.equal(body.status, "ok");
    assert.equal(body.version, expected);
  } finally {
    await new Promise((resolve) => srv.close(resolve));
  }
});