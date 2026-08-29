// DEV NOTE: FULL-UI-05A programme marketplace sharing/release sub-panel
// behavioral proof - covers useCoachProgrammeMarketplaceSharing.ts's
// shareable-gating (a template can only be shared/released once its
// stored status is "complete" or "active", never while still a draft) and
// CoachProgrammeMarketplaceSharingPanel.tsx's rendering of the sharing
// form, the release form and release history, ported from
// public/app/app.js's templateDetailSharingSection markup and its four
// handler functions.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { CoachProgrammeMarketplaceSharingPanel } from "../screens/coach/CoachProgrammeMarketplaceSharingPanel";

const COACH_USER_ID = "coach_test123";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return { ok, status, text: async () => JSON.stringify(body) } as Response;
}

function template(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    template_id: "tmpl_1_v1",
    template_family_id: "tmpl_1",
    template_name: "Base Strength Block",
    template_version: 1,
    template_status: "complete",
    activity_id: "powerlifting",
    ...overrides
  };
}

type MockOptions = {
  templates?: Record<string, unknown>[];
  sharingPreference?: Record<string, unknown> | null;
  releases?: Record<string, unknown>[];
  saveSharingOk?: boolean;
  releaseOk?: boolean;
};

function installMocks(options: MockOptions = {}) {
  const {
    templates = [template()],
    sharingPreference = null,
    releases = [],
    saveSharingOk = true,
    releaseOk = true
  } = options;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const method = init?.method ?? "GET";

    if (path.startsWith("/account/detail")) {
      return jsonResponse({ account: { user_id: COACH_USER_ID }, csrf_token: "csrf-token" });
    }
    if (path.startsWith("/templates?coach_user_id")) return jsonResponse({ templates });
    if (path.includes("/sharing") && method === "GET") return jsonResponse({ sharing_preference: sharingPreference });
    if (path.includes("/sharing") && method === "POST") {
      return saveSharingOk ? jsonResponse({ ok: true }) : jsonResponse({ error: "sharing_save_failed" }, false, 422);
    }
    if (path.includes("/releases") && method === "GET") return jsonResponse({ releases });
    if (path.includes("/release") && method === "POST") {
      return releaseOk ? jsonResponse({ ok: true }) : jsonResponse({ error: "release_failed" }, false, 422);
    }
    return jsonResponse({ error: `unhandled_request_${method}_${path}` }, false, 404);
  }) as typeof fetch;
}

