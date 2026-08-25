// DEV NOTE: athlete's own body-measurement logging behavioral proof -
// replaces the source-text regex checks against the now-removed app.js
// renderBodyMetricEntry()/renderBodyMetricList()/logBodyMetricEntry()
// rendering block.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { AthleteSelfBodyMetricsPanel } from "../screens/athlete/AthleteSelfBodyMetricsPanel";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return {
    ok,
    status,
    text: async () => JSON.stringify(body)
  } as Response;
}

function installMocks(options: { entries?: Record<string, unknown>[]; logFails?: boolean }) {
  const { entries = [], logFails = false } = options;
  let currentEntries = entries;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const method = init?.method ?? "GET";
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: "athlete_1" }, csrf_token: "csrf-abc" });
    if (path.startsWith("/body-metrics") && method === "GET") return jsonResponse({ ok: true, entries: currentEntries });
    if (path.startsWith("/body-metrics") && method === "POST") {
      if (logFails) return jsonResponse({ error: "body_metrics_invalid" }, false, 400);
      const body = JSON.parse(String(init?.body ?? "{}"));
      const record = {
        record_sha256: `metric_${currentEntries.length + 1}`,
        source: "athlete_reported",
        unit: body.metric_type === "body_fat_percentage" ? "percent" : "cm",
        ...body
      };
      currentEntries = [record, ...currentEntries];
      return jsonResponse({ ok: true, entry: record }, true, 201);
    }
    return jsonResponse({ error: `unhandled_request_${path}` }, false, 404);
  }) as typeof fetch;
}

test.afterEach(() => {
  cleanup();
});

test("shows a factual empty state when no body-metric entries are logged", async () => {
  installMocks({});
  render(<AthleteSelfBodyMetricsPanel />);
  await waitFor(() => screen.getByText("No body-metric entries yet."));
});

test("renders a logged entry with its source badge, label and unit", async () => {
  installMocks({
    entries: [
      { record_sha256: "m1", source: "athlete_reported", metric_type: "waist_circumference_cm", unit: "cm", value: 82, effective_date: "2026-08-20", note: "Morning measurement" }
    ]
  });

  render(<AthleteSelfBodyMetricsPanel />);
  await waitFor(() => screen.getByText("Morning measurement"));

  const card = document.querySelector(".record-card") as HTMLElement;
  assert.match(card.querySelector("strong")?.textContent ?? "", /Waist: 82 cm/u);
  assert.equal(card.querySelector(".badge")?.textContent, "You");
});

test("excludes nutrition-flavored entries from the body-metric list", async () => {
  installMocks({
    entries: [
      { record_sha256: "m1", source: "athlete_reported", metric_type: "calories_kcal", unit: "kcal", value: 2200, effective_date: "2026-08-20" }
    ]
  });

  render(<AthleteSelfBodyMetricsPanel />);
  await waitFor(() => screen.getByText("No body-metric entries yet."));
  assert.equal(document.querySelectorAll(".record-card").length, 0);
});

test("blocks submission client-side when value or date is missing", async () => {
  installMocks({});
  render(<AthleteSelfBodyMetricsPanel />);
  await waitFor(() => screen.getByText("No body-metric entries yet."));

  const form = document.querySelector("form") as HTMLFormElement;
  fireEvent.submit(form);

  await waitFor(() => screen.getByText("Choose a measurement, value and date."));
});

test("logs a measurement, then resets the form and shows the new entry", async () => {
  installMocks({});
  render(<AthleteSelfBodyMetricsPanel />);
  await waitFor(() => screen.getByText("No body-metric entries yet."));

  const valueInput = document.querySelector('input[type="number"]') as HTMLInputElement;
  const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
  fireEvent.change(valueInput, { target: { value: "82" } });
  fireEvent.change(dateInput, { target: { value: "2026-08-20" } });

  const form = document.querySelector("form") as HTMLFormElement;
  fireEvent.submit(form);

  await waitFor(() => screen.getByText(/Waist: 82 cm/u));
  assert.equal(valueInput.value, "");
  assert.equal(dateInput.value, "");
});

test("shows a submit error when the server rejects the entry", async () => {
  installMocks({ logFails: true });
  render(<AthleteSelfBodyMetricsPanel />);
  await waitFor(() => screen.getByText("No body-metric entries yet."));

  const valueInput = document.querySelector('input[type="number"]') as HTMLInputElement;
  const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
  fireEvent.change(valueInput, { target: { value: "82" } });
  fireEvent.change(dateInput, { target: { value: "2026-08-20" } });

  const form = document.querySelector("form") as HTMLFormElement;
  fireEvent.submit(form);

  await waitFor(() => screen.getByText("Measurement could not be logged."));
});

test("a note containing markup renders as inert text, never as HTML", async () => {
  installMocks({
    entries: [
      { record_sha256: "m1", source: "athlete_reported", metric_type: "waist_circumference_cm", unit: "cm", value: 82, effective_date: "2026-08-20", note: '<img src=x onerror="window.pwned=true">' }
    ]
  });

  render(<AthleteSelfBodyMetricsPanel />);

  await waitFor(() => screen.getByText(/img src=x/iu));
  assert.equal((globalThis as Record<string, unknown>).pwned, undefined);
  assert.equal(document.querySelectorAll("img").length, 0);
});

test("refetches when kolosseum:history-changed fires", async () => {
  installMocks({});
  render(<AthleteSelfBodyMetricsPanel />);
  await waitFor(() => screen.getByText("No body-metric entries yet."));

  installMocks({
    entries: [
      { record_sha256: "m1", source: "athlete_reported", metric_type: "waist_circumference_cm", unit: "cm", value: 82, effective_date: "2026-08-20" }
    ]
  });

  document.dispatchEvent(new CustomEvent("kolosseum:history-changed"));

  await waitFor(() => screen.getByText(/Waist: 82 cm/u));
});
