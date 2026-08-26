// DEV NOTE: athlete's own habit tracking behavioral proof - replaces the
// source-text regex checks against the now-removed app.js
// renderHabitCard()/renderHabitList()/refreshHabits()/createHabit()/
// logHabitCompletionToday()/archiveHabit() rendering block.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { AthleteSelfHabitsPanel } from "../screens/athlete/AthleteSelfHabitsPanel";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return {
    ok,
    status,
    text: async () => JSON.stringify(body)
  } as Response;
}

function installMocks(options: { habits?: Record<string, unknown>[]; createFails?: boolean }) {
  const { habits = [], createFails = false } = options;
  let currentHabits = habits;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const method = init?.method ?? "GET";
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: "athlete_1" }, csrf_token: "csrf-abc" });
    if (path.startsWith("/habits") && method === "GET") return jsonResponse({ ok: true, habits: currentHabits });
    if (path.match(/\/habits\/.+\/completions$/u) && method === "POST") {
      const habitId = path.split("/")[2];
      currentHabits = currentHabits.map((h) =>
        h.habit_id === habitId
          ? { ...h, current_streak_length: Number(h.current_streak_length ?? 0) + 1, total_completions: Number(h.total_completions ?? 0) + 1 }
          : h
      );
      return jsonResponse({ ok: true, completion: { completion_id: "c1" } }, true, 201);
    }
    if (path.match(/\/habits\/.+\/archive$/u) && method === "POST") {
      const habitId = path.split("/")[2];
      currentHabits = currentHabits.map((h) => (h.habit_id === habitId ? { ...h, archived_at_iso8601: "2026-08-26T00:00:00.000Z" } : h));
      return jsonResponse({ ok: true, habit: currentHabits.find((h) => h.habit_id === habitId) });
    }
    if (path.startsWith("/habits") && method === "POST") {
      if (createFails) return jsonResponse({ error: "habit_invalid" }, false, 400);
      const body = JSON.parse(String(init?.body ?? "{}"));
      const record = {
        habit_id: `habit_${currentHabits.length + 1}`,
        current_streak_length: 0,
        longest_streak_length: 0,
        total_completions: 0,
        archived_at_iso8601: null,
        ...body
      };
      currentHabits = [...currentHabits, record];
      return jsonResponse({ ok: true, habit: record }, true, 201);
    }
    return jsonResponse({ error: `unhandled_request_${path}` }, false, 404);
  }) as typeof fetch;
}

test.afterEach(() => {
  cleanup();
});

test("shows a factual empty state when no habits are tracked", async () => {
  installMocks({});
  render(<AthleteSelfHabitsPanel />);
  await waitFor(() => screen.getByText("No habits yet."));
});

test("renders a habit card with cadence badge and plain-integer streak copy", async () => {
  installMocks({
    habits: [
      { habit_id: "habit_1", habit_label: "Stretch", cadence: "daily", current_streak_length: 3, longest_streak_length: 5, total_completions: 12, archived_at_iso8601: null }
    ]
  });

  render(<AthleteSelfHabitsPanel />);
  await waitFor(() => screen.getByText("Stretch"));

  const card = document.querySelector(".record-card") as HTMLElement;
  assert.equal(card.querySelector(".badge")?.textContent, "Daily");
  assert.match(card.querySelector("p")?.textContent ?? "", /3 days logged in a row - longest 5, 12 total\./u);
  assert.doesNotMatch(card.textContent ?? "", /%|adherence|readiness/iu);
});

test("uses singular 'day' only when the current streak is exactly 1", async () => {
  installMocks({
    habits: [
      { habit_id: "habit_1", habit_label: "Stretch", cadence: "daily", current_streak_length: 1, longest_streak_length: 1, total_completions: 1, archived_at_iso8601: null }
    ]
  });

  render(<AthleteSelfHabitsPanel />);
  await waitFor(() => screen.getByText(/1 day logged in a row/u));
});

test("archived habits show an Archived tag and no action buttons", async () => {
  installMocks({
    habits: [
      { habit_id: "habit_1", habit_label: "Old habit", cadence: "weekly", current_streak_length: 0, longest_streak_length: 4, total_completions: 9, archived_at_iso8601: "2026-08-01T00:00:00.000Z" }
    ]
  });

  render(<AthleteSelfHabitsPanel />);
  await waitFor(() => screen.getByText("Old habit"));

  assert.ok(screen.getByText("Archived"));
  assert.equal(document.querySelectorAll(".record-card button").length, 0);
});

