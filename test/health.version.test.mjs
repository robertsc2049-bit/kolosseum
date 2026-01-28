import test from "node:test";
import assert from "node:assert/strict";
import { VERSION } from "../dist/src/version.js";
import { startServer } from "../dist/src/server.js";

test("health exposes build version", async () => {
  // Start server on an ephemeral port
  const server = startServer(0);

  await new Promise((resolve) => server.once("listening", resolve));

  const { port } = server.address();

  const res = await fetch(`http://127.0.0.1:${port}/health`);
  assert.equal(res.ok, true);

  const body = await res.json();
  assert.equal(body.status, "ok");
  assert.equal(body.version, VERSION);

  // Clean shutdown (critical for CI)
  await new Promise((resolve) => server.close(resolve));
});

