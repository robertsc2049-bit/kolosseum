// DEV NOTE: coach_athlete_detail coach-notes history behavioral proof -
// replaces the source-text regex check
// test/full_ui_04b_coach_athlete_detail.test.mjs previously ran against
// the now-removed app.js note-history rendering block (inside
// renderAthleteDetail) for exactly this history-list capability. Note
// *creation* (recordAthleteDetailNote, #athleteDetailNoteForm) stays
// legacy - see AthleteCoachNotesPanel.tsx's own DEV NOTE for why - and is
// still covered by that same test file's other assertions.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";

import { AthleteCoachNotesPanel } from "../screens/coach/AthleteCoachNotesPanel";

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

async function openPanel(notes: Record<string, unknown>[]) {
  installFetchMock(({ input }) => {
    const path = String(input);
    if (path.startsWith("/coach-workspace/athlete-detail")) return jsonResponse({ detail: { note_history: notes } });
    return jsonResponse({ error: `unhandled_request_${path}` }, false, 404);
  });

  render(<AthleteCoachNotesPanel />);

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
  render(<AthleteCoachNotesPanel />);
  assert.equal(document.body.textContent, "");
});

test("displays a coach-only note and an athlete-visible note with their session and date", async () => {
  await openPanel([
    {
      note_id: "note_1",
      visibility: "coach_private",
      note_text: "Form looked good on the last set.",
      session_id: "session_abc",
      created_at: "2026-08-20T10:00:00.000Z"
    },
    {
      note_id: "note_2",
      visibility: "athlete_visible",
      note_text: "Great work this week!",
      session_id: "session_def",
      created_at: "2026-08-21T10:00:00.000Z"
    }
  ]);

  await waitFor(() => screen.getByText("Form looked good on the last set."));

  assert.ok(screen.getByText("Coach-only note"));
  assert.match(document.body.textContent ?? "", /Session: session_abc/u);
  assert.ok(screen.getByText("Athlete-visible note"));
  assert.match(document.body.textContent ?? "", /Session: session_def/u);
  assert.match(document.body.textContent ?? "", /20 Aug 2026/u);
});

test("shows a factual empty state when the athlete has no coach notes yet", async () => {
  await openPanel([]);
  await waitFor(() => screen.getByText("No coach notes"));
  assert.ok(screen.getByText("Non-binding notes recorded against sessions will appear here."));
});

test("closing the profile clears the panel back to rendering nothing", async () => {
  await openPanel([
    { note_id: "note_1", visibility: "coach_private", note_text: "Form looked good.", session_id: "session_abc", created_at: "2026-08-20T10:00:00.000Z" }
  ]);
  await waitFor(() => screen.getByText("Form looked good."));

  act(() => {
    document.dispatchEvent(new CustomEvent("kolosseum:coach-athlete-profile-closed"));
  });

  await waitFor(() => assert.equal(screen.queryByText("Form looked good."), null));
});

test("a note's text containing markup is rendered as inert text, never as HTML", async () => {
  await openPanel([
    {
      note_id: "note_1",
      visibility: "coach_private",
      note_text: '<img src=x onerror="window.pwned=true">',
      session_id: "session_abc",
      created_at: "2026-08-20T10:00:00.000Z"
    }
  ]);

  await waitFor(() => screen.getByText(/img src=x/u));

  assert.equal((globalThis as Record<string, unknown>).pwned, undefined);
  assert.equal(document.querySelectorAll("img").length, 0);
});
