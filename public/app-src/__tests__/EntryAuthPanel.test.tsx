// DEV NOTE: FULL-UI-02D entry (sign-up/sign-in/password-reset) screen
// behavioral proof - covers EntryAuthPanel.tsx/useEntryAuth.ts/
// authClient.ts. The cross-stack bridge (kolosseum:entry-auth-succeeded ->
// app.js's applyAccountSession()/enterApplication(), and the reverse
// kolosseum:entry-auth-session-rejected/kolosseum:entry-bootstrap-notice)
// is exercised here only as far as the dispatched event's detail shape and
// this component's own reaction to the reverse events - the real legacy
// listener is verified live (see the PR description).
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { EntryAuthPanel } from "../screens/entry/EntryAuthPanel";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return { ok, status, text: async () => JSON.stringify(body) } as Response;
}

const TERMS = { current_terms_version: "v3", current_consent_version: "v2" };

type JsonRecordLike = Record<string, unknown>;

function installMocks(options: { termsUnavailable?: boolean } = {}) {
  const { termsUnavailable = false } = options;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const method = init?.method ?? "GET";

    if (path === "/account/terms") {
      return termsUnavailable ? jsonResponse({ error: "terms_unavailable" }, false, 503) : jsonResponse(TERMS);
    }
    return jsonResponse({ error: `unhandled_request_${method}_${path}` }, false, 404);
  }) as typeof fetch;
}

test.afterEach(() => {
  cleanup();
});

test("renders create mode by default with role, activity and consent fields", async () => {
  installMocks();
  render(<EntryAuthPanel />);
  await screen.findByText("v3");

  assert.ok(screen.getByText("Create your account"));
  assert.ok(screen.getByText("Primary activity"));
  assert.ok(screen.getByLabelText(/controlled-beta terms/));
});

test("switching to the sign-in tab hides create-only fields and changes the submit label", async () => {
  installMocks();
  render(<EntryAuthPanel />);
  await screen.findByText("v3");

  fireEvent.click(screen.getByRole("tab", { name: "Sign in" }));

  assert.equal(screen.queryByText("Primary activity"), null);
  assert.ok(screen.getByRole("button", { name: "Sign in" }));
  assert.ok(screen.getByText("Forgot password?"));
});

test("choosing the coach role hides the primary activity field", async () => {
  installMocks();
  render(<EntryAuthPanel />);
  await screen.findByText("v3");

  fireEvent.click(screen.getByRole("radio", { name: /Coach/ }));

  assert.equal(screen.queryByText("Primary activity"), null);
});

test("the create-account submit button is disabled while terms are unavailable", async () => {
  installMocks({ termsUnavailable: true });
  render(<EntryAuthPanel />);
  await screen.findAllByText("unavailable");

  const submit = screen.getByRole("button", { name: "Create account" });
  assert.equal(submit.hasAttribute("disabled"), true);
});

test("a successful registration dispatches the session bridge event with the raw response and mode", async () => {
  installMocks();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input) === "/account/register") {
      return jsonResponse({ account: { user_id: "u1", actor_type: "athlete" }, csrf_token: "csrf1", bootstrap: {} });
    }
    return originalFetch(input, init);
  }) as typeof fetch;

  render(<EntryAuthPanel />);
  await screen.findByText("v3");

  fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Alex" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "alex@example.com" } });
  fireEvent.change(screen.getByLabelText("Password", { exact: false }), { target: { value: "correcthorsebattery" } });
  fireEvent.click(screen.getByLabelText(/controlled-beta terms/));
  fireEvent.click(screen.getByLabelText(/factual product records/));

  let captured: { response?: JsonRecordLike; mode?: string } | null = null;
  document.addEventListener("kolosseum:entry-auth-succeeded", (event) => {
    captured = (event as CustomEvent).detail;
  }, { once: true });

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  assert.equal(captured?.mode, "create");
  assert.equal((captured?.response as JsonRecordLike)?.csrf_token, "csrf1");
});

test("a rejected registration (account already exists) shows the mapped factual message", async () => {
  installMocks();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input) === "/account/register") {
      return jsonResponse({ error: "account_email_already_registered" }, false, 400);
    }
    return originalFetch(input, init);
  }) as typeof fetch;

  render(<EntryAuthPanel />);
  await screen.findByText("v3");

  fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Alex" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "alex@example.com" } });
  fireEvent.change(screen.getByLabelText("Password", { exact: false }), { target: { value: "correcthorsebattery" } });
  fireEvent.click(screen.getByLabelText(/controlled-beta terms/));
  fireEvent.click(screen.getByLabelText(/factual product records/));

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  await screen.findByText("An account already uses this email address.");
});

