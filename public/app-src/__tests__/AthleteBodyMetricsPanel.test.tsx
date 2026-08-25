// DEV NOTE: coach_athlete_detail body-metric history + log form behavioral
// proof - replaces the source-text regex checks
// test/full_ui_29_body_metrics_habits_surface.test.mjs previously ran
// against the now-removed app.js refreshCoachAthleteBodyMetrics/
// logCoachBodyMetricEntry functions for exactly this coach-side capability.
// The athlete's own log/history view stays legacy and is still covered
// there.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { AthleteBodyMetricsPanel } from "../screens/coach/AthleteBodyMetricsPanel";

type FetchCall = { input: RequestInfo | URL; init?: RequestInit };

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return {
    ok,
    status,
    text: async () => JSON.stringify(body)
  } as Response;
}

function installFetchMock(handler: (call: FetchCall) => Response) {
  const calls: FetchCall[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ input, init });
    return handler({ input, init });
  }) as typeof fetch;
  return { calls, restore: () => { globalThis.fetch = original; } };
}

function baseEntry(overrides: Record<string, unknown> = {}) {
  return {
    record_sha256: "sha-abc123",
    metric_type: "waist_circumference_cm",
    value: 82,
    unit: "cm",
    effective_date: "2026-08-01",
    source: "coach_entered",
    note: "",
    ...overrides
  };
}

async function openPanel(entries: Record<string, unknown>[], extraHandlers: Record<string, () => Response> = {}) {
  const mock = installFetchMock(({ input, init }) => {
    const path = String(input);
    const method = init?.method ?? "GET";

    if (path === "/account/detail" && method === "GET") {
      return jsonResponse({ csrf_token: "csrf-body-metrics" });
    }
    if (path.startsWith("/body-metrics/coach/") && method === "GET") {
      return jsonResponse({ entries });
    }

    const key = `${method} ${path}`;
    if (extraHandlers[key]) return extraHandlers[key]();
    return jsonResponse({ error: `unhandled_request_${key}` }, false, 404);
  });

  render(<AthleteBodyMetricsPanel />);

  act(() => {
    document.dispatchEvent(
      new CustomEvent("kolosseum:coach-athlete-profile-opened", {
        detail: { athlete_user_id: "athlete_test123" }
      })
    );
  });

  await waitFor(() => screen.getByText("Log measurement"));
  return mock;
}

test.afterEach(() => {
  cleanup();
});

test("renders nothing until the coach opens an athlete's profile", () => {
  installFetchMock(() => jsonResponse({}, false, 404));
  render(<AthleteBodyMetricsPanel />);
  assert.equal(document.body.textContent, "");
});

test("displays history entries with the correct source badge for coach, athlete and device sources", async () => {
  await openPanel([
    baseEntry({ record_sha256: "sha-1", source: "coach_entered", note: "Measured at check-in" }),
    baseEntry({ record_sha256: "sha-2", source: "athlete_entered", metric_type: "hip_circumference_cm", value: 95, unit: "cm" }),
    baseEntry({ record_sha256: "sha-3", source: "device_synced", metric_type: "body_fat_percentage", value: 18, unit: "percent" })
  ]);

  await waitFor(() => screen.getByText("Coach"));

  assert.match(document.body.textContent ?? "", /Waist: 82 cm/u);
  assert.match(document.body.textContent ?? "", /Measured at check-in/u);
  assert.match(document.body.textContent ?? "", /Athlete/u);
  assert.match(document.body.textContent ?? "", /Hip: 95 cm/u);
  assert.match(document.body.textContent ?? "", /Device/u);
  assert.match(document.body.textContent ?? "", /Body fat: 18%/u);
});

test("logs a new measurement and posts it with the CSRF header, prepending it to the history", async () => {
  const mock = await openPanel([], {
    "POST /body-metrics/coach/athlete_test123": () =>
      jsonResponse({
        entry: baseEntry({
          record_sha256: "sha-new",
          metric_type: "chest_circumference_cm",
          value: 101,
          unit: "cm",
          effective_date: "2026-08-20",
          source: "coach_entered"
        })
      })
  });

  fireEvent.change(screen.getByLabelText("Measurement"), { target: { value: "chest_circumference_cm" } });
  fireEvent.change(screen.getByLabelText("Value"), { target: { value: "101" } });
  fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-08-20" } });

  await act(async () => {
    fireEvent.submit(screen.getByText("Log measurement").closest("form")!);
  });

  await waitFor(() => screen.getByText("Body-metric entry logged."));

  const saveCall = mock.calls.find(
    (call) => String(call.input) === "/body-metrics/coach/athlete_test123" && call.init?.method === "POST"
  );
  assert.ok(saveCall, "expected a POST /body-metrics/coach/:id request");
  assert.equal((saveCall!.init?.headers as Record<string, string>)["x-kolosseum-csrf"], "csrf-body-metrics");
  const body = JSON.parse(String(saveCall!.init?.body));
  assert.equal(body.metric_type, "chest_circumference_cm");
  assert.equal(body.value, 101);
  assert.equal(body.effective_date, "2026-08-20");

  assert.match(document.body.textContent ?? "", /Chest: 101 cm/u);
});

test("shows a factual empty state when the athlete has no body-metric entries yet", async () => {
  await openPanel([]);
  await waitFor(() => screen.getByText("No body-metric entries yet."));
});

test("closing the profile clears the panel back to rendering nothing", async () => {
  await openPanel([baseEntry({ record_sha256: "sha-1" })]);
  await waitFor(() => screen.getByText(/Waist: 82 cm/u));

  act(() => {
    document.dispatchEvent(new CustomEvent("kolosseum:coach-athlete-profile-closed"));
  });

  await waitFor(() => assert.equal(screen.queryByText(/Waist: 82 cm/u), null));
});

test("a body-metric note containing markup is rendered as inert text, never as HTML", async () => {
  await openPanel([baseEntry({ record_sha256: "sha-1", note: '<img src=x onerror="window.pwned=true">' })]);

  await waitFor(() => screen.getByText(/Waist: 82 cm/u));

  assert.equal((globalThis as Record<string, unknown>).pwned, undefined);
  assert.equal(document.querySelectorAll("img").length, 0);
  assert.match(document.body.textContent ?? "", /<img src=x onerror="window\.pwned=true">/u);
});
