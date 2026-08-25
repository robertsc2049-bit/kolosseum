// DEV NOTE: athlete's own nutrition logging behavioral proof - replaces
// the source-text regex checks against the now-removed app.js
// logNutritionEntry()/groupNutritionEntriesByDate()/
// renderNutritionDayCard()/renderNutritionSummary()/refreshBodyMetrics()
// rendering block.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { AthleteSelfNutritionPanel } from "../screens/athlete/AthleteSelfNutritionPanel";

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
  let postCount = 0;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const method = init?.method ?? "GET";
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: "athlete_1" }, csrf_token: "csrf-abc" });
    if (path.startsWith("/body-metrics") && method === "GET") return jsonResponse({ ok: true, entries: currentEntries });
    if (path.startsWith("/body-metrics") && method === "POST") {
      postCount += 1;
      if (logFails) return jsonResponse({ error: "body_metrics_invalid" }, false, 400);
      const body = JSON.parse(String(init?.body ?? "{}"));
      const record = { record_sha256: `metric_${postCount}`, source: "athlete_reported", unit: "count", ...body };
      currentEntries = [record, ...currentEntries];
      return jsonResponse({ ok: true, entry: record }, true, 201);
    }
    return jsonResponse({ error: `unhandled_request_${path}` }, false, 404);
  }) as typeof fetch;

  return { postCount: () => postCount };
}

test.afterEach(() => {
  cleanup();
});

test("shows a factual empty state when no nutrition entries are logged", async () => {
  installMocks({});
  render(<AthleteSelfNutritionPanel />);
  await waitFor(() => screen.getByText("No nutrition entries yet."));
});

test("groups entries by date into a single day card with macro labels and units", async () => {
  installMocks({
    entries: [
      { record_sha256: "m1", metric_type: "calories_kcal", value: 2200, effective_date: "2026-08-20" },
      { record_sha256: "m2", metric_type: "protein_g", value: 180, effective_date: "2026-08-20" }
    ]
  });

  render(<AthleteSelfNutritionPanel />);
  await waitFor(() => screen.getByText(/Calories 2200 kcal/u));

  assert.equal(document.querySelectorAll(".record-card").length, 1);
  assert.match(document.querySelector(".record-card p")?.textContent ?? "", /Calories 2200 kcal · Protein 180g/u);
});

test("excludes non-macro body-metric entries from the nutrition summary", async () => {
  installMocks({
    entries: [
      { record_sha256: "m1", metric_type: "waist_circumference_cm", value: 82, effective_date: "2026-08-20" }
    ]
  });

  render(<AthleteSelfNutritionPanel />);
  await waitFor(() => screen.getByText("No nutrition entries yet."));
  assert.equal(document.querySelectorAll(".record-card").length, 0);
});

test("blocks submission client-side when date or every macro is missing", async () => {
  installMocks({});
  render(<AthleteSelfNutritionPanel />);
  await waitFor(() => screen.getByText("No nutrition entries yet."));

  const form = document.querySelector("form") as HTMLFormElement;
  fireEvent.submit(form);

  await waitFor(() => screen.getByText("Enter a date and at least one macro."));
});

test("logs one POST per non-empty macro field, then resets the form and shows the new entry", async () => {
  const mocks = installMocks({});
  render(<AthleteSelfNutritionPanel />);
  await waitFor(() => screen.getByText("No nutrition entries yet."));

  const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
  const numberInputs = document.querySelectorAll('input[type="number"]');
  fireEvent.change(dateInput, { target: { value: "2026-08-20" } });
  fireEvent.change(numberInputs[0], { target: { value: "2200" } });
  fireEvent.change(numberInputs[1], { target: { value: "180" } });

  const form = document.querySelector("form") as HTMLFormElement;
  fireEvent.submit(form);

  await waitFor(() => screen.getByText(/Calories 2200 kcal/u));
  assert.equal(mocks.postCount(), 2);
  assert.equal(dateInput.value, "");
  assert.equal((numberInputs[0] as HTMLInputElement).value, "");
});

test("shows a submit error when the server rejects the entry", async () => {
  installMocks({ logFails: true });
  render(<AthleteSelfNutritionPanel />);
  await waitFor(() => screen.getByText("No nutrition entries yet."));

  const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
  const numberInputs = document.querySelectorAll('input[type="number"]');
  fireEvent.change(dateInput, { target: { value: "2026-08-20" } });
  fireEvent.change(numberInputs[0], { target: { value: "2200" } });

  const form = document.querySelector("form") as HTMLFormElement;
  fireEvent.submit(form);

  await waitFor(() => screen.getByText("Nutrition could not be logged."));
});

test("refetches when kolosseum:history-changed fires", async () => {
  installMocks({});
  render(<AthleteSelfNutritionPanel />);
  await waitFor(() => screen.getByText("No nutrition entries yet."));

  installMocks({
    entries: [{ record_sha256: "m1", metric_type: "calories_kcal", value: 2200, effective_date: "2026-08-20" }]
  });

  document.dispatchEvent(new CustomEvent("kolosseum:history-changed"));

  await waitFor(() => screen.getByText(/Calories 2200 kcal/u));
});
