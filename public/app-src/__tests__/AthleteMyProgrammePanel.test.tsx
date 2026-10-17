// "My programme": a powerlifter four weeks into a 12-week meet prep sees
// every block as one strip, this week's days side by side with the weights
// worked out from their maxes, done days ticked and the next one marked.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { AthleteMyProgrammePanel, doseLabel, restLabel } from "../screens/athlete/AthleteMyProgrammePanel";
import { overviewRows } from "../screens/athlete/ProgrammePrintSheet";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) } as Response;
}

const squat = { exercise_id: "back_squat", name: "Back squat", segment: "working", sets: 5, reps: "5", load: "115 kg", rest_seconds: 240, notes: "" };
const warmUp = { exercise_id: "leg_swing", name: "Leg swings", segment: "warm_up", sets: 1, reps: "10", load: "", rest_seconds: 0, notes: "Each leg." };
const day = (index: number, title: string, state: string) => ({ session_index: index, title, state, date: state === "done" ? "2026-10-12T09:00:00.000Z" : null, exercises: [warmUp, squat] });
const week = (number: number, first: number, states: string[]) => ({ week_number: number, sessions: states.map((state, i) => day(first + i, ["Squat day", "Bench day"][i] ?? `Day ${i + 1}`, state)) });

const meetPrep = {
  ok: true,
  status: "active",
  source: "coach",
  programme: { name: "Powerlifting meet prep", activity_id: "powerlifting", total_sessions: 6 },
  current: { session_index: 3, week_number: 2, block_name: "Intensification" },
  completed_sessions: 2,
  blocks: [
    { name: "Accumulation", block_type: "volume", weeks: [week(1, 0, ["done", "done"])] },
    { name: "Intensification", block_type: "strength", weeks: [week(2, 2, ["skipped", "current"]), week(3, 4, ["upcoming", "upcoming"])] }
  ]
};

function installMocks(body: unknown) {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    if (String(input) === "/account/onboarding/my-programme") return jsonResponse(body);
    return jsonResponse({ error: "unhandled" }, false, 404);
  }) as typeof fetch;
}

test.afterEach(() => cleanup());

test("opens on the athlete's current week with every block in one strip and the next session marked", async () => {
  installMocks(meetPrep);
  render(<AthleteMyProgrammePanel />);
  await screen.findByTestId("my-programme");
  assert.equal(document.querySelectorAll("[data-testid='my-programme-block']").length, 2);
  assert.ok(screen.getByText(/2 of 6 sessions done · Week 2 of 3 · Intensification/u));
  const current = document.querySelector(".my-programme-day.is-current");
  assert.ok(current?.textContent?.includes("Bench day"));
  assert.ok(current?.textContent?.includes("Next up"));
  assert.ok(current?.textContent?.includes("115 kg"));
  assert.ok(document.querySelector(".my-programme-day.is-skipped")?.textContent?.includes("Skipped"));
});

test("choosing an earlier week shows its done days ticked, and 'back to this week' returns", async () => {
  installMocks(meetPrep);
  render(<AthleteMyProgrammePanel />);
  await screen.findByTestId("my-programme");
  await act(async () => { fireEvent.click(screen.getByLabelText("Week 1")); });
  await waitFor(() => assert.equal(document.querySelectorAll(".my-programme-day.is-done").length, 2));
  assert.ok(document.querySelector(".my-programme-day.is-done")?.textContent?.includes("✓ Done"));
  await act(async () => { fireEvent.click(screen.getByText("Back to this week (week 2)")); });
  await waitFor(() => assert.ok(document.querySelector(".my-programme-day.is-current")));
});

test("warm-ups are folded away so the working sets lead", async () => {
  installMocks(meetPrep);
  render(<AthleteMyProgrammePanel />);
  await screen.findByTestId("my-programme");
  const folded = document.querySelector(".my-programme-day.is-current details.my-programme-bookend");
  assert.ok(folded?.querySelector("summary")?.textContent?.includes("Warm-up (1)"));
  assert.equal((folded as HTMLDetailsElement).open, false);
});

test("an athlete with no programme is told where it will come from", async () => {
  installMocks({ ok: true, status: "none" });
  render(<AthleteMyProgrammePanel />);
  await screen.findByText("No programme yet");
});

test("doses and rests read the way a lifter says them", () => {
  assert.equal(doseLabel({ name: "", segment: "working", sets: 5, reps: "5", load: "", rest_seconds: null }), "5 × 5");
  assert.equal(doseLabel({ name: "", segment: "working", sets: 1, reps: "400 m", load: "", rest_seconds: null }), "400 m");
  assert.equal(restLabel(240), "4:00 rest");
  assert.equal(restLabel(210), "3:30 rest");
  assert.equal(restLabel(75), "1:15 rest");
  assert.equal(restLabel(180), "3:00 rest");
  assert.equal(restLabel(0), "");
});