test("blocks submission client-side when the habit label is empty", async () => {
  installMocks({});
  render(<AthleteSelfHabitsPanel />);
  await waitFor(() => screen.getByText("No habits yet."));

  const form = document.querySelector("form") as HTMLFormElement;
  fireEvent.submit(form);

  await waitFor(() => screen.getByText("Enter a habit."));
});

test("creates a habit with the chosen cadence, then resets the form and shows the new entry", async () => {
  installMocks({});
  render(<AthleteSelfHabitsPanel />);
  await waitFor(() => screen.getByText("No habits yet."));

  const labelInput = document.querySelector('input[type="text"]') as HTMLInputElement;
  const cadenceSelect = document.querySelector("select") as HTMLSelectElement;
  fireEvent.change(labelInput, { target: { value: "Stretch" } });
  fireEvent.change(cadenceSelect, { target: { value: "weekly" } });

  const form = document.querySelector("form") as HTMLFormElement;
  fireEvent.submit(form);

  await waitFor(() => screen.getByText("Stretch"));
  assert.equal(labelInput.value, "");
  assert.equal(document.querySelector(".record-card .badge")?.textContent, "Weekly");
});

test("shows a submit error when the server rejects the habit", async () => {
  installMocks({ createFails: true });
  render(<AthleteSelfHabitsPanel />);
  await waitFor(() => screen.getByText("No habits yet."));

  const labelInput = document.querySelector('input[type="text"]') as HTMLInputElement;
  fireEvent.change(labelInput, { target: { value: "Stretch" } });

  const form = document.querySelector("form") as HTMLFormElement;
  fireEvent.submit(form);

  await waitFor(() => screen.getByText("Habit could not be created."));
});

test("marking a habit done today calls the server and increments the streak", async () => {
  installMocks({
    habits: [
      { habit_id: "habit_1", habit_label: "Stretch", cadence: "daily", current_streak_length: 2, longest_streak_length: 2, total_completions: 2, archived_at_iso8601: null }
    ]
  });

  render(<AthleteSelfHabitsPanel />);
  await waitFor(() => screen.getByText("Stretch"));

  const completeButton = screen.getByText("Mark done today");
  completeButton.click();

  await waitFor(() => screen.getByText(/3 days logged in a row/u));
});

test("archiving a habit calls the server and removes the action buttons", async () => {
  installMocks({
    habits: [
      { habit_id: "habit_1", habit_label: "Stretch", cadence: "daily", current_streak_length: 2, longest_streak_length: 2, total_completions: 2, archived_at_iso8601: null }
    ]
  });

  render(<AthleteSelfHabitsPanel />);
  await waitFor(() => screen.getByText("Stretch"));

  const archiveButton = screen.getByText("Archive");
  archiveButton.click();

  await waitFor(() => {
    assert.ok(document.querySelector(".record-card"));
    assert.equal(document.querySelectorAll(".record-card button").length, 0);
  });
  assert.ok(screen.getByText("Archived"));
});

test("a habit label containing markup renders as inert text, never as HTML", async () => {
  installMocks({
    habits: [
      { habit_id: "habit_1", habit_label: '<img src=x onerror="window.pwned=true">', cadence: "daily", current_streak_length: 0, longest_streak_length: 0, total_completions: 0, archived_at_iso8601: null }
    ]
  });

  render(<AthleteSelfHabitsPanel />);

  await waitFor(() => screen.getByText(/img src=x/iu));
  assert.equal((globalThis as Record<string, unknown>).pwned, undefined);
  assert.equal(document.querySelectorAll("img").length, 0);
});

test("refetches when kolosseum:history-changed fires", async () => {
  installMocks({});
  render(<AthleteSelfHabitsPanel />);
  await waitFor(() => screen.getByText("No habits yet."));

  installMocks({
    habits: [
      { habit_id: "habit_1", habit_label: "Stretch", cadence: "daily", current_streak_length: 0, longest_streak_length: 0, total_completions: 0, archived_at_iso8601: null }
    ]
  });

  document.dispatchEvent(new CustomEvent("kolosseum:history-changed"));

  await waitFor(() => screen.getByText("Stretch"));
});
