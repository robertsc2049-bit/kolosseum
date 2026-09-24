// DEV NOTE: coach_athlete_detail device-sync mirror behavioral proof -
// replaces the source-text regex checks
// test/full_ui_31_device_sync_surface.test.mjs previously ran against the
// now-removed app.js refreshCoachAthleteDeviceSync function and its
// viewerIsCoach flag for exactly this coach-side capability. The athlete's
// own connect/disconnect/history view stays legacy and is still covered
// there.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";

import { AthleteDeviceSyncPanel } from "../screens/coach/AthleteDeviceSyncPanel";

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

async function openPanel(connections: Record<string, unknown>[], entries: Record<string, unknown>[]) {
  installFetchMock(({ input }) => {
    const path = String(input);
    if (path.startsWith("/device-sync/connections/coach/")) return jsonResponse({ connections });
    if (path.startsWith("/device-sync/metrics/coach/")) return jsonResponse({ entries });
    return jsonResponse({ error: `unhandled_request_${path}` }, false, 404);
  });

  render(<AthleteDeviceSyncPanel />);

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
  render(<AthleteDeviceSyncPanel />);
  assert.equal(document.body.textContent, "");
});

test("displays a connected device and a synced metric entry", async () => {
  await openPanel(
    [
      {
        connection_id: "conn_1",
        provider: "garmin",
        connection_status: "active",
        updated_at_iso8601: "2026-08-01T00:00:00.000Z"
      }
    ],
    [
      {
        provider: "garmin",
        metric_type: "resting_heart_rate_bpm",
        value: 52,
        unit: "bpm",
        reported_at_iso8601: "2026-08-10T00:00:00.000Z"
      }
    ]
  );

  await waitFor(() => screen.getByText("Garmin"));

  assert.match(document.body.textContent ?? "", /Connected/u);
  assert.match(document.body.textContent ?? "", /Synced from Garmin/u);
  assert.match(document.body.textContent ?? "", /Resting heart rate: 52 bpm/u);
});

test("never renders a Disconnect control, even for an active connection", async () => {
  await openPanel(
    [{ connection_id: "conn_1", provider: "whoop", connection_status: "active", updated_at_iso8601: "2026-08-01T00:00:00.000Z" }],
    []
  );

  await waitFor(() => screen.getByText("Whoop"));

  assert.equal(document.querySelectorAll("button").length, 0);
  assert.equal(screen.queryByText("Disconnect"), null);
});

test("shows the factual empty states independently for connections and metrics", async () => {
  await openPanel([], []);
  await waitFor(() => screen.getByText("No connected devices yet."));
  assert.ok(screen.getByText("No synced metrics yet."));
});

test("closing the profile clears the panel back to rendering nothing", async () => {
  await openPanel(
    [{ connection_id: "conn_1", provider: "garmin", connection_status: "active", updated_at_iso8601: "2026-08-01T00:00:00.000Z" }],
    []
  );
  await waitFor(() => screen.getByText("Garmin"));

  act(() => {
    document.dispatchEvent(new CustomEvent("kolosseum:coach-athlete-profile-closed"));
  });

  await waitFor(() => assert.equal(screen.queryByText("Garmin"), null));
});
