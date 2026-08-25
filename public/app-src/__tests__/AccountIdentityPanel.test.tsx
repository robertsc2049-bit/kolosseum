// DEV NOTE: FULL-UI-02 profile_update/email_verification/password_change/
// consent_history behavioral proof - replaces the source-text regex checks
// full_ui_02_account_ui.test.mjs previously ran against the now-removed
// app.js functions for exactly these four capabilities. See the migration
// plan (docs/plans, "Testing: behavioral component tests") for why this
// approach was chosen over continuing to pattern-match source text.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { AccountIdentityPanel } from "../screens/account/AccountIdentityPanel";

type FetchCall = { input: RequestInfo | URL; init?: RequestInit };

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return {
    ok,
    status,
    text: async () => JSON.stringify(body)
  } as Response;
}

function baseAccount(overrides: Record<string, unknown> = {}) {
  return {
    user_id: "athlete_test123",
    display_name: "Jordan Test",
    email: "jordan@example.com",
    email_verified: false,
    current_terms_version: "terms_v2",
    current_consent_version: "consent_v2",
    accepted_terms_version: "terms_v1",
    accepted_consent_version: "consent_v1",
    ...overrides
  };
}

function installFetchMock(handler: (call: FetchCall) => Response) {
  const calls: FetchCall[] = [];
  const original = globalThis.fetch;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ input, init });
    return handler({ input, init });
  }) as typeof fetch;

  return {
    calls,
    restore: () => {
      globalThis.fetch = original;
    }
  };
}

async function renderPanel(detailResponse: Record<string, unknown>, extraHandlers: Record<string, () => Response> = {}) {
  const mock = installFetchMock(({ input, init }) => {
    const path = String(input);
    const method = init?.method ?? "GET";

    if (path === "/account/detail" && method === "GET") {
      return jsonResponse(detailResponse);
    }

    const key = `${method} ${path}`;
    if (extraHandlers[key]) return extraHandlers[key]();

    return jsonResponse({ error: `unhandled_request_${key}` }, false, 404);
  });

  render(<AccountIdentityPanel />);
  await waitFor(() => screen.getByLabelText("Display name"));

  return mock;
}

test.afterEach(() => {
  cleanup();
});

test("profile form loads prefilled with the account's current name and email, and saves via PATCH with the CSRF header", async () => {
  const mock = await renderPanel({
    account: baseAccount(),
    terms: { current_terms_version: "terms_v2", current_consent_version: "consent_v2" },
    consent_history: [],
    csrf_token: "csrf-abc"
  }, {
    "PATCH /account/profile": () =>
      jsonResponse({ account: baseAccount({ display_name: "Jordan Updated" }) })
  });

  const nameInput = screen.getByLabelText("Display name") as HTMLInputElement;
  // ProfileForm prefills its controlled inputs from an effect that fires
  // after the "Display name" label itself is already in the DOM, so waiting
  // for the label alone can race the effect - wait for the value too.
  await waitFor(() => {
    assert.equal(nameInput.value, "Jordan Test");
    assert.equal((screen.getByLabelText("Email") as HTMLInputElement).value, "jordan@example.com");
  });

  await act(async () => {
    fireEvent.change(nameInput, { target: { value: "Jordan Updated" } });
    fireEvent.submit(nameInput.closest("form")!);
  });

  await waitFor(() => screen.getByText("Profile updated."));

  const profileSave = mock.calls.find((call) => String(call.input) === "/account/profile");
  assert.ok(profileSave, "expected a PATCH /account/profile request");
  assert.equal(profileSave!.init?.method, "PATCH");
  assert.equal((profileSave!.init?.headers as Record<string, string>)["x-kolosseum-csrf"], "csrf-abc");
  const body = JSON.parse(String(profileSave!.init?.body));
  assert.equal(body.display_name, "Jordan Updated");
  assert.equal(body.email, "jordan@example.com");

  mock.restore();
});

