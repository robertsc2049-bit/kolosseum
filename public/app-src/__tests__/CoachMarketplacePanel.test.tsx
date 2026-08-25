// DEV NOTE: coach programme-marketplace browse behavioral proof - replaces
// the source-text regex checks test/full_ui_67_programme_marketplace_surface
// .test.mjs previously ran against the now-removed app.js
// renderMarketplace()/filteredMarketplaceTemplates() rendering block. The
// separate template *sharing* toggle stays legacy and is still covered there.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { CoachMarketplacePanel } from "../screens/coach/CoachMarketplacePanel";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return {
    ok,
    status,
    text: async () => JSON.stringify(body)
  } as Response;
}

function installMocks(templates: Record<string, unknown>[]) {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const path = String(input);
    if (path.startsWith("/programme-marketplace/templates")) return jsonResponse({ templates });
    return jsonResponse({ error: `unhandled_request_${path}` }, false, 404);
  }) as typeof fetch;
}

test.afterEach(() => {
  cleanup();
});

test("shows a factual empty state when nothing has been shared at all", async () => {
  installMocks([]);
  render(<CoachMarketplacePanel />);
  await waitFor(() => screen.getByText("No shared programmes yet"));
  assert.ok(screen.getByText("Complete or active programmes another coach shares publicly will appear here."));
});

test("renders a template card with activity, status, description, price, payment note and sharing coach", async () => {
  installMocks([
    {
      template_id: "template_1",
      template_name: "Peak Week Block",
      template_status: "active",
      activity_id: "powerlifting",
      description: "A 4 week peaking block",
      price_label: "$40",
      payment_methods_note: "Card or bank transfer",
      coach_display_name: "Jordan Coach",
      coach_brand_tagline: "Strength for life",
      coach_brand_color: "#336699"
    }
  ]);

  render(<CoachMarketplacePanel />);

  await waitFor(() => screen.getByText("Peak Week Block"));

  assert.match(document.body.textContent ?? "", /Powerlifting · active/u);
  assert.ok(screen.getByText("A 4 week peaking block"));
  assert.ok(screen.getByText("$40"));
  assert.ok(screen.getByText("Accepted payment: Card or bank transfer"));
  assert.ok(screen.getByText(/Shared by Jordan Coach — Strength for life/u));

  const card = document.querySelector(".marketplace-template-row") as HTMLElement;
  assert.ok(card);
  assert.match(card.style.borderLeft, /rgb\(51, 102, 153\)/u);
});

test("omits optional fields and the tagline dash when a template lacks them", async () => {
  installMocks([
    {
      template_id: "template_1",
      template_name: "Minimal Template",
      template_status: "complete",
      activity_id: "general_strength",
      coach_display_name: "Alex Coach"
    }
  ]);

  render(<CoachMarketplacePanel />);

  await waitFor(() => screen.getByText("Minimal Template"));

  assert.ok(screen.getByText("Shared by Alex Coach"));
  assert.equal(document.querySelectorAll(".marketplace-template-row strong").length, 1);
  const card = document.querySelector(".marketplace-template-row") as HTMLElement;
  assert.equal(card.style.borderLeft, "");
});

test("search filters by name, description, activity and coach identity without a server round-trip", async () => {
  installMocks([
    { template_id: "template_1", template_name: "Peak Week Block", activity_id: "powerlifting", coach_display_name: "Jordan Coach" },
    { template_id: "template_2", template_name: "Base Building", activity_id: "general_strength", coach_display_name: "Alex Coach" }
  ]);

  render(<CoachMarketplacePanel />);
  await waitFor(() => screen.getByText("Peak Week Block"));
  assert.ok(screen.getByText("Base Building"));

  const searchInput = screen.getByPlaceholderText("Name, activity or coach");
  fireEvent.change(searchInput, { target: { value: "alex" } });

  await waitFor(() => {
    assert.equal(screen.queryByText("Peak Week Block"), null);
  });
  assert.ok(screen.getByText("Base Building"));
});

test("shows a distinct empty state for zero matches versus zero shared templates", async () => {
  installMocks([
    { template_id: "template_1", template_name: "Peak Week Block", activity_id: "powerlifting", coach_display_name: "Jordan Coach" }
  ]);

  render(<CoachMarketplacePanel />);
  await waitFor(() => screen.getByText("Peak Week Block"));

  const searchInput = screen.getByPlaceholderText("Name, activity or coach");
  fireEvent.change(searchInput, { target: { value: "nothing matches this" } });

  await waitFor(() => screen.getByText("No programmes match"));
  assert.ok(screen.getByText("Try a different search term or activity filter."));
});

test("activity filter narrows the list to the selected activity", async () => {
  installMocks([
    { template_id: "template_1", template_name: "Peak Week Block", activity_id: "powerlifting", coach_display_name: "Jordan Coach" },
    { template_id: "template_2", template_name: "Base Building", activity_id: "general_strength", coach_display_name: "Alex Coach" }
  ]);

  render(<CoachMarketplacePanel />);
  await waitFor(() => screen.getByText("Peak Week Block"));

  const activitySelect = screen.getByDisplayValue("All activities");
  fireEvent.change(activitySelect, { target: { value: "general_strength" } });

  await waitFor(() => {
    assert.equal(screen.queryByText("Peak Week Block"), null);
  });
  assert.ok(screen.getByText("Base Building"));
});

test("sort orders by name A-Z when selected", async () => {
  installMocks([
    { template_id: "template_1", template_name: "Zeta Block", activity_id: "powerlifting", coach_display_name: "Jordan Coach", updated_at_iso8601: "2026-01-01T00:00:00.000Z" },
    { template_id: "template_2", template_name: "Alpha Block", activity_id: "powerlifting", coach_display_name: "Alex Coach", updated_at_iso8601: "2026-02-01T00:00:00.000Z" }
  ]);

  render(<CoachMarketplacePanel />);
  await waitFor(() => screen.getByText("Zeta Block"));

  const sortSelect = screen.getByDisplayValue("Recently updated");
  fireEvent.change(sortSelect, { target: { value: "name_asc" } });

  await waitFor(() => {
    const names = Array.from(document.querySelectorAll(".marketplace-template-row strong")).map((node) => node.textContent);
    assert.deepEqual(names, ["Alpha Block", "Zeta Block"]);
  });
});

test("a template name and description containing markup are rendered as inert text, never as HTML", async () => {
  installMocks([
    {
      template_id: "template_1",
      template_name: '<img src=x onerror="window.pwned=true">',
      activity_id: "powerlifting",
      description: '<img src=y onerror="window.pwned2=true">',
      coach_display_name: "Jordan Coach"
    }
  ]);

  render(<CoachMarketplacePanel />);

  await waitFor(() => screen.getByText(/img src=x/iu));

  assert.ok(screen.getByText(/img src=y/iu));
  assert.equal((globalThis as Record<string, unknown>).pwned, undefined);
  assert.equal((globalThis as Record<string, unknown>).pwned2, undefined);
  assert.equal(document.querySelectorAll("img").length, 0);
});
