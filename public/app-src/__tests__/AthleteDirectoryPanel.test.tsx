// DEV NOTE: FULL-UI-04A coach athlete directory behavioral proof -
// replaces the source-text regex checks
// test/full_ui_04a_coach_athlete_directory.test.mjs previously ran
// against the now-removed app.js renderCoachAthleteDirectory() rendering
// block.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { AthleteDirectoryPanel } from "../screens/coach/AthleteDirectoryPanel";

const COACH_USER_ID = "coach_test123";

type FetchCall = { input: RequestInfo | URL; init?: RequestInit };

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return {
    ok,
    status,
    text: async () => JSON.stringify(body)
  } as Response;
}

function installMocks(options: {
  relationships?: Record<string, unknown>[];
  assignments?: Record<string, unknown>[];
  templates?: Record<string, unknown>[];
  threads?: Record<string, unknown>[];
}) {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const path = String(input);
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: COACH_USER_ID } });
    if (path.startsWith("/coach-workspace/relationships")) return jsonResponse({ relationships: options.relationships ?? [] });
    if (path.startsWith("/coach-workspace/assignments")) return jsonResponse({ assignments: options.assignments ?? [] });
    if (path.startsWith("/templates")) return jsonResponse({ templates: options.templates ?? [] });
    if (path.startsWith("/messages/coach/threads")) return jsonResponse({ threads: options.threads ?? [] });
    return jsonResponse({ error: `unhandled_request_${path}` }, false, 404);
  }) as typeof fetch;
  return { restore: () => { globalThis.fetch = original; } };
}

test.afterEach(() => {
  cleanup();
});

test("displays relationship counts and a roster card for an accepted athlete", async () => {
  installMocks({
    relationships: [
      { athlete_user_id: "athlete_1", display_name: "Jordan Lee", email: "jordan@example.com", activity_id: "powerlifting", relationship_state: "accepted" }
    ]
  });

  render(<AthleteDirectoryPanel />);

  await waitFor(() => screen.getByText("Jordan Lee"));

  const card = within(screen.getByText("Jordan Lee").closest("article") as HTMLElement);
  assert.ok(card.getByText("jordan@example.com"));
  assert.ok(card.getByText("Powerlifting"));
  assert.ok(card.getByText("No programme assigned"));
  assert.ok(card.getByText("Accepted"));
  assert.ok(card.getByText("Open profile"));
  assert.ok(card.getByText("View audit"));

  const counts = document.querySelectorAll(".relationship-metric-card strong");
  const values = Array.from(counts).map((node) => node.textContent);
  assert.deepEqual(values, ["1", "0", "0", "0"]);
});

test("resolves the programme label from the athlete's current assignment and templates", async () => {
  installMocks({
    relationships: [
      { athlete_user_id: "athlete_1", display_name: "Jordan Lee", email: "jordan@example.com", activity_id: "powerlifting", relationship_state: "accepted" }
    ],
    assignments: [
      { assigned_athlete_id: "athlete_1", template_id: "template_1", template_version: 2 }
    ],
    templates: [{ template_id: "template_1", template_name: "Base Strength Block" }]
  });

  render(<AthleteDirectoryPanel />);

  await waitFor(() => screen.getByText("Base Strength Block · v2"));
});

test("shows an unread-messages badge only when the athlete has unread messages", async () => {
  installMocks({
    relationships: [
      { athlete_user_id: "athlete_1", display_name: "Jordan Lee", email: "jordan@example.com", activity_id: "powerlifting", relationship_state: "accepted" },
      { athlete_user_id: "athlete_2", display_name: "Sam Rivera", email: "sam@example.com", activity_id: "powerlifting", relationship_state: "accepted" }
    ],
    threads: [{ athlete_user_id: "athlete_1", unread_count: 3 }]
  });

  render(<AthleteDirectoryPanel />);

  await waitFor(() => screen.getByText("Jordan Lee"));

  assert.ok(screen.getByText("3 unread"));
  assert.equal(screen.queryAllByText(/unread$/u).length, 1);
});

test("an invited (pending) relationship never renders an Open profile button", async () => {
  installMocks({
    relationships: [
      { athlete_user_id: "athlete_1", display_name: "Jordan Lee", email: "jordan@example.com", activity_id: "powerlifting", relationship_state: "invited" }
    ]
  });

  render(<AthleteDirectoryPanel />);

  await waitFor(() => screen.getByText("Jordan Lee"));

  const card = within(screen.getByText("Jordan Lee").closest("article") as HTMLElement);
  assert.equal(card.queryByText("Open profile"), null);
  assert.ok(card.getByText("Invited"));
});