test("signing in against a suspended account shows the factual account-state message", async () => {
  installMocks();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input) === "/account/sign-in") {
      return jsonResponse({ error: "account_unavailable", account_state: "suspended" }, false, 423);
    }
    return originalFetch(input, init);
  }) as typeof fetch;

  render(<EntryAuthPanel />);
  await screen.findByText("v3");
  fireEvent.click(screen.getByRole("tab", { name: "Sign in" }));

  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "alex@example.com" } });
  fireEvent.change(screen.getByLabelText("Password", { exact: false }), { target: { value: "correcthorsebattery" } });

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  await screen.findByText("This account is suspended. Workspace access is unavailable.");
});

test("a session rejected by the legacy bridge (e.g. a data-integrity failure) is shown inline, not left silent", async () => {
  installMocks();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input) === "/account/sign-in") {
      return jsonResponse({ account: { user_id: "u1", actor_type: "coach" }, csrf_token: "csrf1", bootstrap: {} });
    }
    return originalFetch(input, init);
  }) as typeof fetch;

  function rejectOnSucceeded(event: Event) {
    document.dispatchEvent(new CustomEvent("kolosseum:entry-auth-session-rejected", {
      detail: { message: "The coach profile could not be restored." }
    }));
  }
  document.addEventListener("kolosseum:entry-auth-succeeded", rejectOnSucceeded);

  render(<EntryAuthPanel />);
  await screen.findByText("v3");
  fireEvent.click(screen.getByRole("tab", { name: "Sign in" }));
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "alex@example.com" } });
  fireEvent.change(screen.getByLabelText("Password", { exact: false }), { target: { value: "correcthorsebattery" } });

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  await screen.findByText("The coach profile could not be restored.");
  document.removeEventListener("kolosseum:entry-auth-succeeded", rejectOnSucceeded);
});

test("a bootstrap-time notice from the legacy session-restore check is shown inline on mount", async () => {
  installMocks();
  render(<EntryAuthPanel />);
  await screen.findByText("v3");

  await act(async () => {
    document.dispatchEvent(new CustomEvent("kolosseum:entry-bootstrap-notice", {
      detail: { message: "This account is not currently active." }
    }));
  });

  await screen.findByText("This account is not currently active.");
});

test("forgot password opens the reset-request form pre-filled with the entered email", async () => {
  installMocks();
  render(<EntryAuthPanel />);
  await screen.findByText("v3");
  fireEvent.click(screen.getByRole("tab", { name: "Sign in" }));

  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "alex@example.com" } });
  fireEvent.click(screen.getByText("Forgot password?"));

  await screen.findByText("Reset password");
  assert.equal((screen.getByLabelText("Email") as HTMLInputElement).value, "alex@example.com");
});

test("requesting a reset code shows the development code and moves to the set-new-password form", async () => {
  installMocks();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input) === "/account/password/reset/request") {
      return jsonResponse({ accepted: true, development_code: "123456" });
    }
    return originalFetch(input, init);
  }) as typeof fetch;

  render(<EntryAuthPanel />);
  await screen.findByText("v3");
  fireEvent.click(screen.getByRole("tab", { name: "Sign in" }));
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "alex@example.com" } });
  fireEvent.click(screen.getByText("Forgot password?"));
  await screen.findByText("Reset password");

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Request code" }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  await screen.findByText("Development code: 123456");
  await screen.findByRole("heading", { name: "Set new password" });
  assert.equal((screen.getByLabelText("Six-digit code") as HTMLInputElement).value, "123456");
});

test("completing a password reset shows a success message on the sign-in form", async () => {
  installMocks();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input) === "/account/password/reset/request") {
      return jsonResponse({ accepted: true, development_code: "654321" });
    }
    if (String(input) === "/account/password/reset/complete") {
      return jsonResponse({});
    }
    return originalFetch(input, init);
  }) as typeof fetch;

  render(<EntryAuthPanel />);
  await screen.findByText("v3");
  fireEvent.click(screen.getByRole("tab", { name: "Sign in" }));
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "alex@example.com" } });
  fireEvent.click(screen.getByText("Forgot password?"));
  await screen.findByText("Reset password");

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Request code" }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await screen.findByRole("heading", { name: "Set new password" });

  fireEvent.change(screen.getByLabelText("New password"), { target: { value: "correcthorsebattery" } });

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Set new password" }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  await screen.findByText("Password reset complete. Sign in with the new password.");
  assert.ok(screen.getByRole("button", { name: "Sign in" }));
});
