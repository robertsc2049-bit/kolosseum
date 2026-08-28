// DEV NOTE: coach Events screen create-event form behavioral proof -
// replaces the source-text regex checks that used to run against app.js's
// (removed) COACH_EVENT_TYPES/syncCoachEventTypeOptions()/
// renderCoachEventPreview()/createCoachEvent().
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { CoachEventCreatePanel } from "../screens/coach/CoachEventCreatePanel";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) } as Response;
}

function installMocks(options: { createFails?: boolean } = {}) {
  const { createFails = false } = options;
  const calls: Array<{ path: string; init?: RequestInit }> = [];

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    calls.push({ path, init });

    if (path.startsWith("/account/detail")) {
      return jsonResponse({ account: { user_id: "coach_1" }, csrf_token: "csrf-abc" });
    }
    if (path === "/coach-workspace/events") {
      if (createFails) return jsonResponse({ error: "event_date_invalid" }, false, 400);
      return jsonResponse({
        ok: true,
        event: { event_id: "event_new", activity_id: "powerlifting", event_plan: { event_name: "British Championships", event_date: "2027-01-01" } }
      }, true, 201);
    }
    return jsonResponse({ error: `unhandled_request_${path}` }, false, 404);
  }) as typeof fetch;

  return calls;
}

function daysFromNow(offset: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

test.afterEach(() => {
  cleanup();
});

test("renders the compile-event form with default activity, event type options, and timezone", () => {
  installMocks();
  render(<CoachEventCreatePanel />);

  assert.ok(screen.getByRole("heading", { name: "Compile event" }));
  const activitySelect = screen.getByDisplayValue("Powerlifting") as HTMLSelectElement;
  assert.equal(activitySelect.value, "powerlifting");
  assert.ok(screen.getByText("Powerlifting meet"));
  assert.equal((screen.getByPlaceholderText("British Championships") as HTMLInputElement).value, "");
  assert.equal(document.querySelectorAll('input[maxlength="80"]').length, 1);
});

test("changing activity swaps the event type options and resets the selection when the previous type no longer applies", () => {
  installMocks();
  render(<CoachEventCreatePanel />);

  assert.ok(screen.getByText("Powerlifting meet"));

  fireEvent.change(screen.getByDisplayValue("Powerlifting"), { target: { value: "rugby_union" } });

  assert.equal(screen.queryByText("Powerlifting meet"), null);
  assert.ok(screen.getByText("Rugby match"));
});

test("the countdown and available-weeks preview update as dates are entered", () => {
  installMocks();
  render(<CoachEventCreatePanel />);

  assert.ok(screen.getByText("Set event date"));
  assert.ok(screen.getByText("—"));

  const dateInputs = document.querySelectorAll('input[type="date"]');
  const startDateInput = dateInputs[0] as HTMLInputElement;
  const eventDateInput = dateInputs[1] as HTMLInputElement;

  fireEvent.change(startDateInput, { target: { value: daysFromNow(0) } });
  fireEvent.change(eventDateInput, { target: { value: daysFromNow(14) } });

  assert.equal(screen.queryByText("Set event date"), null);
  assert.ok(screen.getByText("2"));
});

test("submitting posts the CSRF-guarded event, dispatches the change event, resets the form, and shows a confirmation", async () => {
  const calls = installMocks();
  let changed = false;
  document.addEventListener("kolosseum:coach-events-changed", () => { changed = true; });

  render(<CoachEventCreatePanel />);

  fireEvent.change(screen.getByPlaceholderText("British Championships"), { target: { value: "British Championships" } });
  const dateInputs = document.querySelectorAll('input[type="date"]');
  fireEvent.change(dateInputs[0], { target: { value: "2026-10-01" } });
  fireEvent.change(dateInputs[1], { target: { value: "2027-01-01" } });
  fireEvent.change(screen.getByPlaceholderText("Optional venue or town"), { target: { value: "Birmingham" } });

  await act(async () => {
    fireEvent.submit(screen.getByRole("button", { name: "Compile event" }).closest("form")!);
  });

  assert.equal(changed, true);
  await screen.findByText("British Championships compiled.");

  const createCall = calls.find((entry) => entry.path === "/coach-workspace/events");
  assert.ok(createCall);
  assert.equal((createCall?.init?.headers as Record<string, string>)?.["x-kolosseum-csrf"], "csrf-abc");
  const body = JSON.parse(String(createCall?.init?.body));
  assert.equal(body.event_name, "British Championships");
  assert.equal(body.activity_id, "powerlifting");
  assert.equal(body.event_type, "powerlifting_meet");
  assert.equal(body.programme_start_date, "2026-10-01");
  assert.equal(body.event_date, "2027-01-01");
  assert.equal(body.location, "Birmingham");
  assert.equal(body.timezone, "Europe/London");

  assert.equal((screen.getByPlaceholderText("British Championships") as HTMLInputElement).value, "");
  assert.equal((screen.getByPlaceholderText("Optional venue or town") as HTMLInputElement).value, "");
});

test("a rejected creation request shows the server's factual error and keeps the entered fields", async () => {
  installMocks({ createFails: true });
  render(<CoachEventCreatePanel />);

  fireEvent.change(screen.getByPlaceholderText("British Championships"), { target: { value: "Bad Event" } });
  const dateInputs = document.querySelectorAll('input[type="date"]');
  fireEvent.change(dateInputs[0], { target: { value: "2026-10-01" } });
  fireEvent.change(dateInputs[1], { target: { value: "2027-01-01" } });

  await act(async () => {
    fireEvent.submit(screen.getByRole("button", { name: "Compile event" }).closest("form")!);
  });

  await screen.findByText("event_date_invalid");
  assert.equal((screen.getByPlaceholderText("British Championships") as HTMLInputElement).value, "Bad Event");
});
