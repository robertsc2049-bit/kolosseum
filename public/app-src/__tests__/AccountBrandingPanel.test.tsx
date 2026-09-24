// DEV NOTE: FULL-UI-65 coach branding behavioral proof - replaces the
// source-text regex checks against the now-retired coach_branding_ui.js.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { AccountBrandingPanel } from "../screens/account/AccountBrandingPanel";

const STORAGE_KEY = "kolosseum.product.app.v1";

function setRole(role: string) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ role }));
}

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return {
    ok,
    status,
    text: async () => JSON.stringify(body)
  } as Response;
}

function installMocks(options: { preference?: Record<string, unknown> | null; saveFails?: string | boolean }) {
  const { preference = null, saveFails = false } = options;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const method = init?.method ?? "GET";
    if (path.startsWith("/account/detail")) {
      return jsonResponse({ account: { user_id: "coach_1" }, csrf_token: "csrf-abc" });
    }
    if (path.startsWith("/coach-branding") && method === "GET") {
      return jsonResponse({ ok: true, brand_preference: preference });
    }
    if (path.startsWith("/coach-branding") && method === "POST") {
      if (saveFails) {
        const code = typeof saveFails === "string" ? saveFails : "coach_branding_request_failed";
        return jsonResponse({ error: code }, false, 400);
      }
      const body = JSON.parse(String(init?.body ?? "{}"));
      return jsonResponse({ ok: true, brand_preference: body }, true, 201);
    }
    return jsonResponse({ error: `unhandled_request_${path}` }, false, 404);
  }) as typeof fetch;
}

test.afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

test("renders nothing for an athlete", async () => {
  setRole("athlete");
  installMocks({});
  const { container } = render(<AccountBrandingPanel />);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(container.innerHTML, "");
});

test("loads and displays the coach's own saved preference", async () => {
  setRole("coach");
  installMocks({ preference: { brand_color: "#112233", brand_tagline: "Strength, simplified." } });
  render(<AccountBrandingPanel />);

  await waitFor(() => screen.getByDisplayValue("Strength, simplified."));
  const colorInput = document.querySelector('input[type="color"]') as HTMLInputElement;
  assert.equal(colorInput.value, "#112233");
});

test("defaults to the bronze accent colour when no preference has been saved yet", async () => {
  setRole("coach");
  installMocks({ preference: null });
  render(<AccountBrandingPanel />);

  await waitFor(() => {
    const colorInput = document.querySelector('input[type="color"]') as HTMLInputElement;
    assert.equal(colorInput.value, "#d2a952");
  });
});

test("the preview updates as the colour and tagline change, and escapes the tagline", async () => {
  setRole("coach");
  installMocks({ preference: null });
  render(<AccountBrandingPanel />);
  await waitFor(() => screen.getByText("Your athletes will see this next to your name"));

  const taglineInput = document.querySelector('input[type="text"]') as HTMLInputElement;
  fireEvent.change(taglineInput, { target: { value: '<img src=x onerror="window.pwned=true">' } });

  await waitFor(() => screen.getByText(/img src=x/iu));
  assert.equal((globalThis as Record<string, unknown>).pwned, undefined);
  assert.equal(document.querySelectorAll(".coach-brand-preview img").length, 0);
});

test("saves the branding preference and shows a success message", async () => {
  setRole("coach");
  installMocks({ preference: null });
  render(<AccountBrandingPanel />);
  await waitFor(() => screen.getByText("Your athletes will see this next to your name"));

  const taglineInput = document.querySelector('input[type="text"]') as HTMLInputElement;
  fireEvent.change(taglineInput, { target: { value: "Factual and simple." } });

  const form = document.querySelector("form") as HTMLFormElement;
  fireEvent.submit(form);

  await waitFor(() => screen.getByText("Branding saved."));
});

test("shows a mapped error message when the server rejects an invalid colour", async () => {
  setRole("coach");
  installMocks({ preference: null, saveFails: "coach_branding_coach_brand_color_invalid" });
  render(<AccountBrandingPanel />);
  await waitFor(() => screen.getByText("Your athletes will see this next to your name"));

  fireEvent.submit(document.querySelector("form") as HTMLFormElement);

  await waitFor(() => screen.getByText("Choose a valid colour."));
});

test("responds to a role change (storage event) without a full page reload", async () => {
  setRole("athlete");
  installMocks({});
  const { container } = render(<AccountBrandingPanel />);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(container.innerHTML, "");

  setRole("coach");
  act(() => {
    window.dispatchEvent(new Event("storage"));
  });

  await waitFor(() => screen.getByText("Your athletes' view of you"));
});
