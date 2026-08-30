// DEV NOTE: Attendance events slice 1 - coach create-form behavioral proof.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { AttendanceEventCreatePanel } from "../screens/coach/AttendanceEventCreatePanel";

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
  createResult?: { ok: boolean; status?: number; body?: unknown };
}) {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path.startsWith("/account/detail")) {
      return jsonResponse({ account: { user_id: COACH_USER_ID }, csrf_token: "csrf-token" });
    }
    if (path.startsWith("/coach-workspace/relationships")) {
      return jsonResponse({ relationships: options.relationships ?? [] });
    }
    if (path === "/attendance-events" && init?.method === "POST") {
      if (options.createResult && !options.createResult.ok) {
        return jsonResponse(options.createResult.body ?? { error: "attendance_event_title_invalid" }, false, options.createResult.status ?? 400);
      }
      return jsonResponse(
        options.createResult?.body ?? {
          ok: true,
          event: { event_id: "attendance_event_1", title: "Saturday class" },
          occurrences: [{ occurrence_id: "occ_1", occurrence_date: "2026-09-05" }],
          invites: []
        },
        true,
        201
      );
    }
    return jsonResponse({ error: `unhandled_request_${path}` }, false, 404);
  }) as typeof fetch;
  return { restore: () => { globalThis.fetch = original; } };
}

test.afterEach(() => {
  cleanup();
});

test("shows a factual empty state when the coach has no connected athletes", async () => {
  installMocks({ relationships: [] });
  render(<AttendanceEventCreatePanel />);
  await waitFor(() => screen.getByText("No connected athletes yet."));
});

test("lists only currently-accepted athletes as invite candidates, not invited/declined/revoked ones", async () => {
  installMocks({
    relationships: [
      { athlete_user_id: "athlete_1", display_name: "Jordan Lee", relationship_state: "accepted" },
      { athlete_user_id: "athlete_2", display_name: "Sam Rivera", relationship_state: "invited" }
    ]
  });
  render(<AttendanceEventCreatePanel />);
  await waitFor(() => screen.getByText("Jordan Lee"));
  assert.equal(screen.queryByText("Sam Rivera"), null);
});

test("creating an event with selected athletes submits the form and shows a success message", async () => {
  installMocks({
    relationships: [
      { athlete_user_id: "athlete_1", display_name: "Jordan Lee", relationship_state: "accepted" }
    ]
  });

  render(<AttendanceEventCreatePanel />);
  await waitFor(() => screen.getByText("Jordan Lee"));

  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Saturday class" } });
  fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-09-05" } });
  fireEvent.click(screen.getByLabelText("Jordan Lee"));

  let received: unknown;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: COACH_USER_ID }, csrf_token: "csrf-token" });
    if (path.startsWith("/coach-workspace/relationships")) {
      return jsonResponse({ relationships: [{ athlete_user_id: "athlete_1", display_name: "Jordan Lee", relationship_state: "accepted" }] });
    }
    if (path === "/attendance-events" && init?.method === "POST") {
      received = init.body ? JSON.parse(String(init.body)) : null;
      return jsonResponse({
        ok: true,
        event: { event_id: "attendance_event_1", title: "Saturday class" },
        occurrences: [],
        invites: []
      }, true, 201);
    }
    return jsonResponse({ error: `unhandled_request_${path}` }, false, 404);
  }) as typeof fetch;

  await act(async () => {
    fireEvent.submit(screen.getByText("Create event").closest("form") as HTMLFormElement);
  });

  await waitFor(() => screen.getByText("Saturday class created."));
  assert.deepEqual((received as { athlete_user_ids?: string[] })?.athlete_user_ids, ["athlete_1"]);
  assert.equal((received as { title?: string })?.title, "Saturday class");
});

test("a rejected create shows a factual error message, not a generic one", async () => {
  installMocks({
    relationships: [],
    createResult: { ok: false, body: { error: "attendance_event_title_invalid" } }
  });

  render(<AttendanceEventCreatePanel />);
  await waitFor(() => screen.getByText("No connected athletes yet."));

  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "x" } });
  fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-09-05" } });

  await act(async () => {
    fireEvent.submit(screen.getByText("Create event").closest("form") as HTMLFormElement);
  });

  await waitFor(() => screen.getByText("attendance_event_title_invalid"));
});
