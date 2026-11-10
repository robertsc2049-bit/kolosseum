// Signing up emails a verification code; the app now asks for it at the top
// of the screen (VerifyEmailPrompt.tsx) instead of only under Account
// (walkthrough 10).
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { VerifyEmailPrompt } from "../screens/account/VerifyEmailPrompt";

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status < 400, status, text: async () => JSON.stringify(body) } as Response;
}

function installMocks(verified: boolean) {
  const server = { verified, completes: [] as unknown[] };
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path.startsWith("/account/detail")) {
      return jsonResponse({ account: { user_id: "athlete_1", email: "alex@example.com", email_verified: server.verified }, csrf_token: "csrf" });
    }
    if (path === "/account/email-verification/complete") {
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
      server.completes.push(body);
      if (body.code !== "123456") return jsonResponse({ error: "account_challenge_invalid" }, 400);
      server.verified = true;
      return jsonResponse({ account: { user_id: "athlete_1", email_verified: true } });
    }
    return jsonResponse({ error: `unhandled_${path}` }, 404);
  }) as typeof fetch;
  return server;
}

const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });

test.beforeEach(() => { try { window.localStorage.clear(); } catch { /* none */ } });
test.afterEach(() => cleanup());

test("a new account is asked for the code from its sign-up email, and the prompt goes once verified", async () => {
  const server = installMocks(false);
  render(<VerifyEmailPrompt />);
  await screen.findByText("Verify your email");
  assert.ok(screen.getByText("We emailed a 6-digit code to alex@example.com when you signed up. Enter it here so we know we can reach you."));

  const input = screen.getByLabelText("Code from the email") as HTMLInputElement;
  fireEvent.change(input, { target: { value: "999999" } });
  await act(async () => { fireEvent.click(screen.getByText("Verify")); });
  await screen.findByText("That code didn't work - it may have expired. Send a new one and try again.");

  fireEvent.change(input, { target: { value: "123456" } });
  await act(async () => { fireEvent.click(screen.getByText("Verify")); });
  await settle();
  assert.equal(screen.queryByText("Verify your email"), null);
  assert.deepEqual(server.completes, [{ code: "999999" }, { code: "123456" }]);
});

test("Later hides it in this browser; a verified account never sees it", async () => {
  installMocks(false);
  const first = render(<VerifyEmailPrompt />);
  await screen.findByText("Verify your email");
  fireEvent.click(screen.getByText("Later"));
  assert.equal(screen.queryByText("Verify your email"), null);
  first.unmount();

  render(<VerifyEmailPrompt />);
  await settle();
  assert.equal(screen.queryByText("Verify your email"), null, "still hidden after a reload");
  cleanup();

  window.localStorage.clear();
  installMocks(true);
  render(<VerifyEmailPrompt />);
  await settle();
  assert.equal(screen.queryByText("Verify your email"), null);
});
