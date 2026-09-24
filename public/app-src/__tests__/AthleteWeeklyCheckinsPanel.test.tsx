// DEV NOTE: coach_athlete_detail weekly-checkins mirror behavioral proof -
// replaces the source-text regex checks
// test/full_ui_64_weekly_checkins_surface.test.mjs previously ran against
// the now-removed app.js refreshCoachAthleteWeeklyCheckins function for
// exactly this coach-side capability. The athlete's own submit/history view
// stays legacy and is still covered there.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";

import { AthleteWeeklyCheckinsPanel } from "../screens/coach/AthleteWeeklyCheckinsPanel";

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

async function openPanel(checkins: Record<string, unknown>[]) {
  installFetchMock(({ input }) => {
    const path = String(input);
    if (path.startsWith("/weekly-checkins/coach/")) return jsonResponse({ checkins });
    return jsonResponse({ error: `unhandled_request_${path}` }, false, 404);
  });

  render(<AthleteWeeklyCheckinsPanel />);

  act(() => {
    document.dispatchEvent(
      new CustomEvent("kolosseum:coach-athlete-profile-opened", {
        detail: { athlete_user_id: "athlete_test123" }
      })
    );
  });
}

test.afterEach(() => {
  cleanup();
});

test("renders nothing until the coach opens an athlete's profile", () => {
  installFetchMock(() => jsonResponse({}, false, 404));
  render(<AthleteWeeklyCheckinsPanel />);
  assert.equal(document.body.textContent, "");
});

test("displays each check-in's week, ratings and optional note", async () => {
  await openPanel([
    {
      week_start_date: "2026-08-17",
      energy_level: 4,
      motivation_level: 3,
      sleep_quality: 5,
      note: "Felt strong this week"
    },
    {
      week_start_date: "2026-08-10",
      energy_level: 2,
      motivation_level: 2,
      sleep_quality: 3,
      note: ""
    }
  ]);

  await waitFor(() => screen.getByText("Felt strong this week"));

  assert.match(document.body.textContent ?? "", /Week of 17 Aug 2026/u);
  assert.match(document.body.textContent ?? "", /Energy 4\/5 · Motivation 3\/5 · Sleep 5\/5/u);
  assert.match(document.body.textContent ?? "", /Felt strong this week/u);
  assert.match(document.body.textContent ?? "", /Week of 10 Aug 2026/u);
  assert.match(document.body.textContent ?? "", /Energy 2\/5 · Motivation 2\/5 · Sleep 3\/5/u);
});

test("shows a factual empty state when the athlete has no check-ins yet", async () => {
  await openPanel([]);
  await waitFor(() => screen.getByText("No weekly check-ins yet."));
});

test("closing the profile clears the panel back to rendering nothing", async () => {
  await openPanel([{ week_start_date: "2026-08-17", energy_level: 4, motivation_level: 3, sleep_quality: 5 }]);
  await waitFor(() => screen.getByText(/Week of/u));

  act(() => {
    document.dispatchEvent(new CustomEvent("kolosseum:coach-athlete-profile-closed"));
  });

  await waitFor(() => assert.equal(screen.queryByText(/Week of/u), null));
});

test("a check-in note containing markup is rendered as inert text, never as HTML", async () => {
  await openPanel([
    {
      week_start_date: "2026-08-17",
      energy_level: 4,
      motivation_level: 3,
      sleep_quality: 5,
      note: '<img src=x onerror="window.pwned=true">'
    }
  ]);

  await waitFor(() => screen.getByText(/Week of/u));

  assert.equal((globalThis as Record<string, unknown>).pwned, undefined);
  assert.equal(document.querySelectorAll("img").length, 0);
  assert.match(document.body.textContent ?? "", /<img src=x onerror="window\.pwned=true">/u);
});
