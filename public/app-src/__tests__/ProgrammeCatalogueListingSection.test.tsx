// "Publish to coaches": a Kolosseum programme author lists an active
// programme for athletes without a coach, with who it suits.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ProgrammeCatalogueListingSection } from "../screens/coach/ProgrammeCatalogueListingSection";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) } as Response;
}

const activeTemplate = {
  template_id: "coach_template_1_v1", template_name: "Beginner full-body", template_status: "active",
  template_structure: { blocks: [{ weeks: [{ sessions: [{}, {}, {}] }] }] }
};

function installMocks(options: { author?: boolean; listing?: Record<string, unknown> | null; others?: Record<string, unknown>[] } = {}) {
  const puts: Record<string, unknown>[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const method = init?.method ?? "GET";
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: "coach_1" }, csrf_token: "csrf" });
    if (path === "/templates/coach_template_1_v1/catalogue-listing" && method === "GET") {
      return jsonResponse({ catalogue_author: options.author ?? true, listing: options.listing ?? null, other_listings: options.others ?? [] });
    }
    if (path === "/templates/coach_template_1_v1/catalogue-listing" && method === "PUT") {
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
      puts.push(body);
      return jsonResponse({ listing: { listing_id: "programme_coach_template_1", ...body } });
    }
    return jsonResponse({ error: `unhandled_${path}` }, false, 404);
  }) as typeof fetch;
  return puts;
}

test.afterEach(() => cleanup());

test("a coach who isn't a Kolosseum programme author sees nothing to publish", async () => {
  installMocks({ author: false });
  const { container } = render(<ProgrammeCatalogueListingSection template={activeTemplate} />);
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
  assert.equal(container.innerHTML, "");
});

test("a draft can't be published until it's activated", async () => {
  installMocks();
  render(<ProgrammeCatalogueListingSection template={{ ...activeTemplate, template_status: "complete" }} />);
  await screen.findByText("Activate this programme to publish it. Athletes run the exact version you publish.");
  assert.equal(screen.queryByText("Publish to coaches", { selector: "button" }), null);
});

test("the author publishes a beginner programme for any sport, three days a week", async () => {
  const puts = installMocks();
  render(<ProgrammeCatalogueListingSection template={activeTemplate} />);
  await screen.findByText("Coaches can copy this programme into their own library to adapt and assign. Its levels and sports help them find it.");
  assert.equal((screen.getByLabelText("Title coaches see") as HTMLInputElement).value, "Beginner full-body");
  assert.equal((screen.getByLabelText("Training days a week") as HTMLSelectElement).value, "3", "from the programme's first week");
  fireEvent.click(screen.getByLabelText("Beginner"));
  fireEvent.change(screen.getByLabelText("Summary"), { target: { value: "Three full-body days on the main lifts." } });
  await act(async () => {
    fireEvent.click(screen.getByText("Publish to coaches", { selector: "button" }));
  });
  await waitFor(() => assert.equal(puts.length, 1));
  assert.deepEqual(puts[0], { title: "Beginner full-body", summary: "Three full-body days on the main lifts.", levels: ["beginner"], activity_ids: [], days_per_week: 3, next_listing_id: "", listed: true });
  await screen.findByText("Listed for coaches.");
  assert.ok(screen.getByText("Listed"));
});

test("a programme for specific sports lists those sports; it can't be published with none chosen", async () => {
  const puts = installMocks();
  render(<ProgrammeCatalogueListingSection template={activeTemplate} />);
  await screen.findByLabelText("Specific sports");
  fireEvent.click(screen.getByLabelText("Amateur"));
  fireEvent.click(screen.getByLabelText("Specific sports"));
  const publish = screen.getByText("Publish to coaches", { selector: "button" }) as HTMLButtonElement;
  assert.equal(publish.disabled, true, "no sports chosen yet");
  fireEvent.click(screen.getByLabelText("Rugby union"));
  fireEvent.click(screen.getByLabelText("Rugby league"));
  await act(async () => {
    fireEvent.click(publish);
  });
  await waitFor(() => assert.equal(puts.length, 1));
  assert.deepEqual(puts[0].activity_ids, ["rugby_union", "rugby_league"]);
});

test("a listed programme can be unlisted", async () => {
  const puts = installMocks({ listing: { listing_id: "programme_coach_template_1", title: "Beginner full-body", summary: "", levels: ["beginner"], activity_ids: [], days_per_week: 3, next_listing_id: "", listed: true } });
  render(<ProgrammeCatalogueListingSection template={activeTemplate} />);
  await screen.findByText("Update listing");
  await act(async () => {
    fireEvent.click(screen.getByText("Unlist"));
  });
  await waitFor(() => assert.equal(puts.length, 1));
  assert.equal(puts[0].listed, false);
  await screen.findByText("No longer listed - copies coaches already made are theirs to keep.");
});

test("the author names which of their programmes athletes are offered when they finish this one", async () => {
  const puts = installMocks({
    listing: { listing_id: "programme_coach_template_1", title: "Off-season strength build", summary: "", levels: ["amateur", "pro"], activity_ids: [], days_per_week: 3, next_listing_id: "", listed: true },
    others: [{ listing_id: "programme_in_season", title: "In-season maintenance", listed: true }, { listing_id: "programme_old", title: "Old programme", listed: false }]
  });
  render(<ProgrammeCatalogueListingSection template={activeTemplate} />);
  const select = await screen.findByLabelText("When athletes finish it, offer next") as HTMLSelectElement;
  assert.deepEqual([...select.options].map((o) => o.textContent), ["Nothing - they choose for themselves", "In-season maintenance", "Old programme (not listed)"]);
  fireEvent.change(select, { target: { value: "programme_in_season" } });
  await act(async () => {
    fireEvent.click(screen.getByText("Update listing"));
  });
  await waitFor(() => assert.equal(puts.length, 1));
  assert.equal(puts[0].next_listing_id, "programme_in_season");
});

test("with no other programmes published there's nothing to offer next, so no choice is shown", async () => {
  installMocks();
  render(<ProgrammeCatalogueListingSection template={activeTemplate} />);
  await screen.findByLabelText("Title coaches see");
  assert.equal(screen.queryByLabelText("When athletes finish it, offer next"), null);
});
