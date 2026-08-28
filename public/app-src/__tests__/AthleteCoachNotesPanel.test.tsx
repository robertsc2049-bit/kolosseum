// DEV NOTE: coach_athlete_detail coach-notes behavioral proof - replaces
// the source-text regex check test/full_ui_04b_coach_athlete_detail.test.mjs
// previously ran against the now-removed app.js note-history rendering
// block (inside renderAthleteDetail), and now also covers note *creation*
// (formerly recordAthleteDetailNote/#athleteDetailNoteForm) - see
// useAthleteCoachNotes.ts's DEV NOTE for the capability-object handshake
// this write path needs that no other coach write path requires.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { AthleteCoachNotesPanel } from "../screens/coach/AthleteCoachNotesPanel";

const OPENED_EVENT = "kolosseum:coach-athlete-profile-opened";
const CLOSED_EVENT = "kolosseum:coach-athlete-profile-closed";
const OPEN_NOTE_FORM_EVENT = "kolosseum:open-session-note-form";

const COACH_PROFILE = { record_type: "beta17_coach_profile", coach_user_id: "coach_1", record_sha256: "profile-hash" };
const RELATIONSHIP = { record_type: "beta17_coach_relationship", coach_user_id: "coach_1", athlete_user_id: "athlete_test123", record_sha256: "rel-hash" };

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) } as Response;
}

function installMocks(options: {
  notes?: Record<string, unknown>[];
  relationships?: Record<string, unknown>[];
  coachProfile?: unknown;
  createFails?: boolean;
} = {}) {
  const {
    notes = [],
    relationships = [{ athlete_user_id: "athlete_test123", relationship: RELATIONSHIP }],
    coachProfile = COACH_PROFILE,
    createFails = false
  } = options;
  const calls: Array<{ path: string; init?: RequestInit }> = [];

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    calls.push({ path, init });

    if (path.startsWith("/coach-workspace/athlete-detail")) {
      return jsonResponse({ detail: { note_history: notes } });
    }
    if (path.startsWith("/account/detail")) {
      return jsonResponse({ account: { user_id: "coach_1" }, csrf_token: "csrf-abc", bootstrap: { coach_profile: coachProfile } });
    }
    if (path.startsWith("/coach-workspace/relationships")) {
      return jsonResponse({ relationships });
    }
    if (path === "/sessions/beta-coach-notes") {
      if (createFails) return jsonResponse({ error: "coach_note_fields_required" }, false, 400);
      return jsonResponse({ ok: true, coach_note: { note_id: "note_new" } }, true, 201);
    }
    return jsonResponse({ error: `unhandled_request_${path}` }, false, 404);
  }) as typeof fetch;

  return calls;
}

async function openPanel(notes: Record<string, unknown>[] = [], options: Parameters<typeof installMocks>[0] = {}) {
  installMocks({ ...options, notes });

  render(<AthleteCoachNotesPanel />);

  await act(async () => {
    document.dispatchEvent(
      new CustomEvent(OPENED_EVENT, { detail: { athlete_user_id: "athlete_test123" } })
    );
  });
}

test.afterEach(() => {
  cleanup();
});

test("renders nothing until the coach opens an athlete's profile", () => {
  installMocks();
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

  await screen.findByText("Form looked good on the last set.");

  assert.ok(screen.getByText("Coach-only note"));
  assert.match(document.body.textContent ?? "", /Session: session_abc/u);
  assert.ok(screen.getByText("Athlete-visible note"));
  assert.match(document.body.textContent ?? "", /Session: session_def/u);
  assert.match(document.body.textContent ?? "", /20 Aug 2026/u);
});

test("shows a factual empty state when the athlete has no coach notes yet", async () => {
  await openPanel([]);
  await screen.findByText("No coach notes");
  assert.ok(screen.getByText("Non-binding notes recorded against sessions will appear here."));
});

test("closing the profile clears the panel back to rendering nothing", async () => {
  await openPanel([
    { note_id: "note_1", visibility: "coach_private", note_text: "Form looked good.", session_id: "session_abc", created_at: "2026-08-20T10:00:00.000Z" }
  ]);
  await screen.findByText("Form looked good.");

  await act(async () => {
    document.dispatchEvent(new CustomEvent(CLOSED_EVENT));
  });

  assert.equal(screen.queryByText("Form looked good."), null);
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

  await screen.findByText(/img src=x/u);

  assert.equal((globalThis as Record<string, unknown>).pwned, undefined);
  assert.equal(document.querySelectorAll("img").length, 0);
});

test("the open-session-note-form event reveals the compose form", async () => {
  await openPanel([]);
  await screen.findByText("No coach notes");

  assert.equal(screen.queryByText("Record note"), null);
  await act(async () => {
    document.dispatchEvent(new CustomEvent(OPEN_NOTE_FORM_EVENT, { detail: { session_id: "session_1", artefact_id: "artefact_1" } }));
  });
  assert.ok(screen.getByText("Record note"));
  assert.ok(screen.getByText("Cancel"));
});

test("Cancel hides the compose form again", async () => {
  await openPanel([]);
  await screen.findByText("No coach notes");

  await act(async () => {
    document.dispatchEvent(new CustomEvent(OPEN_NOTE_FORM_EVENT, { detail: { session_id: "session_1", artefact_id: "artefact_1" } }));
  });
  fireEvent.click(screen.getByText("Cancel"));
  assert.equal(screen.queryByText("Record note"), null);
});