test("password form submits current and new password via POST with the CSRF header, then resets and shows the revocation notice", async () => {
  const mock = await renderPanel(
    {
      account: baseAccount(),
      terms: {},
      consent_history: [],
      csrf_token: "csrf-xyz"
    },
    {
      "POST /account/password/change": () => jsonResponse({ ok: true })
    }
  );

  const currentPassword = screen.getByLabelText("Current password") as HTMLInputElement;
  const newPassword = screen.getByLabelText("New password") as HTMLInputElement;

  await act(async () => {
    fireEvent.change(currentPassword, { target: { value: "old-password-123456" } });
    fireEvent.change(newPassword, { target: { value: "new-password-123456" } });
    fireEvent.submit(currentPassword.closest("form")!);
  });

  await waitFor(() => screen.getByText("Password changed. Other sessions were revoked."));

  const passwordChange = mock.calls.find((call) => String(call.input) === "/account/password/change");
  assert.ok(passwordChange, "expected a POST /account/password/change request");
  assert.equal((passwordChange!.init?.headers as Record<string, string>)["x-kolosseum-csrf"], "csrf-xyz");
  const body = JSON.parse(String(passwordChange!.init?.body));
  assert.equal(body.current_password, "old-password-123456");
  assert.equal(body.new_password, "new-password-123456");

  mock.restore();
});

test("email verification: requesting a code shows the development code, and completing verification reports success", async () => {
  const mock = await renderPanel(
    {
      account: baseAccount({ email_verified: false }),
      terms: {},
      consent_history: [],
      csrf_token: "csrf-verify"
    },
    {
      "POST /account/email-verification/request": () => jsonResponse({ development_code: "123456" }),
      "POST /account/email-verification/complete": () =>
        jsonResponse({ account: baseAccount({ email_verified: true }) })
    }
  );

  const requestButton = screen.getByRole("button", { name: "Request code" });
  await act(async () => {
    fireEvent.click(requestButton);
  });
  await waitFor(() => screen.getByText("Development code: 123456"));

  const codeInput = screen.getByLabelText("Verification code") as HTMLInputElement;
  assert.equal(codeInput.value, "123456");

  const verifyButton = screen.getByRole("button", { name: "Verify email" });
  await act(async () => {
    fireEvent.click(verifyButton);
  });
  await waitFor(() => screen.getByText("Email verified."));

  const complete = mock.calls.find((call) => String(call.input) === "/account/email-verification/complete");
  assert.ok(complete, "expected a POST /account/email-verification/complete request");
  const body = JSON.parse(String(complete!.init?.body));
  assert.equal(body.code, "123456");

  mock.restore();
});

test("consent history renders each event's title-cased type, formatted date and version summary - or a factual empty state with no events", async () => {
  const mockWithHistory = await renderPanel({
    account: baseAccount(),
    terms: { current_terms_version: "terms_v2", current_consent_version: "consent_v2" },
    consent_history: [
      {
        event_id: "evt_1",
        event_type: "terms_accepted",
        occurred_at_iso8601: "2026-01-15",
        event_payload: { terms_version: "terms_v1" }
      }
    ],
    csrf_token: "csrf-history"
  });

  assert.ok(screen.getByText("Terms Accepted"));
  assert.ok(screen.getByText("Terms terms_v1"));
  assert.equal(screen.getByText("terms_v2", { selector: "strong" }).textContent, "terms_v2");

  mockWithHistory.restore();
  cleanup();

  const mockEmpty = await renderPanel({
    account: baseAccount(),
    terms: {},
    consent_history: [],
    csrf_token: "csrf-empty"
  });

  assert.ok(screen.getByText("No consent or verification events recorded."));
  mockEmpty.restore();
});

test("a display name containing markup is rendered as inert text, never as HTML - and no readiness/scoring language appears anywhere in the panel", async () => {
  const mock = await renderPanel({
    account: baseAccount({ display_name: '<img src=x onerror="window.pwned=true">' }),
    terms: {},
    consent_history: [],
    csrf_token: "csrf-escape"
  });

  const nameInput = screen.getByLabelText("Display name") as HTMLInputElement;
  await waitFor(() => assert.equal(nameInput.value, '<img src=x onerror="window.pwned=true">'));
  assert.equal((globalThis as Record<string, unknown>).pwned, undefined);
  assert.equal(document.querySelectorAll("img").length, 0);

  const panelText = document.body.textContent ?? "";
  for (const forbidden of [
    /readiness score/iu,
    /performance prediction/iu,
    /athlete ranking/iu,
    /recommended programme/iu,
    /capability inference/iu
  ]) {
    assert.doesNotMatch(panelText, forbidden);
  }

  mock.restore();
});
