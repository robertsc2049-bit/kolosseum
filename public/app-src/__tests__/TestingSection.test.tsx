// A coach records a rugby player's test day: the results table says which
// changes are real and which are noise, and a result is recorded or removed.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { TestingSection } from "../screens/coach/TestingSection";
import { __resetSharedReadsForTests } from "../api/transport";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) } as Response;
}
const posts: Array<{ path: string; body: Record<string, unknown>; csrf: string | null }> = [];
function installMocks() {
  posts.length = 0;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path === "/account/detail") return jsonResponse({ ok: true, csrf_token: "csrf-1" });
    if (init?.method === "POST") {
      const headers = (init.headers ?? {}) as Record<string, string>;
      posts.push({ path, body: typeof init.body === "string" ? JSON.parse(init.body) : {}, csrf: headers["x-kolosseum-csrf"] ?? null });
      return jsonResponse({ ok: true });
    }
    return jsonResponse({ error: "unhandled" }, false, 404);
  }) as typeof fetch;
}
const tests = [
  { test_id: "cmj_cm", name: "Countermovement jump", unit: "cm", better: "higher", swc: 1.5, verdict: "improved", change: 3, latest: { date: "2026-10-13", value: 44.5 }, previous: { date: "2026-09-08", value: 41.5 }, best: { date: "2026-10-13", value: 44.5 }, results: [{ id: "t1", date: "2026-09-08", value: 41.5 }, { id: "t2", date: "2026-10-13", value: 44.5 }] },
  { test_id: "sprint_10m_s", name: "10 m sprint", unit: "s", better: "lower", swc: 0.03, verdict: "within_noise", change: 0.02, latest: { date: "2026-10-13", value: 1.73 }, previous: { date: "2026-09-08", value: 1.71 }, best: { date: "2026-09-08", value: 1.71 }, results: [{ id: "t3", date: "2026-09-08", value: 1.71 }, { id: "t4", date: "2026-10-13", value: 1.73 }] }
];

test.beforeEach(() => __resetSharedReadsForTests());
test.afterEach(() => cleanup());

test("test results say which changes are real and which are within normal variation", () => {
  installMocks();
  render(<TestingSection athleteUserId="a1" tests={tests} onChanged={() => {}} />);
  const table = screen.getByTestId("testing").textContent ?? "";
  assert.ok(table.includes("44.5 cm") && table.includes("+3 cm") && table.includes("Real improvement"));
  assert.ok(table.includes("1.73 s") && table.includes("Within normal variation"));
  assert.equal(screen.getByText("Real improvement").getAttribute("title"), "Smallest worthwhile change: 1.5 cm");
});

test("recording a sprint result and removing a wrong one", async () => {
  installMocks();
  let changed = 0;
  render(<TestingSection athleteUserId="a1" tests={tests} onChanged={() => { changed += 1; }} />);
  const form = screen.getByTestId("testing-form");
  await act(async () => { fireEvent.change(form.querySelector("select")!, { target: { value: "sprint_10m_s" } }); });
  assert.ok(screen.getByText("Result (s)"));
  await act(async () => { fireEvent.change(form.querySelector("input[type=number]")!, { target: { value: "1.69" } }); });
  await act(async () => { fireEvent.click(screen.getByText("Record result")); });
  assert.equal(posts[0].path, "/coach-workspace/athletes/a1/tests");
  assert.equal(posts[0].body.test_id, "sprint_10m_s");
  assert.equal(posts[0].body.value, 1.69);
  assert.match(String(posts[0].body.client_request_id), /^pt_/u);
  assert.equal(posts[0].csrf, "csrf-1");
  await act(async () => { fireEvent.click(screen.getByLabelText("Remove 10 m sprint 1.73 on 2026-10-13")); });
  assert.deepEqual(posts[1], { path: "/coach-workspace/athletes/a1/tests/remove", body: { id: "t4" }, csrf: "csrf-1" });
  assert.equal(changed, 2, "the analysis reloads after each change");
});