test("an expired invitation is classified by its expiry date, not the raw stored state", async () => {
  installMocks({
    relationships: [
      {
        athlete_user_id: "athlete_1",
        display_name: "Jordan Lee",
        email: "jordan@example.com",
        activity_id: "powerlifting",
        relationship_state: "invited",
        relationship: { relationship_state: "invited", expires_at_iso8601: "2020-01-01T00:00:00.000Z" }
      }
    ]
  });

  render(<AthleteDirectoryPanel />);

  await waitFor(() => screen.getByText("Jordan Lee"));
  const card = within(screen.getByText("Jordan Lee").closest("article") as HTMLElement);
  assert.ok(card.getByText("Expired"));
});

test("the View audit button carries the relationship-action data attributes the existing global click delegation relies on", async () => {
  installMocks({
    relationships: [
      { athlete_user_id: "athlete_1", display_name: "Jordan Lee", email: "jordan@example.com", activity_id: "powerlifting", relationship_state: "accepted" }
    ]
  });

  render(<AthleteDirectoryPanel />);

  await waitFor(() => screen.getByText("Jordan Lee"));

  const button = screen.getByText("View audit");
  assert.equal(button.getAttribute("data-relationship-action"), "audit");
  assert.equal(button.getAttribute("data-relationship-athlete-id"), "athlete_1");
});

test("the Open profile button dispatches kolosseum:open-athlete-profile-request with the athlete's id", async () => {
  installMocks({
    relationships: [
      { athlete_user_id: "athlete_1", display_name: "Jordan Lee", email: "jordan@example.com", activity_id: "powerlifting", relationship_state: "accepted" }
    ]
  });

  render(<AthleteDirectoryPanel />);
  await waitFor(() => screen.getByText("Open profile"));

  let received: unknown;
  document.addEventListener("kolosseum:open-athlete-profile-request", (event) => {
    received = (event as CustomEvent).detail;
  });

  act(() => {
    screen.getByText("Open profile").click();
  });

  assert.deepEqual(received, { athlete_user_id: "athlete_1" });
});

test("searching filters the roster by name, email, athlete id and activity", async () => {
  installMocks({
    relationships: [
      { athlete_user_id: "athlete_1", display_name: "Jordan Lee", email: "jordan@example.com", activity_id: "powerlifting", relationship_state: "accepted" },
      { athlete_user_id: "athlete_2", display_name: "Sam Rivera", email: "sam@example.com", activity_id: "rugby_union", relationship_state: "accepted" }
    ]
  });

  render(<AthleteDirectoryPanel />);
  await waitFor(() => screen.getByText("Jordan Lee"));
  assert.ok(screen.getByText("Sam Rivera"));

  fireEvent.change(screen.getByPlaceholderText("Name, email or account code"), { target: { value: "rivera" } });

  await waitFor(() => assert.equal(screen.queryByText("Jordan Lee"), null));
  assert.ok(screen.getByText("Sam Rivera"));
});

test("shows a factual empty state when no relationship matches the search or filter", async () => {
  installMocks({
    relationships: [
      { athlete_user_id: "athlete_1", display_name: "Jordan Lee", email: "jordan@example.com", activity_id: "powerlifting", relationship_state: "accepted" }
    ]
  });

  render(<AthleteDirectoryPanel />);
  await waitFor(() => screen.getByText("Jordan Lee"));

  fireEvent.change(screen.getByPlaceholderText("Name, email or account code"), { target: { value: "nobody-matches-this" } });

  await waitFor(() => screen.getByText("No matching relationships"));
});

test("a display name and email containing markup are rendered as inert text, never as HTML", async () => {
  installMocks({
    relationships: [
      {
        athlete_user_id: "athlete_1",
        display_name: '<img src=x onerror="window.pwned=true">',
        email: "jordan@example.com",
        activity_id: "powerlifting",
        relationship_state: "accepted"
      }
    ]
  });

  render(<AthleteDirectoryPanel />);

  await waitFor(() => screen.getByText(/img src=x/iu));

  assert.equal((globalThis as Record<string, unknown>).pwned, undefined);
  assert.equal(document.querySelectorAll("img").length, 0);
});

test("refetches when kolosseum:athlete-directory-changed fires", async () => {
  installMocks({ relationships: [] });
  render(<AthleteDirectoryPanel />);
  await waitFor(() => screen.getByText("No matching relationships"));

  installMocks({
    relationships: [
      { athlete_user_id: "athlete_1", display_name: "Jordan Lee", email: "jordan@example.com", activity_id: "powerlifting", relationship_state: "accepted" }
    ]
  });

  act(() => {
    document.dispatchEvent(new CustomEvent("kolosseum:athlete-directory-changed"));
  });

  await waitFor(() => screen.getByText("Jordan Lee"));
});
