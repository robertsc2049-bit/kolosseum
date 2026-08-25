// DEV NOTE: coach_athlete_detail progress-photos mirror behavioral proof -
// replaces the source-text regex checks
// test/full_ui_28_progress_photos_surface.test.mjs previously ran against
// the now-removed app.js refreshCoachAthleteProgressPhotos/
// renderCoachAthleteProgressPhotos functions for exactly this coach-side
// capability. The athlete's own upload/history/compare view stays legacy
// and is still covered there.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { AthleteProgressPhotosPanel } from "../screens/coach/AthleteProgressPhotosPanel";

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

function photo(overrides: Record<string, unknown> = {}) {
  return {
    photo_id: "photo_1",
    url: "/progress-photos/coach/athlete_test123/photo_1/file",
    taken_at_iso8601: "2026-08-01T00:00:00.000Z",
    byte_size: 204800,
    caption: "",
    ...overrides
  };
}

async function openPanel(photos: Record<string, unknown>[]) {
  installFetchMock(({ input }) => {
    const path = String(input);
    if (path.startsWith("/progress-photos/coach/")) return jsonResponse({ photos });
    return jsonResponse({ error: `unhandled_request_${path}` }, false, 404);
  });

  render(<AthleteProgressPhotosPanel />);

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
  render(<AthleteProgressPhotosPanel />);
  assert.equal(document.body.textContent, "");
});

test("displays each photo with its date, human-readable size and caption", async () => {
  await openPanel([photo({ caption: "Week 4 check-in" })]);

  await waitFor(() => screen.getByText("Week 4 check-in"));

  assert.match(document.body.textContent ?? "", /1 Aug 2026/u);
  assert.match(document.body.textContent ?? "", /200\.0 KB/u);
  assert.equal(document.querySelectorAll("img").length, 1);
});

test("selecting two photos shows the comparison panel with the earlier photo first", async () => {
  await openPanel([
    photo({ photo_id: "photo_later", taken_at_iso8601: "2026-08-20T00:00:00.000Z" }),
    photo({ photo_id: "photo_earlier", taken_at_iso8601: "2026-07-01T00:00:00.000Z" })
  ]);

  await waitFor(() => screen.getAllByText("Compare"));

  const compareButtons = screen.getAllByText("Compare");
  fireEvent.click(compareButtons[0]);
  fireEvent.click(compareButtons[1]);

  await waitFor(() => screen.getByText("Comparing two photos"));

  const comparisonGrid = document.querySelector(".progress-photo-comparison-grid")!;
  const sides = comparisonGrid.querySelectorAll("figcaption");
  assert.match(sides[0].textContent ?? "", /1 Jul 2026/u);
  assert.match(sides[1].textContent ?? "", /20 Aug 2026/u);
});

test("selecting a third photo drops the oldest selection instead of refusing the click", async () => {
  await openPanel([
    photo({ photo_id: "photo_1", taken_at_iso8601: "2026-08-01T00:00:00.000Z" }),
    photo({ photo_id: "photo_2", taken_at_iso8601: "2026-08-10T00:00:00.000Z" }),
    photo({ photo_id: "photo_3", taken_at_iso8601: "2026-08-20T00:00:00.000Z" })
  ]);

  await waitFor(() => screen.getAllByText("Compare"));
  const buttons = screen.getAllByText("Compare");
  fireEvent.click(buttons[0]);
  fireEvent.click(buttons[1]);
  fireEvent.click(buttons[2]);

  await waitFor(() => screen.getByText("Comparing two photos"));

  assert.equal(document.querySelectorAll(".progress-photo-card.selected").length, 2);
  assert.equal(screen.getAllByText("Selected for comparison").length, 2);
});

test("shows a factual empty state when the athlete has no progress photos yet", async () => {
  await openPanel([]);
  await waitFor(() => screen.getByText("No progress photos yet."));
});

test("closing the profile clears the panel back to rendering nothing", async () => {
  await openPanel([photo({ caption: "Week 4 check-in" })]);
  await waitFor(() => screen.getByText("Week 4 check-in"));

  act(() => {
    document.dispatchEvent(new CustomEvent("kolosseum:coach-athlete-profile-closed"));
  });

  await waitFor(() => assert.equal(screen.queryByText("Week 4 check-in"), null));
});

test("a photo caption containing markup is rendered as inert text, never as HTML", async () => {
  await openPanel([photo({ caption: '<img src=x onerror="window.pwned=true">' })]);

  await waitFor(() => screen.getByText(/img src=x/u));

  assert.equal((globalThis as Record<string, unknown>).pwned, undefined);
  // Exactly one <img> - the legitimate progress-photo <img>, none injected
  // from the caption.
  assert.equal(document.querySelectorAll("img").length, 1);
});
