// Shared reads in api/transport.ts: one page load used to send the same read
// dozens of times. Identical reads share one request, a just-finished read
// is reused for a moment, and any change sends the next read to the server.
import assert from "node:assert/strict";
import test from "node:test";

import { __resetSharedReadsForTests, request } from "../api/transport";

type Call = { method: string; path: string };
let calls: Call[] = [];
let detailVersion = 1;

function installFetch() {
  calls = [];
  globalThis.fetch = (async (path: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    calls.push({ method, path });
    await new Promise((resolve) => setTimeout(resolve, 5));
    if (path === "/broken") return new Response(JSON.stringify({ error: "nope" }), { status: 500 });
    if (method === "POST" && path === "/account/profile") detailVersion += 1;
    return new Response(JSON.stringify({ path, version: detailVersion, items: [1, 2] }), { status: 200 });
  }) as typeof fetch;
}

const g = globalThis as { __KOLOSSEUM_READ_REUSE_MS__?: number };

test.beforeEach(() => {
  __resetSharedReadsForTests();
  installFetch();
  detailVersion = 1;
  g.__KOLOSSEUM_READ_REUSE_MS__ = 60_000;
});
test.after(() => { g.__KOLOSSEUM_READ_REUSE_MS__ = 0; });

test("ten screens asking for the account at once send one request, and each gets its own copy", async () => {
  const results = await Promise.all(Array.from({ length: 10 }, () => request("GET", "/account/detail")));
  assert.equal(calls.length, 1);
  (results[0].items as number[]).push(3);
  assert.deepEqual(results[1].items, [1, 2], "one screen changing its copy doesn't change another's");
});

test("a read just after the same read is reused; a different read is not", async () => {
  await request("GET", "/account/detail");
  await request("GET", "/account/detail");
  await request("GET", "/coach-workspace/relationships");
  assert.deepEqual(calls.map((c) => c.path), ["/account/detail", "/coach-workspace/relationships"]);
});

test("a change sends the next read to the server, so nobody sees the old profile", async () => {
  assert.equal((await request("GET", "/account/detail")).version, 1);
  await request("POST", "/account/profile", { display_name: "New" }, "csrf");
  assert.equal((await request("GET", "/account/detail")).version, 2);
  assert.equal(calls.filter((c) => c.path === "/account/detail").length, 2);
});

test("a change made by the legacy app (kolosseum:data-changed) also clears shared reads", async () => {
  await request("GET", "/account/detail");
  document.dispatchEvent(new Event("kolosseum:data-changed"));
  await request("GET", "/account/detail");
  assert.equal(calls.length, 2);
});

test("athlete Today and history POSTs are reads; other POSTs are never shared", async () => {
  await Promise.all([
    request("POST", "/sessions/beta-athlete-today", { athlete_user_id: "a" }),
    request("POST", "/sessions/beta-athlete-today", { athlete_user_id: "a" }),
    request("POST", "/sessions/beta-athlete-today", { athlete_user_id: "b" })
  ]);
  assert.equal(calls.length, 2, "same athlete shared, a different athlete not");
  calls = [];
  await Promise.all([request("POST", "/sessions/s_1/events", { type: "X" }), request("POST", "/sessions/s_1/events", { type: "X" })]);
  assert.equal(calls.length, 2, "a change is always sent");
});

test("a failed read is not kept: the next read tries again", async () => {
  await assert.rejects(request("GET", "/broken"));
  await assert.rejects(request("GET", "/broken"));
  assert.equal(calls.length, 2);
});
