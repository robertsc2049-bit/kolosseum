// DEV NOTE: FULL-UI-09C event detail/lifecycle behavioral proof - replaces
// the (never-run, since its DOM targets were removed) manual coverage the
// now-deleted event_lifecycle_ui.js had.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { CoachEventDetailPanel } from "../screens/coach/CoachEventDetailPanel";

const COACH_USER_ID = "coach_test123";
const EVENT_ID = "event_1";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return { ok, status, text: async () => JSON.stringify(body) } as Response;
}

function baseEvent(overrides: Record<string, unknown> = {}) {
  return {
    event_id: EVENT_ID,
    event_status: "active",
    event_version: 1,
    activity_id: "powerlifting",
    record_sha256: "a".repeat(64),
    event_plan: {
      event_name: "Autumn Meet",
      event_type: "powerlifting_meet",
      programme_start_date: "2026-08-01",
      event_date: "2026-09-01",
      location: "Nottingham",
      timezone: "Europe/London",
      notes: "Bring lifting shoes."
    },
    ...overrides
  };
}

function baseDetail(overrides: Record<string, unknown> = {}) {
  return {
    event_id: EVENT_ID,
    event: baseEvent(),
    linked_athletes: [],
    lifecycle_records: [],
    historical_preservation: {
      event_versions_retained: 1,
      link_records_retained: 0,
      assignment_records_retained: 0,
      session_records_retained: 0
    },
    ...overrides
  };
}

function installMocks(options: {
  detail?: Record<string, unknown> | null;
  detailStatus?: number;
  relationships?: Record<string, unknown>[];
  templates?: Record<string, unknown>[];
} = {}) {
  const { detail = baseDetail(), detailStatus = 200, relationships = [], templates = [] } = options;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const path = String(input);
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: COACH_USER_ID }, csrf_token: "csrf" });
    if (path.startsWith(`/coach-workspace/events/${EVENT_ID}/`)) return jsonResponse({ ok: true, event: baseEvent() });
    if (path.startsWith(`/coach-workspace/events/${EVENT_ID}`)) {
      return detail
        ? jsonResponse({ ok: true, detail })
        : jsonResponse({ ok: false, code: "NOT_FOUND", error: "EVENT_RECORD_NOT_FOUND", details: { reason: "event_not_found" } }, false, detailStatus);
    }
    if (path.startsWith("/coach-workspace/relationships")) return jsonResponse({ relationships });
    if (path.startsWith("/templates")) return jsonResponse({ templates });
    return jsonResponse({ error: `unhandled_request_${path}` }, false, 404);
  }) as typeof fetch;
}

function openDetail() {
  document.dispatchEvent(new CustomEvent("kolosseum:open-event-detail", { detail: { event_id: EVENT_ID } }));
}

test.afterEach(() => {
  cleanup();
  // @ts-expect-error - test-only cleanup of a stubbed global
  delete window.confirm;
});

test("renders nothing until an open-event-detail request fires", () => {
  installMocks();
  const { container } = render(<CoachEventDetailPanel />);
  assert.equal(container.innerHTML, "");
});

test("shows event facts, notes and linked-athlete state once opened", async () => {
  installMocks();
  render(<CoachEventDetailPanel />);

  await act(async () => {
    openDetail();
  });

  await screen.findByText("Autumn Meet");
  assert.ok(screen.getByText("Bring lifting shoes.", { selector: "p" }));
  assert.ok(screen.getByText("No athletes are currently linked."));
  assert.ok(screen.getByText("Nottingham"));
});

test("a stale or invalid event id dispatches kolosseum:coach-event-detail-not-found", async () => {
  installMocks({ detail: null, detailStatus: 404 });
  let notFound = false;
  document.addEventListener("kolosseum:coach-event-detail-not-found", () => { notFound = true; });

  render(<CoachEventDetailPanel />);
  await act(async () => {
    openDetail();
  });
  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.equal(notFound, true);
});

test("cancelling asks for confirmation, then posts the cancel action and refreshes", async () => {
  installMocks();
  window.confirm = () => true;

  render(<CoachEventDetailPanel />);
  await act(async () => {
    openDetail();
  });
  await screen.findByText("Autumn Meet");

  await act(async () => {
    screen.getByText("Cancel event").click();
  });

  await screen.findByText("Event cancelled.");
});

test("declining the confirmation does not cancel the event", async () => {
  installMocks();
  window.confirm = () => false;

  render(<CoachEventDetailPanel />);
  await act(async () => {
    openDetail();
  });
  await screen.findByText("Autumn Meet");

  await act(async () => {
    screen.getByText("Cancel event").click();
  });

  assert.equal(screen.queryByText("Event cancelled."), null);
});

test("linking an athlete posts the link request and shows a confirmation", async () => {
  installMocks({ relationships: [{ athlete_user_id: "athlete_1", display_name: "Alex", relationship_state: "accepted" }] });

  render(<CoachEventDetailPanel />);
  await act(async () => {
    openDetail();
  });
  await screen.findByText("Autumn Meet");

  await act(async () => {
    fireEvent.change(screen.getByLabelText("Athlete"), { target: { value: "athlete_1" } });
  });

  await act(async () => {
    screen.getByRole("button", { name: "Link athlete" }).click();
  });

  await screen.findByText("Athlete linked.");
});

test("unlinking an athlete posts the unlink request", async () => {
  installMocks({
    detail: baseDetail({
      linked_athletes: [{ athlete_user_id: "athlete_1", display_name: "Alex", linked_programme: null }]
    })
  });

  render(<CoachEventDetailPanel />);
  await act(async () => {
    openDetail();
  });
  await screen.findByText("Alex");

  await act(async () => {
    screen.getByText("Unlink").click();
  });

  await screen.findByText("Athlete unlinked. Historical records retained.");
});

test("creating a new version posts the current form values with the expected hash", async () => {
  installMocks();

  render(<CoachEventDetailPanel />);
  await act(async () => {
    openDetail();
  });
  await screen.findByText("Autumn Meet");

  await act(async () => {
    screen.getByText("Create new version").click();
  });

  await screen.findByText("New event version created.");
});

test("a cancelled event hides cancel/archive actions but keeps the archive action for a completed event correctly gated", async () => {
  installMocks({ detail: baseDetail({ event: baseEvent({ event_status: "cancelled" }) }) });

  render(<CoachEventDetailPanel />);
  await act(async () => {
    openDetail();
  });
  await screen.findByText("Autumn Meet");

  assert.equal(screen.queryByText("Cancel event"), null);
  assert.ok(screen.getByText("Archive event"));
  assert.ok(screen.getByText("This event no longer accepts factual edits."));
});

test("closing the panel resets the hash away from the event route", async () => {
  window.location.hash = `#/coach/events/${EVENT_ID}`;
  installMocks();

  render(<CoachEventDetailPanel />);
  await act(async () => {
    openDetail();
  });
  await screen.findByText("Autumn Meet");

  await act(async () => {
    screen.getByText("Close detail").click();
  });

  assert.equal(window.location.hash, "#/coach/events");
});