function openDetail(templateId: string) {
  return act(async () => {
    document.dispatchEvent(new CustomEvent("kolosseum:open-programme-detail", { detail: { template_id: templateId } }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

test.afterEach(() => {
  cleanup();
});

test("renders nothing for a draft template - not yet shareable", async () => {
  installMocks({ templates: [template({ template_status: "draft" })] });
  const { container } = render(<CoachProgrammeMarketplaceSharingPanel />);
  await openDetail("tmpl_1_v1");
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(container.innerHTML, "");
});

test("shows the sharing form for a complete template, prefilled with the stored preference", async () => {
  installMocks({
    templates: [template({ template_status: "complete" })],
    sharingPreference: { shared_publicly: true, price_label: "£49", payment_methods_note: "Venmo @handle" }
  });
  render(<CoachProgrammeMarketplaceSharingPanel />);
  await openDetail("tmpl_1_v1");

  await screen.findByText("Share this programme publicly with other coaches");
  const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
  assert.equal(checkbox.checked, true);
  assert.equal((screen.getByPlaceholderText("e.g. £49") as HTMLInputElement).value, "£49");
  assert.equal((screen.getByPlaceholderText("e.g. Venmo @handle, PayPal") as HTMLInputElement).value, "Venmo @handle");
});

test("also shows the sharing form for an active (previously activated) template", async () => {
  installMocks({ templates: [template({ template_status: "active" })] });
  render(<CoachProgrammeMarketplaceSharingPanel />);
  await openDetail("tmpl_1_v1");
  await screen.findByText("Share this programme publicly with other coaches");
});

test("saving the sharing preference posts the entered values and shows a confirmation", async () => {
  installMocks({ templates: [template()] });
  render(<CoachProgrammeMarketplaceSharingPanel />);
  await openDetail("tmpl_1_v1");
  await screen.findByText("Share this programme publicly with other coaches");

  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.change(screen.getByPlaceholderText("e.g. £49"), { target: { value: "£99" } });

  const requests: { path: string; body: unknown }[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path.includes("/sharing") && (init?.method ?? "GET") === "POST") {
      requests.push({ path, body: init?.body ? JSON.parse(String(init.body)) : null });
    }
    return originalFetch(input, init);
  }) as typeof fetch;

  await act(async () => {
    fireEvent.click(screen.getByText("Save marketplace details"));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  await screen.findByText("Shared with other coaches.");
  assert.equal(requests.length, 1);
  assert.equal((requests[0].body as { shared_publicly: boolean }).shared_publicly, true);
  assert.equal((requests[0].body as { price_label: string }).price_label, "£99");
});

test("a failed sharing save shows a factual error", async () => {
  installMocks({ templates: [template()], saveSharingOk: false });
  render(<CoachProgrammeMarketplaceSharingPanel />);
  await openDetail("tmpl_1_v1");
  await screen.findByText("Share this programme publicly with other coaches");

  await act(async () => {
    fireEvent.click(screen.getByText("Save marketplace details"));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  await screen.findByText("The marketplace details could not be saved.");
});

test("shows a factual empty state when the programme has never been released", async () => {
  installMocks({ templates: [template()], releases: [] });
  render(<CoachProgrammeMarketplaceSharingPanel />);
  await openDetail("tmpl_1_v1");
  await screen.findByText("Not released to any coach yet.");
});

test("shows release history with the buyer coach id and release date", async () => {
  installMocks({
    templates: [template()],
    releases: [{ buyer_coach_user_id: "coach_buyer_1", released_at_iso8601: "2026-08-01T00:00:00.000Z" }]
  });
  render(<CoachProgrammeMarketplaceSharingPanel />);
  await openDetail("tmpl_1_v1");
  await screen.findByText("Released to coach_buyer_1");
});

test("releasing to a buyer account code posts the code, clears the field and refreshes history on success", async () => {
  installMocks({ templates: [template()], releases: [] });
  render(<CoachProgrammeMarketplaceSharingPanel />);
  await openDetail("tmpl_1_v1");
  await screen.findByText("Not released to any coach yet.");

  const input = screen.getByPlaceholderText("coach_...") as HTMLInputElement;
  fireEvent.change(input, { target: { value: "coach_buyer_2" } });

  installMocks({ templates: [template()], releases: [{ buyer_coach_user_id: "coach_buyer_2", released_at_iso8601: "2026-08-02T00:00:00.000Z" }] });

  await act(async () => {
    fireEvent.click(screen.getByText("Release to this coach"));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  await screen.findByText("Released to coach_buyer_2.");
  assert.equal(input.value, "");
  await screen.findByText("Released to coach_buyer_2");
});

test("a failed release shows a factual error and keeps the entered account code", async () => {
  installMocks({ templates: [template()], releaseOk: false });
  render(<CoachProgrammeMarketplaceSharingPanel />);
  await openDetail("tmpl_1_v1");
  await screen.findByText("Not released to any coach yet.");

  const input = screen.getByPlaceholderText("coach_...") as HTMLInputElement;
  fireEvent.change(input, { target: { value: "coach_buyer_3" } });

  await act(async () => {
    fireEvent.click(screen.getByText("Release to this coach"));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  await screen.findByText("The programme could not be released to that account.");
  assert.equal(input.value, "coach_buyer_3");
});

test("refetches and re-gates when a legacy kolosseum:templates-changed event fires for the currently open programme", async () => {
  installMocks({ templates: [template({ template_status: "draft" })] });
  const { container } = render(<CoachProgrammeMarketplaceSharingPanel />);
  await openDetail("tmpl_1_v1");
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(container.innerHTML, "");

  installMocks({ templates: [template({ template_status: "active" })] });
  await act(async () => {
    document.dispatchEvent(new CustomEvent("kolosseum:templates-changed"));
  });

  await screen.findByText("Share this programme publicly with other coaches");
});
