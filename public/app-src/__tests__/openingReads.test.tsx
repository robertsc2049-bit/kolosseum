import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { ApiRequestError, __resetSharedReadsForTests, request } from "../api/transport";

// opening.js as the page loads it: a classic script against this window.
const source = fs.readFileSync(new URL("../../app/opening.js", import.meta.url), "utf8");
type Win = { kolosseumOpeningRead?: (key: string) => Promise<{ status: number; payload: unknown } | null>; kolosseumOpeningSpent?: () => void };
const win = globalThis as unknown as Win;

function open(opening: unknown, ok = true) {
  const asked: string[] = [];
  const respond = (body: unknown, good = true) => ({ ok: good, status: good ? 200 : 500, json: async () => body, text: async () => JSON.stringify(body) }) as Response;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const path = String(input);
    asked.push(path);
    return path === "/account/opening" ? respond(opening, ok) : respond({ from: "server" });
  }) as typeof fetch;
  new Function("window", "document", "fetch", source)(globalThis, document, globalThis.fetch);
  return asked;
}

test.afterEach(() => {
  delete win.kolosseumOpeningRead;
  delete win.kolosseumOpeningSpent;
  __resetSharedReadsForTests();
});

test("a read that came with the opening isn't asked for again, and each caller gets its own copy", async () => {
  const asked = open({ reads: { "GET /weekly-checkins": { status: 200, payload: { checkins: [{ n: 1 }] } } } });
  const first = await request("GET", "/weekly-checkins");
  (first.checkins as Array<{ n: number }>)[0].n = 99;
  assert.deepEqual(await request("GET", "/weekly-checkins"), { checkins: [{ n: 1 }] });
  assert.deepEqual(asked, ["/account/opening"]);
  assert.deepEqual(await request("GET", "/something-else"), { from: "server" });
});

test("a refusal in the opening reads as the same error", async () => {
  open({ reads: { "GET /check-ins/slots": { status: 403, payload: { error: "not_for_you" } } } });
  await assert.rejects(() => request("GET", "/check-ins/slots"), (error: unknown) => error instanceof ApiRequestError && error.status === 403);
});

test("after a change nothing from the opening is used", async () => {
  const asked = open({ reads: { "GET /weekly-checkins": { status: 200, payload: { checkins: [] } } } });
  await request("POST", "/weekly-checkins", { week_start_date: "2026-11-23" });
  assert.deepEqual(await request("GET", "/weekly-checkins"), { from: "server" });
  assert.deepEqual(asked, ["/account/opening", "/weekly-checkins", "/weekly-checkins"]);
});

test("the legacy app's changes count too", async () => {
  open({ reads: { "GET /weekly-checkins": { status: 200, payload: { checkins: [] } } } });
  document.dispatchEvent(new Event("kolosseum:data-changed"));
  assert.deepEqual(await request("GET", "/weekly-checkins"), { from: "server" });
});

test("if the opening fails, or never loaded, every read is asked for as before", async () => {
  open({ error: "x" }, false);
  assert.deepEqual(await request("GET", "/weekly-checkins"), { from: "server" });
  delete win.kolosseumOpeningRead;
  __resetSharedReadsForTests();
  assert.deepEqual(await request("GET", "/account/detail"), { from: "server" });
});
