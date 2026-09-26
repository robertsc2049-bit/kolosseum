import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ProgrammeExercisesCard } from "../screens/athlete/ProgrammeExercisesCard";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) } as Response;
}

const rx = (sets: number, reps: number, intensity: Record<string, unknown>) => ({ sets, reps, intensity, rest_seconds: 120 });

// A powerlifter's squat day: the squat and paused bench are named; the rest are hers to choose.
const ALL_EXERCISES = [
  { exercise_id: "back_squat", display_name: "Back squat" }, { exercise_id: "barbell_row", display_name: "Barbell row" },
  { exercise_id: "bench_press", display_name: "Bench press" }, { exercise_id: "front_squat", display_name: "Front squat" },
  { exercise_id: "goblet_squat", display_name: "Goblet squat" }, { exercise_id: "leg_press", display_name: "Leg press" },
  { exercise_id: "paused_back_squat", display_name: "Paused back squat" }, { exercise_id: "seated_cable_row", display_name: "Seated cable row" }
];

function programme(selections: Record<string, string> = {}, notes: Record<string, string> = {}) {
  const slots = [
    { slot_id: "squat.squat_1", movement_pattern_id: "squat", explosive: false, prescription: rx(3, 3, { type: "percent_1rm", value: 68 }), options: [{ exercise_id: "back_squat", display_name: "Back squat" }, { exercise_id: "paused_back_squat", display_name: "Paused back squat" }, { exercise_id: "front_squat", display_name: "Front squat" }, { exercise_id: "goblet_squat", display_name: "Goblet squat" }] },
    { slot_id: "squat.horizontal_pull_1", movement_pattern_id: "horizontal_pull", explosive: false, prescription: rx(3, 8, { type: "rpe", value: 8 }), options: [{ exercise_id: "barbell_row", display_name: "Barbell row" }, { exercise_id: "seated_cable_row", display_name: "Seated cable row" }] }
  ];
  const missing = slots.map((s) => s.slot_id).filter((id) => !selections[id]);
  return {
    status: "ok",
    days: [{
      day_id: "squat", focus: "squat_day",
      items: [
        { kind: "fixed", exercise_id: "back_squat", display_name: "Back squat", prescription: rx(5, 3, { type: "percent_1rm", value: 80 }) },
        { kind: "fixed", exercise_id: "paused_bench_press", display_name: "Paused bench press", prescription: rx(4, 4, { type: "percent_1rm", value: 72 }) },
        ...slots.map((s) => ({ kind: "slot", ...s, selected_exercise_id: selections[s.slot_id] ?? null, selected_fit_note: notes[s.slot_id] ?? null }))
      ]
    }],
    selections,
    open_slot_count: slots.length,
    missing_slot_ids: missing,
    complete: missing.length === 0,
    all_exercises: ALL_EXERCISES
  };
}

function installMocks(options: { initial?: Record<string, unknown>; onSave?: (body: Record<string, unknown>) => Response }) {
  const saves: Record<string, unknown>[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const method = init?.method ?? "GET";
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: "athlete_1" }, csrf_token: "csrf" });
    if (path === "/account/onboarding/exercises" && method === "GET") return jsonResponse(options.initial ?? programme());
    if (path === "/account/onboarding/exercises" && method === "PUT") {
      const body = JSON.parse(String(init?.body ?? "{}"));
      saves.push(body);
      return options.onSave ? options.onSave(body) : jsonResponse(programme(body.selections));
    }
    return jsonResponse({ error: `unhandled_${path}` }, false, 404);
  }) as typeof fetch;
  return saves;
}

test.afterEach(() => cleanup());

test("nothing is chosen for the athlete: the lifts the programme names are shown, and every other slot starts empty", async () => {
  installMocks({});
  render(<ProgrammeExercisesCard />);
  await screen.findByText("0 of 2 exercises chosen");
  assert.ok(screen.getByText("Choose an exercise for every open slot before your next session."));
  await act(async () => {
    fireEvent.click(screen.getByText("Choose exercises"));
  });
  assert.ok(screen.getByText("Back squat", { selector: "strong" }));
  assert.ok(screen.getByText("Paused bench press"));
  assert.equal(screen.getAllByText("Named in your programme").length, 2);
  const selects = Array.from(document.querySelectorAll("select")) as HTMLSelectElement[];
  assert.equal(selects.length, 2);
  assert.ok(selects.every((select) => select.value === ""), "no slot is pre-filled");
  assert.ok(screen.getByText("Squat · 3 × 3 @ 68%"));
});

