// DEV NOTE: athlete's own device sync behavioral proof - replaces the
// source-text regex checks against the now-removed app.js
// renderDeviceConnectionCard()/renderDeviceConnectionList()/
// renderDeviceMetricEntry()/renderDeviceMetricList()/refreshDeviceSync()/
// connectDeviceSync()/disconnectDeviceSync() rendering block.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { AthleteSelfDeviceSyncPanel } from "../screens/athlete/AthleteSelfDeviceSyncPanel";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return {
    ok,
    status,
    text: async () => JSON.stringify(body)
  } as Response;
}

function installMocks(options: {
  connections?: Record<string, unknown>[];
  metricEntries?: Record<string, unknown>[];
  connectFails?: boolean;
}) {
  const { connections = [], metricEntries = [], connectFails = false } = options;
  let currentConnections = connections;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const method = init?.method ?? "GET";
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: "athlete_1" }, csrf_token: "csrf-abc" });
    if (path.startsWith("/device-sync/connections")) return jsonResponse({ ok: true, connections: currentConnections });
    if (path.startsWith("/device-sync/metrics")) return jsonResponse({ ok: true, entries: metricEntries });
    if (path.startsWith("/device-sync/connect") && method === "POST") {
      if (connectFails) return jsonResponse({ error: "device_sync_invalid" }, false, 400);
      const body = JSON.parse(String(init?.body ?? "{}"));
      const record = { connection_id: `conn_${currentConnections.length + 1}`, provider: body.provider, connection_status: "active", updated_at_iso8601: "2026-01-05T10:00:00.000Z" };
      currentConnections = [...currentConnections, record];
      return jsonResponse({ ok: true, connection: record }, true, 201);
    }
    if (path.startsWith("/device-sync/disconnect") && method === "POST") {
      const body = JSON.parse(String(init?.body ?? "{}"));
      currentConnections = currentConnections.map((c) =>
        c.connection_id === body.connection_id ? { ...c, connection_status: "disconnected" } : c
      );
      return jsonResponse({ ok: true, connection: currentConnections.find((c) => c.connection_id === body.connection_id) });
    }
    return jsonResponse({ error: `unhandled_request_${path}` }, false, 404);
  }) as typeof fetch;
}

test.afterEach(() => {
  cleanup();
});

test("shows factual empty states when nothing is connected or synced", async () => {
  installMocks({});
  render(<AthleteSelfDeviceSyncPanel />);
  await waitFor(() => screen.getByText("No connected devices yet."));
  assert.ok(screen.getByText("No synced metrics yet."));
});

test("renders a connected device card with a working Disconnect button, and a disconnected one without it", async () => {
  installMocks({
    connections: [
      { connection_id: "conn_1", provider: "garmin", connection_status: "active", updated_at_iso8601: "2026-01-05T10:00:00.000Z" },
      { connection_id: "conn_2", provider: "whoop", connection_status: "disconnected", updated_at_iso8601: "2026-01-02T10:00:00.000Z" }
    ]
  });

  render(<AthleteSelfDeviceSyncPanel />);

  await waitFor(() => assert.equal(document.querySelectorAll(".record-card").length, 2));

  const cards = document.querySelectorAll(".record-card");
  assert.equal(cards[0].querySelector("strong")?.textContent, "Garmin");
  assert.ok(within(cards[0] as HTMLElement).queryByText("Disconnect"));
  assert.equal(cards[1].querySelector("strong")?.textContent, "Whoop");
  assert.equal(within(cards[1] as HTMLElement).queryByText("Disconnect"), null);
});

test("disconnecting a device calls the server and refreshes the list", async () => {
  installMocks({
    connections: [
      { connection_id: "conn_1", provider: "garmin", connection_status: "active", updated_at_iso8601: "2026-01-05T10:00:00.000Z" }
    ]
  });

  render(<AthleteSelfDeviceSyncPanel />);
  await waitFor(() => screen.getByText("Garmin"));

  const disconnectButton = screen.getByText("Disconnect");
  await act(async () => {
    disconnectButton.click();
  });

  await waitFor(() => {
    assert.equal(screen.queryByText("Disconnect"), null);
  });
});

test("renders a synced metric card with the resolved metric and provider labels", async () => {
  installMocks({
    metricEntries: [
      { metric_type: "resting_heart_rate_bpm", provider: "apple_health", value: 52, unit: "bpm", reported_at_iso8601: "2026-01-05T10:00:00.000Z" }
    ]
  });

  render(<AthleteSelfDeviceSyncPanel />);

  await waitFor(() => screen.getByText(/Synced from Apple Health/u));
  assert.ok(screen.getByText("Resting heart rate: 52 bpm"));
});

test("submitting the form with the default provider connects a device end to end", async () => {
  installMocks({ connections: [] });
  render(<AthleteSelfDeviceSyncPanel />);
  await waitFor(() => screen.getByText("No connected devices yet."));

  const form = document.querySelector("form") as HTMLFormElement;
  await act(async () => {
    fireEvent.submit(form);
  });

  await waitFor(() => assert.equal(document.querySelector(".record-card strong")?.textContent, "Apple Health"));
});

test("connecting a different provider sends that provider and shows it in the new card", async () => {
  installMocks({ connections: [] });
  render(<AthleteSelfDeviceSyncPanel />);
  await waitFor(() => screen.getByText("No connected devices yet."));

  const select = document.querySelector("select") as HTMLSelectElement;
  fireEvent.change(select, { target: { value: "whoop" } });

  const form = document.querySelector("form") as HTMLFormElement;
  await act(async () => {
    fireEvent.submit(form);
  });

  await waitFor(() => assert.equal(document.querySelector(".record-card strong")?.textContent, "Whoop"));
});

test("shows a submit error when the server rejects the connection", async () => {
  installMocks({ connections: [], connectFails: true });
  render(<AthleteSelfDeviceSyncPanel />);
  await waitFor(() => screen.getByText("No connected devices yet."));

  const form = document.querySelector("form") as HTMLFormElement;
  await act(async () => {
    fireEvent.submit(form);
  });

  await waitFor(() => screen.getByText("Device could not be connected."));
});

test("refetches when kolosseum:history-changed fires", async () => {
  installMocks({ connections: [] });
  render(<AthleteSelfDeviceSyncPanel />);
  await waitFor(() => screen.getByText("No connected devices yet."));

  installMocks({
    connections: [{ connection_id: "conn_1", provider: "garmin", connection_status: "active", updated_at_iso8601: "2026-01-05T10:00:00.000Z" }]
  });

  act(() => {
    document.dispatchEvent(new CustomEvent("kolosseum:history-changed"));
  });

  await waitFor(() => assert.equal(document.querySelector(".record-card strong")?.textContent, "Garmin"));
});