test("printing the whole programme puts every week on the paper sheet, then puts the app back", async () => {
  installMocks(meetPrep);
  let printed = 0;
  window.print = () => { printed += 1; };
  render(<AthleteMyProgrammePanel />);
  await screen.findByTestId("my-programme");
  await act(async () => { fireEvent.click(screen.getByText("Print whole programme")); });
  assert.equal(printed, 1);
  assert.ok(document.body.classList.contains("printing-programme"));
  const sheet = document.getElementById("programme-print-root");
  assert.equal(sheet?.parentElement, document.body, "the sheet sits outside the app so the app can be hidden when printing");
  assert.equal(sheet?.querySelectorAll(".print-week").length, 3);
  const squat = [...(sheet?.querySelectorAll(".print-week tr") ?? [])].find((row) => row.textContent?.includes("Back squat"));
  assert.ok(squat?.textContent?.includes("5 × 5") && squat.textContent.includes("115 kg") && squat.textContent.includes("4:00"));
  assert.equal(squat?.querySelectorAll(".print-box").length, 5, "a box to write in for each set");
  assert.ok(sheet?.textContent?.includes("Warm-up: Leg swings 10"), "the warm-up is on the sheet, on one line");
  await act(async () => { window.dispatchEvent(new window.Event("afterprint")); });
  assert.equal(document.body.classList.contains("printing-programme"), false);
  assert.equal(document.getElementById("programme-print-root")?.querySelectorAll(".print-week").length, 1, "back to the week on screen");
});

test("'Print this week' prints just the week on screen, with done sessions dated", async () => {
  installMocks(meetPrep);
  window.print = () => {};
  render(<AthleteMyProgrammePanel />);
  await screen.findByTestId("my-programme");
  await act(async () => { fireEvent.click(screen.getByLabelText("Week 1")); });
  await act(async () => { fireEvent.click(screen.getByText("Print this week")); });
  const sheet = document.getElementById("programme-print-root");
  assert.equal(sheet?.querySelectorAll(".print-week").length, 1);
  assert.ok(sheet?.textContent?.includes("Week 1 · Accumulation"));
  assert.match(sheet?.textContent ?? "", /✓ Done (12 Oct|Oct 12)/u);
  await act(async () => { window.dispatchEvent(new window.Event("afterprint")); });
});

test("the overview is one page of the whole programme: a row per training day, a column per week, the main lift's dose and load, trained days ticked", async () => {
  installMocks(meetPrep);
  window.print = () => {};
  render(<AthleteMyProgrammePanel />);
  await screen.findByTestId("my-programme");
  await act(async () => { fireEvent.click(screen.getByText("Print overview")); });
  const sheet = document.getElementById("programme-print-root");
  assert.equal(sheet?.querySelectorAll(".print-week").length, 0, "the overview alone - no week pages");
  const overview = sheet?.querySelector("[data-testid='print-overview']");
  assert.ok(overview?.textContent?.includes("3 weeks · 6 sessions · 2 done"));
  assert.deepEqual([...(overview?.querySelectorAll(".print-overview-blocks th[colspan]") ?? [])].map((th) => [th.textContent, th.getAttribute("colspan")]), [["AccumulationVolume", "1"], ["IntensificationStrength", "2"]]);
  const rows = [...(overview?.querySelectorAll("tbody tr") ?? [])];
  assert.deepEqual(rows.map((row) => row.querySelector("th")?.textContent), ["Squat dayBack squat", "Bench dayBack squat"]);
  const firstCell = rows[0].querySelectorAll("td")[0];
  assert.equal(firstCell.querySelector("b")?.textContent, "5×5");
  assert.equal(firstCell.querySelector("span")?.textContent, "115 kg");
  assert.equal(firstCell.querySelector("small"), null, "no percentage");
  assert.ok(firstCell.textContent?.includes("✓"), "week 1's Squat day was trained");
  assert.equal(rows[0].querySelectorAll("td")[2].textContent?.includes("✓"), false);
  await act(async () => { window.dispatchEvent(new window.Event("afterprint")); });
});

test("the whole programme prints the overview first, then every week", async () => {
  installMocks(meetPrep);
  window.print = () => {};
  render(<AthleteMyProgrammePanel />);
  await screen.findByTestId("my-programme");
  await act(async () => { fireEvent.click(screen.getByText("Print whole programme")); });
  const sheet = document.getElementById("programme-print-root");
  assert.deepEqual([...(sheet?.children ?? [])].map((child) => child.className), ["print-overview", "print-week", "print-week", "print-week"]);
  await act(async () => { window.dispatchEvent(new window.Event("afterprint")); });
});

test("overview rows are labelled by each day's usual title and main lift, so a one-off openers week doesn't rename the row", () => {
  const exercise = (name: string) => ({ name, segment: "working", sets: 3, reps: "3", load: "", rest_seconds: null });
  const session = (index: number, title: string, lift: string) => ({ session_index: index, title, state: "upcoming", date: null, exercises: [exercise(lift)] });
  const block = { name: "Block", block_type: "strength" };
  const rows = overviewRows([
    { week_number: 1, block, sessions: [session(0, "Squat day", "Back squat"), session(1, "Pull day", "Deadlift")] },
    { week_number: 2, block, sessions: [session(2, "Squat day", "Back squat"), session(3, "Pull day", "Deadlift")] },
    { week_number: 3, block, sessions: [session(4, "Openers", "Back squat")] }
  ]);
  assert.deepEqual(rows.map((row) => [row.title, row.lift, row.sessions.filter(Boolean).length]), [["Squat day", "Back squat", 3], ["Pull day", "Deadlift", 2]]);
});
