// Under a message you received: report it with a reason, or block the
// sender. Nothing under your own messages or a removed one. Blocked people
// are listed under Account, where they can be unblocked.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { MessageSafetyActions } from "../components/MessageSafetyActions";
import { BlockedPeoplePanel } from "../screens/account/BlockedPeoplePanel";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) } as Response;
}

function installMocks(blocks: unknown[] = []) {
  const posts: Array<{ path: string; body: unknown }> = [];
  let current = [...blocks];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: "athlete_dan" }, csrf_token: "csrf" });
    if (path === "/messages/safety/reports" && method === "POST") {
      posts.push({ path, body });
      return jsonResponse({ ok: true, report_id: "r1", status: "open" }, true, 201);
    }
    if (path === "/messages/safety/blocks" && method === "POST") {
      posts.push({ path, body });
      current = [{ user_id: (body as { user_id: string }).user_id, display_name: "Coach Grim", blocked_at_iso8601: "2026-11-05T10:00:00Z" }];
      return jsonResponse({ ok: true, blocks: current });
    }
    if (path === "/messages/safety/blocks" && method === "GET") return jsonResponse({ ok: true, blocks: current });
    if (path.startsWith("/messages/safety/blocks/") && method === "POST") {
      posts.push({ path, body });
      current = [];
      return jsonResponse({ ok: true, blocks: current });
    }
    return jsonResponse({ error: `unhandled_${path}` }, false, 404);
  }) as typeof fetch;
  return posts;
}

const received = { message_id: "msg_1", sender_user_id: "coach_grim", sender_role: "coach", body_text: "You're useless." };

test.afterEach(() => cleanup());

test("Dan reports an abusive message from his coach with a reason and a note", async () => {
  const posts = installMocks();
  render(<MessageSafetyActions message={received} received />);
  fireEvent.click(screen.getByText("Report"));
  await act(async () => {
    fireEvent.click(screen.getByText("Send report"));
  });
  assert.ok(screen.getByText("Choose a reason."), "a reason is needed");
  assert.equal(posts.length, 0);
  fireEvent.click(screen.getByLabelText("Abuse or harassment"));
  fireEvent.change(screen.getByLabelText("Anything else we should know (optional)"), { target: { value: "Third time this week." } });
  assert.match(screen.getByText(/isn't told who reported it/).textContent ?? "", /call 999/);
  await act(async () => {
    fireEvent.click(screen.getByText("Send report"));
  });
  await waitFor(() => assert.deepEqual(posts, [{ path: "/messages/safety/reports", body: { message_id: "msg_1", reason: "abuse", note: "Third time this week." } }]));
  await screen.findByText(/Reported - thank you/);
});

test("blocking asks first, then says how to undo it", async () => {
  const posts = installMocks();
  render(<MessageSafetyActions message={received} received />);
  fireEvent.click(screen.getByText("Block"));
  assert.ok(screen.getByText(/you can end a coaching relationship separately/));
  await act(async () => {
    fireEvent.click(screen.getAllByText("Block").at(-1) as HTMLElement);
  });
  await waitFor(() => assert.deepEqual(posts, [{ path: "/messages/safety/blocks", body: { user_id: "coach_grim" } }]));
  await screen.findByText(/You can unblock them under Account, Blocked people/);
});

test("nothing under your own message or one Kolosseum removed", () => {
  installMocks();
  const { container, rerender } = render(<MessageSafetyActions message={{ ...received, sender_role: "athlete" }} received={false} />);
  assert.equal(container.innerHTML, "");
  rerender(<MessageSafetyActions message={{ ...received, removed: true }} received />);
  assert.equal(container.innerHTML, "");
});

test("blocked people are listed under Account and can be unblocked; the panel hides when there are none", async () => {
  const posts = installMocks([{ user_id: "coach_grim", display_name: "Coach Grim", blocked_at_iso8601: "2026-11-05T10:00:00Z" }]);
  render(<BlockedPeoplePanel />);
  await screen.findByText("Coach Grim");
  await act(async () => {
    fireEvent.click(screen.getByText("Unblock"));
  });
  await waitFor(() => assert.deepEqual(posts.map((post) => post.path), ["/messages/safety/blocks/coach_grim/remove"]));
  await waitFor(() => assert.equal(screen.queryByTestId("blocked-people"), null));
});

test("after reporting, the sender can still be blocked from the same message", async () => {
  const posts = installMocks();
  render(<MessageSafetyActions message={received} received />);
  fireEvent.click(screen.getByText("Report"));
  fireEvent.click(screen.getByLabelText("Abuse or harassment"));
  await act(async () => {
    fireEvent.click(screen.getByText("Send report"));
  });
  await screen.findByText(/Reported - thank you/);
  fireEvent.click(screen.getByText("Block"));
  await act(async () => {
    fireEvent.click(screen.getAllByText("Block").at(-1) as HTMLElement);
  });
  await waitFor(() => assert.deepEqual(posts.map((post) => post.path), ["/messages/safety/reports", "/messages/safety/blocks"]));
  await screen.findByText(/Blocked. Their messages won't reach you/);
  assert.equal(screen.queryByText("Block"), null, "nothing more to do once blocked");
});

test("a block made under a message shows up in Blocked people on the same page straight away", async () => {
  installMocks();
  render(<><MessageSafetyActions message={received} received /><BlockedPeoplePanel /></>);
  await waitFor(() => assert.equal(screen.queryByTestId("blocked-people"), null));
  fireEvent.click(screen.getByText("Block"));
  await act(async () => {
    fireEvent.click(screen.getAllByText("Block").at(-1) as HTMLElement);
  });
  await screen.findByTestId("blocked-people");
  assert.ok(screen.getByText("Coach Grim"));
});
