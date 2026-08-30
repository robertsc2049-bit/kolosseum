// DEV NOTE: progress graphs slice 3 - roster-wide overview behavioral
// proof. Mirrors AthleteDirectoryPanel.test.tsx's fetch-mock/event
// conventions since this panel shares its "load on mount, refetch on
// kolosseum:athlete-directory-changed" lifecycle.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";

import { CoachProgressOverviewPanel } from "../screens/coach/CoachProgressOverviewPanel";

type FetchCall = { input: RequestInfo | URL; init?: RequestInit };

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return {
    ok,
    status,
    text: async () => JSON.stringify(body)
  } as Response;
}

function installFetchMock(handler: (call: FetchCall) => Response) {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => handler({ input, init })) as typeof fetch;
  return { restore: () => { globalThis.fetch = original; } };
}

function installRoster(roster: Record<string, unknown>[] | null, ok = true) {
  return installFetchMock(({ input }) => {
    const path = String(input);
    if (path.startsWith("/progress-insights/coach-roster")) {
      return ok ? jsonResponse({ ok: true, roster: roster ?? [] }) : jsonResponse({ error: "server_error" }, false, 500);
    }
    return jsonResponse({ error: `unhandled_request_${path}` }, false, 404);
  });
}

test.afterEach(() => {
  cleanup();
});

test("shows a loading status before the roster resolves", () => {
  installFetchMock(() => jsonResponse({ ok: true, roster: [] }));
  render(<CoachProgressOverviewPanel />);
  assert.ok(screen.getByText("Loading athlete progress…"));
});

test("shows a factual empty state when the coach has no connected athletes", async () => {
  installRoster([]);
  render(<CoachProgressOverviewPanel />);
  await waitFor(() => screen.getByText(/No connected athletes yet/u));
});

test("shows a retryable error state when the roster fails to load", async () => {
  installRoster(null, false);
  render(<CoachProgressOverviewPanel />);
  await waitFor(() => screen.getByText(/Progress overview could not be loaded/u));
  assert.ok(screen.getByText("Retry"));
});

test("retrying after an error re-fetches and renders the roster", async () => {
  installRoster(null, false);
  render(<CoachProgressOverviewPanel />);
  await waitFor(() => screen.getByText("Retry"));

  installRoster([
    { athlete_user_id: "athlete_1", display_name: "Jordan Lee", insights: { session_adherence: { series: [] } } }
  ]);

  act(() => {
    screen.getByText("Retry").click();
  });

  await waitFor(() => screen.getByText("Jordan Lee"));
});

test("renders one card per athlete with a chartable adherence series", async () => {
  installRoster([
    {
      athlete_user_id: "athlete_1",
      display_name: "Jordan Lee",
      insights: {
        session_adherence: {
          series: [
            { window_end_date: "2026-06-01", adherence_percentage: null },
            { window_end_date: "2026-07-01", adherence_percentage: 60 },
            { window_end_date: "2026-08-01", adherence_percentage: 80 }
          ]
        }
      }
    },
    {
      athlete_user_id: "athlete_2",
      display_name: "Sam Rivera",
      insights: { session_adherence: { series: [] } }
    }
  ]);

  render(<CoachProgressOverviewPanel />);
  await waitFor(() => screen.getByText("Jordan Lee"));
  assert.ok(screen.getByText("Sam Rivera"));

  const cards = document.querySelectorAll(".record-list .record-card");
  assert.equal(cards.length, 2);

  const jordanCard = screen.getByText("Jordan Lee").closest("article") as HTMLElement;
  const path = jordanCard.querySelector("svg path");
  assert.ok(path, "expected an adherence line chart for Jordan Lee");
  const dCommands = path?.getAttribute("d")?.split(" ") ?? [];
  assert.equal(dCommands.length, 2, "expected exactly 2 plotted points (the null-adherence window excluded)");

  const samCard = screen.getByText("Sam Rivera").closest("article") as HTMLElement;
  assert.match(samCard.textContent ?? "", /Not enough sessions to chart yet\./u);
});

test("an athlete whose insights failed to load shows a factual unavailable state, not a crash", async () => {
  installRoster([
    { athlete_user_id: "athlete_1", display_name: "Jordan Lee", insights: null }
  ]);

  render(<CoachProgressOverviewPanel />);
  await waitFor(() => screen.getByText("Jordan Lee"));

  const card = screen.getByText("Jordan Lee").closest("article") as HTMLElement;
  assert.ok(card.querySelector(".badge")?.textContent === "Unavailable");
  assert.match(card.textContent ?? "", /Progress could not be loaded for this athlete\./u);
});

test("the Open profile button dispatches kolosseum:open-athlete-profile-request with the athlete's id", async () => {
  installRoster([
    { athlete_user_id: "athlete_1", display_name: "Jordan Lee", insights: { session_adherence: { series: [] } } }
  ]);

  render(<CoachProgressOverviewPanel />);
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

test("a display name containing markup is rendered as inert text, never as HTML", async () => {
  installRoster([
    {
      athlete_user_id: "athlete_1",
      display_name: '<img src=x onerror="window.pwned=true">',
      insights: { session_adherence: { series: [] } }
    }
  ]);

  render(<CoachProgressOverviewPanel />);

  await waitFor(() => screen.getByText(/img src=x/iu));

  assert.equal((globalThis as Record<string, unknown>).pwned, undefined);
  assert.equal(document.querySelectorAll("img").length, 0);
});

test("refetches when kolosseum:athlete-directory-changed fires", async () => {
  installRoster([]);
  render(<CoachProgressOverviewPanel />);
  await waitFor(() => screen.getByText(/No connected athletes yet/u));

  installRoster([
    { athlete_user_id: "athlete_1", display_name: "Jordan Lee", insights: { session_adherence: { series: [] } } }
  ]);

  act(() => {
    document.dispatchEvent(new CustomEvent("kolosseum:athlete-directory-changed"));
  });

  await waitFor(() => screen.getByText("Jordan Lee"));
});
