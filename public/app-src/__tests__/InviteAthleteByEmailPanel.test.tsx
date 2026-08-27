// DEV NOTE: FULL-UI-24 lawful invitation - behavioral proof replacing the
// source-text regex checks that used to run against app.js's (removed)
// inviteAthleteByEmail().
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { InviteAthleteByEmailPanel } from "../screens/coach/InviteAthleteByEmailPanel";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return { ok, status, text: async () => JSON.stringify(body) } as Response;
}

function installMocks(options: { inviteFails?: boolean } = {}) {
  const { inviteFails = false } = options;
  const calls: Array<{ path: string; init?: RequestInit }> = [];

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    calls.push({ path, init });

    if (path.startsWith("/account/detail")) {
      return jsonResponse({ account: { user_id: "coach_1" }, csrf_token: "csrf-abc" });
    }
    if (path === "/coach-workspace/relationship-invitations") {
      if (inviteFails) return jsonResponse({ error: "relationship_invitation_email_invalid" }, false, 400);
      return jsonResponse({ ok: true, relationship: { relationship_id: "rel_1" } }, true, 201);
    }
    return jsonResponse({ error: `unhandled_${path}` }, false, 404);
  }) as typeof fetch;

  return calls;
}

test.afterEach(() => {
  cleanup();
});

test("renders the invite form", () => {
  installMocks();
  render(<InviteAthleteByEmailPanel />);
  assert.ok(screen.getByText("Invite athlete by email"));
  assert.ok(screen.getByText("Send invitation"));
});

test("submitting sends the CSRF-guarded email invitation and shows a confirmation", async () => {
  const calls = installMocks();
  render(<InviteAthleteByEmailPanel />);

  const input = screen.getByRole("textbox") as HTMLInputElement;
  fireEvent.change(input, { target: { value: "athlete@example.com" } });

  await act(async () => {
    fireEvent.click(screen.getByText("Send invitation"));
  });

  await screen.findByText("Invitation sent to athlete@example.com.");

  const inviteCall = calls.find((entry) => entry.path === "/coach-workspace/relationship-invitations");
  assert.ok(inviteCall);
  assert.equal(inviteCall?.init?.method, "POST");
  assert.equal((inviteCall?.init?.headers as Record<string, string>)?.["x-kolosseum-csrf"], "csrf-abc");
  assert.deepEqual(JSON.parse(String(inviteCall?.init?.body)), { athlete_email: "athlete@example.com" });
  assert.equal((input).value, "");
});

test("a failed invitation shows a factual error and keeps the entered email", async () => {
  installMocks({ inviteFails: true });
  render(<InviteAthleteByEmailPanel />);

  const input = screen.getByRole("textbox") as HTMLInputElement;
  fireEvent.change(input, { target: { value: "athlete@example.com" } });

  await act(async () => {
    fireEvent.click(screen.getByText("Send invitation"));
  });

  await screen.findByText("The invitation could not be sent.");
  assert.equal(input.value, "athlete@example.com");
});