test("submitting a note fetches the coach profile and matching relationship as signed capability objects and posts them verbatim", async () => {
  const calls = installMocks({});
  render(<AthleteCoachNotesPanel />);
  await act(async () => {
    document.dispatchEvent(new CustomEvent(OPENED_EVENT, { detail: { athlete_user_id: "athlete_test123" } }));
  });
  await screen.findByText("No coach notes");

  await act(async () => {
    document.dispatchEvent(new CustomEvent(OPEN_NOTE_FORM_EVENT, { detail: { session_id: "session_1", artefact_id: "artefact_1" } }));
  });

  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Great tempo on squats today." } });

  await act(async () => {
    fireEvent.submit(screen.getByText("Record note").closest("form")!);
  });

  assert.equal(screen.queryByText("Cancel"), null);
  const createCall = calls.find((entry) => entry.path === "/sessions/beta-coach-notes");
  assert.ok(createCall);
  assert.equal((createCall?.init?.headers as Record<string, string>)?.["x-kolosseum-csrf"], "csrf-abc");
  const body = JSON.parse(String(createCall?.init?.body));
  assert.deepEqual(body.coach_profile, COACH_PROFILE);
  assert.deepEqual(body.relationship, RELATIONSHIP);
  assert.equal(body.athlete_user_id, "athlete_test123");
  assert.equal(body.session_id, "session_1");
  assert.equal(body.artefact_id, "artefact_1");
  assert.equal(body.note_text, "Great tempo on squats today.");
  assert.equal(body.visibility, "coach_private");
});

test("choosing 'Visible to athlete' sends athlete_visible", async () => {
  const calls = installMocks({});
  render(<AthleteCoachNotesPanel />);
  await act(async () => {
    document.dispatchEvent(new CustomEvent(OPENED_EVENT, { detail: { athlete_user_id: "athlete_test123" } }));
  });
  await screen.findByText("No coach notes");

  await act(async () => {
    document.dispatchEvent(new CustomEvent(OPEN_NOTE_FORM_EVENT, { detail: { session_id: "session_1", artefact_id: "artefact_1" } }));
  });

  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Visible note." } });
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "athlete_visible" } });

  await act(async () => {
    fireEvent.submit(screen.getByText("Record note").closest("form")!);
  });

  const createCall = calls.find((entry) => entry.path === "/sessions/beta-coach-notes");
  const body = JSON.parse(String(createCall?.init?.body));
  assert.equal(body.visibility, "athlete_visible");
});

test("an empty note shows a validation error and never sends", async () => {
  const calls = installMocks({});
  render(<AthleteCoachNotesPanel />);
  await act(async () => {
    document.dispatchEvent(new CustomEvent(OPENED_EVENT, { detail: { athlete_user_id: "athlete_test123" } }));
  });
  await screen.findByText("No coach notes");

  await act(async () => {
    document.dispatchEvent(new CustomEvent(OPEN_NOTE_FORM_EVENT, { detail: { session_id: "session_1", artefact_id: "artefact_1" } }));
  });

  await act(async () => {
    fireEvent.submit(screen.getByText("Record note").closest("form")!);
  });

  await screen.findByText("Enter a coach note.");
  assert.equal(calls.some((entry) => entry.path === "/sessions/beta-coach-notes"), false);
});

test("a missing relationship capability object shows a factual error and keeps the form open", async () => {
  const calls = installMocks({ relationships: [] });
  render(<AthleteCoachNotesPanel />);
  await act(async () => {
    document.dispatchEvent(new CustomEvent(OPENED_EVENT, { detail: { athlete_user_id: "athlete_test123" } }));
  });
  await screen.findByText("No coach notes");

  await act(async () => {
    document.dispatchEvent(new CustomEvent(OPEN_NOTE_FORM_EVENT, { detail: { session_id: "session_1", artefact_id: "artefact_1" } }));
  });
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Some note." } });

  await act(async () => {
    fireEvent.submit(screen.getByText("Record note").closest("form")!);
  });

  await screen.findByText("This coach-athlete relationship is not available.");
  assert.equal(calls.some((entry) => entry.path === "/sessions/beta-coach-notes"), false);
  assert.ok(screen.getByText("Record note"));
});

test("a rejected creation request shows the server's factual error and keeps the form open", async () => {
  installMocks({ createFails: true });
  render(<AthleteCoachNotesPanel />);
  await act(async () => {
    document.dispatchEvent(new CustomEvent(OPENED_EVENT, { detail: { athlete_user_id: "athlete_test123" } }));
  });
  await screen.findByText("No coach notes");

  await act(async () => {
    document.dispatchEvent(new CustomEvent(OPEN_NOTE_FORM_EVENT, { detail: { session_id: "session_1", artefact_id: "artefact_1" } }));
  });
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Some note." } });

  await act(async () => {
    fireEvent.submit(screen.getByText("Record note").closest("form")!);
  });

  await screen.findByText("coach_note_fields_required");
  assert.ok(screen.getByText("Record note"));
});

test("a successful submission refreshes the note list", async () => {
  await openPanel([]);
  await screen.findByText("No coach notes");

  installMocks({
    notes: [{ note_id: "note_new", visibility: "coach_private", note_text: "Great tempo on squats today.", session_id: "session_1", created_at: "2026-08-27T10:00:00.000Z" }]
  });

  await act(async () => {
    document.dispatchEvent(new CustomEvent(OPEN_NOTE_FORM_EVENT, { detail: { session_id: "session_1", artefact_id: "artefact_1" } }));
  });
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Great tempo on squats today." } });

  await act(async () => {
    fireEvent.submit(screen.getByText("Record note").closest("form")!);
  });

  await screen.findByText("Great tempo on squats today.");
});
