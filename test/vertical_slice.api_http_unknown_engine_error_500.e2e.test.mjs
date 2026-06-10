import test from "node:test";
import assert from "node:assert/strict";

import {
  bootHttpVerticalSlice,
  createStartedSession,
  readJsonOnce
} from "../test_support/http_e2e_harness.mjs";

test("Vertical slice (HTTP): unknown engine exception maps to 500 (never 4xx)", async (t) => {
  let ctx = null;

  try {
    ctx = await bootHttpVerticalSlice(t, {
      requiredFlagEnvVar: "KOLOSSEUM_HTTP_E2E_UNKNOWN_ENGINE_500"
    });

    if (!ctx) return;
    if (!ctx.enabled) return;

    const { baseUrl } = ctx;
    const sessionId = await createStartedSession(baseUrl);

    const ev = await fetch(`${baseUrl}/sessions/${encodeURIComponent(sessionId)}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event: { type: "E2E_FORCE_UNKNOWN_ENGINE_ERROR" } })
    });

    const evBody = await readJsonOnce(ev);

    assert.equal(ev.status, 500, evBody.text);
  } catch (e) {
    const logs = ctx?.getLogs ? ctx.getLogs() : "";
    throw new Error(`${e?.message ?? e}\n\n--- harness logs ---\n${logs}`);
  }
});