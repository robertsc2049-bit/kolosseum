// "My training": an athlete without a coach builds one week - days, and the
// exercises with sets and reps on each - and their sessions follow it.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { MyTrainingCard } from "../screens/athlete/MyTrainingCard";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) } as Response;
}

const options = [{ exercise_id: "back_squat", label: "Back squat" }, { exercise_id: "bench_press", label: "Bench press" }, { exercise_id: "deadlift", label: "Deadlift" }];

function installMocks(initial: Record<string, unknown>) {
  const puts: Record<string, unknown>[] = [];
  let state = initial;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: "athlete_1" }, csrf_token: "csrf" });
    if (path === "/account/onboarding/training-week" && (init?.method ?? "GET") === "GET") return jsonResponse(state);
    if (path === "/account/onboarding/training-week" && init?.method === "PUT") {
      const body = typeof init.body === "string" ? JSON.parse(init.body) : {};
      puts.push(body);
      state = { ...state, week: { week_id: "training_week_1", ...body }, next: { day_number: 1, days_total: body.days.length, week_number: 1, lighter: false } };
      return jsonResponse(state);
    }
    return jsonResponse({ error: "unhandled" }, false, 404);
  }) as typeof fetch;
  return puts;
}

test.afterEach(() => cleanup());

test("a self-coached athlete builds a 2-day week - squat and bench, then deadlift - and sees what's next", async () => {
  const puts = installMocks({ week: null, next: null, exercise_options: options });
  render(<MyTrainingCard />);
  await screen.findByText("Build your training");
  fireEvent.click(screen.getByText("Build my training"));
  fireEvent.change(screen.getByLabelText("Training days a week"), { target: { value: "2" } });
  fireEvent.change(screen.getByLabelText("Day 1 exercise 1"), { target: { value: "back_squat" } });
  fireEvent.change(screen.getByLabelText("Day 1 exercise 1 reps"), { target: { value: "5" } });
  fireEvent.click(screen.getAllByText("Add exercise")[0]);
  fireEvent.change(screen.getByLabelText("Day 1 exercise 2"), { target: { value: "bench_press" } });
  fireEvent.change(screen.getByLabelText("Day 2 exercise 1"), { target: { value: "deadlift" } });
  fireEvent.change(screen.getByLabelText("Day 2 exercise 1 sets"), { target: { value: "1" } });
  fireEvent.change(screen.getByLabelText("Day 2 exercise 1 reps"), { target: { value: "5" } });
  await act(async () => {
    fireEvent.click(screen.getByText("Save my training"));
  });
  await waitFor(() => assert.equal(puts.length, 1));
  assert.deepEqual(puts[0], {
    days: [
      { items: [{ exercise_id: "back_squat", sets: 3, reps: 5 }, { exercise_id: "bench_press", sets: 3, reps: 8 }] },
      { items: [{ exercise_id: "deadlift", sets: 1, reps: 5 }] }
    ],
    lighter_every_fourth: true
  });
  await screen.findByText("Next: Day 1 of 2 · week 1");
  assert.ok(screen.getByText("Back squat 3x5 · Bench press 3x8"));
});

test("Cancel puts the saved week back", async () => {
  installMocks({
    week: { week_id: "w", days: [{ items: [{ exercise_id: "back_squat", sets: 3, reps: 5 }] }], lighter_every_fourth: false },
    next: { day_number: 1, days_total: 1, week_number: 3, lighter: false }, exercise_options: options
  });
  render(<MyTrainingCard />);
  await screen.findByText("Next: Day 1 of 1 · week 3");
  fireEvent.click(screen.getByText("Edit my training"));
  fireEvent.change(screen.getByLabelText("Training days a week"), { target: { value: "3" } });
  fireEvent.click(screen.getByText("Cancel"));
  assert.ok(screen.getByText("1 day a week"));
  assert.ok(screen.getByText("Back squat 3x5"));
  assert.equal(screen.queryByText("Day 3"), null);
});