test("the athlete's choices are saved and the prompt clears once every slot is chosen", async () => {
  const saves = installMocks({});
  render(<ProgrammeExercisesCard />);
  await screen.findByText("0 of 2 exercises chosen");
  await act(async () => {
    fireEvent.click(screen.getByText("Choose exercises"));
  });
  fireEvent.change(screen.getByLabelText("Squat Day: Squat"), { target: { value: "front_squat" } });
  fireEvent.change(screen.getByLabelText("Squat Day: Horizontal Pull"), { target: { value: "seated_cable_row" } });
  await act(async () => {
    fireEvent.click(screen.getByText("Save exercises"));
  });
  await waitFor(() => assert.equal(saves.length, 1));
  assert.deepEqual(saves[0], { selections: { "squat.squat_1": "front_squat", "squat.horizontal_pull_1": "seated_cable_row" } });
  await screen.findByText("2 of 2 exercises chosen");
  assert.equal(screen.queryByText("Choose an exercise for every open slot before your next session."), null);
  assert.ok(screen.getByText("Change exercises"));
});

test("an exercise already in that session cannot be chosen twice", async () => {
  installMocks({ initial: programme({ "squat.squat_1": "front_squat" }) });
  render(<ProgrammeExercisesCard />);
  await screen.findByText("1 of 2 exercises chosen");
  await act(async () => {
    fireEvent.click(screen.getByText("Change exercises"));
  });
  const squat = screen.getByLabelText("Squat Day: Squat") as HTMLSelectElement;
  assert.equal(squat.value, "front_squat", "a saved choice is shown");
  const option = (value: string) => Array.from(squat.options).find((o) => o.value === value) as HTMLOptionElement;
  assert.equal(option("back_squat").disabled, true, "the day's named back squat cannot be chosen again");
  assert.equal(option("paused_back_squat").disabled, false);
});

test("nothing is locked out: an exercise outside the recommendations can be chosen, and says why it is not recommended", async () => {
  const saves = installMocks({
    onSave: (body) => jsonResponse(programme(body.selections as Record<string, string>, { "squat.squat_1": "Trains a different movement from this slot." }))
  });
  render(<ProgrammeExercisesCard />);
  await screen.findByText("0 of 2 exercises chosen");
  await act(async () => {
    fireEvent.click(screen.getByText("Choose exercises"));
  });
  const squat = screen.getByLabelText("Squat Day: Squat") as HTMLSelectElement;
  const groups = Array.from(squat.querySelectorAll("optgroup")).map((g) => [g.label, Array.from(g.querySelectorAll("option")).map((o) => o.value)]);
  assert.deepEqual(groups, [
    ["Recommended", ["back_squat", "paused_back_squat", "front_squat", "goblet_squat"]],
    ["All other exercises", ["barbell_row", "bench_press", "leg_press", "seated_cable_row"]]
  ]);
  fireEvent.change(squat, { target: { value: "leg_press" } });
  assert.ok(screen.getByText("Not one of the recommended exercises for this slot."));
  fireEvent.change(screen.getByLabelText("Squat Day: Horizontal Pull"), { target: { value: "seated_cable_row" } });
  await act(async () => {
    fireEvent.click(screen.getByText("Save exercises"));
  });
  await waitFor(() => assert.equal(saves.length, 1));
  assert.deepEqual(saves[0], { selections: { "squat.squat_1": "leg_press", "squat.horizontal_pull_1": "seated_cable_row" } });
  await screen.findByText("2 of 2 exercises chosen");
  await act(async () => {
    fireEvent.click(screen.getByText("Change exercises"));
  });
  assert.ok(screen.getByText("Trains a different movement from this slot."), "the saved choice carries the programme's reason");
});

test("a choice the server refuses is shown on its slot", async () => {
  installMocks({ onSave: () => jsonResponse({ error: "athlete_onboarding_validation_failed", field_errors: { "squat.squat_1": "Choose an exercise from the list." } }, false, 422) });
  render(<ProgrammeExercisesCard />);
  await screen.findByText("0 of 2 exercises chosen");
  await act(async () => {
    fireEvent.click(screen.getByText("Choose exercises"));
  });
  fireEvent.change(screen.getByLabelText("Squat Day: Squat"), { target: { value: "goblet_squat" } });
  await act(async () => {
    fireEvent.click(screen.getByText("Save exercises"));
  });
  await screen.findByText("Choose an exercise from the list.");
  assert.ok(screen.getByText("Some choices could not be saved - check the highlighted slots."));
});

test("no card when the programme has nothing to choose, or before a sport is declared", async () => {
  installMocks({ initial: { status: "no_programme", days: [], selections: {}, open_slot_count: 0, missing_slot_ids: [], complete: false } });
  render(<ProgrammeExercisesCard />);
  await waitFor(() => assert.equal(screen.queryByText(/Loading your programme exercises/), null));
  assert.equal(screen.queryByTestId("programme-exercises"), null);
});
